import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { TokenVesting } from "../typechain-types";
import { EnclaveToken } from "../typechain-types";
import { deployNFTManager } from "./helpers/deployNFTManager";

// Helper for anyValue matcher
const anyValue = () => true;

describe("TokenVesting", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployTokenVestingFixture() {
    const ONE_MONTH = 30 * 24 * 60 * 60; // 30 days in seconds
    const ONE_YEAR = 365 * 24 * 60 * 60; // 365 days in seconds
    const SIX_MONTHS = 180 * 24 * 60 * 60; // 180 days in seconds

    // Deploy contracts
    const [owner, oracle, treasury, beneficiary1, beneficiary2, beneficiary3, other] = await ethers.getSigners();

    // Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Deploy EnclaveToken
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const token = await EnclaveToken.deploy() as EnclaveToken;
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // Set oracle first, then mint tokens BEFORE TGE (no mining limit before TGE)
    await token.setOracle(oracle.address);
    
    // Vesting amounts (based on actual distribution) - mint before TGE
    const teamAmount = ethers.parseEther("10000000"); // 10M
    const saft1Amount = ethers.parseEther("6000000"); // 6M
    const saft2Amount = ethers.parseEther("4000000"); // 4M
    const totalAmount = teamAmount + saft1Amount + saft2Amount;
    
    // Mine tokens to owner BEFORE TGE (within pre-TGE 30M allowance)
    await token.connect(oracle).mineTokens(owner.address, totalAmount);

    // Set TGE time to current block timestamp (after minting)
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
    await token.setTGETime(tgeTime);

    // Deploy NodeNFT
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    const nftAddress = await nodeNFT.getAddress();

    // Deploy NFTManager (Diamond Pattern) - TokenVesting needs this as configSource
    const {
      nftManager,
      nftManagerFacet,
      marketplaceFacet,
      rewardFacet,
      adminFacet,
      nftManagerAddress,
    } = await deployNFTManager(
      nftAddress,
      tokenAddress,
      usdtAddress,
      oracle.address,
      treasury.address,
      owner
    );

    // Configure NodeNFT
    await nodeNFT.setNFTManager(nftManagerAddress);

    // Deploy TokenVesting with NFTManager as configSource
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await TokenVesting.deploy(nftManagerAddress, owner.address) as TokenVesting;
    await vesting.waitForDeployment();

    // Transfer tokens to vesting contract (tokens already minted before TGE)
    await token.transfer(await vesting.getAddress(), totalAmount);

    return {
      token,
      vesting,
      owner,
      oracle,
      treasury,
      beneficiary1,
      beneficiary2,
      beneficiary3,
      other,
      tgeTime: BigInt(tgeTime),
      teamAmount,
      saft1Amount,
      saft2Amount,
      ONE_MONTH,
      ONE_YEAR,
      SIX_MONTHS,
      nftManagerAddress,
      adminFacet,
    };
  }

  describe("Deployment", function () {
    it("Should set the right config source", async function () {
      const { vesting, nftManagerAddress } = await loadFixture(deployTokenVestingFixture);
      expect(await vesting.configSource()).to.equal(nftManagerAddress);
    });

    it("Should set the right owner", async function () {
      const { vesting, owner } = await loadFixture(deployTokenVestingFixture);
      expect(await vesting.owner()).to.equal(owner.address);
    });

    it("Should read TGE time from EnclaveToken (via configSource)", async function () {
      const { vesting, tgeTime } = await loadFixture(deployTokenVestingFixture);
      expect(await vesting.tgeTime()).to.equal(tgeTime);
    });
  });

  describe("Vesting Schedule Creation", function () {
    it("Should create vesting schedule for Team", async function () {
      const { vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH
        )
      )
        .to.emit(vesting, "VestingScheduleCreated")
        .withArgs(
          anyValue, // scheduleId (indexed)
          beneficiary1.address, // beneficiary (indexed)
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH,
          anyValue, // startTime
          anyValue  // endTime
        );

      expect(await vesting.hasSchedules(beneficiary1.address)).to.be.true;
      expect(await vesting.totalVested()).to.equal(teamAmount);
    });

    it("Should create multiple vesting schedules", async function () {
      const { vesting, beneficiary1, beneficiary2, beneficiary3, teamAmount, saft1Amount, saft2Amount, ONE_YEAR, ONE_MONTH, SIX_MONTHS } = await loadFixture(
        deployTokenVestingFixture
      );

      // Team
      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // SAFT1
      await vesting.createVestingSchedule(
        beneficiary2.address,
        saft1Amount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // SAFT2
      await vesting.createVestingSchedule(
        beneficiary3.address,
        saft2Amount,
        SIX_MONTHS,
        32 * ONE_MONTH
      );

      expect(await vesting.getBeneficiaryCount()).to.equal(3);
      expect(await vesting.totalVested()).to.equal(teamAmount + saft1Amount + saft2Amount);
    });

    it("Should allow creating multiple schedules for same beneficiary", async function () {
      const { vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // TokenVesting allows multiple schedules per beneficiary
      // So this should succeed
      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH
        )
      ).to.emit(vesting, "VestingScheduleCreated");
    });
  });

  describe("Token Release", function () {
    it("Should not release tokens before lock period", async function () {
      const { vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // Get schedule ID first
      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];
      
      const releasable = await vesting.calculateReleasable(scheduleId);
      expect(releasable).to.equal(0);
      
      await expect(vesting.connect(beneficiary1).release(scheduleId)).to.be.revertedWith(
        "TokenVesting: no tokens to release"
      );
    });

    it("Should release tokens after lock period", async function () {
      const { token, vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH, tgeTime } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // Get schedule ID
      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];

      // Fast forward past lock period
      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH); // 1 month after start

      const releasable = await vesting.calculateReleasable(scheduleId);
      expect(releasable).to.be.gt(0);

      const balanceBefore = await token.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).releaseAll();
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(releasable, ethers.parseEther("1")); // Allow small rounding error
    });

    it("Should release tokens linearly", async function () {
      const { token, vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH, tgeTime } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // Get schedule ID
      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];

      const startTime = Number(tgeTime) + ONE_YEAR;
      
      // After 1 month of release period (1/32 of total)
      await time.increaseTo(startTime + ONE_MONTH);
      let releasable = await vesting.calculateReleasable(scheduleId);
      const expected1 = teamAmount / BigInt(32);
      expect(releasable).to.be.closeTo(expected1, ethers.parseEther("1000")); // Allow small rounding error

      await vesting.connect(beneficiary1).releaseAll();

      // After 2 months of release period (2/32 of total, but 1/32 already released)
      await time.increaseTo(startTime + 2 * ONE_MONTH);
      releasable = await vesting.calculateReleasable(scheduleId);
      const expected2 = teamAmount / BigInt(32);
      expect(releasable).to.be.closeTo(expected2, ethers.parseEther("1000"));
    });

    it("Should release all tokens after vesting period ends", async function () {
      const { token, vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH, tgeTime } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      const startTime = Number(tgeTime) + ONE_YEAR;
      const endTime = startTime + 32 * ONE_MONTH;

      // Get schedule ID
      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];

      // Fast forward past end time
      await time.increaseTo(endTime + ONE_MONTH);

      const releasable = await vesting.calculateReleasable(scheduleId);
      expect(releasable).to.equal(teamAmount);

      const balanceBefore = await token.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).releaseAll();
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(teamAmount, ethers.parseEther("1")); // Allow small rounding error
    });

    it("Should allow owner to release for beneficiary", async function () {
      const { token, vesting, owner, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH, tgeTime } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // Get schedule ID
      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];

      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH);

      const releasable = await vesting.calculateReleasable(scheduleId);
      const balanceBefore = await token.balanceOf(beneficiary1.address);
      
      // releaseAll has two overloads, use the one with address parameter explicitly
      await vesting.connect(owner)["releaseAll(address)"](beneficiary1.address);
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(releasable, ethers.parseEther("1")); // Allow small rounding error
    });
  });

  describe("Batch Operations", function () {
    it("Should create multiple schedules in batch", async function () {
      const { vesting, beneficiary1, beneficiary2, beneficiary3, teamAmount, saft1Amount, saft2Amount, ONE_YEAR, ONE_MONTH, SIX_MONTHS } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedulesBatch(
        [beneficiary1.address, beneficiary2.address, beneficiary3.address],
        [teamAmount, saft1Amount, saft2Amount],
        [ONE_YEAR, ONE_YEAR, SIX_MONTHS],
        [32 * ONE_MONTH, 32 * ONE_MONTH, 32 * ONE_MONTH]
      );

      expect(await vesting.getBeneficiaryCount()).to.equal(3);
    });

    it("Should release for multiple beneficiaries in batch", async function () {
      const { token, vesting, owner, beneficiary1, beneficiary2, teamAmount, saft1Amount, ONE_YEAR, ONE_MONTH, tgeTime } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      await vesting.createVestingSchedule(
        beneficiary2.address,
        saft1Amount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      // Get schedule IDs
      const scheduleIds1 = await vesting.getScheduleIds(beneficiary1.address);
      const scheduleIds2 = await vesting.getScheduleIds(beneficiary2.address);
      expect(scheduleIds1.length).to.be.gt(0);
      expect(scheduleIds2.length).to.be.gt(0);
      const scheduleId1 = scheduleIds1[0];
      const scheduleId2 = scheduleIds2[0];

      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH);

      const balance1Before = await token.balanceOf(beneficiary1.address);
      const balance2Before = await token.balanceOf(beneficiary2.address);

      // releaseBatch takes schedule IDs, not addresses
      await vesting.connect(owner).releaseBatch([scheduleId1, scheduleId2]);

      const balance1After = await token.balanceOf(beneficiary1.address);
      const balance2After = await token.balanceOf(beneficiary2.address);

      expect(balance1After - balance1Before).to.be.gt(0);
      expect(balance2After - balance2Before).to.be.gt(0);
    });
  });

  describe("View Functions", function () {
    it("Should return correct vesting info", async function () {
      const { vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];
      const [schedule, releasable] = await vesting.getVestingInfo(scheduleId);
      expect(schedule.beneficiary).to.equal(beneficiary1.address);
      expect(schedule.totalAmount).to.equal(teamAmount);
      expect(schedule.lockPeriod).to.equal(ONE_YEAR);
      expect(schedule.releaseDuration).to.equal(32 * ONE_MONTH);
      expect(releasable).to.equal(0); // Before lock period
    });

    it("Should return all beneficiaries", async function () {
      const { vesting, beneficiary1, beneficiary2, teamAmount, saft1Amount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      await vesting.createVestingSchedule(
        beneficiary2.address,
        saft1Amount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      const beneficiaries = await vesting.getAllBeneficiaries();
      expect(beneficiaries.length).to.equal(2);
      expect(beneficiaries).to.include(beneficiary1.address);
      expect(beneficiaries).to.include(beneficiary2.address);
    });

    it("Should get contract balance", async function () {
      const { vesting, teamAmount, saft1Amount, saft2Amount } = await loadFixture(
        deployTokenVestingFixture
      );

      const totalAmount = teamAmount + saft1Amount + saft2Amount;
      const balance = await vesting.getContractBalance();
      expect(balance).to.equal(totalAmount);
    });
  });

  describe("Access Control", function () {
    it("Should not allow non-owner to create vesting schedule", async function () {
      const { vesting, other, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await expect(
        vesting.connect(other).createVestingSchedule(
          beneficiary1.address,
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH
        )
      ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
    });

    it("Should not allow non-beneficiary to release for others", async function () {
      const { vesting, beneficiary1, other, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      const scheduleIds = await vesting.getScheduleIds(beneficiary1.address);
      expect(scheduleIds.length).to.be.gt(0);
      const scheduleId = scheduleIds[0];
      
      await expect(
        vesting.connect(other).release(scheduleId)
      ).to.be.revertedWith("TokenVesting: not authorized");
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow owner to emergency withdraw", async function () {
      const { vesting, token, owner, teamAmount, saft1Amount, saft2Amount } = await loadFixture(
        deployTokenVestingFixture
      );

      const withdrawAmount = ethers.parseEther("1000000"); // 1M
      const ownerBalanceBefore = await token.balanceOf(owner.address);
      
      await vesting.emergencyWithdraw(withdrawAmount);
      
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(withdrawAmount);
    });

    it("Should not allow non-owner to emergency withdraw", async function () {
      const { vesting, other } = await loadFixture(
        deployTokenVestingFixture
      );

      await expect(
        vesting.connect(other).emergencyWithdraw(ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
    });
  });
});
