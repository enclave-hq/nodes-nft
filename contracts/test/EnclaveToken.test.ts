import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { EnclaveToken } from "../typechain-types";

describe("EnclaveToken - Unit Tests", function () {
  async function deployEnclaveTokenFixture() {
    const [owner, oracle, treasury, user1] = await ethers.getSigners();

    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const token = await EnclaveToken.deploy();
    await token.waitForDeployment();

    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);

    await token.setTGETime(tgeTime);
    await token.setOracle(oracle.address);

    return {
      token,
      owner,
      oracle,
      treasury,
      user1,
      tgeTime: BigInt(tgeTime),
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { token } = await loadFixture(deployEnclaveTokenFixture);
      expect(await token.name()).to.equal("$E");
      expect(await token.symbol()).to.equal("$E");
      expect(await token.decimals()).to.equal(18);
    });

    it("Should have correct constants", async function () {
      const { token } = await loadFixture(deployEnclaveTokenFixture);
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("100000000")); // 100M
      expect(await token.INITIAL_SUPPLY()).to.equal(ethers.parseEther("70000000")); // 70M
    });

    it("Should allow setting TGE time", async function () {
      const { token } = await loadFixture(deployEnclaveTokenFixture);
      const newTgeTime = Math.floor(Date.now() / 1000);
      await expect(token.setTGETime(newTgeTime))
        .to.emit(token, "TGESet")
        .withArgs(newTgeTime);
    });

    it("Should allow setting oracle", async function () {
      const { token, oracle } = await loadFixture(deployEnclaveTokenFixture);
      await expect(token.setOracle(oracle.address))
        .to.emit(token, "OracleSet")
        .withArgs(oracle.address);
    });
  });

  describe("Mining (Before TGE)", function () {
    it("Should allow mining initial supply before TGE", async function () {
      const [owner, oracle, treasury] = await ethers.getSigners();
      
      // Deploy new token without TGE
      const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
      const newToken = await EnclaveToken.deploy();
      await newToken.waitForDeployment();
      
      await newToken.setOracle(oracle.address);
      
      const amount = ethers.parseEther("10000000"); // 10M
      await expect(newToken.connect(oracle).mineTokens(treasury.address, amount))
        .to.emit(newToken, "TokensMined")
        .withArgs(treasury.address, amount, amount, 0);
    });

    it("Should not allow mining more than initial supply before TGE", async function () {
      const [owner, oracle, treasury] = await ethers.getSigners();
      
      // Deploy new token without TGE
      const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
      const newToken = await EnclaveToken.deploy();
      await newToken.waitForDeployment();
      
      await newToken.setOracle(oracle.address);
      
      const tooMuch = ethers.parseEther("71000000"); // 71M > 70M
      await expect(
        newToken.connect(oracle).mineTokens(treasury.address, tooMuch)
      ).to.be.revertedWith("Exceeds initial supply limit");
    });
  });

  describe("Mining (After TGE)", function () {
    it("Should calculate current year correctly", async function () {
      const { token, tgeTime } = await loadFixture(deployEnclaveTokenFixture);
      const currentYear = await token.getCurrentYear();
      expect(currentYear).to.equal(0n); // First year
    });

    it("Should calculate mining allowance for first 6 years", async function () {
      const { token, oracle, treasury } = await loadFixture(deployEnclaveTokenFixture);
      
      const allowance = await token.calculateMiningAllowance();
      expect(allowance).to.equal(ethers.parseEther("5000000")); // 5M per year
    });

    it("Should mine tokens after TGE", async function () {
      const { token, oracle, treasury } = await loadFixture(deployEnclaveTokenFixture);
      
      const amount = ethers.parseEther("1000000"); // 1M
      await expect(token.connect(oracle).mineTokens(treasury.address, amount))
        .to.emit(token, "TokensMined")
        .withArgs(treasury.address, amount, amount, 0);
      
      expect(await token.balanceOf(treasury.address)).to.equal(amount);
      expect(await token.totalMined()).to.equal(amount);
    });

    it("Should not allow mining more than allowance", async function () {
      const { token, oracle, treasury } = await loadFixture(deployEnclaveTokenFixture);
      
      const tooMuch = ethers.parseEther("6000000"); // 6M > 5M allowance
      await expect(
        token.connect(oracle).mineTokens(treasury.address, tooMuch)
      ).to.be.revertedWith("Exceeds mining allowance");
    });

    it("Should track yearly mining", async function () {
      const { token, oracle, treasury } = await loadFixture(deployEnclaveTokenFixture);
      
      const amount = ethers.parseEther("2000000"); // 2M
      await token.connect(oracle).mineTokens(treasury.address, amount);
      
      const currentYear = await token.getCurrentYear();
      const yearMined = await token.yearlyMined(currentYear);
      expect(yearMined).to.equal(amount);
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      const { token, oracle, user1 } = await loadFixture(deployEnclaveTokenFixture);
      
      const amount = ethers.parseEther("1000");
      await token.connect(oracle).mineTokens(user1.address, amount);
      
      const balanceBefore = await token.balanceOf(user1.address);
      const totalBurnedBefore = await token.totalBurned();
      await token.connect(user1).burn(ethers.parseEther("500"));
      const balanceAfter = await token.balanceOf(user1.address);
      const totalBurnedAfter = await token.totalBurned();
      
      expect(balanceBefore - balanceAfter).to.equal(ethers.parseEther("500"));
      // Note: Regular burn() doesn't update totalBurned, only burnFromSwap() does
      expect(totalBurnedAfter).to.equal(totalBurnedBefore);
    });

    it("Should allow oracle to burn from swap", async function () {
      const { token, oracle } = await loadFixture(deployEnclaveTokenFixture);
      
      const amount = ethers.parseEther("1000");
      await token.connect(oracle).mineTokens(oracle.address, amount);
      
      await token.connect(oracle).approve(await token.getAddress(), amount);
      
      await expect(
        token.connect(oracle).burnFromSwap(amount, "swap_buyback")
      )
        .to.emit(token, "TokensBurned")
        .withArgs(oracle.address, amount, amount, "swap_buyback");
      
      expect(await token.totalBurned()).to.equal(amount);
    });

    it("Should track yearly burned amount", async function () {
      const { token, oracle } = await loadFixture(deployEnclaveTokenFixture);
      
      const amount = ethers.parseEther("1000");
      await token.connect(oracle).mineTokens(oracle.address, amount);
      await token.connect(oracle).approve(await token.getAddress(), amount);
      await token.connect(oracle).burnFromSwap(amount, "test");
      
      const currentYear = await token.getCurrentYear();
      const yearBurned = await token.yearlyBurned(currentYear);
      expect(yearBurned).to.equal(amount);
    });
  });

  describe("Mining After 6 Years", function () {
    it("Should calculate mining after 6 years correctly", async function () {
      // Deploy fresh token for this test
      const [owner, oracle, treasury] = await ethers.getSigners();
      const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
      const token = await EnclaveToken.deploy();
      await token.waitForDeployment();
      
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await token.setTGETime(tgeTime);
      await token.setOracle(oracle.address);
      
      // Mine for first 5 years (year 0-4): 5M per year = 25M total
      for (let year = 0; year < 5; year++) {
        await token.connect(oracle).mineTokens(treasury.address, ethers.parseEther("5000000"));
        await time.increase(365 * 24 * 60 * 60);
      }
      
      // Year 5: mine 4M to treasury, then mine and burn 1M
      await token.connect(oracle).mineTokens(treasury.address, ethers.parseEther("4000000"));
      const burnAmount = ethers.parseEther("1000000"); // 1M
      await token.connect(oracle).mineTokens(oracle.address, burnAmount);
      await token.connect(oracle).approve(await token.getAddress(), burnAmount);
      await token.connect(oracle).burnFromSwap(burnAmount, "test");
      
      // Move to year 6 (yearsFromTGE = 6, currentYear = 6)
      await time.increase(365 * 24 * 60 * 60);
      
      const allowance = await token.calculateMiningAllowance();
      // Should be min(previous year burned, 2M) = min(1M, 2M) = 1M
      expect(allowance).to.be.closeTo(ethers.parseEther("1000000"), ethers.parseEther("1000"));
    });

    it("Should cap mining at 2M per year after 6 years", async function () {
      const [owner, oracle, treasury] = await ethers.getSigners();
      const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
      const token = await EnclaveToken.deploy();
      await token.waitForDeployment();
      
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block?.timestamp || Math.floor(Date.now() / 1000);
      await token.setTGETime(tgeTime);
      await token.setOracle(oracle.address);
      
      // Mine for first 5 years
      for (let year = 0; year < 5; year++) {
        await token.connect(oracle).mineTokens(treasury.address, ethers.parseEther("5000000"));
        await time.increase(365 * 24 * 60 * 60);
      }
      
      // Year 5: mine and burn 3M
      const burnAmount = ethers.parseEther("3000000");
      await token.connect(oracle).mineTokens(oracle.address, burnAmount);
      await token.connect(oracle).approve(await token.getAddress(), burnAmount);
      await token.connect(oracle).burnFromSwap(burnAmount, "test");
      
      // Move to year 6
      await time.increase(365 * 24 * 60 * 60);
      
      const allowance = await token.calculateMiningAllowance();
      // Should be min(3M, 2M) = 2M
      expect(allowance).to.be.closeTo(ethers.parseEther("2000000"), ethers.parseEther("1000"));
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set TGE time", async function () {
      const { token, user1 } = await loadFixture(deployEnclaveTokenFixture);
      const tgeTime = Math.floor(Date.now() / 1000);
      
      await expect(
        token.connect(user1).setTGETime(tgeTime)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to set oracle", async function () {
      const { token, user1 } = await loadFixture(deployEnclaveTokenFixture);
      
      await expect(
        token.connect(user1).setOracle(user1.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should only allow oracle to mine tokens", async function () {
      const { token, user1, treasury } = await loadFixture(deployEnclaveTokenFixture);
      
      await expect(
        token.connect(user1).mineTokens(treasury.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Only oracle");
    });

    it("Should only allow oracle to burn from swap", async function () {
      const { token, user1 } = await loadFixture(deployEnclaveTokenFixture);
      
      await expect(
        token.connect(user1).burnFromSwap(ethers.parseEther("1000"), "test")
      ).to.be.revertedWith("Only oracle");
    });
  });
});

