// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibNFTManagerStorage.sol";
import "../libraries/LibNFTManager.sol";
import "../../libraries/RewardCalculator.sol";

/**
 * @title RewardFacet
 * @notice Handles all reward functionality: claiming, distribution, config, multisig, burning
 * @dev Unified Facet combining 5 smaller Facets
 */
contract RewardFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ========== MODIFIERS ========== */
    
    modifier onlyOracle() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.oracle || msg.sender == s.oracleMultisig, "Only oracle or oracle multisig");
        _;
    }
    
    modifier onlyMaster() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(
            msg.sender == s.master || 
            msg.sender == LibNFTManager.contractOwner() || 
            msg.sender == s.multisigner,
            "Only master, owner, or multisigner"
        );
        _;
    }

    /* ========== CLAIM FUNCTIONS ========== */
    
    function claimProduced(uint256 nftId) public nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        _checkTerminationTimeout(s, nftId);
        
        uint256 amount = _getPendingProduced(s, nftId);
        
        if (amount > 0) {
            // Check contract balance before updating state
            uint256 balance = s.eclvToken.balanceOf(address(this));
            require(balance >= amount, "Insufficient contract balance");
            
            if (pool.status == LibNFTManagerStorage.NFTStatus.Active || 
                pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination) {
                pool.producedWithdrawn += amount;
            }
            // Use safeTransfer for better error handling
            IERC20(address(s.eclvToken)).safeTransfer(msg.sender, amount);
            emit ProducedClaimed(nftId, msg.sender, amount);
        }
        
        return amount;
    }
    
    function claimReward(uint256 nftId, address token) public nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        require(s.isRewardToken[token], "Token not supported");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        _checkTerminationTimeout(s, nftId);
        
        uint256 amount = _getPendingReward(s, nftId, token);
        
        if (amount > 0) {
            if (pool.status == LibNFTManagerStorage.NFTStatus.Active || 
                pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination) {
                pool.rewardWithdrawn[token] += amount;
            }
            IERC20(token).safeTransfer(msg.sender, amount);
            emit RewardClaimed(nftId, msg.sender, token, amount);
        }
        
        return amount;
    }
    
    function claimAllRewards(uint256 nftId) external nonReentrant returns (
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 totalClaimed
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        _checkTerminationTimeout(s, nftId);
        
        uint256 tokenCount = s.rewardTokens.length;
        tokens = new address[](tokenCount);
        amounts = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = s.rewardTokens[i];
            tokens[i] = token;
            
            uint256 amount = _getPendingReward(s, nftId, token);
            amounts[i] = amount;
            
            if (amount > 0) {
                if (pool.status == LibNFTManagerStorage.NFTStatus.Active || 
                    pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination) {
                    pool.rewardWithdrawn[token] += amount;
                }
                IERC20(token).safeTransfer(msg.sender, amount);
                totalClaimed += amount;
                emit RewardClaimed(nftId, msg.sender, token, amount);
            }
        }
        
        return (tokens, amounts, totalClaimed);
    }

    /* ========== DISTRIBUTION FUNCTIONS ========== */
    
    /**
     * @notice Distribute produced tokens (optimized version - only for active NFTs)
     * @param rewardPerNFT Reward per NFT (calculated based on MAX_SUPPLY for fairness)
     * @dev Oracle only needs to mine tokens for active NFTs, not all 5000
     */
    function distributeProduced(uint256 rewardPerNFT) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(rewardPerNFT > 0, "Reward per NFT must be positive");
        require(s.multisigNode != address(0), "Multisig node not set");
        
        uint256 totalActiveNFTs = s.globalState.totalActiveNFTs;
        require(totalActiveNFTs > 0, "No active NFTs");
        
        // ✅ 使用可配置的多签比例（默认 20% = 2000 BPS）
        uint256 multisigBps = s.multisigRewardBps > 0 ? s.multisigRewardBps : 2000;
        
        // ✅ 计算需要挖矿的实际金额（只计算 Active NFT）
        (uint256 requiredAmount, uint256 nftAmount, uint256 multisigAmount) = 
            RewardCalculator.calculateRequiredOracleAmount(rewardPerNFT, totalActiveNFTs, multisigBps);
        
        // ✅ 只挖矿 Active NFT 对应的金额
        if (nftAmount > 0) {
            s.eclvToken.mineTokens(address(this), nftAmount);
        }
        
        // ✅ 多签部分直接挖矿到 multisigNode
        if (multisigAmount > 0) {
            s.eclvToken.mineTokens(s.multisigNode, multisigAmount);
        }
        
        // ✅ 更新全局索引（仍然按 MAX_SUPPLY 计算，保证公平）
        s.globalState.accProducedPerNFT += rewardPerNFT;
        s.globalState.lastUpdateTime = block.timestamp;
        
        emit MiningDistributed(requiredAmount, nftAmount, multisigAmount);
        emit ProducedDistributed(nftAmount, s.globalState.accProducedPerNFT, block.timestamp);
    }
    
    /**
     * @notice Distribute reward tokens (optimized version - only for active NFTs)
     * @param token Token address
     * @param rewardPerNFT Reward per NFT (calculated based on MAX_SUPPLY for fairness)
     * @dev Oracle only needs to deposit funds for active NFTs, not all 5000
     */
    function distributeReward(address token, uint256 rewardPerNFT) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(rewardPerNFT > 0, "Reward per NFT must be positive");
        require(s.isRewardToken[token], "Token not supported");
        require(s.multisigNode != address(0), "Multisig node not set");
        
        uint256 totalActiveNFTs = s.globalState.totalActiveNFTs;
        require(totalActiveNFTs > 0, "No active NFTs");
        
        // ✅ 使用可配置的多签比例（默认 20% = 2000 BPS）
        uint256 multisigBps = s.multisigRewardBps > 0 ? s.multisigRewardBps : 2000;
        
        // ✅ 计算 Oracle 需要打入的实际金额（只计算 Active NFT）
        (uint256 requiredAmount, uint256 nftAmount, uint256 multisigAmount) = 
            RewardCalculator.calculateRequiredOracleAmount(rewardPerNFT, totalActiveNFTs, multisigBps);
        
        // ✅ Oracle 只需要打入 requiredAmount（Active NFT 资金 + 多签资金）
        IERC20(token).safeTransferFrom(msg.sender, address(this), requiredAmount);
        
        // 累积多签奖励
        s.multisigRewardDistributed[token] += multisigAmount;
        
        // ✅ 更新全局索引（仍然按 MAX_SUPPLY 计算，保证公平）
        s.globalState.accRewardPerNFT[token] += rewardPerNFT;
        s.globalState.lastUpdateTime = block.timestamp;
        
        emit RewardDistributed(token, requiredAmount, nftAmount, multisigAmount, s.globalState.accRewardPerNFT[token], block.timestamp);
    }

    /**
     * @notice Same as distributeReward but without actual token transfer.
     *         Oracle must separately send tokens to this contract.
     *         claimReward will revert if contract balance is insufficient (first-come-first-served).
     * @param token Token address
     * @param rewardPerNFT Reward amount per NFT
     */
    function distributeRewardV2(address token, uint256 rewardPerNFT) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(rewardPerNFT > 0, "Reward per NFT must be positive");
        require(s.isRewardToken[token], "Token not supported");
        require(s.multisigNode != address(0), "Multisig node not set");
        
        uint256 totalActiveNFTs = s.globalState.totalActiveNFTs;
        require(totalActiveNFTs > 0, "No active NFTs");
        
        uint256 multisigBps = s.multisigRewardBps > 0 ? s.multisigRewardBps : 2000;
        
        (uint256 requiredAmount, uint256 nftAmount, uint256 multisigAmount) = 
            RewardCalculator.calculateRequiredOracleAmount(rewardPerNFT, totalActiveNFTs, multisigBps);
        
        // ✅ 与 distributeReward 唯一的区别：不做 safeTransferFrom
        // IERC20(token).safeTransferFrom(msg.sender, address(this), requiredAmount);
        
        s.multisigRewardDistributed[token] += multisigAmount;
        
        s.globalState.accRewardPerNFT[token] += rewardPerNFT;
        s.globalState.lastUpdateTime = block.timestamp;
        
        emit RewardDistributed(token, requiredAmount, nftAmount, multisigAmount, s.globalState.accRewardPerNFT[token], block.timestamp);
    }

    /**
     * @notice Set reward amount per node and pull token from Oracle in one tx
     * @param token Reward token (must be added via addRewardToken)
     * @param nftIds Array of NFT IDs to allocate reward to
     * @param amounts Array of amounts (same length as nftIds); sum will be transferFrom(oracle)
     * @dev Oracle must approve this contract for sum(amounts) before calling. Each node owner can then withdraw via withdrawAllocatedReward().
     * @dev If contract balance is insufficient at withdraw time, withdraw fails until more U is deposited.
     */
    function setNodeRewards(
        address token,
        uint256[] calldata nftIds,
        uint256[] calldata amounts
    ) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.isRewardToken[token], "Token not supported");
        require(nftIds.length == amounts.length, "Length mismatch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < nftIds.length; i++) {
            totalAmount += amounts[i];
            s.allocatedReward[token][nftIds[i]] += amounts[i];
        }
        require(totalAmount > 0, "Total amount must be positive");

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        emit NodeRewardsSet(token, totalAmount);
    }

    /**
     * @notice Withdraw the reward amount that was allocated to this node (via setNodeRewards)
     * @param nftId NFT ID (caller must be owner)
     * @param token Reward token address
     * @dev Fails if contract has insufficient token balance (user can retry later when U is deposited)
     */
    function withdrawAllocatedReward(uint256 nftId, address token) external nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        require(s.isRewardToken[token], "Token not supported");

        uint256 amount = s.allocatedReward[token][nftId];
        require(amount > 0, "No allocated reward");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient contract balance");

        s.allocatedReward[token][nftId] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit AllocatedRewardWithdrawn(nftId, msg.sender, token, amount);
        return amount;
    }

    /**
     * @notice Credit reward allocations without pulling tokens from Oracle.
     *         Oracle must separately transfer tokens to this contract.
     *         Users call withdrawAllocatedReward(); if contract balance is
     *         insufficient at that time the withdraw reverts (first-come-first-served).
     */
    function setNodeRewardsCredit(
        address token,
        uint256[] calldata nftIds,
        uint256[] calldata amounts
    ) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.isRewardToken[token], "Token not supported");
        require(nftIds.length == amounts.length, "Length mismatch");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < nftIds.length; i++) {
            totalAmount += amounts[i];
            s.allocatedReward[token][nftIds[i]] += amounts[i];
        }
        require(totalAmount > 0, "Total amount must be positive");

        emit NodeRewardsCredited(token, totalAmount, nftIds.length);
    }

    /**
     * @notice View: get allocated reward amount for a node (for direct withdrawal)
     */
    function getAllocatedReward(uint256 nftId, address token) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.allocatedReward[token][nftId];
    }

    /* ========== CONFIG FUNCTIONS ========== */
    
    function setMultisigNode(address multisigNode_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(multisigNode_ != address(0), "Invalid multisig node");
        s.multisigNode = multisigNode_;
        emit MultisigNodeSet(multisigNode_);
    }
    
    function setOracle(address oracle_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(oracle_ != address(0), "Invalid oracle");
        s.oracle = oracle_;
        emit OracleSet(oracle_);
    }
    
    function setOracleMultisig(address oracleMultisig_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(oracleMultisig_ != address(0), "Invalid oracle multisig");
        s.oracleMultisig = oracleMultisig_;
        emit OracleMultisigSet(oracleMultisig_);
    }
    
    function addRewardToken(address token) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(token != address(0), "Invalid token address");
        require(!s.isRewardToken[token], "Token already added");
        
        s.rewardTokens.push(token);
        s.isRewardToken[token] = true;
        emit RewardTokenAdded(token);
    }
    
    function removeRewardToken(address token) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.isRewardToken[token], "Token not added");
        
        s.isRewardToken[token] = false;
        
        for (uint256 i = 0; i < s.rewardTokens.length; i++) {
            if (s.rewardTokens[i] == token) {
                s.rewardTokens[i] = s.rewardTokens[s.rewardTokens.length - 1];
                s.rewardTokens.pop();
                break;
            }
        }
        
        emit RewardTokenRemoved(token);
    }
    
    function getRewardTokens() external view returns (address[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.rewardTokens;
    }
    
    /**
     * @notice Set multisig reward ratio in basis points
     * @param bps Basis points (10000 = 100%), e.g., 2000 = 20%
     */
    function setMultisigRewardBps(uint256 bps) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(bps <= 10000, "BPS must be <= 10000");
        s.multisigRewardBps = bps;
        emit MultisigRewardBpsSet(bps);
    }
    
    /**
     * @notice Get multisig reward ratio in basis points
     * @return bps Basis points (default 2000 = 20%)
     */
    function getMultisigRewardBps() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.multisigRewardBps > 0 ? s.multisigRewardBps : 2000; // Default 20%
    }
    
    /**
     * @notice Calculate required amount for Oracle to deposit based on rewardPerNFT
     * @param token Token address
     * @param rewardPerNFT Reward per NFT (calculated based on MAX_SUPPLY)
     * @return requiredAmount Total amount Oracle needs to deposit
     * @return nftAmount Amount for active NFTs
     * @return multisigAmount Amount for multisig
     */
    function calculateRequiredAmountForDistribution(
        address token,
        uint256 rewardPerNFT
    ) external view returns (uint256 requiredAmount, uint256 nftAmount, uint256 multisigAmount) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.isRewardToken[token], "Token not supported");

        uint256 totalActiveNFTs = s.globalState.totalActiveNFTs;
        if (totalActiveNFTs == 0) {
            return (0, 0, 0);
        }

        uint256 multisigBps = s.multisigRewardBps > 0 ? s.multisigRewardBps : 2000;
        (requiredAmount, nftAmount, multisigAmount) =
            RewardCalculator.calculateRequiredOracleAmount(rewardPerNFT, totalActiveNFTs, multisigBps);
    }

    /* ========== MULTISIG REWARD FUNCTIONS ========== */
    
    function claimMultisigReward(address token) external nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.multisigNode, "Only multisig node can claim");
        require(s.isRewardToken[token], "Token not supported");
        
        uint256 totalDistributed = s.multisigRewardDistributed[token];
        uint256 withdrawn = s.multisigRewardWithdrawn[token];
        uint256 available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
        
        require(available > 0, "No reward available");
        
        s.multisigRewardWithdrawn[token] += available;
        IERC20(token).safeTransfer(s.multisigNode, available);
        
        emit MultisigRewardClaimed(token, available, block.timestamp);
        return available;
    }
    
    function claimAllMultisigRewards() external nonReentrant returns (
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 totalClaimed
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.multisigNode, "Only multisig node can claim");
        
        uint256 tokenCount = s.rewardTokens.length;
        tokens = new address[](tokenCount);
        amounts = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = s.rewardTokens[i];
            tokens[i] = token;
            
            uint256 totalDistributed = s.multisigRewardDistributed[token];
            uint256 withdrawn = s.multisigRewardWithdrawn[token];
            uint256 available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
            amounts[i] = available;
            
            if (available > 0) {
                s.multisigRewardWithdrawn[token] += available;
                IERC20(token).safeTransfer(s.multisigNode, available);
                totalClaimed += available;
                emit MultisigRewardClaimed(token, available, block.timestamp);
            }
        }
        
        return (tokens, amounts, totalClaimed);
    }

    /* ========== BURN FUNCTIONS ========== */
    
    function burnTokensFromSwap(uint256 amount, string memory reason) external onlyOracle nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(amount > 0, "Amount must be positive");
        
        uint256 balance = s.eclvToken.balanceOf(address(this));
        if (balance < amount) {
            uint256 needed = amount - balance;
            IERC20(address(s.eclvToken)).safeTransferFrom(msg.sender, address(this), needed);
        }
        
        IERC20(address(s.eclvToken)).approve(address(s.eclvToken), amount);
        s.eclvToken.burnFromSwap(amount, reason);
        
        emit TokensBurnedFromSwap(amount, reason);
    }

    /* ========== INTERNAL FUNCTIONS ========== */
    
    function _getPendingProduced(
        LibNFTManagerStorage.NFTManagerStorage storage s,
        uint256 nftId
    ) internal view returns (uint256) {
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        
        if (pool.status == LibNFTManagerStorage.NFTStatus.Active || 
            pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination) {
            return RewardCalculator.calculatePendingProduced(
                s.globalState.accProducedPerNFT,
                pool.producedWithdrawn
            );
        }
        
        return 0;
    }
    
    function _getPendingReward(
        LibNFTManagerStorage.NFTManagerStorage storage s,
        uint256 nftId,
        address token
    ) internal view returns (uint256) {
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        
        if (pool.status == LibNFTManagerStorage.NFTStatus.Active || 
            pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination) {
            return RewardCalculator.calculatePendingReward(
                s.globalState.accRewardPerNFT[token],
                pool.rewardWithdrawn[token]
            );
        }
        
        return 0;
    }
    
    function _checkTerminationTimeout(
        LibNFTManagerStorage.NFTManagerStorage storage s,
        uint256 nftId
    ) internal {
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        
        if (
            pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination &&
            block.timestamp >= pool.terminationInitiatedAt + s.TERMINATION_COOLDOWN + s.TERMINATION_TIMEOUT
        ) {
            pool.status = LibNFTManagerStorage.NFTStatus.Terminated;
            s.globalState.totalActiveNFTs--;
            emit TerminationConfirmed(nftId, s.nftContract.ownerOf(nftId), block.timestamp);
        }
    }

    /* ========== EVENTS ========== */
    
    event ProducedClaimed(uint256 indexed nftId, address indexed user, uint256 amount);
    event RewardClaimed(uint256 indexed nftId, address indexed user, address indexed token, uint256 amount);
    event TerminationConfirmed(uint256 indexed nftId, address indexed owner, uint256 timestamp);
    event ProducedDistributed(uint256 amount, uint256 accProducedPerNFT, uint256 timestamp);
    event RewardDistributed(address indexed token, uint256 totalAmount, uint256 nftAmount, uint256 multisigAmount, uint256 accRewardPerNFT, uint256 timestamp);
    event MiningDistributed(uint256 totalAmount, uint256 nftAmount, uint256 multisigAmount);
    event VaultUpdated(address indexed token, uint256 amount);
    event MultisigNodeSet(address indexed multisigNode);
    event OracleSet(address indexed oracle);
    event OracleMultisigSet(address indexed oracleMultisig);
    event RewardTokenAdded(address indexed token);
    event RewardTokenRemoved(address indexed token);
    event MultisigRewardClaimed(address indexed token, uint256 amount, uint256 timestamp);
    event TokensBurnedFromSwap(uint256 amount, string reason);
    event MultisigRewardBpsSet(uint256 bps);
    event NodeRewardsSet(address indexed token, uint256 totalAmount);
    event NodeRewardsCredited(address indexed token, uint256 totalAmount, uint256 nftCount);
    event AllocatedRewardWithdrawn(uint256 indexed nftId, address indexed user, address indexed token, uint256 amount);
}

