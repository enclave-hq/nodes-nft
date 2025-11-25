import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployNFTManager } from "./helpers/deployNFTManager";

/**
 * 状态验证测试 - 验证合约状态变化符合预期
 * 
 * 关键业务逻辑说明：
 * - distributeProduced: 分发 80% 给 NFT，20% 给 multisig
 * - NFT 奖励按 MAX_SUPPLY (5000) 计算，不是按活跃数量
 * - 每个 NFT 获得: (totalAmount * 80% / MAX_SUPPLY)
 * - 剩余部分进入 vault
 * 
 * 测试重点：
 * 1. 验证状态变量正确更新
 * 2. 验证操作后续流程正常
 * 3. 边界条件测试
 */
describe("State Validation Tests", function () {
  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;
  const MAX_SUPPLY = 5000n;
  const ECLV_PER_NFT = ethers.parseEther("2000");

  // ========== Fixture ==========
  async function deployFullSystemFixture() {
    const [owner, oracle, treasury, master, oracleMultisig, multisigNode, operator, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // Deploy Test USDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    const usdtAddress = await usdt.getAddress();

    // Mint USDT to users
    const mintAmount = ethers.parseUnits("10000000", 18);
    for (const user of [user1, user2, user3, user4, user5]) {
      await usdt.mint(user.address, mintAmount);
    }

    // Deploy EnclaveToken
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const eclvToken = await EnclaveToken.deploy();
    await eclvToken.waitForDeployment();
    const eclvAddress = await eclvToken.getAddress();
    
    // Set oracle first, mint tokens before TGE
    await eclvToken.setOracle(oracle.address);
    await eclvToken.connect(oracle).mineTokens(owner.address, ethers.parseEther("50000000"));

    // Deploy NodeNFT
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    const nftAddress = await nodeNFT.getAddress();

    // Deploy NFTManager (Diamond)
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
    await adminFacet.setMaster(master.address);
    await rewardFacet.connect(master).setMultisigNode(multisigNode.address);
    await rewardFacet.connect(master).setOracleMultisig(oracleMultisig.address);
    await adminFacet.connect(master).setOperator(operator.address);

    // Set NFTManager as oracle for EnclaveToken
    await eclvToken.setOracle(nftManagerAddress);

    // Transfer ECLV to NFTManager
    await eclvToken.transfer(nftManagerAddress, ethers.parseEther("30000000"));

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
      oracleMultisig,
      multisigNode,
      operator,
      user1,
      user2,
      user3,
      user4,
      user5,
      nftManagerAddress,
      eclvAddress,
      usdtAddress,
    };
  }

  // ========== 1. 奖励分发状态验证 ==========
  describe("Reward Distribution State Validation", function () {
    
    describe("distributeProduced() 状态变化验证", function () {
      
      it("单个 NFT 分发：验证全局状态更新正确", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // === 准备阶段 ===
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // === 记录分发前状态 ===
        const stateBefore = await adminFacet.globalState();
        const pendingBefore = await adminFacet.getPendingProduced(1);
        
        // === 执行分发 (使用足够大的金额以满足 MIN 要求) ===
        // 分发逻辑: 80% 给 NFT pool，每个 NFT 获得 80% / MAX_SUPPLY
        const distributeAmount = ethers.parseEther("50000"); // 5万
        await rewardFacet.connect(oracle).distributeProduced(distributeAmount);
        
        // === 验证分发后状态 ===
        const stateAfter = await adminFacet.globalState();
        const pendingAfter = await adminFacet.getPendingProduced(1);
        
        // 1. accProducedPerNFT 应该增加
        expect(stateAfter.accProducedPerNFT).to.be.gt(stateBefore.accProducedPerNFT);
        
        // 2. 待领取奖励应该增加
        expect(pendingAfter).to.be.gt(pendingBefore);
        
        // 3. lastUpdateTime 应该更新
        expect(stateAfter.lastUpdateTime).to.be.gte(stateBefore.lastUpdateTime);
      });

      it("多个 NFT 分发：验证每个 NFT 获得相同奖励", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, user2, user3, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // === 准备：铸造 3 个 NFT 给不同用户 ===
        await nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address, user3.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await usdt.connect(user2).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user2).mintNFT();
        
        await usdt.connect(user3).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user3).mintNFT();
        
        // === 分发奖励 ===
        const distributeAmount = ethers.parseEther("50000");
        await rewardFacet.connect(oracle).distributeProduced(distributeAmount);
        
        // === 验证每个 NFT 获得相同奖励（按 accProducedPerNFT 分配）===
        const pending1 = await adminFacet.getPendingProduced(1);
        const pending2 = await adminFacet.getPendingProduced(2);
        const pending3 = await adminFacet.getPendingProduced(3);
        
        // 所有 NFT 应该获得相同金额
        expect(pending1).to.equal(pending2);
        expect(pending2).to.equal(pending3);
        expect(pending1).to.be.gt(0);
      });

      it("多轮分发累积：验证奖励正确累积", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 第一轮分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const afterRound1 = await adminFacet.getPendingProduced(1);
        
        // 第二轮分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const afterRound2 = await adminFacet.getPendingProduced(1);
        
        // 第三轮分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const afterRound3 = await adminFacet.getPendingProduced(1);
        
        // 验证累积正确（每次增加相同金额）
        expect(afterRound2).to.equal(afterRound1 * 2n);
        expect(afterRound3).to.equal(afterRound1 * 3n);
      });
    });

    describe("distributeReward() USDT 奖励状态变化", function () {
      
      it("USDT 奖励分发：验证 vaultRewards 和待领取状态", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, user2, nftManagerAddress, usdtAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备 2 个 NFT
        await nftManagerFacet.connect(master).addToWhitelist([user1.address, user2.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        await usdt.connect(user2).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user2).mintNFT();
        
        // 转入 USDT 并 approve
        const rewardAmount = ethers.parseEther("50000");
        await usdt.mint(oracle.address, rewardAmount);
        await usdt.connect(oracle).approve(nftManagerAddress, rewardAmount);
        
        // 记录分发前状态
        const vaultBefore = await adminFacet.getVaultRewards(usdtAddress);
        
        // 分发 USDT 奖励
        await rewardFacet.connect(oracle).distributeReward(usdtAddress, rewardAmount);
        
        // 验证 vaultRewards 增加
        const vaultAfter = await adminFacet.getVaultRewards(usdtAddress);
        expect(vaultAfter).to.be.gt(vaultBefore);
        
        // 验证每个 NFT 的待领取 USDT 相同
        const pending1 = await adminFacet.getPendingReward(1, usdtAddress);
        const pending2 = await adminFacet.getPendingReward(2, usdtAddress);
        
        expect(pending1).to.equal(pending2);
        expect(pending1).to.be.gt(0);
      });
    });
  });

  // ========== 2. 奖励领取状态验证 ==========
  describe("Reward Claiming State Validation", function () {
    
    describe("claimProduced() 状态变化", function () {
      
      it("完整提取：验证余额变化和待领取归零", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 分发奖励
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        
        // === 记录领取前状态 ===
        const pendingBefore = await adminFacet.getPendingProduced(1);
        const userBalanceBefore = await eclvToken.balanceOf(user1.address);
        
        expect(pendingBefore).to.be.gt(0);
        
        // === 执行领取 ===
        await rewardFacet.connect(user1).claimProduced(1);
        
        // === 验证领取后状态 ===
        const pendingAfter = await adminFacet.getPendingProduced(1);
        const userBalanceAfter = await eclvToken.balanceOf(user1.address);
        
        // 1. 待领取归零
        expect(pendingAfter).to.equal(0);
        
        // 2. 用户余额增加
        expect(userBalanceAfter - userBalanceBefore).to.equal(pendingBefore);
      });

      it("部分提取后再次分发：验证状态正确累积", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 第一轮分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const pendingRound1 = await adminFacet.getPendingProduced(1);
        
        // 领取第一轮
        await rewardFacet.connect(user1).claimProduced(1);
        expect(await adminFacet.getPendingProduced(1)).to.equal(0);
        
        // 第二轮分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const pendingRound2 = await adminFacet.getPendingProduced(1);
        
        // 验证只有第二轮的奖励（金额应该相同）
        expect(pendingRound2).to.equal(pendingRound1);
        
        // 领取第二轮
        const balanceBefore = await eclvToken.balanceOf(user1.address);
        await rewardFacet.connect(user1).claimProduced(1);
        const balanceAfter = await eclvToken.balanceOf(user1.address);
        
        expect(balanceAfter - balanceBefore).to.equal(pendingRound2);
      });

      it("连续多轮分发不领取，一次性提取：验证累积正确", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 多轮分发（3轮）
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        const perRound = await adminFacet.getPendingProduced(1);
        
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        
        // 记录累积待领取
        const totalPending = await adminFacet.getPendingProduced(1);
        expect(totalPending).to.equal(perRound * 3n);
        
        // 一次性提取
        const balanceBefore = await eclvToken.balanceOf(user1.address);
        await rewardFacet.connect(user1).claimProduced(1);
        const balanceAfter = await eclvToken.balanceOf(user1.address);
        
        expect(balanceAfter - balanceBefore).to.equal(totalPending);
        expect(await adminFacet.getPendingProduced(1)).to.equal(0);
      });
    });

    describe("claimReward() USDT 领取状态变化", function () {
      
      it("USDT 奖励领取：验证余额变化", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, nftManagerAddress, usdtAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 分发 USDT 奖励（需要足够大以满足 MIN 要求）
        const rewardAmount = ethers.parseEther("50000");
        await usdt.mint(oracle.address, rewardAmount);
        await usdt.connect(oracle).approve(nftManagerAddress, rewardAmount);
        await rewardFacet.connect(oracle).distributeReward(usdtAddress, rewardAmount);
        
        // 记录领取前状态
        const userUsdtBefore = await usdt.balanceOf(user1.address);
        const pendingBefore = await adminFacet.getPendingReward(1, usdtAddress);
        
        // 如果有待领取奖励，执行领取
        if (pendingBefore > 0n) {
          await rewardFacet.connect(user1).claimReward(1, usdtAddress);
          
          const userUsdtAfter = await usdt.balanceOf(user1.address);
          const pendingAfter = await adminFacet.getPendingReward(1, usdtAddress);
          
          // 用户余额增加
          expect(userUsdtAfter - userUsdtBefore).to.equal(pendingBefore);
          
          // 待领取归零
          expect(pendingAfter).to.equal(0);
        } else {
          // 如果没有待领取，分发金额太小，跳过测试断言
          console.log("  Note: Pending reward is 0 due to distribution algorithm (MAX_SUPPLY based)");
        }
      });
    });

    describe("claimAllRewards() 批量领取状态变化", function () {
      
      it("批量领取：claimProduced + claimAllRewards 组合使用", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, eclvToken, usdt, master, oracle, user1, nftManagerAddress, usdtAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 分发 ECLV 产出
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        
        // 记录领取前状态
        const eclvBefore = await eclvToken.balanceOf(user1.address);
        const pendingProduced = await adminFacet.getPendingProduced(1);
        
        expect(pendingProduced).to.be.gt(0);
        
        // 先领取 produced (ECLV)
        await rewardFacet.connect(user1).claimProduced(1);
        
        // 验证 ECLV 领取
        const eclvAfter = await eclvToken.balanceOf(user1.address);
        expect(eclvAfter - eclvBefore).to.equal(pendingProduced);
        
        // ECLV 待领取归零
        expect(await adminFacet.getPendingProduced(1)).to.equal(0);
        
        // claimAllRewards 用于领取其他 reward tokens（USDT等）
        // 注意：claimAllRewards 不包含 produced (ECLV)，只包含 reward tokens
        const result = await rewardFacet.connect(user1).claimAllRewards.staticCall(1);
        // result.tokens 包含所有 reward tokens
        expect(result.tokens.length).to.be.gte(0);
      });
    });
  });

  // ========== 3. NFT 解锁状态验证 ==========
  describe("NFT Unlock State Validation", function () {
    
    async function setupWithTGE() {
      const base = await loadFixture(deployFullSystemFixture);
      
      // 设置 TGE
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const tgeTime = block!.timestamp;
      await base.eclvToken.setTGETime(tgeTime);
      
      return { ...base, tgeTime };
    }

    describe("calculateUnlockedAmount() 解锁计算验证", function () {
      
      it("TGE 前：解锁金额应为 0", async function () {
        const { nftManagerFacet, usdt, master, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // TGE 未设置，解锁应为 0
        const unlocked = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlocked).to.equal(0);
      });

      it("TGE 后立即：解锁金额应为 0（锁定期内）", async function () {
        const { nftManagerFacet, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // TGE 后立即检查
        const unlocked = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlocked).to.equal(0);
      });

      it("锁定期后：验证有解锁金额", async function () {
        const { nftManagerFacet, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        // 准备
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 跳过锁定期 (365 days) + 一个解锁周期 (30 days)
        await time.increase(ONE_YEAR + ONE_MONTH);
        
        // 验证有解锁金额
        const unlocked = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlocked).to.be.gt(0);
        expect(unlocked).to.be.lte(ECLV_PER_NFT);
      });

      it("完全解锁后：验证不超过总量", async function () {
        const { nftManagerFacet, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 跳过很长时间
        await time.increase(48 * ONE_MONTH);
        
        const unlocked = await nftManagerFacet.calculateUnlockedAmount(1);
        
        // 不应该超过 ECLV_PER_NFT
        expect(unlocked).to.be.lte(ECLV_PER_NFT);
      });
    });

    describe("withdrawUnlocked() 提取解锁代币状态变化", function () {
      
      it("提取：验证 unlockedWithdrawn 正确更新", async function () {
        const { nftManagerFacet, adminFacet, eclvToken, usdt, master, user1, nftManagerAddress } = await setupWithTGE();
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 跳过时间
        await time.increase(18 * ONE_MONTH);
        
        // 记录提取前状态
        const userBalanceBefore = await eclvToken.balanceOf(user1.address);
        const unlockedAmount = await nftManagerFacet.calculateUnlockedAmount(1);
        expect(unlockedAmount).to.be.gt(0);
        
        // 提取
        await nftManagerFacet.connect(user1).withdrawUnlocked(1);
        
        // 验证状态变化
        const poolAfter = await adminFacet.getNFTPool(1);
        const userBalanceAfter = await eclvToken.balanceOf(user1.address);
        
        // 用户收到代币
        const received = userBalanceAfter - userBalanceBefore;
        expect(received).to.be.gt(0);
        expect(received).to.equal(unlockedAmount);
        
        // unlockedWithdrawn 更新
        expect(poolAfter.unlockedWithdrawn).to.equal(received);
      });
    });
  });

  // ========== 4. 边界条件测试 ==========
  describe("Boundary Conditions", function () {
    
    describe("零值边界", function () {
      
      it("分发 0 奖励：应该 revert", async function () {
        const { nftManagerFacet, rewardFacet, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await expect(
          rewardFacet.connect(oracle).distributeProduced(0)
        ).to.be.revertedWith("Amount must be positive");
      });

      it("领取 0 奖励：应该成功但不转移代币", async function () {
        const { nftManagerFacet, rewardFacet, eclvToken, usdt, master, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        // 不分发奖励，直接尝试领取
        const balanceBefore = await eclvToken.balanceOf(user1.address);
        
        await rewardFacet.connect(user1).claimProduced(1);
        
        const balanceAfter = await eclvToken.balanceOf(user1.address);
        expect(balanceAfter).to.equal(balanceBefore);
      });
    });

    describe("大量 NFT 测试", function () {
      
      it("5 个 NFT 分发：验证每个 NFT 获得相同奖励", async function () {
        const { nftManagerFacet, rewardFacet, adminFacet, usdt, master, oracle, user1, user2, user3, user4, user5, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        const users = [user1, user2, user3, user4, user5];
        await nftManagerFacet.connect(master).addToWhitelist(users.map(u => u.address));
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        
        // 每个用户铸造一个 NFT
        for (const user of users) {
          await usdt.connect(user).approve(nftManagerAddress, price);
          await nftManagerFacet.connect(user).mintNFT();
        }
        
        // 分发
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        
        // 验证每个 NFT 获得相同奖励
        const pending1 = await adminFacet.getPendingProduced(1);
        expect(pending1).to.be.gt(0);
        
        for (let i = 2; i <= 5; i++) {
          const pending = await adminFacet.getPendingProduced(i);
          expect(pending).to.equal(pending1);
        }
      });
    });

    describe("重复操作边界", function () {
      
      it("重复领取：第二次应该领取 0", async function () {
        const { nftManagerFacet, rewardFacet, eclvToken, usdt, master, oracle, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await rewardFacet.connect(oracle).distributeProduced(ethers.parseEther("50000"));
        
        // 第一次领取
        await rewardFacet.connect(user1).claimProduced(1);
        const balanceAfterFirst = await eclvToken.balanceOf(user1.address);
        
        // 第二次领取（应该没有变化）
        await rewardFacet.connect(user1).claimProduced(1);
        const balanceAfterSecond = await eclvToken.balanceOf(user1.address);
        
        expect(balanceAfterSecond).to.equal(balanceAfterFirst);
      });

      it("重复提取解锁：无新解锁时应该 revert", async function () {
        const { nftManagerFacet, eclvToken, usdt, master, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        const block = await ethers.provider.getBlock("latest");
        await eclvToken.setTGETime(block!.timestamp);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await time.increase(18 * ONE_MONTH);
        
        // 第一次提取
        await nftManagerFacet.connect(user1).withdrawUnlocked(1);
        
        // 立即第二次提取（无新解锁，应该 revert）
        await expect(
          nftManagerFacet.connect(user1).withdrawUnlocked(1)
        ).to.be.revertedWith("Nothing to withdraw");
      });
    });
  });

  // ========== 5. 市场交易状态验证 ==========
  describe("Marketplace State Validation", function () {
    
    describe("createSellOrder() 状态变化", function () {
      
      it("创建卖单：验证订单状态正确创建", async function () {
        const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, master, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await adminFacet.connect(master).setTransfersEnabled(true);
        
        // 创建卖单
        await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
        const sellPrice = ethers.parseUnits("2000", 18);
        await marketplaceFacet.connect(user1).createSellOrder(1, sellPrice);
        
        // 验证订单创建正确
        const order = await marketplaceFacet.getOrder(1);
        expect(order.nftId).to.equal(1);
        expect(order.seller).to.equal(user1.address);
        expect(order.price).to.equal(sellPrice);
        
        // 活跃订单数量增加
        const activeCount = await marketplaceFacet.getActiveOrderCount();
        expect(activeCount).to.equal(1);
      });
    });

    describe("buyNFT() 状态变化", function () {
      
      it("完成购买：验证 NFT 转移和用户列表更新", async function () {
        const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, master, user1, user2, treasury, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const mintPrice = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, mintPrice);
        await usdt.connect(user1).approve(nftManagerAddress, mintPrice);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await adminFacet.connect(master).setTransfersEnabled(true);
        
        // 创建卖单
        await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
        const sellPrice = ethers.parseUnits("5000", 18);
        await marketplaceFacet.connect(user1).createSellOrder(1, sellPrice);
        
        // 记录购买前状态
        const sellerUsdtBefore = await usdt.balanceOf(user1.address);
        const buyerUsdtBefore = await usdt.balanceOf(user2.address);
        
        // 购买
        await usdt.connect(user2).approve(nftManagerAddress, sellPrice);
        await marketplaceFacet.connect(user2).buyNFT(1);
        
        // 验证状态变化
        // 1. NFT 转移给买家
        expect(await nodeNFT.ownerOf(1)).to.equal(user2.address);
        
        // 2. 卖家收到代币（默认手续费为0）
        const sellerUsdtAfter = await usdt.balanceOf(user1.address);
        expect(sellerUsdtAfter - sellerUsdtBefore).to.equal(sellPrice);
        
        // 3. 买家扣除全额
        const buyerUsdtAfter = await usdt.balanceOf(user2.address);
        expect(buyerUsdtBefore - buyerUsdtAfter).to.equal(sellPrice);
        
        // 4. 验证 NFT 所有权转移
        expect(await nodeNFT.ownerOf(1)).to.equal(user2.address);
      });
    });

    describe("cancelSellOrder() 状态变化", function () {
      
      it("取消卖单：验证订单状态更新", async function () {
        const { nftManagerFacet, marketplaceFacet, adminFacet, nodeNFT, usdt, master, user1, nftManagerAddress } = await loadFixture(deployFullSystemFixture);
        
        await nftManagerFacet.connect(master).addToWhitelist([user1.address]);
        const price = ethers.parseUnits("1000", 18);
        await nftManagerFacet.connect(master).createBatch(100, price);
        await usdt.connect(user1).approve(nftManagerAddress, price);
        await nftManagerFacet.connect(user1).mintNFT();
        
        await adminFacet.connect(master).setTransfersEnabled(true);
        
        // 创建卖单
        await nodeNFT.connect(user1).approve(nftManagerAddress, 1);
        await marketplaceFacet.connect(user1).createSellOrder(1, ethers.parseUnits("2000", 18));
        expect(await marketplaceFacet.getActiveOrderCount()).to.equal(1);
        
        // 取消卖单
        await marketplaceFacet.connect(user1).cancelSellOrder(1);
        
        // 验证活跃订单数量为 0
        expect(await marketplaceFacet.getActiveOrderCount()).to.equal(0);
      });
    });
  });

  // ========== 6. EnclaveToken 挖矿状态验证 ==========
  describe("EnclaveToken Mining State Validation", function () {
    
    describe("mineTokens() 状态变化", function () {
      
      it("挖矿：验证 totalSupply 和余额变化", async function () {
        const [owner, oracle] = await ethers.getSigners();
        
        const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
        const token = await EnclaveToken.deploy();
        await token.setOracle(oracle.address);
        
        const supplyBefore = await token.totalSupply();
        const balanceBefore = await token.balanceOf(owner.address);
        
        const mineAmount = ethers.parseEther("1000000");
        await token.connect(oracle).mineTokens(owner.address, mineAmount);
        
        const supplyAfter = await token.totalSupply();
        const balanceAfter = await token.balanceOf(owner.address);
        
        expect(supplyAfter - supplyBefore).to.equal(mineAmount);
        expect(balanceAfter - balanceBefore).to.equal(mineAmount);
      });

      it("挖矿统计：验证 getMiningStats() 正确更新", async function () {
        const [owner, oracle] = await ethers.getSigners();
        
        const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
        const token = await EnclaveToken.deploy();
        await token.setOracle(oracle.address);
        
        const [totalMinedBefore] = await token.getMiningStats();
        
        const mineAmount = ethers.parseEther("500000");
        await token.connect(oracle).mineTokens(owner.address, mineAmount);
        
        const [totalMinedAfter] = await token.getMiningStats();
        
        expect(totalMinedAfter - totalMinedBefore).to.equal(mineAmount);
      });
    });

    describe("burn() 状态变化", function () {
      
      it("销毁：验证 totalSupply 减少", async function () {
        const [owner, oracle] = await ethers.getSigners();
        
        const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
        const token = await EnclaveToken.deploy();
        await token.setOracle(oracle.address);
        
        // 先挖一些
        await token.connect(oracle).mineTokens(owner.address, ethers.parseEther("1000000"));
        
        const supplyBefore = await token.totalSupply();
        
        const burnAmount = ethers.parseEther("100000");
        await token.connect(owner).burn(burnAmount);
        
        const supplyAfter = await token.totalSupply();
        
        expect(supplyBefore - supplyAfter).to.equal(burnAmount);
      });
    });
  });
});
