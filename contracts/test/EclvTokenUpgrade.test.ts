import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployNFTManager } from "./helpers/deployNFTManager";

/**
 * ECLV Token 地址更换测试
 * 
 * 测试场景：
 * 1. TGE 未设置，NFT 未铸造 → 可以更换
 * 2. TGE 未设置，NFT 已铸造 → 可以更换（重点测试）
 * 3. TGE 已设置，NFT 已铸造 → 不可更换
 * 4. 更换后的状态验证
 */
describe("ECLV Token Upgrade Tests", function () {
  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;

  async function deployBaseFixture() {
    const [owner, oracle, treasury, master, user1, user2] = await ethers.getSigners();

    // Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Mint USDT to users
    const mintAmount = ethers.parseUnits("100000000", 18);
    for (const user of [user1, user2]) {
      await usdt.mint(user.address, mintAmount);
    }

    // Deploy first EnclaveToken (will be replaced)
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const oldEclvToken = await EnclaveToken.deploy();
    await oldEclvToken.waitForDeployment();
    const oldEclvAddress = await oldEclvToken.getAddress();
    await oldEclvToken.setOracle(oracle.address);
    // Note: TGE NOT set on old token

    // Deploy NodeNFT
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    const nftAddress = await nodeNFT.getAddress();

    // Deploy NFTManager with old ECLV Token
    const {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nftManagerAddress,
    } = await deployNFTManager(
      nftAddress,
      oldEclvAddress,
      usdtAddress,
      oracle.address,
      treasury.address,
      owner
    );

    // Configure
    await nodeNFT.setNFTManager(nftManagerAddress);
    await adminFacet.setMaster(master.address);
    await rewardFacet.connect(master).setMultisigNode(oracle.address);

    // Deploy new EnclaveToken (replacement)
    const newEclvToken = await EnclaveToken.deploy();
    await newEclvToken.waitForDeployment();
    const newEclvAddress = await newEclvToken.getAddress();
    await newEclvToken.setOracle(oracle.address);
    // Note: TGE NOT set on new token either

    return {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nodeNFT,
      oldEclvToken,
      newEclvToken,
      usdt,
      owner,
      oracle,
      treasury,
      master,
      user1,
      user2,
      nftManagerAddress,
      oldEclvAddress,
      newEclvAddress,
    };
  }

  describe("Scenario 1: TGE未设置, NFT未铸造 - 可以更换", function () {
    it("Should allow changing ECLV token before TGE and before any NFT minted", async function () {
      const { adminFacet, master, oldEclvAddress, newEclvAddress } = await loadFixture(deployBaseFixture);
      
      // Verify current state
      expect(await adminFacet.eclvToken()).to.equal(oldEclvAddress);
      expect(await adminFacet.totalMinted()).to.equal(0n);
      expect(await adminFacet.tgeTime()).to.equal(0n);
      
      // Change ECLV Token
      await expect(adminFacet.connect(master).setEclvToken(newEclvAddress))
        .to.emit(adminFacet, "EclvTokenUpdated")
        .withArgs(oldEclvAddress, newEclvAddress);
      
      // Verify new state
      expect(await adminFacet.eclvToken()).to.equal(newEclvAddress);
    });
  });

  describe("Scenario 2: TGE未设置, NFT已铸造 - 可以更换（重点测试）", function () {
    async function setupWithMintedNFTsNoTGE() {
      const fixture = await loadFixture(deployBaseFixture);
      const { nftManagerFacet, usdt, master, user1, user2, nftManagerAddress } = fixture;
      
      // Add users to whitelist and create batch
      await nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.connect(master).createBatch(100, price);
      
      // Mint 3 NFTs
      for (const user of [user1, user1, user2]) {
        await usdt.connect(user).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user).mintNFT();
      }
      
      return fixture;
    }

    it("Should have NFTs minted but TGE not set", async function () {
      const { adminFacet, nodeNFT, user1, user2 } = await setupWithMintedNFTsNoTGE();
      
      // Verify NFTs are minted
      expect(await adminFacet.totalMinted()).to.equal(3n);
      expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);
      expect(await nodeNFT.ownerOf(2)).to.equal(user1.address);
      expect(await nodeNFT.ownerOf(3)).to.equal(user2.address);
      
      // Verify TGE is not set
      expect(await adminFacet.tgeTime()).to.equal(0n);
    });

    it("Should allow changing ECLV token when NFTs minted but TGE not set", async function () {
      const { adminFacet, master, oldEclvAddress, newEclvAddress } = await setupWithMintedNFTsNoTGE();
      
      // Verify NFTs minted
      expect(await adminFacet.totalMinted()).to.equal(3n);
      
      // Change ECLV Token - should succeed
      await expect(adminFacet.connect(master).setEclvToken(newEclvAddress))
        .to.emit(adminFacet, "EclvTokenUpdated")
        .withArgs(oldEclvAddress, newEclvAddress);
      
      // Verify new ECLV Token is set
      expect(await adminFacet.eclvToken()).to.equal(newEclvAddress);
    });

    it("Should preserve NFT pool data after ECLV token change", async function () {
      const { adminFacet, master, user1, user2, newEclvAddress } = await setupWithMintedNFTsNoTGE();
      
      // Get pool data before change
      const pool1Before = await adminFacet.nftPools(1);
      const pool2Before = await adminFacet.nftPools(2);
      const pool3Before = await adminFacet.nftPools(3);
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Get pool data after change
      const pool1After = await adminFacet.nftPools(1);
      const pool2After = await adminFacet.nftPools(2);
      const pool3After = await adminFacet.nftPools(3);
      
      // Verify pool data is preserved
      expect(pool1After.nftId).to.equal(pool1Before.nftId);
      expect(pool1After.status).to.equal(pool1Before.status);
      expect(pool1After.createdAt).to.equal(pool1Before.createdAt);
      
      expect(pool2After.nftId).to.equal(pool2Before.nftId);
      expect(pool3After.nftId).to.equal(pool3Before.nftId);
    });

    it("Should be able to set TGE on new ECLV token after change", async function () {
      const { adminFacet, master, newEclvToken, newEclvAddress, owner } = await setupWithMintedNFTsNoTGE();
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Set TGE on new token
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      
      await expect(newEclvToken.connect(owner).setTGETime(tgeTime))
        .to.emit(newEclvToken, "TGESet")
        .withArgs(tgeTime);
      
      // Verify TGE is now readable from adminFacet
      expect(await adminFacet.tgeTime()).to.equal(tgeTime);
    });

    it("Should correctly calculate unlocked amount after ECLV token change and TGE set", async function () {
      const { nftManagerFacet, adminFacet, master, newEclvToken, newEclvAddress, oracle, nftManagerAddress, owner } = await setupWithMintedNFTsNoTGE();
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Set TGE on new token
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await newEclvToken.connect(owner).setTGETime(tgeTime);
      
      // Mine ECLV to NFTManager - within yearly allowance (5M/year for first 6 years)
      await newEclvToken.connect(oracle).mineTokens(nftManagerAddress, ethers.parseEther("4000000"));
      
      // Before lock period ends, unlocked amount should be 0
      const unlockedBefore = await nftManagerFacet.calculateUnlockedAmount(1);
      expect(unlockedBefore).to.equal(0n);
      
      // Fast forward past lock period (1 year) + some unlock periods
      await time.increaseTo(tgeTime + ONE_YEAR + 2 * ONE_MONTH);
      
      // After lock period, should have some unlocked amount
      const unlockedAfter = await nftManagerFacet.calculateUnlockedAmount(1);
      expect(unlockedAfter).to.be.gt(0);
      
      // Should be 8% (2 periods * 4%)
      const ECLV_PER_NFT = await adminFacet.ECLV_PER_NFT();
      const expected = (ECLV_PER_NFT * 8n) / 100n;
      expect(unlockedAfter).to.be.closeTo(expected, ethers.parseEther("1"));
    });

    it("Should be able to withdraw unlocked tokens with new ECLV token", async function () {
      const { nftManagerFacet, adminFacet, master, newEclvToken, newEclvAddress, oracle, user1, nftManagerAddress, owner } = await setupWithMintedNFTsNoTGE();
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Set TGE on new token
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await newEclvToken.connect(owner).setTGETime(tgeTime);
      
      // Mine ECLV to NFTManager - within yearly allowance
      await newEclvToken.connect(oracle).mineTokens(nftManagerAddress, ethers.parseEther("4000000"));
      
      // Fast forward past lock period
      await time.increaseTo(tgeTime + ONE_YEAR + 2 * ONE_MONTH);
      
      // Withdraw unlocked tokens
      const balanceBefore = await newEclvToken.balanceOf(user1.address);
      await nftManagerFacet.connect(user1).withdrawUnlocked(1);
      const balanceAfter = await newEclvToken.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.be.gt(0);
    });

    it("Should update reward token list when changing ECLV token", async function () {
      const { rewardFacet, adminFacet, master, oldEclvAddress, newEclvAddress } = await setupWithMintedNFTsNoTGE();
      
      // Check old ECLV is in reward tokens (eclvToken is added during initialization)
      const rewardTokensBefore = await rewardFacet.getRewardTokens();
      console.log("    Reward tokens before:", rewardTokensBefore);
      console.log("    Old ECLV address:", oldEclvAddress);
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Check new ECLV is in reward tokens, old is removed
      const rewardTokensAfter = await rewardFacet.getRewardTokens();
      console.log("    Reward tokens after:", rewardTokensAfter);
      console.log("    New ECLV address:", newEclvAddress);
      
      // Verify new token is in list
      expect(rewardTokensAfter.map((addr: string) => addr.toLowerCase()))
        .to.include(newEclvAddress.toLowerCase());
      // Verify old token is removed from list
      expect(rewardTokensAfter.map((addr: string) => addr.toLowerCase()))
        .to.not.include(oldEclvAddress.toLowerCase());
    });
  });

  describe("Scenario 3: TGE已设置 - 不可更换", function () {
    async function setupWithTGESet() {
      const fixture = await loadFixture(deployBaseFixture);
      const { oldEclvToken, owner } = fixture;
      
      // Set TGE on old token
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await oldEclvToken.connect(owner).setTGETime(tgeTime);
      
      return { ...fixture, tgeTime };
    }

    it("Should NOT allow changing ECLV token after TGE is set", async function () {
      const { adminFacet, master, newEclvAddress, tgeTime } = await setupWithTGESet();
      
      // Verify TGE is set
      expect(await adminFacet.tgeTime()).to.equal(tgeTime);
      
      // Try to change ECLV Token - should fail
      await expect(
        adminFacet.connect(master).setEclvToken(newEclvAddress)
      ).to.be.revertedWith("Cannot change ECLV token after TGE is set");
    });

    it("Should NOT allow changing ECLV token even if no NFTs minted but TGE set", async function () {
      const { adminFacet, master, newEclvAddress, tgeTime } = await setupWithTGESet();
      
      // Verify no NFTs minted
      expect(await adminFacet.totalMinted()).to.equal(0n);
      
      // Verify TGE is set
      expect(await adminFacet.tgeTime()).to.equal(tgeTime);
      
      // Try to change ECLV Token - should fail
      await expect(
        adminFacet.connect(master).setEclvToken(newEclvAddress)
      ).to.be.revertedWith("Cannot change ECLV token after TGE is set");
    });
  });

  describe("Scenario 4: TokenVesting 配合测试", function () {
    it("Should deploy TokenVesting with NFTManager as configSource", async function () {
      const { adminFacet, newEclvAddress, master, owner, nftManagerAddress } = await loadFixture(deployBaseFixture);
      
      // Change ECLV Token before TGE
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Deploy TokenVesting with NFTManager as configSource
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address);
      await vesting.waitForDeployment();
      
      // Verify configSource is NFTManager
      expect(await vesting.configSource()).to.equal(nftManagerAddress);
    });

    it("TokenVesting should read correct ECLV address from configSource after change", async function () {
      const { adminFacet, newEclvToken, newEclvAddress, master, oracle, owner, nftManagerAddress } = await loadFixture(deployBaseFixture);
      
      // Change ECLV Token before TGE
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Set TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await newEclvToken.connect(owner).setTGETime(tgeTime);
      
      // Deploy TokenVesting with NFTManager as configSource
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address);
      await vesting.waitForDeployment();
      
      // Mine tokens to vesting contract
      await newEclvToken.connect(oracle).mineTokens(owner.address, ethers.parseEther("1000000"));
      await newEclvToken.connect(owner).transfer(await vesting.getAddress(), ethers.parseEther("1000000"));
      
      // Verify TGE time is readable from vesting (via configSource -> eclvToken)
      expect(await vesting.tgeTime()).to.equal(tgeTime);
      
      // Verify contract balance
      expect(await vesting.getContractBalance()).to.equal(ethers.parseEther("1000000"));
    });
  });

  describe("Scenario 5: 分发奖励后更换 ECLV Token", function () {
    it("Should migrate vaultRewards when changing ECLV token", async function () {
      const { nftManagerFacet, rewardFacet, adminFacet, oldEclvToken, newEclvToken, master, oracle, user1, usdt, nftManagerAddress, oldEclvAddress, newEclvAddress } = await loadFixture(deployBaseFixture);
      
      // Setup: mint NFT
      await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.connect(master).createBatch(100, price);
      await usdt.connect(user1).approve(nftManagerAddress, price);
      await nftManagerFacet.connect(user1).mintNFT();
      
      // Set NFTManager as oracle for old token to allow mining
      await oldEclvToken.setOracle(nftManagerAddress);
      
      // Distribute rewards (creates vaultRewards for unminted NFTs)
      await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("100000"));
      
      // Check vaultRewards for old token
      const vaultRewardsBefore = await adminFacet.getVaultRewards(oldEclvAddress);
      expect(vaultRewardsBefore).to.be.gt(0);
      
      // Change ECLV Token
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      
      // Check vaultRewards migrated to new token
      const newVaultRewards = await adminFacet.getVaultRewards(newEclvAddress);
      const oldVaultRewardsAfter = await adminFacet.getVaultRewards(oldEclvAddress);
      
      expect(newVaultRewards).to.equal(vaultRewardsBefore);
      expect(oldVaultRewardsAfter).to.equal(0n);
    });
  });

  describe("Scenario 6: 边界条件测试", function () {
    it("Should NOT allow setting same ECLV token address", async function () {
      const { adminFacet, master, oldEclvAddress } = await loadFixture(deployBaseFixture);
      
      await expect(
        adminFacet.connect(master).setEclvToken(oldEclvAddress)
      ).to.be.revertedWith("Same address");
    });

    it("Should NOT allow setting zero address", async function () {
      const { adminFacet, master } = await loadFixture(deployBaseFixture);
      
      await expect(
        adminFacet.connect(master).setEclvToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid ECLV token address");
    });

    it("Should only allow master to change ECLV token", async function () {
      const { adminFacet, user1, newEclvAddress } = await loadFixture(deployBaseFixture);
      
      await expect(
        adminFacet.connect(user1).setEclvToken(newEclvAddress)
      ).to.be.revertedWith("Only master or owner");
    });
  });

  describe("Complete Flow: 铸造NFT → 更换Token → 设置TGE → 验证功能", function () {
    it("Should complete full flow: mint NFTs -> change ECLV -> set TGE -> unlock -> withdraw", async function () {
      const { 
        nftManagerFacet, adminFacet, nodeNFT,
        oldEclvToken, newEclvToken, usdt,
        owner, oracle, master, user1,
        nftManagerAddress, newEclvAddress 
      } = await loadFixture(deployBaseFixture);

      console.log("    Step 1: Mint NFTs (TGE not set)");
      await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
      const price = ethers.parseUnits("1000", 18);
      await nftManagerFacet.connect(master).createBatch(100, price);
      
      // Mint 2 NFTs
      await usdt.connect(user1).approve(nftManagerAddress, price * 2n);
      await nftManagerFacet.connect(user1).mintNFT();
      await nftManagerFacet.connect(user1).mintNFT();
      
      expect(await adminFacet.totalMinted()).to.equal(2n);
      expect(await nodeNFT.ownerOf(1)).to.equal(user1.address);
      expect(await nodeNFT.ownerOf(2)).to.equal(user1.address);

      console.log("    Step 2: Verify TGE not set, unlock amount is 0");
      expect(await adminFacet.tgeTime()).to.equal(0n);
      expect(await nftManagerFacet.calculateUnlockedAmount(1)).to.equal(0n);

      console.log("    Step 3: Change ECLV Token");
      await adminFacet.connect(master).setEclvToken(newEclvAddress);
      expect(await adminFacet.eclvToken()).to.equal(newEclvAddress);

      console.log("    Step 4: Set TGE on new token");
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await newEclvToken.connect(owner).setTGETime(tgeTime);
      expect(await adminFacet.tgeTime()).to.equal(tgeTime);

      console.log("    Step 5: Verify unlock still 0 (lock period not passed)");
      expect(await nftManagerFacet.calculateUnlockedAmount(1)).to.equal(0n);

      console.log("    Step 6: Mine ECLV to NFTManager (within yearly allowance)");
      await newEclvToken.connect(oracle).mineTokens(nftManagerAddress, ethers.parseEther("4000000"));

      console.log("    Step 7: Fast forward past lock period + 3 unlock periods");
      await time.increaseTo(tgeTime + ONE_YEAR + 3 * ONE_MONTH);

      console.log("    Step 8: Verify unlocked amount");
      const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
      const ECLV_PER_NFT = await adminFacet.ECLV_PER_NFT();
      const expected = (ECLV_PER_NFT * 12n) / 100n; // 3 periods * 4%
      expect(unlockedAmount).to.be.closeTo(expected, ethers.parseEther("1"));

      console.log("    Step 9: Withdraw unlocked tokens");
      const balanceBefore = await newEclvToken.balanceOf(user1.address);
      await nftManagerFacet.connect(user1).withdrawUnlocked(1);
      const balanceAfter = await newEclvToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(expected, ethers.parseEther("1"));

      console.log("    Step 10: Verify second NFT also works");
      const unlockedAmount2 = await nftManagerFacet.calculateUnlockedAmount(2);
      expect(unlockedAmount2).to.be.closeTo(expected, ethers.parseEther("1"));
      
      await nftManagerFacet.connect(user1).withdrawUnlocked(2);
      const finalBalance = await newEclvToken.balanceOf(user1.address);
      expect(finalBalance - balanceBefore).to.be.closeTo(expected * 2n, ethers.parseEther("2"));

      console.log("    ✅ Complete flow verified successfully!");
    });
  });
});

