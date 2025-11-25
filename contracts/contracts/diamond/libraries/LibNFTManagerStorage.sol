// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../../NodeNFT.sol";
import "../../EnclaveToken.sol";

/**
 * @title LibNFTManagerStorage
 * @notice Shared storage library for NFTManager Diamond
 * @dev All facets (NFTManager, Marketplace, RewardDistributor) share the same storage layout
 */
library LibNFTManagerStorage {
    bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("diamond.standard.nftmanager.storage");

    /* ========== ENUMS ========== */
    
    enum NFTStatus {
        Active,
        PendingTermination,
        Terminated
    }
    
    enum OrderStatus {
        Active,
        Cancelled,
        Filled
    }

    /* ========== STRUCTS ========== */
    
    struct GlobalState {
        uint256 accProducedPerNFT;
        mapping(address => uint256) accRewardPerNFT;
        uint256 totalActiveNFTs;
        uint256 lastUpdateTime;
    }
    
    struct Batch {
        uint256 batchId;
        uint256 maxMintable;
        uint256 currentMinted;
        uint256 mintPrice;
        bool active;
        uint256 createdAt;
    }
    
    struct NFTPool {
        uint256 nftId;
        NFTStatus status;
        uint256 createdAt;
        uint256 terminationInitiatedAt;
        uint256 unlockedWithdrawn;
        uint256 producedWithdrawn;
        mapping(address => uint256) rewardWithdrawn;
        address minter;
    }
    
    // Marketplace structures
    struct SellOrder {
        uint256 orderId;
        uint256 nftId;
        address seller;
        uint256 price;
        uint256 createdAt;
        OrderStatus status;
    }
    
    // RewardDistributor structures (already in NFTManager, but kept for clarity)
    // Note: RewardDistributor uses NFTManager's storage for multisig rewards

    struct NFTManagerStorage {
        // Constants (stored for access)
        uint256 MAX_SUPPLY;
        uint256 ECLV_PER_NFT;
        uint256 UNLOCK_PERIODS;
        uint256 UNLOCK_PERCENTAGE;
        uint256 UNLOCK_INTERVAL;
        uint256 LOCK_PERIOD;
        uint256 TERMINATION_COOLDOWN;
        uint256 TERMINATION_TIMEOUT;
        
        // Contract references
        NodeNFT nodeNFT;
        EnclaveToken eclvToken;
        IERC20 usdtToken;
        IERC721 nftContract; // For marketplace (same as nodeNFT, but typed as IERC721)
        IERC20 paymentToken; // For marketplace (same as usdtToken, but typed as IERC20)
        
        // Roles
        address oracle;
        address treasury;
        address multisigNode;
        address master;
        address oracleMultisig;
        address operator;
        
        // State
        GlobalState globalState;
        mapping(uint256 => Batch) batches;
        uint256 currentBatchId;
        uint256 totalMinted;
        mapping(uint256 => NFTPool) nftPools;
        mapping(address => uint256[]) userNFTList;
        address[] rewardTokens;
        mapping(address => bool) isRewardToken;
        // tgeTime removed - now read from eclvToken.tgeTime()
        mapping(address => uint256) vaultRewards;
        mapping(address => bool) whitelist;
        address[] whitelistAddresses; // Array to store all whitelisted addresses for enumeration
        uint256 whitelistCount;
        bool transfersEnabled;
        mapping(address => uint256) multisigRewardDistributed;
        mapping(address => uint256) multisigRewardWithdrawn;
        
        // ========== MARKETPLACE STORAGE ==========
        // Marketplace state (integrated into Diamond)
        mapping(uint256 => SellOrder) sellOrders;
        mapping(uint256 => uint256) nftActiveOrder; // nftId => orderId
        uint256 nextOrderId;
        uint256[] activeOrderIds;
        uint256 marketFeeRate;
    }

    function getStorage() internal pure returns (NFTManagerStorage storage ds) {
        bytes32 position = NFT_MANAGER_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}

