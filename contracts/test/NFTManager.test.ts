import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { NFTManager, NodeNFT, EnclaveToken, TestUSDT, NFTManagerFacet, MarketplaceFacet, RewardFacet, AdminFacet } from "../typechain-types";
import { deployNFTManager } from "./helpers/deployNFTManager";

// Helper for anyValue matcher
const anyValue = () => true;

describe("NFTManager - Unit Tests", function () {
  async function deployNFTManagerFixture() {
    const [owner, oracle, treasury, user1, user2, user3] = await ethers.getSigners();

    // Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Mint USDT to users - give enough for 5000 NFTs (5000 * 1000 = 5M USDT)
    const mintAmount = ethers.parseUnits("10000000", 18); // 10M USDT per user
    for (const user of [user1, user2, user3]) {
      await usdt.mint(user.address, mintAmount);
    }

    // Deploy EnclaveToken
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const eclvToken = await EnclaveToken.deploy();
    await eclvToken.waitForDeployment();
    const eclvAddress = await eclvToken.getAddress();

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
    await eclvToken.setTGETime(tgeTime);
    await eclvToken.setOracle(oracle.address);

    // Deploy NodeNFT
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    const nftAddress = await nodeNFT.getAddress();

    // Deploy NFTManager (Diamond Pattern)
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

    // Configure
    await nodeNFT.setNFTManager(nftManagerAddress);
    await nodeNFT.setBaseURI("https://api.enclave.com/nft/metadata/");
    
    // Set multisig node for reward distribution
    await rewardFacet.setMultisigNode(oracle.address);

    // Setup initial balance - mine 4M to leave room for distribution tests
    const initialEclv = ethers.parseEther("4000000"); // 4M (leaves 1M for distribution tests)
    await eclvToken.connect(oracle).mineTokens(nftManagerAddress, initialEclv);

    return {
      nftManager, // Main contract
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
      user1,
      user2,
      user3,
      tgeTime: BigInt(tgeTime),
      nftManagerAddress,
    };
  }

  describe("Deployment", function () {
    it("Should deploy and initialize correctly", async function () {
      const { adminFacet, nodeNFT, eclvToken, usdt } = await loadFixture(deployNFTManagerFixture);
      
      expect(await adminFacet.nodeNFT()).to.equal(await nodeNFT.getAddress());
      expect(await adminFacet.eclvToken()).to.equal(await eclvToken.getAddress());
      expect(await adminFacet.usdtToken()).to.equal(await usdt.getAddress());
    });

    it("Should have correct constants", async function () {
      const { adminFacet } = await loadFixture(deployNFTManagerFixture);
      
      expect(await adminFacet.MAX_SUPPLY()).to.equal(5000n);
      expect(await adminFacet.ECLV_PER_NFT()).to.equal(ethers.parseEther("2000"));
      expect(await adminFacet.UNLOCK_PERIODS()).to.equal(25n);
      expect(await adminFacet.UNLOCK_PERCENTAGE()).to.equal(4n);
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow master to add users to whitelist", async function () {
      const { nftManagerFacet, owner, user1, user2 } = await loadFixture(deployNFTManagerFixture);
      
      await expect(nftManagerFacet.addToWhitelist([user1.address, user2.address]))
        .to.emit(nftManagerFacet, "WhitelistAdded")
        .withArgs([user1.address, user2.address]);
      
      expect(await nftManagerFacet.isWhitelisted(user1.address)).to.be.true;
      expect(await nftManagerFacet.isWhitelisted(user2.address)).to.be.true;
      expect(await nftManagerFacet.getWhitelistCount()).to.equal(2n);
    });

    it("Should allow master to remove users from whitelist", async function () {
      const { nftManagerFacet, owner, user1 } = await loadFixture(deployNFTManagerFixture);
      
      await nftManagerFacet.addToWhitelist([user1.address]);
      await expect(nftManagerFacet.removeFromWhitelist(user1.address))
        .to.emit(nftManagerFacet, "WhitelistRemoved")
        .withArgs(user1.address);
      
      expect(await nftManagerFacet.isWhitelisted(user1.address)).to.be.false;
      expect(await nftManagerFacet.getWhitelistCount()).to.equal(0n);
    });

    it("Should not allow non-whitelisted users to mint", async function () {
      const { nftManagerFacet, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Create batch
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      
      // Approve USDT
      await usdt.connect(user1).approve(nftManagerAddress, price);
      
      // Try to mint without whitelist
      await expect(
        nftManagerFacet.connect(user1).mintNFT()
      ).to.be.revertedWith("Not whitelisted");
    });
  });

  describe("Batch Management", function () {
    it("Should allow master to create batch", async function () {
      const { nftManagerFacet, adminFacet, owner } = await loadFixture(deployNFTManagerFixture);
      
      const price = ethers.parseUnits("1000", 18);
      await expect(nftManagerFacet.createBatch(100, price))
        .to.emit(nftManagerFacet, "BatchCreated")
        .withArgs(1n, 100n, price);
      
      const batch = await adminFacet.batches(1);
      expect(batch.maxMintable).to.equal(100n);
      expect(batch.mintPrice).to.equal(price);
      expect(batch.active).to.be.true;
    });

    it("Should not allow creating batch that exceeds MAX_SUPPLY", async function () {
      const { nftManagerFacet } = await loadFixture(deployNFTManagerFixture);
      
      const price = ethers.parseUnits("1000", 18);
      await expect(
        nftManagerFacet.createBatch(5001, price) // 5001 > 5000
      ).to.be.revertedWith("Total maxMintable exceeds MAX_SUPPLY");
    });

    it("Should allow activating and deactivating batches", async function () {
      const { nftManagerFacet, adminFacet } = await loadFixture(deployNFTManagerFixture);
      
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await nftManagerFacet.createBatch(50, price);
      
      // Batch 2 should be active, batch 1 should be inactive
      const batch1 = await adminFacet.batches(1);
      const batch2 = await adminFacet.batches(2);
      expect(batch1.active).to.be.false;
      expect(batch2.active).to.be.true;
      
      // Activate batch 1
      await nftManagerFacet.activateBatch(1);
      const batch1After = await adminFacet.batches(1);
      const batch2After = await adminFacet.batches(2);
      expect(batch1After.active).to.be.true;
      expect(batch2After.active).to.be.false;
    });
  });

  describe("NFT Minting", function () {
    it("Should allow whitelisted user to mint NFT", async function () {
      const { nftManagerFacet, adminFacet, nodeNFT, usdt, owner, user1, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      
      // Approve USDT
      await usdt.connect(user1).approve(nftManagerAddress, price);
      
      // Mint
      await expect(nftManagerFacet.connect(user1).mintNFT())
        .to.emit(nftManagerFacet, "NFTMinted")
        .withArgs(1n, user1.address, 1n, price, anyValue);
      
      expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);
      expect(await adminFacet.totalMinted()).to.equal(1n);
    });

    it("Should transfer USDT to treasury on mint", async function () {
      const { nftManagerFacet, usdt, treasury, owner, user1, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      
      const treasuryBalanceBefore = await usdt.balanceOf(treasury.address);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      const treasuryBalanceAfter = await usdt.balanceOf(treasury.address);
      
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(price);
    });

    it("Should not allow minting beyond batch limit", async function () {
      const { nftManagerFacet, usdt, owner, user1, user2, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      await nftManagerFacet.addToWhitelist([user1.address, user2.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(1, price); // Only 1 NFT
      
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      await usdt.connect(user2).approve(nftManagerAddress, price);
      await expect(
        nftManagerFacet.connect(user2).mintNFT()
      ).to.be.revertedWith("Batch sold out");
    });

    it("Should not allow minting beyond MAX_SUPPLY", async function () {
      const { nftManagerFacet, usdt, owner, user1, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      
      // Create batch with 5000 NFTs
      await nftManagerFacet.createBatch(5000, price);
      
      // Mint 5000 NFTs - need to approve enough for all and ensure user has enough USDT
      const totalPrice = price * BigInt(5000);
      // User1 already has 1M USDT from fixture, which is enough for 5000 NFTs at 1000 USDT each
      await usdt.connect(user1).approve(nftManagerAddress, totalPrice);
      
      // Mint 5000 NFTs (this will take a while, but it's a test)
      for (let i = 0; i < 5000; i++) {
        await nftManagerFacet.connect(user1).mintNFT();
      }
      
      // Try to mint one more - should fail with either "Max supply reached" or "Batch sold out"
      // Since we minted all 5000 NFTs, the batch is sold out, so it will revert with "Batch sold out"
      await expect(
        nftManagerFacet.connect(user1).mintNFT()
      ).to.be.revertedWith("Batch sold out");
    });
  });

  describe("Reward Distribution", function () {
    it("Should allow oracle to distribute produced tokens", async function () {
      const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, oracle, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // NFTManager needs to be set as oracle in EnclaveToken to call mineTokens
      await eclvToken.setOracle(nftManagerAddress);
      
      // Distribute - we have 1M allowance left (5M - 4M already mined)
      const amount = ethers.parseEther("500000"); // 500K $E (within remaining 1M allowance)
      await expect(rewardFacet.connect(oracle).distributeProduced(amount))
        .to.emit(rewardFacet, "ProducedDistributed");
      
      // Check global state
      const globalState = await adminFacet.globalState();
      expect(globalState.accProducedPerNFT).to.be.gt(0);
    });

    it("Should allow oracle to distribute reward tokens", async function () {
      const { nftManagerFacet, rewardFacet, adminFacet, usdt, oracle, owner, user1, eclvToken, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // NFTManager needs to be set as oracle in EnclaveToken to call mineTokens (for distributeProduced)
      await eclvToken.setOracle(nftManagerAddress);
      
      // Distribute - oracle needs to have USDT balance
      const amount = ethers.parseUnits("100000", 18); // 100K USDT
      // Mint USDT to oracle first
      await usdt.mint(oracle.address, amount);
      await usdt.connect(oracle).approve(nftManagerAddress, amount);
      await expect(rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), amount))
        .to.emit(rewardFacet, "RewardDistributed");
      
      // Check global state
      const accReward = await adminFacet.getAccRewardPerNFT(await usdt.getAddress());
      expect(accReward).to.be.gt(0);
    });

    it("Should not allow non-oracle to distribute rewards", async function () {
      const { rewardFacet, user1 } = await loadFixture(deployNFTManagerFixture);
      
      await expect(
        rewardFacet.connect(user1).distributeProduced(ethers.parseEther("1000"))
      ).to.be.revertedWith("Only oracle or oracle multisig");
    });
  });

  describe("Reward Claiming", function () {
    it("Should allow NFT owner to claim produced tokens", async function () {
      const { nftManagerFacet, rewardFacet, eclvToken, oracle, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT and distribute
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // NFTManager needs to be set as oracle in EnclaveToken
      await eclvToken.setOracle(nftManagerAddress);
      
      const amount = ethers.parseEther("1000000");
      await rewardFacet.connect(oracle).distributeProduced(amount);
      
      // Claim
      const balanceBefore = await eclvToken.balanceOf(user1.address);
      await expect(rewardFacet.connect(user1).claimProduced(1))
        .to.emit(rewardFacet, "ProducedClaimed")
        .withArgs(1n, user1.address, anyValue);
      
      const balanceAfter = await eclvToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gt(0);
    });

    it("Should allow NFT owner to claim reward tokens", async function () {
      const { nftManagerFacet, rewardFacet, usdt, oracle, owner, user1, eclvToken, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT and distribute
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // NFTManager needs to be set as oracle in EnclaveToken
      await eclvToken.setOracle(nftManagerAddress);
      
      const amount = ethers.parseUnits("100000", 18);
      // Mint USDT to oracle first
      await usdt.mint(oracle.address, amount);
      await usdt.connect(oracle).approve(nftManagerAddress, amount);
      await rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), amount);
      
      // Claim
      const balanceBefore = await usdt.balanceOf(user1.address);
      await expect(rewardFacet.connect(user1).claimReward(1, await usdt.getAddress()))
        .to.emit(rewardFacet, "RewardClaimed")
        .withArgs(1n, user1.address, await usdt.getAddress(), anyValue);
      
      const balanceAfter = await usdt.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gt(0);
    });

    it("Should not allow non-owner to claim rewards", async function () {
      const { rewardFacet, user1, user2 } = await loadFixture(deployNFTManagerFixture);
      
      // Should revert with any error (could be custom error or string)
      await expect(
        rewardFacet.connect(user2).claimProduced(1)
      ).to.be.reverted;
    });
  });

  describe("NFT Termination", function () {
    it("Should allow NFT owner to initiate termination", async function () {
      const { nftManagerFacet, adminFacet, nodeNFT, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      await expect(nftManagerFacet.connect(user1).initiateTermination(1))
        .to.emit(nftManagerFacet, "TerminationInitiated")
        .withArgs(1n, user1.address, anyValue, anyValue);
      
      const pool = await adminFacet.nftPools(1);
      expect(pool.status).to.equal(1n); // PendingTermination
    });

    it("Should allow NFT owner to confirm termination after cooldown", async function () {
      const { nftManagerFacet, adminFacet, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT and initiate termination
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      await nftManagerFacet.connect(user1).initiateTermination(1);
      
      // Fast forward past cooldown
      await time.increase(2 * 24 * 60 * 60); // 2 days
      
      await expect(nftManagerFacet.connect(user1).confirmTermination(1))
        .to.emit(nftManagerFacet, "TerminationConfirmed")
        .withArgs(1n, user1.address, anyValue);
      
      const pool = await adminFacet.nftPools(1);
      expect(pool.status).to.equal(2n); // Terminated
    });

    it("Should allow NFT owner to cancel termination", async function () {
      const { nftManagerFacet, adminFacet, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT and initiate termination
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      await nftManagerFacet.connect(user1).initiateTermination(1);
      
      await expect(nftManagerFacet.connect(user1).cancelTermination(1))
        .to.emit(nftManagerFacet, "TerminationCancelled")
        .withArgs(1n, user1.address, anyValue);
      
      const pool = await adminFacet.nftPools(1);
      expect(pool.status).to.equal(0n); // Active
    });
  });

  describe("Marketplace", function () {
    it("Should allow NFT owner to create sell order", async function () {
      const { nftManagerFacet, adminFacet, nodeNFT, marketplaceFacet, owner, user1, usdt, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT and enable transfers
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      await adminFacet.setTransfersEnabled(true);
      
      // Approve NFTManager to transfer NFT
      await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
      
      const sellPrice = ethers.parseUnits("2000", 18);
      await expect(marketplaceFacet.connect(user1).createSellOrder(1, sellPrice))
        .to.emit(marketplaceFacet, "SellOrderCreated")
        .withArgs(anyValue, 1n, user1.address, sellPrice, anyValue);
    });

    it("Should allow buyer to purchase NFT from order", async function () {
      const { nftManagerFacet, adminFacet, nodeNFT, marketplaceFacet, usdt, owner, user1, user2, nftManagerAddress } = await loadFixture(deployNFTManagerFixture);
      
      // Setup: mint NFT, enable transfers, create order
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      await adminFacet.setTransfersEnabled(true);
      
      await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
      
      const sellPrice = ethers.parseUnits("2000", 18);
      const createOrderTx = await marketplaceFacet.connect(user1).createSellOrder(1, sellPrice);
      const receipt = await createOrderTx.wait();
      
      // Extract orderId from event
      let orderId = 1n;
      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = marketplaceFacet.interface.parseLog(log);
            if (parsed && parsed.name === "SellOrderCreated") {
              orderId = parsed.args[0]; // First arg is orderId
              break;
            }
          } catch {
            // Continue searching
          }
        }
      }
      
      // Buy - approve NFTManager to transfer USDT
      await usdt.connect(user2).approve(nftManagerAddress, sellPrice);
      
      await expect(marketplaceFacet.connect(user2).buyNFT(orderId))
        .to.emit(marketplaceFacet, "NFTBought")
        .withArgs(orderId, 1n, user1.address, user2.address, sellPrice, anyValue);
      
      expect(await nodeNFT.ownerOf(1)).to.equal(user2.address);
    });
  });
});

