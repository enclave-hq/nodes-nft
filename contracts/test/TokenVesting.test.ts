import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { TokenVesting } from "../typechain-types";
import { EnclaveToken } from "../typechain-types";

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
    const [owner, beneficiary1, beneficiary2, beneficiary3, other] = await ethers.getSigners();

    // Deploy EnclaveToken
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const token = await EnclaveToken.deploy(owner.address) as EnclaveToken;
    await token.waitForDeployment();

    // Deploy TokenVesting
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await TokenVesting.deploy(await token.getAddress(), owner.address) as TokenVesting;
    await vesting.waitForDeployment();

    // Set TGE time to current block timestamp
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
    await vesting.setTGETime(tgeTime);

    // Vesting amounts (based on actual distribution)
    const teamAmount = ethers.parseEther("10000000"); // 10M
    const saft1Amount = ethers.parseEther("6000000"); // 6M
    const saft2Amount = ethers.parseEther("4000000"); // 4M

    // Mint tokens to owner
    const totalAmount = teamAmount + saft1Amount + saft2Amount;
    // Note: EnclaveToken mints 70M in constructor, so we have enough

    // Transfer tokens to vesting contract
    await token.transfer(await vesting.getAddress(), totalAmount);

    return {
      token,
      vesting,
      owner,
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
    };
  }

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      const { token, vesting } = await loadFixture(deployTokenVestingFixture);
      expect(await vesting.token()).to.equal(await token.getAddress());
    });

    it("Should set the right owner", async function () {
      const { vesting, owner } = await loadFixture(deployTokenVestingFixture);
      expect(await vesting.owner()).to.equal(owner.address);
    });

    it("Should allow setting TGE time", async function () {
      const { vesting } = await loadFixture(deployTokenVestingFixture);
      const tgeTime = Math.floor(Date.now() / 1000);
      await expect(vesting.setTGETime(tgeTime))
        .to.emit(vesting, "TGESet")
        .withArgs(tgeTime);
    });

    it("Should not allow setting TGE time in the future", async function () {
      const { vesting } = await loadFixture(deployTokenVestingFixture);
      const futureTime = Math.floor(Date.now() / 1000) + 86400; // 1 day in future
      await expect(vesting.setTGETime(futureTime)).to.be.revertedWith(
        "TokenVesting: TGE time cannot be in the future"
      );
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
          beneficiary1.address,
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH,
          anyValue,
          anyValue
        );

      expect(await vesting.isBeneficiary(beneficiary1.address)).to.be.true;
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

    it("Should not allow creating duplicate vesting schedule", async function () {
      const { vesting, beneficiary1, teamAmount, ONE_YEAR, ONE_MONTH } = await loadFixture(
        deployTokenVestingFixture
      );

      await vesting.createVestingSchedule(
        beneficiary1.address,
        teamAmount,
        ONE_YEAR,
        32 * ONE_MONTH
      );

      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          teamAmount,
          ONE_YEAR,
          32 * ONE_MONTH
        )
      ).to.be.revertedWith("TokenVesting: schedule already exists");
    });

    it("Should not allow creating schedule without TGE time", async function () {
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const [owner, beneficiary] = await ethers.getSigners();
      
      const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
      const token = await EnclaveToken.deploy(owner.address);
      await token.waitForDeployment();

      const vesting = await TokenVesting.deploy(await token.getAddress(), owner.address);
      await vesting.waitForDeployment();

      await expect(
        vesting.createVestingSchedule(
          beneficiary.address,
          ethers.parseEther("1000000"),
          365 * 24 * 60 * 60,
          32 * 30 * 24 * 60 * 60
        )
      ).to.be.revertedWith("TokenVesting: TGE time not set");
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

      const releasable = await vesting.calculateReleasable(beneficiary1.address);
      expect(releasable).to.equal(0);

      await expect(vesting.connect(beneficiary1).release()).to.be.revertedWith(
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

      // Fast forward past lock period
      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH); // 1 month after start

      const releasable = await vesting.calculateReleasable(beneficiary1.address);
      expect(releasable).to.be.gt(0);

      const balanceBefore = await token.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).release();
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.equal(releasable);
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

      const startTime = Number(tgeTime) + ONE_YEAR;
      
      // After 1 month of release period (1/32 of total)
      await time.increaseTo(startTime + ONE_MONTH);
      let releasable = await vesting.calculateReleasable(beneficiary1.address);
      const expected1 = teamAmount / BigInt(32);
      expect(releasable).to.be.closeTo(expected1, ethers.parseEther("1000")); // Allow small rounding error

      await vesting.connect(beneficiary1).release();

      // After 2 months of release period (2/32 of total, but 1/32 already released)
      await time.increaseTo(startTime + 2 * ONE_MONTH);
      releasable = await vesting.calculateReleasable(beneficiary1.address);
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

      // Fast forward past end time
      await time.increaseTo(endTime + ONE_MONTH);

      const releasable = await vesting.calculateReleasable(beneficiary1.address);
      expect(releasable).to.equal(teamAmount);

      const balanceBefore = await token.balanceOf(beneficiary1.address);
      await vesting.connect(beneficiary1).release();
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.equal(teamAmount);
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

      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH);

      const releasable = await vesting.calculateReleasable(beneficiary1.address);
      const balanceBefore = await token.balanceOf(beneficiary1.address);
      
      await vesting.connect(owner).release(beneficiary1.address);
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter - balanceBefore).to.equal(releasable);
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

      const startTime = Number(tgeTime) + ONE_YEAR;
      await time.increaseTo(startTime + ONE_MONTH);

      const balance1Before = await token.balanceOf(beneficiary1.address);
      const balance2Before = await token.balanceOf(beneficiary2.address);

      await vesting.connect(owner).releaseBatch([beneficiary1.address, beneficiary2.address]);

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

      const [schedule, releasable] = await vesting.getVestingInfo(beneficiary1.address);
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

      await expect(
        vesting.connect(other).release(beneficiary1.address)
      ).to.be.revertedWith("TokenVesting: not authorized");
    });
  });
});

