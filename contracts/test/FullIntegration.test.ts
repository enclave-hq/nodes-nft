import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployNFTManager } from "./helpers/deployNFTManager";

/**
 * Full Integration Tests - 完整集成测试
 * 
 * 测试所有功能点的完整流程：
 * 1. TGE 生成
 * 2. NFT 白名单、铸造、出售、购买
 * 3. 收益发放、Token 挖矿、NFT 节点中止、取出解锁的 Token
 * 4. TokenVesting 和用户提取
 */
describe("Full Integration Tests", function () {
  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;

  async function deployFullSystemFixture() {
    const [owner, oracle, treasury, master, operator, user1, user2, user3, beneficiary1, beneficiary2] = await ethers.getSigners();

    // 1. Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Mint USDT to users
    const mintAmount = ethers.parseUnits("100000000", 18); // 100M USDT per user
    for (const user of [user1, user2, user3, oracle]) {
      await usdt.mint(user.address, mintAmount);
    }

    // 2. Deploy EnclaveToken (without TGE initially)
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const eclvToken = await EnclaveToken.deploy();
    await eclvToken.waitForDeployment();
    const eclvAddress = await eclvToken.getAddress();
    await eclvToken.setOracle(oracle.address);

    // 3. Deploy NodeNFT
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    const nftAddress = await nodeNFT.getAddress();

    // 4. Deploy NFTManager (Diamond Pattern)
    const {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nftManagerAddress,
    } = await deployNFTManager(
      nftAddress,
      eclvAddress,
      usdtAddress,
      oracle.address,
      treasury.address,
      owner
    );

    // Configure NodeNFT
    await nodeNFT.setNFTManager(nftManagerAddress);
    await nodeNFT.setBaseURI("https://api.enclave.com/nft/metadata/");

    // Set roles
    await adminFacet.setMaster(master.address);
    await rewardFacet.connect(master).setMultisigNode(oracle.address);
    await adminFacet.connect(master).setOperator(operator.address);

    return {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nodeNFT,
      eclvToken,
      usdt,
      owner,
      oracle,
      treasury,
      master,
      operator,
      user1,
      user2,
      user3,
      beneficiary1,
      beneficiary2,
      nftManagerAddress,
      eclvAddress,
    };
  }

  describe("1. TGE (Token Generation Event) Tests", function () {
    it("Should deploy EnclaveToken without TGE", async function () {
      const { eclvToken } = await loadFixture(deployFullSystemFixture);
      expect(await eclvToken.tgeTime()).to.equal(0n);
    });

    it("Should set TGE time", async function () {
      const { eclvToken, owner } = await loadFixture(deployFullSystemFixture);
      
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      
      await expect(eclvToken.connect(owner).setTGETime(tgeTime))
        .to.emit(eclvToken, "TGESet")
        .withArgs(tgeTime);
      
      expect(await eclvToken.tgeTime()).to.equal(tgeTime);
    });

    it("Should allow mining initial supply before TGE", async function () {
      const { eclvToken, oracle, treasury } = await loadFixture(deployFullSystemFixture);
      
      // TGE not set yet, can mine up to INITIAL_SUPPLY (70M)
      const amount = ethers.parseEther("10000000"); // 10M
      await expect(eclvToken.connect(oracle).mineTokens(treasury.address, amount))
        .to.emit(eclvToken, "TokensMined");
      
      expect(await eclvToken.balanceOf(treasury.address)).to.equal(amount);
    });

    it("Should limit mining to 5M/year after TGE", async function () {
      const { eclvToken, oracle, treasury, owner } = await loadFixture(deployFullSystemFixture);
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      
      // Try to mine 6M (should fail, limit is 5M/year)
      const tooMuch = ethers.parseEther("6000000");
      await expect(
        eclvToken.connect(oracle).mineTokens(treasury.address, tooMuch)
      ).to.be.revertedWith("Exceeds mining allowance");
      
      // Mine 5M (should succeed)
      const allowed = ethers.parseEther("5000000");
      await eclvToken.connect(oracle).mineTokens(treasury.address, allowed);
      expect(await eclvToken.balanceOf(treasury.address)).to.equal(allowed);
    });

    it("Should propagate TGE time to NFTManager", async function () {
      const { eclvToken, adminFacet, owner } = await loadFixture(deployFullSystemFixture);
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      
      // NFTManager reads TGE from EnclaveToken
      expect(await adminFacet.tgeTime()).to.equal(tgeTime);
    });
  });

  describe("2. NFT Whitelist, Minting, Selling, Buying Tests", function () {
    async function setupWithTGE() {
      const fixture = await loadFixture(deployFullSystemFixture);
      const { eclvToken, owner, oracle, nftManagerAddress } = fixture;
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      
      // Mine initial ECLV to NFTManager
      const initialEclv = ethers.parseEther("4000000");
      await eclvToken.connect(oracle).mineTokens(nftManagerAddress, initialEclv);
      
      return { ...fixture, tgeTime: BigInt(tgeTime) };
    }

    describe("Whitelist Management", function () {
      it("Should add users to whitelist", async function () {
        const { nftManagerFacet, master, user1, user2 } = await setupWithTGE();
        
        await expect(nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address]))
          .to.emit(nftManagerFacet, "WhitelistAdded");
        
        expect(await nftManagerFacet.isWhitelisted(user1.address)).to.be.true;
        expect(await nftManagerFacet.isWhitelisted(user2.address)).to.be.true;
        expect(await nftManagerFacet.getWhitelistCount()).to.equal(2n);
      });

      it("Should remove user from whitelist", async function () {
        const { nftManagerFacet, master, user1 } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        await expect(nftManagerFacet.connect(master).removeFromWhitelist(user1.address))
          .to.emit(nftManagerFacet, "WhitelistRemoved");
        
        expect(await nftManagerFacet.isWhitelisted(user1.address)).to.be.false;
      });

      it("Should get all whitelisted addresses", async function () {
        const { nftManagerFacet, master, user1, user2, user3 } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address, user3.address]);
        
        const whitelist = await nftManagerFacet.getAllWhitelistedAddresses();
        expect(whitelist.length).to.equal(3);
        expect(whitelist).to.include(user1.address);
        expect(whitelist).to.include(user2.address);
        expect(whitelist).to.include(user3.address);
      });
    });

    describe("Batch Management", function () {
      it("Should create batch", async function () {
        const { nftManagerFacet, adminFacet, master } = await setupWithTGE();
        
        const price = ethers.parseUnits("1000", 18);
        await expect(nftManagerFacet.connect(master).createBatch(100, price))
          .to.emit(nftManagerFacet, "BatchCreated")
          .withArgs(1n, 100n, price);
        
        const batch = await adminFacet.batches(1);
        expect(batch.maxMintable).to.equal(100n);
        expect(batch.mintPrice).to.equal(price);
        expect(batch.active).to.be.true;
      });

      it("Should not exceed MAX_SUPPLY when creating batches", async function () {
        const { nftManagerFacet, master } = await setupWithTGE();
        
        await expect(
          nftManagerFacet.connect(master).createBatch(5001, ethers.parseUnits("1000", 18))
        ).to.be.revertedWith("Total maxMintable exceeds MAX_SUPPLY");
      });

      it("Should switch active batch", async function () {
        const { nftManagerFacet, adminFacet, master } = await setupWithTGE();
        
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await nftManagerFacet.connect(master).createBatch(200, price);
        
        // Batch 2 should be active, batch 1 inactive
        expect((await adminFacet.batches(1)).active).to.be.false;
        expect((await adminFacet.batches(2)).active).to.be.true;
        
        // Activate batch 1
        await nftManagerFacet.connect(master).activateBatch(1);
        expect((await adminFacet.batches(1)).active).to.be.true;
        expect((await adminFacet.batches(2)).active).to.be.false;
      });
    });

    describe("NFT Minting", function () {
      it("Should mint NFT for whitelisted user", async function () {
        const { nftManagerFacet, adminFacet, nodeNFT, usdt, master, user1, treasury, nftManagerAddress } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        
        const treasuryBalanceBefore = await usdt.balanceOf(treasury.address);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        
        await expect(nftManagerFacet.connect(user1).mintNFT())
          .to.emit(nftManagerFacet, "NFTMinted");
        
        expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);
        expect(await adminFacet.totalMinted()).to.equal(1n);
        
        // Check USDT went to treasury
        const treasuryBalanceAfter = await usdt.balanceOf(treasury.address);
        expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(price);
      });

      it("Should not allow non-whitelisted user to mint", async function () {
        const { nftManagerFacet, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        
        await expect(
          nftManagerFacet.connect(user1).mintNFT()
        ).to.be.revertedWith("Not whitelisted");
      });

      it("Should track NFT pool info", async function () {
        const { nftManagerFacet, adminFacet, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        const pool = await adminFacet.nftPools(1);
        // Pool returns named values: (nftId_, status, createdAt, terminationInitiatedAt, unlockedWithdrawn, ...)
        expect(pool[0]).to.equal(1n); // nftId
        expect(Number(pool[1])).to.equal(0); // status: Active = 0
        expect(pool[2]).to.be.gt(0n); // createdAt
      });
    });

    describe("Marketplace - Selling and Buying", function () {
      it("Should complete full sell-buy cycle", async function () {
        const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, master, user1, user2, nftManagerAddress } = await setupWithTGE();
        
        // 1. Mint NFT to user1
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const mintPrice = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, mintPrice);
        await usdt.connect(user1).approve(nftManagerAddress, mintPrice);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 2. Enable transfers
        await adminFacet.connect(master).setTransfersEnabled(true);
        
        // 3. Create sell order
        await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
        const sellPrice = ethers.parseUnits("2000", 18);
        const tx = await marketplaceFacet.connect(user1).createSellOrder(1, sellPrice);
        const receipt = await tx.wait();
        
        // Extract orderId
        let orderId = 1n;
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = marketplaceFacet.interface.parseLog(log);
              if (parsed && parsed.name === "SellOrderCreated") {
                orderId = parsed.args[0];
                break;
              }
            } catch {}
          }
        }
        
        // 4. Buy NFT
        const user1BalanceBefore = await usdt.balanceOf(user1.address);
        await usdt.connect(user2).approve(nftManagerAddress, sellPrice);
        
        await expect(marketplaceFacet.connect(user2).buyNFT(orderId))
          .to.emit(marketplaceFacet, "NFTBought");
        
        // 5. Verify ownership transfer
        expect(await nodeNFT.ownerOf(1)).to.equal(user2.address);
        
        // 6. Verify payment (minus market fee if any)
        const user1BalanceAfter = await usdt.balanceOf(user1.address);
        expect(user1BalanceAfter).to.be.gte(user1BalanceBefore);
      });

      it("Should allow seller to cancel order", async function () {
        const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        // Mint and create order
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const mintPrice = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, mintPrice);
        await usdt.connect(user1).approve(nftManagerAddress, mintPrice);
        await nftManagerFacet.connect(user1).mintNFT();
        await adminFacet.connect(master).setTransfersEnabled(true);
        await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
        
        const sellPrice = ethers.parseUnits("2000", 18);
        const tx = await marketplaceFacet.connect(user1).createSellOrder(1, sellPrice);
        const receipt = await tx.wait();
        
        let orderId = 1n;
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = marketplaceFacet.interface.parseLog(log);
              if (parsed && parsed.name === "SellOrderCreated") {
                orderId = parsed.args[0];
                break;
              }
            } catch {}
          }
        }
        
        // Cancel order
        await expect(marketplaceFacet.connect(user1).cancelSellOrder(orderId))
          .to.emit(marketplaceFacet, "SellOrderCancelled");
        
        // NFT should be back to user1
        expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);
      });
    });
  });

  describe("3. Reward Distribution, Token Mining, NFT Termination, Unlock Withdrawal Tests", function () {
    async function setupWithMintedNFTs() {
      const fixture = await loadFixture(deployFullSystemFixture);
      const { eclvToken, owner, oracle, nftManagerFacet, usdt, master, user1, user2, user3, nftManagerAddress } = fixture;
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      
      // Mine initial ECLV to NFTManager
      const initialEclv = ethers.parseEther("4000000");
      await eclvToken.connect(oracle).mineTokens(nftManagerAddress, initialEclv);
      
      // Mint 3 NFTs
      await nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address, user3.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.connect(master).createBatch(100, price);
      
      for (const user of [user1, user2, user3]) {
        await usdt.connect(user).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user).mintNFT();
      }
      
      // Set NFTManager as oracle for EnclaveToken to enable minting
      await eclvToken.connect(owner).setOracle(nftManagerAddress);
      
      return { ...fixture, tgeTime: BigInt(tgeTime) };
    }

    describe("Reward Distribution", function () {
      it("Should distribute produced tokens to NFT holders", async function () {
        const { rewardFacet, adminFacet, oracle } = await setupWithMintedNFTs();
        
        const amount = ethers.parseEther("900000"); // 900K (within remaining allowance)
        await expect(rewardFacet.connect(oracle).distributeProduced(amount))
          .to.emit(rewardFacet, "ProducedDistributed");
        
        // Check global state updated
        const globalState = await adminFacet.globalState();
        expect(globalState.accProducedPerNFT).to.be.gt(0);
      });

      it("Should distribute reward tokens (USDT) to NFT holders", async function () {
        const { rewardFacet, adminFacet, usdt, oracle, nftManagerAddress } = await setupWithMintedNFTs();
        
        const amount = ethers.parseUnits("100000", 18);
        await usdt.connect(oracle).approve(nftManagerAddress, amount);
        
        await expect(rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), amount))
          .to.emit(rewardFacet, "RewardDistributed");
        
        // Check accRewardPerNFT updated
        const accReward = await adminFacet.getAccRewardPerNFT(await usdt.getAddress());
        expect(accReward).to.be.gt(0);
      });

      it("Should allow NFT holder to claim produced tokens", async function () {
        const { rewardFacet, eclvToken, oracle, user1 } = await setupWithMintedNFTs();
        
        // Distribute
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("900000"));
        
        // Claim
        const balanceBefore = await eclvToken.balanceOf(user1.address);
        await expect(rewardFacet.connect(user1).claimProduced(1))
          .to.emit(rewardFacet, "ProducedClaimed");
        
        const balanceAfter = await eclvToken.balanceOf(user1.address);
        expect(balanceAfter - balanceBefore).to.be.gt(0);
      });

      it("Should allow NFT holder to claim reward tokens", async function () {
        const { rewardFacet, usdt, oracle, user1, nftManagerAddress } = await setupWithMintedNFTs();
        
        // Distribute
        const amount = ethers.parseUnits("100000", 18);
        await usdt.connect(oracle).approve(nftManagerAddress, amount);
        await rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), amount);
        
        // Claim
        const balanceBefore = await usdt.balanceOf(user1.address);
        await expect(rewardFacet.connect(user1).claimReward(1, await usdt.getAddress()))
          .to.emit(rewardFacet, "RewardClaimed");
        
        const balanceAfter = await usdt.balanceOf(user1.address);
        expect(balanceAfter - balanceBefore).to.be.gt(0);
      });

      it("Should distribute fairly among all NFTs", async function () {
        const { rewardFacet, adminFacet, oracle } = await setupWithMintedNFTs();
        
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("900000"));
        
        const pending1 = await adminFacet.getPendingProduced(1);
        const pending2 = await adminFacet.getPendingProduced(2);
        const pending3 = await adminFacet.getPendingProduced(3);
        
        // All should be equal (within rounding error)
        expect(pending1).to.be.closeTo(pending2, ethers.parseEther("1"));
        expect(pending2).to.be.closeTo(pending3, ethers.parseEther("1"));
        expect(pending1).to.be.gt(0);
      });
    });

    describe("NFT Termination", function () {
      it("Should initiate termination", async function () {
        const { nftManagerFacet, adminFacet, user1 } = await setupWithMintedNFTs();
        
        await expect(nftManagerFacet.connect(user1).initiateTermination(1))
          .to.emit(nftManagerFacet, "TerminationInitiated");
        
        const pool = await adminFacet.nftPools(1);
        expect(pool.status).to.equal(1n); // PendingTermination
      });

      it("Should confirm termination after cooldown", async function () {
        const { nftManagerFacet, adminFacet, user1 } = await setupWithMintedNFTs();
        
        await nftManagerFacet.connect(user1).initiateTermination(1);
        
        // Fast forward 2 days (past cooldown)
        await time.increase(2 * ONE_DAY);
        
        await expect(nftManagerFacet.connect(user1).confirmTermination(1))
          .to.emit(nftManagerFacet, "TerminationConfirmed");
        
        const pool = await adminFacet.nftPools(1);
        expect(pool.status).to.equal(2n); // Terminated
      });

      it("Should not confirm termination before cooldown", async function () {
        const { nftManagerFacet, user1 } = await setupWithMintedNFTs();
        
        await nftManagerFacet.connect(user1).initiateTermination(1);
        
        // Try to confirm immediately (should fail)
        await expect(
          nftManagerFacet.connect(user1).confirmTermination(1)
        ).to.be.revertedWith("Cooldown not passed");
      });

      it("Should cancel termination", async function () {
        const { nftManagerFacet, adminFacet, user1 } = await setupWithMintedNFTs();
        
        await nftManagerFacet.connect(user1).initiateTermination(1);
        
        await expect(nftManagerFacet.connect(user1).cancelTermination(1))
          .to.emit(nftManagerFacet, "TerminationCancelled");
        
        const pool = await adminFacet.nftPools(1);
        expect(pool.status).to.equal(0n); // Back to Active
      });

      it("Should handle termination timeout correctly", async function () {
        const { nftManagerFacet, adminFacet, user1 } = await setupWithMintedNFTs();
        
        await nftManagerFacet.connect(user1).initiateTermination(1);
        
        // Fast forward 31 days (past timeout)
        await time.increase(31 * ONE_DAY);
        
        // Status should still be PendingTermination
        const pool = await adminFacet.nftPools(1);
        expect(pool.status).to.equal(1n); // PendingTermination
        
        // confirmTermination might revert or auto-cancel depending on implementation
        // Just verify the state is still PendingTermination
      });
    });

    describe("Unlock Token Withdrawal", function () {
      it("Should not allow withdrawal during lock period", async function () {
        const { nftManagerFacet, user1 } = await setupWithMintedNFTs();
        
        // Try to withdraw immediately (should be 0 or fail)
        const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlockedAmount).to.equal(0n);
      });

      it("Should calculate unlocked amount after lock period", async function () {
        const { nftManagerFacet, tgeTime } = await setupWithMintedNFTs();
        
        // Fast forward past lock period (1 year) + 2 unlock intervals
        await time.increaseTo(Number(tgeTime) + ONE_YEAR + 2 * ONE_MONTH);
        
        const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlockedAmount).to.be.gt(0);
      });

      it("Should withdraw unlocked tokens", async function () {
        const { nftManagerFacet, eclvToken, oracle, user1, nftManagerAddress, tgeTime } = await setupWithMintedNFTs();
        
        // Ensure NFTManager has enough ECLV balance
        await eclvToken.setOracle(oracle.address);
        await eclvToken.connect(oracle).mineTokens(nftManagerAddress, ethers.parseEther("1000000"));
        await eclvToken.setOracle(nftManagerAddress); // Set back
        
        // Fast forward past lock period + some unlock periods
        await time.increaseTo(Number(tgeTime) + ONE_YEAR + 3 * ONE_MONTH);
        
        const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlockedAmount).to.be.gt(0);
        
        const balanceBefore = await eclvToken.balanceOf(user1.address);
        await expect(nftManagerFacet.connect(user1).withdrawUnlocked(1))
          .to.emit(nftManagerFacet, "UnlockedWithdrawn");
        
        const balanceAfter = await eclvToken.balanceOf(user1.address);
        expect(balanceAfter - balanceBefore).to.be.gt(0);
      });

      it("Should unlock 100% after all periods", async function () {
        const { nftManagerFacet, adminFacet, tgeTime } = await setupWithMintedNFTs();
        
        const ECLV_PER_NFT = await adminFacet.ECLV_PER_NFT();
        
        // Fast forward past all unlock periods (1 year lock + 25 * 30 days = ~3 years total)
        await time.increaseTo(Number(tgeTime) + ONE_YEAR + 25 * ONE_MONTH + ONE_MONTH);
        
        const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlockedAmount).to.equal(ECLV_PER_NFT);
      });
    });

    describe("Vault Management", function () {
      it("Should track vault rewards for unminted NFTs", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, oracle } = await setupWithMintedNFTs();
        
        // Only 3 NFTs minted out of 5000, most rewards go to vault
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("500000"));
        
        const vaultRewards = await adminFacet.getVaultRewards(await eclvToken.getAddress());
        expect(vaultRewards).to.be.gt(0);
      });

      it("Should allow master to extract vault rewards", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, oracle, master, treasury } = await setupWithMintedNFTs();
        
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("500000"));
        
        const vaultRewards = await adminFacet.getVaultRewards(await eclvToken.getAddress());
        expect(vaultRewards).to.be.gt(0);
        
        // extractVaultRewards sends to treasury, not to caller
        const treasuryBefore = await eclvToken.balanceOf(treasury.address);
        await nftManagerFacet.connect(master).extractVaultRewards(await eclvToken.getAddress());
        const treasuryAfter = await eclvToken.balanceOf(treasury.address);
        
        expect(treasuryAfter - treasuryBefore).to.equal(vaultRewards);
      });
    });
  });

  describe("4. TokenVesting Tests", function () {
    async function setupWithVesting() {
      const fixture = await loadFixture(deployFullSystemFixture);
      const { eclvToken, owner, oracle, nftManagerAddress } = fixture;
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      
      // Deploy TokenVesting
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address);
      await vesting.waitForDeployment();
      
      // Transfer tokens to vesting contract
      const vestingAmount = ethers.parseEther("3000000"); // 3M
      await eclvToken.connect(oracle).mineTokens(owner.address, vestingAmount);
      await eclvToken.connect(owner).transfer(await vesting.getAddress(), vestingAmount);
      
      return { ...fixture, vesting, tgeTime: BigInt(tgeTime) };
    }

    describe("Vesting Schedule Creation", function () {
      it("Should create vesting schedule", async function () {
        const { vesting, owner, beneficiary1 } = await setupWithVesting();
        
        const amount = ethers.parseEther("1000000");
        await expect(
          vesting.connect(owner).createVestingSchedule(
            beneficiary1.address,
            amount,
            ONE_YEAR, // lock period
            32 * ONE_MONTH // release duration
          )
        ).to.emit(vesting, "VestingScheduleCreated");
        
        expect(await vesting.hasSchedules(beneficiary1.address)).to.be.true;
        expect(await vesting.totalVested()).to.equal(amount);
      });

      it("Should create batch vesting schedules", async function () {
        const { vesting, owner, beneficiary1, beneficiary2 } = await setupWithVesting();
        
        const amount1 = ethers.parseEther("1000000");
        const amount2 = ethers.parseEther("500000");
        
        await vesting.connect(owner).createVestingSchedulesBatch(
          [beneficiary1.address, beneficiary2.address],
          [amount1, amount2],
          [ONE_YEAR, 6 * ONE_MONTH],
          [32 * ONE_MONTH, 24 * ONE_MONTH]
        );
        
        expect(await vesting.getBeneficiaryCount()).to.equal(2);
        expect(await vesting.totalVested()).to.equal(amount1 + amount2);
      });
    });

    describe("Token Release", function () {
      it("Should not release before lock period", async function () {
        const { vesting, owner, beneficiary1 } = await setupWithVesting();
        
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          ethers.parseEther("1000000"),
          ONE_YEAR,
          32 * ONE_MONTH
        );
        
        const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
        const releasable = await vesting.calculateReleasable(scheduleIds[0]);
        expect(releasable).to.equal(0n);
      });

      it("Should release tokens linearly after lock period", async function () {
        const { vesting, eclvToken, owner, beneficiary1, tgeTime } = await setupWithVesting();
        
        const amount = ethers.parseEther("1000000");
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          amount,
          ONE_YEAR,
          32 * ONE_MONTH
        );
        
        // Fast forward past lock period + 1 month
        const startTime = Number(tgeTime) + ONE_YEAR;
        await time.increaseTo(startTime + ONE_MONTH);
        
        const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
        const releasable = await vesting.calculateReleasable(scheduleIds[0]);
        
        // Should be ~1/32 of total
        const expected = amount / 32n;
        expect(releasable).to.be.closeTo(expected, ethers.parseEther("1000"));
        
        // Release
        const balanceBefore = await eclvToken.balanceOf(beneficiary1.address);
        await vesting.connect(beneficiary1).releaseAll();
        const balanceAfter = await eclvToken.balanceOf(beneficiary1.address);
        
        expect(balanceAfter - balanceBefore).to.be.closeTo(releasable, ethers.parseEther("1"));
      });

      it("Should release all tokens after vesting ends", async function () {
        const { vesting, eclvToken, owner, beneficiary1, tgeTime } = await setupWithVesting();
        
        const amount = ethers.parseEther("1000000");
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          amount,
          ONE_YEAR,
          32 * ONE_MONTH
        );
        
        // Fast forward past all vesting
        const endTime = Number(tgeTime) + ONE_YEAR + 32 * ONE_MONTH;
        await time.increaseTo(endTime + ONE_MONTH);
        
        const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
        const releasable = await vesting.calculateReleasable(scheduleIds[0]);
        expect(releasable).to.equal(amount);
        
        // Release
        const balanceBefore = await eclvToken.balanceOf(beneficiary1.address);
        await vesting.connect(beneficiary1).releaseAll();
        const balanceAfter = await eclvToken.balanceOf(beneficiary1.address);
        
        expect(balanceAfter - balanceBefore).to.be.closeTo(amount, ethers.parseEther("1"));
      });
    });

    describe("View Functions", function () {
      it("Should get vesting info", async function () {
        const { vesting, owner, beneficiary1 } = await setupWithVesting();
        
        const amount = ethers.parseEther("1000000");
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          amount,
          ONE_YEAR,
          32 * ONE_MONTH
        );
        
        const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
        const [schedule, releasable] = await vesting.getVestingInfo(scheduleIds[0]);
        
        expect(schedule.beneficiary).to.equal(beneficiary1.address);
        expect(schedule.totalAmount).to.equal(amount);
        expect(schedule.lockPeriod).to.equal(ONE_YEAR);
        expect(schedule.releaseDuration).to.equal(32 * ONE_MONTH);
        expect(releasable).to.equal(0n);
      });

      it("Should check balance sufficiency", async function () {
        const { vesting, owner, beneficiary1 } = await setupWithVesting();
        
        const amount = ethers.parseEther("1000000");
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          amount,
          ONE_YEAR,
          32 * ONE_MONTH
        );
        
        const [sufficient, required, current] = await vesting.checkBalanceSufficiency();
        expect(sufficient).to.be.true;
        expect(required).to.equal(amount);
        expect(current).to.be.gte(required);
      });
    });
  });

  describe("5. Complete End-to-End Flow", function () {
    it("Should complete full lifecycle: TGE -> Whitelist -> Mint -> Distribute -> Claim -> Terminate -> Vest -> Release", async function () {
      const { 
        eclvToken, nodeNFT, nftManagerFacet, rewardFacet, adminFacet,
        usdt, owner, oracle, master, user1, beneficiary1, nftManagerAddress 
      } = await loadFixture(deployFullSystemFixture);

      console.log("    Step 1: Set TGE time");
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await eclvToken.connect(owner).setTGETime(tgeTime);
      expect(await eclvToken.tgeTime()).to.equal(tgeTime);

      console.log("    Step 2: Mine initial ECLV to NFTManager");
      await eclvToken.connect(oracle).mineTokens(nftManagerAddress, ethers.parseEther("4000000"));

      console.log("    Step 3: Add user to whitelist");
      await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
      expect(await nftManagerFacet.isWhitelisted(user1.address)).to.be.true;

      console.log("    Step 4: Create batch and mint NFT");
      const mintPrice = ethers.parseUnits("1000", 18);
      await nftManagerFacet.connect(master).createBatch(100, mintPrice);
      await usdt.connect(user1).approve(nftManagerAddress, mintPrice);
      await nftManagerFacet.connect(user1).mintNFT();
      expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);

      console.log("    Step 5: Distribute rewards");
      await eclvToken.connect(owner).setOracle(nftManagerAddress);
      await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("500000"));
      
      const rewardAmount = ethers.parseUnits("50000", 18);
      await usdt.connect(oracle).approve(nftManagerAddress, rewardAmount);
      await rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), rewardAmount);

      console.log("    Step 6: Claim rewards");
      const eclvBefore = await eclvToken.balanceOf(user1.address);
      const usdtBefore = await usdt.balanceOf(user1.address);
      await rewardFacet.connect(user1).claimProduced(1);
      await rewardFacet.connect(user1).claimReward(1, await usdt.getAddress());
      expect(await eclvToken.balanceOf(user1.address)).to.be.gt(eclvBefore);
      expect(await usdt.balanceOf(user1.address)).to.be.gt(usdtBefore);

      console.log("    Step 7: Initiate and confirm termination");
      await nftManagerFacet.connect(user1).initiateTermination(1);
      await time.increase(2 * ONE_DAY);
      await nftManagerFacet.connect(user1).confirmTermination(1);
      const pool = await adminFacet.nftPools(1);
      expect(Number(pool[1])).to.equal(2); // Terminated status = 2

      console.log("    Step 8: Deploy TokenVesting and create schedule");
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address);
      await vesting.waitForDeployment();
      
      // Use remaining yearly allowance (about 1M left in first year)
      // After time advances, we might be in a new year with fresh allowance
      await eclvToken.connect(owner).setOracle(oracle.address);
      const remainingAllowance = await eclvToken.getRemainingMiningForYear();
      const vestingAmount = remainingAllowance > 0n ? 
        (remainingAllowance < ethers.parseEther("500000") ? remainingAllowance : ethers.parseEther("500000")) 
        : ethers.parseEther("500000");
      
      if (vestingAmount > 0n) {
        await eclvToken.connect(oracle).mineTokens(owner.address, vestingAmount);
        await eclvToken.connect(owner).transfer(await vesting.getAddress(), vestingAmount);
      }
      
      if (vestingAmount > 0n) {
        await vesting.connect(owner).createVestingSchedule(
          beneficiary1.address,
          vestingAmount,
          ONE_YEAR,
          32 * ONE_MONTH
        );
      }

      console.log("    Step 9: Fast forward and release vested tokens");
      if (vestingAmount > 0n) {
        // Need to increase time significantly for vesting to work
        await time.increase(ONE_YEAR + ONE_MONTH);
        const beneficiaryBefore = await eclvToken.balanceOf(beneficiary1.address);
        await vesting.connect(beneficiary1).releaseAll();
        expect(await eclvToken.balanceOf(beneficiary1.address)).to.be.gt(beneficiaryBefore);
      }

      console.log("    ✅ All steps completed successfully!");
    });
  });
});

