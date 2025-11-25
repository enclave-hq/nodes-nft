import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployNFTManager } from "./helpers/deployNFTManager";

/**
 * AccessControl Tests - 权限控制测试
 * 
 * 测试不同角色的权限：
 * - Owner: 合约所有者
 * - Master: 主管理员（可以设置其他角色）
 * - Oracle: 预言机（分发奖励、挖矿）
 * - OracleMultisig: 预言机多签
 * - Operator: 运营者（提取vault奖励）
 * - Treasury: 财务地址
 * - User: 普通用户
 */
describe("AccessControl Tests", function () {
  async function deployAccessControlFixture() {
    const [owner, master, oracle, oracleMultisig, operator, treasury, user1, user2, attacker] = await ethers.getSigners();

    // Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Mint USDT to users
    const mintAmount = ethers.parseUnits("10000000", 18);
    for (const user of [user1, user2, attacker]) {
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
    
    // Set roles
    await adminFacet.setMaster(master.address);
    await rewardFacet.connect(master).setMultisigNode(oracleMultisig.address);
    await rewardFacet.connect(master).setOracleMultisig(oracleMultisig.address);
    await adminFacet.connect(master).setOperator(operator.address);

    // Mine initial ECLV to NFTManager
    const initialEclv = ethers.parseEther("4000000");
    await eclvToken.connect(oracle).mineTokens(nftManagerAddress, initialEclv);

    // Deploy TokenVesting
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address);
    await vesting.waitForDeployment();

    return {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nodeNFT,
      eclvToken,
      usdt,
      vesting,
      owner,
      master,
      oracle,
      oracleMultisig,
      operator,
      treasury,
      user1,
      user2,
      attacker,
      tgeTime: BigInt(tgeTime),
      nftManagerAddress,
    };
  }

  describe("EnclaveToken Access Control", function () {
    describe("Owner-only functions", function () {
      it("Should allow owner to set TGE time", async function () {
        const { eclvToken, owner } = await loadFixture(deployAccessControlFixture);
        const newTgeTime = Math.floor(Date.now() / 1000);
        await expect(eclvToken.connect(owner).setTGETime(newTgeTime))
          .to.emit(eclvToken, "TGESet");
      });

      it("Should NOT allow attacker to set TGE time", async function () {
        const { eclvToken, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          eclvToken.connect(attacker).setTGETime(Math.floor(Date.now() / 1000))
        ).to.be.revertedWithCustomError(eclvToken, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set oracle", async function () {
        const { eclvToken, owner, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(eclvToken.connect(owner).setOracle(user1.address))
          .to.emit(eclvToken, "OracleSet");
      });

      it("Should NOT allow attacker to set oracle", async function () {
        const { eclvToken, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          eclvToken.connect(attacker).setOracle(user1.address)
        ).to.be.revertedWithCustomError(eclvToken, "OwnableUnauthorizedAccount");
      });
    });

    describe("Oracle-only functions", function () {
      it("Should allow oracle to mine tokens", async function () {
        const { eclvToken, oracle, treasury } = await loadFixture(deployAccessControlFixture);
        const amount = ethers.parseEther("100000");
        await expect(eclvToken.connect(oracle).mineTokens(treasury.address, amount))
          .to.emit(eclvToken, "TokensMined");
      });

      it("Should NOT allow attacker to mine tokens", async function () {
        const { eclvToken, attacker, treasury } = await loadFixture(deployAccessControlFixture);
        await expect(
          eclvToken.connect(attacker).mineTokens(treasury.address, ethers.parseEther("1000"))
        ).to.be.revertedWith("Only oracle");
      });

      it("Should allow oracle to burn from swap", async function () {
        const { eclvToken, oracle } = await loadFixture(deployAccessControlFixture);
        const amount = ethers.parseEther("1000");
        await eclvToken.connect(oracle).mineTokens(oracle.address, amount);
        await eclvToken.connect(oracle).approve(await eclvToken.getAddress(), amount);
        
        await expect(eclvToken.connect(oracle).burnFromSwap(amount, "test"))
          .to.emit(eclvToken, "TokensBurned");
      });

      it("Should NOT allow attacker to burn from swap", async function () {
        const { eclvToken, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          eclvToken.connect(attacker).burnFromSwap(ethers.parseEther("1000"), "test")
        ).to.be.revertedWith("Only oracle");
      });
    });
  });

  describe("NodeNFT Access Control", function () {
    describe("Owner-only functions", function () {
      it("Should allow owner to set NFT manager", async function () {
        const { nodeNFT, owner, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(nodeNFT.connect(owner).updateNFTManager(user1.address))
          .to.emit(nodeNFT, "NFTManagerSet");
      });

      it("Should NOT allow attacker to set NFT manager", async function () {
        const { nodeNFT, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          nodeNFT.connect(attacker).updateNFTManager(user1.address)
        ).to.be.revertedWithCustomError(nodeNFT, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set base URI", async function () {
        const { nodeNFT, owner } = await loadFixture(deployAccessControlFixture);
        await expect(nodeNFT.connect(owner).setBaseURI("https://new.uri/"))
          .to.emit(nodeNFT, "BaseURIUpdated");
      });

      it("Should NOT allow attacker to set base URI", async function () {
        const { nodeNFT, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          nodeNFT.connect(attacker).setBaseURI("https://evil.uri/")
        ).to.be.revertedWithCustomError(nodeNFT, "OwnableUnauthorizedAccount");
      });
    });

    describe("NFTManager-only functions", function () {
      it("Should allow NFT manager to mint", async function () {
        const { nodeNFT, nftManagerFacet, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        
        await expect(nftManagerFacet.connect(user1).mintNFT())
          .to.emit(nodeNFT, "Transfer");
      });

      it("Should NOT allow attacker to directly mint on NodeNFT", async function () {
        const { nodeNFT, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          nodeNFT.connect(attacker).mint(user1.address)
        ).to.be.revertedWith("Only NFT Manager can mint");
      });

      it("Should NOT allow attacker to directly burn on NodeNFT", async function () {
        const { nodeNFT, nftManagerFacet, usdt, attacker, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        // First mint an NFT
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await expect(
          nodeNFT.connect(attacker).burn(1)
        ).to.be.revertedWith("Only NFT Manager can burn");
      });
    });
  });

  describe("NFTManager Access Control", function () {
    describe("Master-only functions", function () {
      it("Should allow master to add to whitelist", async function () {
        const { nftManagerFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(nftManagerFacet.connect(master).addToWhitelist([user1.address]))
          .to.emit(nftManagerFacet, "WhitelistAdded");
      });

      it("Should NOT allow attacker to add to whitelist", async function () {
        const { nftManagerFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          nftManagerFacet.connect(attacker).addToWhitelist([user1.address])
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to create batch", async function () {
        const { nftManagerFacet, master } = await loadFixture(deployAccessControlFixture);
        const price = ethers.parseUnits("1000", 18);
        await expect(nftManagerFacet.connect(master).createBatch(100, price))
          .to.emit(nftManagerFacet, "BatchCreated");
      });

      it("Should NOT allow attacker to create batch", async function () {
        const { nftManagerFacet, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          nftManagerFacet.connect(attacker).createBatch(100, ethers.parseUnits("1000", 18))
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set transfers enabled", async function () {
        const { adminFacet, master } = await loadFixture(deployAccessControlFixture);
        await expect(adminFacet.connect(master).setTransfersEnabled(true))
          .to.emit(adminFacet, "TransfersEnabled");
      });

      it("Should NOT allow attacker to set transfers enabled", async function () {
        const { adminFacet, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          adminFacet.connect(attacker).setTransfersEnabled(true)
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set market fee rate", async function () {
        const { marketplaceFacet, master } = await loadFixture(deployAccessControlFixture);
        await expect(marketplaceFacet.connect(master).setMarketFeeRate(500)) // 5%
          .to.emit(marketplaceFacet, "MarketFeeRateUpdated")
          .withArgs(500);
      });

      it("Should NOT allow attacker to set market fee rate", async function () {
        const { marketplaceFacet, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          marketplaceFacet.connect(attacker).setMarketFeeRate(500)
        ).to.be.revertedWith("Only master or owner");
      });
    });

    describe("Oracle-only functions", function () {
      it("Should allow oracle to distribute produced tokens", async function () {
        const { nftManagerFacet, rewardFacet, eclvToken, oracle, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        // Setup: mint NFT
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // Set NFTManager as oracle for EnclaveToken
        await eclvToken.setOracle(nftManagerAddress);
        
        const amount = ethers.parseEther("100000");
        await expect(rewardFacet.connect(oracle).distributeProduced(amount))
          .to.emit(rewardFacet, "ProducedDistributed");
      });

      it("Should allow oracleMultisig to distribute produced tokens", async function () {
        const { nftManagerFacet, rewardFacet, eclvToken, oracleMultisig, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        // Setup: mint NFT
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // Set NFTManager as oracle for EnclaveToken
        await eclvToken.setOracle(nftManagerAddress);
        
        const amount = ethers.parseEther("100000");
        await expect(rewardFacet.connect(oracleMultisig).distributeProduced(amount))
          .to.emit(rewardFacet, "ProducedDistributed");
      });

      it("Should NOT allow attacker to distribute produced tokens", async function () {
        const { rewardFacet, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          rewardFacet.connect(attacker).distributeProduced(ethers.parseEther("1000"))
        ).to.be.revertedWith("Only oracle or oracle multisig");
      });

      it("Should allow oracle to distribute reward tokens", async function () {
        const { nftManagerFacet, rewardFacet, eclvToken, usdt, oracle, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        // Setup: mint NFT
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // Set NFTManager as oracle for EnclaveToken
        await eclvToken.setOracle(nftManagerAddress);
        
        // Mint USDT to oracle and distribute
        const amount = ethers.parseUnits("10000", 18);
        await usdt.mint(oracle.address, amount);
        await usdt.connect(oracle).approve(nftManagerAddress, amount);
        
        await expect(rewardFacet.connect(oracle).distributeReward(await usdt.getAddress(), amount))
          .to.emit(rewardFacet, "RewardDistributed");
      });

      it("Should NOT allow attacker to distribute reward tokens", async function () {
        const { rewardFacet, usdt, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          rewardFacet.connect(attacker).distributeReward(await usdt.getAddress(), ethers.parseUnits("1000", 18))
        ).to.be.revertedWith("Only oracle or oracle multisig");
      });
    });

    describe("Vault Management (Master-only)", function () {
      it("Should allow master to extract vault rewards", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, master, oracle, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
        
        // Setup: mint NFT and distribute
        await nftManagerFacet.addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // Set NFTManager as oracle for EnclaveToken
        await eclvToken.setOracle(nftManagerAddress);
        
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("1000000"));
        
        // Get vault rewards for ECLV token
        const vaultRewards = await adminFacet.getVaultRewards(await eclvToken.getAddress());
        if (vaultRewards > 0n) {
          // extractVaultRewards is onlyMaster, not onlyOperator
          await expect(
            nftManagerFacet.connect(master).extractVaultRewards(await eclvToken.getAddress())
          ).to.emit(nftManagerFacet, "VaultUpdated")
            .withArgs(await eclvToken.getAddress(), 0);
        }
      });

      it("Should NOT allow attacker to extract vault rewards", async function () {
        const { nftManagerFacet, eclvToken, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          nftManagerFacet.connect(attacker).extractVaultRewards(await eclvToken.getAddress())
        ).to.be.revertedWith("Only master or owner");
      });
    });

    describe("Owner-only functions (AdminFacet)", function () {
      it("Should allow owner to set master", async function () {
        const { adminFacet, owner, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(adminFacet.connect(owner).setMaster(user1.address))
          .to.emit(adminFacet, "MasterSet");
      });

      it("Should NOT allow attacker to set master", async function () {
        const { adminFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          adminFacet.connect(attacker).setMaster(user1.address)
        ).to.be.revertedWith("Only owner");
      });
    });

    describe("Role setting by Master", function () {
      it("Should allow master to set oracle", async function () {
        const { adminFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(adminFacet.connect(master).setOracle(user1.address))
          .to.emit(adminFacet, "OracleSet");
      });

      it("Should NOT allow attacker to set oracle", async function () {
        const { adminFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          adminFacet.connect(attacker).setOracle(user1.address)
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set treasury", async function () {
        const { adminFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        // Master can set treasury
        const tx = await adminFacet.connect(master).setTreasury(user1.address);
        const receipt = await tx.wait();
        // Verify transaction succeeded and treasury was updated
        expect(await adminFacet.treasury()).to.equal(user1.address);
      });

      it("Should NOT allow attacker to set treasury", async function () {
        const { adminFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          adminFacet.connect(attacker).setTreasury(user1.address)
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set operator", async function () {
        const { adminFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(adminFacet.connect(master).setOperator(user1.address))
          .to.emit(adminFacet, "OperatorSet");
      });

      it("Should NOT allow attacker to set operator", async function () {
        const { adminFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          adminFacet.connect(attacker).setOperator(user1.address)
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set multisig node", async function () {
        const { rewardFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(rewardFacet.connect(master).setMultisigNode(user1.address))
          .to.emit(rewardFacet, "MultisigNodeSet");
      });

      it("Should NOT allow attacker to set multisig node", async function () {
        const { rewardFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          rewardFacet.connect(attacker).setMultisigNode(user1.address)
        ).to.be.revertedWith("Only master or owner");
      });

      it("Should allow master to set oracle multisig", async function () {
        const { rewardFacet, master, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(rewardFacet.connect(master).setOracleMultisig(user1.address))
          .to.emit(rewardFacet, "OracleMultisigSet");
      });

      it("Should NOT allow attacker to set oracle multisig", async function () {
        const { rewardFacet, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        await expect(
          rewardFacet.connect(attacker).setOracleMultisig(user1.address)
        ).to.be.revertedWith("Only master or owner");
      });
    });
  });

  describe("TokenVesting Access Control", function () {
    describe("Owner-only functions", function () {
      it("Should allow owner to create vesting schedule", async function () {
        const { vesting, eclvToken, oracle, owner, user1 } = await loadFixture(deployAccessControlFixture);
        
        // Transfer tokens to vesting
        const amount = ethers.parseEther("1000000");
        await eclvToken.connect(oracle).mineTokens(owner.address, amount);
        await eclvToken.connect(owner).transfer(await vesting.getAddress(), amount);
        
        const ONE_YEAR = 365 * 24 * 60 * 60;
        const ONE_MONTH = 30 * 24 * 60 * 60;
        
        await expect(
          vesting.connect(owner).createVestingSchedule(user1.address, amount, ONE_YEAR, 32 * ONE_MONTH)
        ).to.emit(vesting, "VestingScheduleCreated");
      });

      it("Should NOT allow attacker to create vesting schedule", async function () {
        const { vesting, attacker, user1 } = await loadFixture(deployAccessControlFixture);
        
        const ONE_YEAR = 365 * 24 * 60 * 60;
        const ONE_MONTH = 30 * 24 * 60 * 60;
        
        await expect(
          vesting.connect(attacker).createVestingSchedule(user1.address, ethers.parseEther("1000"), ONE_YEAR, 32 * ONE_MONTH)
        ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to emergency withdraw", async function () {
        const { vesting, eclvToken, oracle, owner } = await loadFixture(deployAccessControlFixture);
        
        // Transfer tokens to vesting
        const amount = ethers.parseEther("1000000");
        await eclvToken.connect(oracle).mineTokens(owner.address, amount);
        await eclvToken.connect(owner).transfer(await vesting.getAddress(), amount);
        
        await expect(vesting.connect(owner).emergencyWithdraw(ethers.parseEther("100000")))
          .to.not.be.reverted;
      });

      it("Should NOT allow attacker to emergency withdraw", async function () {
        const { vesting, attacker } = await loadFixture(deployAccessControlFixture);
        await expect(
          vesting.connect(attacker).emergencyWithdraw(ethers.parseEther("1000"))
        ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("NFT Owner-only functions", function () {
    it("Should allow NFT owner to initiate termination", async function () {
      const { nftManagerFacet, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      await expect(nftManagerFacet.connect(user1).initiateTermination(1))
        .to.emit(nftManagerFacet, "TerminationInitiated");
    });

    it("Should NOT allow non-owner to initiate termination", async function () {
      const { nftManagerFacet, usdt, user1, attacker, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      await expect(
        nftManagerFacet.connect(attacker).initiateTermination(1)
      ).to.be.revertedWith("Not NFT owner");
    });

    it("Should allow NFT owner to claim rewards", async function () {
      const { nftManagerFacet, rewardFacet, eclvToken, oracle, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // Distribute rewards
      await eclvToken.setOracle(nftManagerAddress);
      await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("1000000"));
      
      await expect(rewardFacet.connect(user1).claimProduced(1))
        .to.emit(rewardFacet, "ProducedClaimed");
    });

    it("Should NOT allow non-owner to claim rewards", async function () {
      const { nftManagerFacet, rewardFacet, eclvToken, oracle, usdt, user1, attacker, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // Distribute rewards
      await eclvToken.setOracle(nftManagerAddress);
      await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("1000000"));
      
      await expect(
        rewardFacet.connect(attacker).claimProduced(1)
      ).to.be.reverted; // Will revert with "Not NFT owner" or similar
    });
  });

  describe("Marketplace Access Control", function () {
    it("Should allow NFT owner to create sell order", async function () {
      const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, user1, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // Enable transfers
      await adminFacet.setTransfersEnabled(true);
      
      // Approve and create order
      await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
      const sellPrice = ethers.parseUnits("2000", 18);
      await expect(marketplaceFacet.connect(user1).createSellOrder(1, sellPrice))
        .to.emit(marketplaceFacet, "SellOrderCreated");
    });

    it("Should NOT allow non-owner to create sell order", async function () {
      const { nftManagerFacet, marketplaceFacet, adminFacet, usdt, user1, attacker, nftManagerAddress } = await loadFixture(deployAccessControlFixture);
      
      // Mint NFT to user1
      await nftManagerFacet.addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // Enable transfers
      await adminFacet.setTransfersEnabled(true);
      
      const sellPrice = ethers.parseUnits("2000", 18);
      await expect(
        marketplaceFacet.connect(attacker).createSellOrder(1, sellPrice)
      ).to.be.revertedWith("Not NFT owner");
    });
  });
});

