// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../libraries/LibNFTManagerStorage.sol";
import "../libraries/LibNFTManager.sol";
import "../../libraries/RewardCalculator.sol";
import "../../libraries/UnlockCalculator.sol";

/**
 * @title AdminFacet
 * @notice Handles all admin functionality: roles, config, views
 * @dev Unified Facet combining 3 smaller Facets
 */
contract AdminFacet {
    /* ========== MODIFIERS ========== */
    
    modifier onlyOwner() {
        require(msg.sender == LibNFTManager.contractOwner(), "Only owner");
        _;
    }
    
    modifier onlyMaster() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.master || msg.sender == LibNFTManager.contractOwner(), "Only master or owner");
        _;
    }

    /* ========== ROLE FUNCTIONS ========== */
    
    function setMaster(address master_) external onlyOwner {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(master_ != address(0), "Invalid master address");
        s.master = master_;
        emit MasterSet(master_);
    }
    
    function setOracle(address oracle_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(oracle_ != address(0), "Invalid oracle address");
        s.oracle = oracle_;
        emit OracleSet(oracle_);
    }
    
    function setTreasury(address treasury_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(treasury_ != address(0), "Invalid treasury address");
        s.treasury = treasury_;
        emit TreasurySet(treasury_);
    }
    
    function setMultisigNode(address multisigNode_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(multisigNode_ != address(0), "Invalid multisig node address");
        s.multisigNode = multisigNode_;
        emit MultisigNodeSet(multisigNode_);
    }
    
    function setOracleMultisig(address oracleMultisig_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(oracleMultisig_ != address(0), "Invalid oracle multisig address");
        s.oracleMultisig = oracleMultisig_;
        emit OracleMultisigSet(oracleMultisig_);
    }
    
    function setOperator(address operator_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        s.operator = operator_;
        emit OperatorSet(operator_);
    }

    /* ========== CONFIG FUNCTIONS ========== */
    
    function setTransfersEnabled(bool enabled) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        s.transfersEnabled = enabled;
        emit TransfersEnabled(enabled);
    }
    
    function transfersEnabled() external view returns (bool) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.transfersEnabled;
    }
    
    // setTgeTime removed - TGE is now managed by EnclaveToken
    // Use EnclaveToken.setTGETime() to set TGE time
    
    function setNodeNFT(address nodeNFT_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(nodeNFT_ != address(0), "Invalid NodeNFT address");
        s.nodeNFT = NodeNFT(nodeNFT_);
        s.nftContract = IERC721(nodeNFT_);
        emit NodeNFTSet(nodeNFT_);
    }
    
    /**
     * @notice Set ECLV Token address (can only be changed before TGE is set)
     * @dev This function allows updating ECLV Token address before TGE
     *      After TGE is set, changing address would break unlock calculations
     * @param eclvToken_ New ECLV Token address
     */
    function setEclvToken(address eclvToken_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(eclvToken_ != address(0), "Invalid ECLV token address");
        require(eclvToken_ != address(s.eclvToken), "Same address");
        
        // Check TGE is not set yet (can only change before TGE)
        uint256 currentTge = s.eclvToken.tgeTime();
        require(currentTge == 0, "Cannot change ECLV token after TGE is set");
        
        address oldEclv = address(s.eclvToken);
        
        // Check and migrate vaultRewards if any
        uint256 oldVaultRewards = s.vaultRewards[oldEclv];
        if (oldVaultRewards > 0) {
            // Migrate vault rewards to new address
            s.vaultRewards[eclvToken_] = oldVaultRewards;
            s.vaultRewards[oldEclv] = 0;
            emit VaultUpdated(oldEclv, 0);
            emit VaultUpdated(eclvToken_, oldVaultRewards);
        }
        
        // Update reward token list
        if (s.isRewardToken[oldEclv]) {
            s.isRewardToken[oldEclv] = false;
            for (uint256 i = 0; i < s.rewardTokens.length; i++) {
                if (s.rewardTokens[i] == oldEclv) {
                    s.rewardTokens[i] = s.rewardTokens[s.rewardTokens.length - 1];
                    s.rewardTokens.pop();
                    break;
                }
            }
            emit RewardTokenRemoved(oldEclv);
        }
        
        if (!s.isRewardToken[eclvToken_]) {
            s.rewardTokens.push(eclvToken_);
            s.isRewardToken[eclvToken_] = true;
            emit RewardTokenAdded(eclvToken_);
        }
        
        // Update ECLV Token reference
        s.eclvToken = EnclaveToken(eclvToken_);
        
        emit EclvTokenUpdated(oldEclv, eclvToken_);
    }
    
    function setUsdtToken(address usdtToken_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(usdtToken_ != address(0), "Invalid USDT address");
        require(usdtToken_ != address(s.usdtToken), "Same address");
        
        address oldUsdt = address(s.usdtToken);
        
        if (s.isRewardToken[oldUsdt]) {
            s.isRewardToken[oldUsdt] = false;
            
            for (uint256 i = 0; i < s.rewardTokens.length; i++) {
                if (s.rewardTokens[i] == oldUsdt) {
                    s.rewardTokens[i] = s.rewardTokens[s.rewardTokens.length - 1];
                    s.rewardTokens.pop();
                    break;
                }
            }
            
            emit RewardTokenRemoved(oldUsdt);
        }
        
        s.usdtToken = IERC20(usdtToken_);
        s.paymentToken = IERC20(usdtToken_);
        
        if (!s.isRewardToken[usdtToken_]) {
            s.rewardTokens.push(usdtToken_);
            s.isRewardToken[usdtToken_] = true;
            emit RewardTokenAdded(usdtToken_);
        }
        
        emit UsdtTokenUpdated(oldUsdt, usdtToken_);
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

    /* ========== VIEW FUNCTIONS ========== */
    
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.userNFTList[user];
    }
    
    function getNFTPool(uint256 nftId) external view returns (
        LibNFTManagerStorage.NFTStatus status,
        uint256 createdAt,
        uint256 terminationInitiatedAt,
        uint256 totalEclvLocked,
        uint256 remainingMintQuota,
        uint256 unlockedAmount,
        uint256 unlockedWithdrawn,
        uint256 unlockedPeriods,
        uint256 producedWithdrawn
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        // Read TGE time from EnclaveToken (single source of truth)
        uint256 tgeTime_ = s.eclvToken.tgeTime();
        uint256 calculatedUnlocked = UnlockCalculator.calculateUnlockedAmount(tgeTime_, s.ECLV_PER_NFT);
        uint256 calculatedPeriods = UnlockCalculator.calculateUnlockedPeriods(tgeTime_);
        uint256 calculatedRemaining = s.ECLV_PER_NFT > calculatedUnlocked
            ? s.ECLV_PER_NFT - calculatedUnlocked
            : 0;
        return (
            pool.status,
            pool.createdAt,
            pool.terminationInitiatedAt,
            s.ECLV_PER_NFT,
            calculatedRemaining,
            calculatedUnlocked,
            pool.unlockedWithdrawn,
            calculatedPeriods,
            pool.producedWithdrawn
        );
    }
    
    function getPendingProduced(uint256 nftId) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
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
    
    function getPendingReward(uint256 nftId, address token) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
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
    
    function getRewardWithdrawn(uint256 nftId, address token) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.nftId == nftId, "NFT does not exist");
        return pool.rewardWithdrawn[token];
    }
    
    function getAccRewardPerNFT(address token) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.globalState.accRewardPerNFT[token];
    }
    
    function getMultisigRewardInfo(address token) external view returns (
        uint256 totalDistributed,
        uint256 withdrawn,
        uint256 available
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        totalDistributed = s.multisigRewardDistributed[token];
        withdrawn = s.multisigRewardWithdrawn[token];
        available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
        return (totalDistributed, withdrawn, available);
    }
    
    function getAllRewardTokens() external view returns (address[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.rewardTokens;
    }
    
    function getRewardTokenCount() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.rewardTokens.length;
    }
    
    function getTotalActiveNFTs() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.globalState.totalActiveNFTs;
    }
    
    function getVaultRewards(address token) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.vaultRewards[token];
    }
    
    // Additional view functions for testing and compatibility
    function nodeNFT() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return address(s.nodeNFT);
    }
    
    function eclvToken() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return address(s.eclvToken);
    }
    
    function usdtToken() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return address(s.usdtToken);
    }
    
    function treasury() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.treasury;
    }
    
    function oracle() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.oracle;
    }
    
    function master() external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.master;
    }
    
    function tgeTime() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        // Read TGE time from EnclaveToken (single source of truth)
        return s.eclvToken.tgeTime();
    }
    
    function MAX_SUPPLY() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.MAX_SUPPLY;
    }
    
    function ECLV_PER_NFT() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.ECLV_PER_NFT;
    }
    
    function UNLOCK_PERIODS() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.UNLOCK_PERIODS;
    }
    
    function UNLOCK_PERCENTAGE() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.UNLOCK_PERCENTAGE;
    }
    
    function totalMinted() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.totalMinted;
    }
    
    function batches(uint256 batchId) external view returns (
        uint256 batchId_,
        uint256 maxMintable,
        uint256 currentMinted,
        uint256 mintPrice,
        bool active,
        uint256 createdAt
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.Batch storage batch = s.batches[batchId];
        return (
            batch.batchId,
            batch.maxMintable,
            batch.currentMinted,
            batch.mintPrice,
            batch.active,
            batch.createdAt
        );
    }
    
    function nftPools(uint256 nftId) external view returns (
        uint256 nftId_,
        LibNFTManagerStorage.NFTStatus status,
        uint256 createdAt,
        uint256 terminationInitiatedAt,
        uint256 unlockedWithdrawn,
        uint256 producedWithdrawn,
        address minter
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        return (
            pool.nftId,
            pool.status,
            pool.createdAt,
            pool.terminationInitiatedAt,
            pool.unlockedWithdrawn,
            pool.producedWithdrawn,
            pool.minter
        );
    }
    
    function globalState() external view returns (
        uint256 accProducedPerNFT,
        uint256 lastUpdateTime,
        uint256 totalActiveNFTs
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return (
            s.globalState.accProducedPerNFT,
            s.globalState.lastUpdateTime,
            s.globalState.totalActiveNFTs
        );
    }

    /* ========== EVENTS ========== */
    
    event MasterSet(address indexed master);
    event OracleSet(address indexed oracle);
    event TreasurySet(address indexed treasury);
    event MultisigNodeSet(address indexed multisigNode);
    event OracleMultisigSet(address indexed oracleMultisig);
    event OperatorSet(address indexed operator);
    event TransfersEnabled(bool enabled);
    // TgeTimeSet event removed - TGE is now managed by EnclaveToken
    event NodeNFTSet(address indexed nodeNFT);
    event EclvTokenUpdated(address indexed oldEclv, address indexed newEclv);
    event UsdtTokenUpdated(address indexed oldUsdt, address indexed newUsdt);
    event RewardTokenAdded(address indexed token);
    event RewardTokenRemoved(address indexed token);
    event VaultUpdated(address indexed token, uint256 amount);
}

