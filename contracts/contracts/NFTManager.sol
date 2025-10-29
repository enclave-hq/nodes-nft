// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NodeNFT.sol";
import "./EnclaveToken.sol";

/**
 * @title NFTManager
 * @notice Core contract for managing Node NFTs, rewards, and share trading
 * @dev Upgradeable contract using UUPS proxy pattern
 * 
 * Key Features:
 * - Mint NFTs with USDT payment
 * - O(1) global index reward distribution
 * - Dual reward system ($E production + multi-token rewards)
 * - 25-month linear unlock schedule (4% per month after 1 year)
 * - Share transfer within NFTs
 * - NFT state management (Live/Dissolved)
 * - On-chain marketplace for share trading
 */
contract NFTManager is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /* ========== CONSTANTS ========== */
    
    /// @notice Precision multiplier for calculations (1e18)
    uint256 public constant PRECISION = 1e18;
    
    /// @notice Shares per NFT (always 10)
    uint256 public constant SHARES_PER_NFT = 10;
    
    /// @notice Total unlock periods (25 months)
    uint256 public constant UNLOCK_PERIODS = 25;
    
    /// @notice Unlock percentage per period (4%)
    uint256 public constant UNLOCK_PERCENTAGE = 4;
    
    /// @notice Unlock interval (30 days)
    uint256 public constant UNLOCK_INTERVAL = 30 days;
    
    /// @notice Lock period before first unlock (365 days)
    uint256 public constant LOCK_PERIOD = 365 days;

    /* ========== ENUMS ========== */
    
    /// @notice NFT type enumeration
    enum NFTType {
        Standard,  // Weight = 1
        Premium    // Weight = 6
    }
    
    /// @notice NFT status enumeration
    enum NFTStatus {
        Live,      // Active, generating rewards
        Dissolved  // Inactive, no new rewards
    }

    /* ========== STRUCTS ========== */
    
    /**
     * @notice Global state for reward distribution
     * @dev Uses O(1) global index model for scalability
     */
    struct GlobalState {
        /// @notice Accumulated $E produced per unit of weighted share
        uint256 accProducedPerWeight;
        
        /// @notice Accumulated reward per unit of weighted share for each token
        mapping(address => uint256) accRewardPerWeight;
        
        /// @notice Total weighted shares across all Live NFTs
        uint256 totalWeightedShares;
        
        /// @notice Last update timestamp
        uint256 lastUpdateTime;
    }
    
    /**
     * @notice NFT configuration
     * @dev Static configuration for each NFT type
     */
    struct NFTConfig {
        NFTType nftType;          // Type of NFT
        uint256 mintPrice;        // Mint price in USDT (user pays this)
        uint256 eclvLockAmount;   // $E production quota (accounting only, no actual lock)
        uint256 shareWeight;      // Weight per share for reward distribution
    }
    
    /**
     * @notice NFT pool data
     * @dev Contains all data for a specific NFT
     * Important: "Locked" $E is just accounting - no actual tokens are locked
     * User pays USDT, NFT receives $E production quota that unlocks over time
     */
    struct NFTPool {
        uint256 nftId;                    // NFT token ID
        NFTType nftType;                  // Type of NFT
        NFTStatus status;                 // Current status (Live/Dissolved)
        uint256 createdAt;                // Creation timestamp
        uint256 dissolvedAt;              // Dissolution timestamp (0 if not dissolved)
        
        // Unlock tracking (accounting only, no actual token lock)
        uint256 totalEclvLocked;          // Total $E production quota
        uint256 remainingMintQuota;       // R: Remaining quota (not yet unlocked)
        uint256 unlockedNotWithdrawn;     // U: Unlocked but not withdrawn
        uint256 lastUnlockTime;           // Last unlock timestamp
        uint256 unlockedPeriods;          // Number of periods unlocked
        
        // Share tracking
        uint256 totalShares;              // Total shares (always 10)
        uint256 shareWeight;              // Weight per share
        address[] shareholders;           // List of addresses holding shares
        
        // Frozen indices (set at dissolution)
        uint256 dissolvedAccProducedPerWeight;           // Frozen produced index
        mapping(address => uint256) dissolvedAccRewardPerWeight;  // Frozen reward indices
    }
    
    /**
     * @notice User share data
     * @dev Tracks user's shares in a specific NFT
     */
    struct UserShare {
        uint256 shares;                   // Number of shares owned
        uint256 producedDebt;             // $E production debt
        mapping(address => uint256) rewardDebt;  // Reward debt per token
        uint256 withdrawnAfterDissolve;   // Amount withdrawn after dissolution
    }
    
    /**
     * @notice Sell order for shares
     * @dev On-chain order book entry
     */
    struct SellOrder {
        uint256 nftId;                    // NFT ID
        address seller;                   // Seller address
        uint256 shares;                   // Number of shares for sale
        uint256 pricePerShare;            // Price per share in USDT
        uint256 createdAt;                // Order creation timestamp
        bool active;                      // Order status
    }
    
    /**
     * @notice Dissolution proposal
     * @dev Multi-signature mechanism for NFT dissolution
     */
    struct DissolutionProposal {
        uint256 nftId;                    // NFT ID
        address proposer;                 // Proposer address
        uint256 createdAt;                // Proposal timestamp
        mapping(address => bool) approvals;  // Approval status per user
        uint256 approvalCount;            // Number of approvals
        uint256 totalShareholderCount;    // Total number of shareholders
        bool executed;                    // Execution status
    }

    /* ========== STATE VARIABLES ========== */
    
    /// @notice Global state for reward distribution
    GlobalState public globalState;
    
    /// @notice NFT contract reference
    NodeNFT public nodeNFT;
    
    /// @notice $E token contract reference
    EnclaveToken public eclvToken;
    
    /// @notice USDT token contract reference
    IERC20 public usdtToken;
    
    /// @notice Oracle address (authorized to distribute rewards)
    address public oracle;
    
    /// @notice Treasury address (receives mint payments)
    address public treasury;
    
    /// @notice NFT configurations
    mapping(NFTType => NFTConfig) public nftConfigs;
    
    /// @notice NFT pools (nftId => NFTPool)
    mapping(uint256 => NFTPool) public nftPools;
    
    /// @notice User shares (nftId => user => UserShare)
    mapping(uint256 => mapping(address => UserShare)) public userShares;
    
    /// @notice User NFT list (user => nftId[])
    mapping(address => uint256[]) public userNFTList;
    
    /// @notice Supported reward tokens
    address[] public rewardTokens;
    mapping(address => bool) public isRewardToken;
    
    /// @notice Sell orders (orderId => SellOrder)
    mapping(uint256 => SellOrder) public sellOrders;
    uint256 public nextOrderId;
    
    /// @notice Active sell order IDs for each NFT (nftId => orderIds[])
    mapping(uint256 => uint256[]) public nftSellOrders;
    
    /// @notice Dissolution proposals (nftId => DissolutionProposal)
    mapping(uint256 => DissolutionProposal) public dissolutionProposals;

    /* ========== EVENTS ========== */
    
    event NFTMinted(
        uint256 indexed nftId,
        address indexed minter,
        NFTType nftType,
        uint256 mintPrice,
        uint256 eclvLocked
    );
    
    event ProducedDistributed(
        uint256 amount,
        uint256 newAccProducedPerWeight,
        uint256 timestamp
    );
    
    event RewardDistributed(
        address indexed token,
        uint256 amount,
        uint256 newAccRewardPerWeight,
        uint256 timestamp
    );
    
    event ProducedClaimed(
        uint256 indexed nftId,
        address indexed user,
        uint256 amount
    );
    
    event RewardClaimed(
        uint256 indexed nftId,
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event ShareTransferred(
        uint256 indexed nftId,
        address indexed from,
        address indexed to,
        uint256 shares
    );
    
    event UnlockProcessed(
        uint256 indexed nftId,
        uint256 period,
        uint256 unlockedAmount,
        uint256 newRemainingQuota
    );
    
    event NFTDissolved(
        uint256 indexed nftId,
        uint256 timestamp
    );
    
    event DissolutionProposed(
        uint256 indexed nftId,
        address indexed proposer
    );
    
    event DissolutionApproved(
        uint256 indexed nftId,
        address indexed approver
    );
    
    event SellOrderCreated(
        uint256 indexed orderId,
        uint256 indexed nftId,
        address indexed seller,
        uint256 shares,
        uint256 pricePerShare
    );
    
    event SellOrderCancelled(
        uint256 indexed orderId
    );
    
    event SharesSold(
        uint256 indexed orderId,
        uint256 indexed nftId,
        address indexed buyer,
        uint256 shares,
        uint256 totalPrice
    );

    /* ========== CONSTRUCTOR & INITIALIZER ========== */
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param nodeNFT_ NodeNFT contract address
     * @param eclvToken_ EnclaveToken contract address
     * @param usdtToken_ USDT token contract address
     * @param oracle_ Oracle address
     * @param treasury_ Treasury address
     */
    function initialize(
        address nodeNFT_,
        address eclvToken_,
        address usdtToken_,
        address oracle_,
        address treasury_
    ) external initializer {
        require(nodeNFT_ != address(0), "Invalid NodeNFT address");
        require(eclvToken_ != address(0), "Invalid $E address");
        require(usdtToken_ != address(0), "Invalid USDT address");
        require(oracle_ != address(0), "Invalid oracle address");
        require(treasury_ != address(0), "Invalid treasury address");
        
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        nodeNFT = NodeNFT(nodeNFT_);
        eclvToken = EnclaveToken(eclvToken_);
        usdtToken = IERC20(usdtToken_);
        oracle = oracle_;
        treasury = treasury_;
        
        // Initialize NFT configurations
        // Standard NFT: 10,000 USDT, 20,000 $E, weight = 1
        nftConfigs[NFTType.Standard] = NFTConfig({
            nftType: NFTType.Standard,
            mintPrice: 10_000 * 10**18,      // 10,000 USDT (assuming 18 decimals)
            eclvLockAmount: 20_000 * 10**18, // 20,000 $E
            shareWeight: 1                    // Weight per share
        });
        
        // Premium NFT: 50,000 USDT, 100,000 $E, weight = 6
        nftConfigs[NFTType.Premium] = NFTConfig({
            nftType: NFTType.Premium,
            mintPrice: 50_000 * 10**18,       // 50,000 USDT
            eclvLockAmount: 100_000 * 10**18, // 100,000 $E
            shareWeight: 6                     // Weight per share
        });
        
        // Add USDT as default reward token
        rewardTokens.push(usdtToken_);
        isRewardToken[usdtToken_] = true;
        
        // Initialize global state
        globalState.lastUpdateTime = block.timestamp;
        
        // Initialize order ID
        nextOrderId = 1;
    }

    /* ========== MODIFIERS ========== */
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    /* ========== MINTING FUNCTIONS ========== */
    
    /**
     * @notice Mint a new NFT
     * @dev User pays USDT, NFT gets $E production quota (no actual $E transfer)
     * @param nftType_ Type of NFT to mint
     * @return nftId Minted NFT ID
     */
    function mintNFT(NFTType nftType_) external nonReentrant returns (uint256) {
        NFTConfig memory config = nftConfigs[nftType_];
        
        // Transfer USDT from user to treasury
        usdtToken.safeTransferFrom(msg.sender, treasury, config.mintPrice);
        
        // Note: No $E transfer needed
        // The NFT will receive $E production quota that unlocks over time
        
        // Mint NFT to user
        uint256 nftId = nodeNFT.mint(msg.sender);
        
        // Create NFT pool
        // Note: totalEclvLocked is the $E production quota (not actual locked tokens)
        // This quota will unlock gradually over time
        NFTPool storage pool = nftPools[nftId];
        pool.nftId = nftId;
        pool.nftType = nftType_;
        pool.status = NFTStatus.Live;
        pool.createdAt = block.timestamp;
        pool.totalEclvLocked = config.eclvLockAmount;      // Total $E quota
        pool.remainingMintQuota = config.eclvLockAmount;   // Initially all quota is "locked" (not yet unlocked)
        pool.totalShares = SHARES_PER_NFT;
        pool.shareWeight = config.shareWeight;
        pool.lastUnlockTime = block.timestamp;
        
        // Assign all shares to minter
        UserShare storage userShare = userShares[nftId][msg.sender];
        userShare.shares = SHARES_PER_NFT;
        userShare.producedDebt = (SHARES_PER_NFT * config.shareWeight * globalState.accProducedPerWeight) / PRECISION;
        
        // Initialize reward debts for all reward tokens
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            userShare.rewardDebt[token] = (SHARES_PER_NFT * config.shareWeight * globalState.accRewardPerWeight[token]) / PRECISION;
        }
        
        // Add to user's NFT list
        userNFTList[msg.sender].push(nftId);
        
        // Add minter to shareholders list
        pool.shareholders.push(msg.sender);
        
        // Update global weighted shares (NFT is now Live)
        globalState.totalWeightedShares += SHARES_PER_NFT * config.shareWeight;
        
        emit NFTMinted(nftId, msg.sender, nftType_, config.mintPrice, config.eclvLockAmount);
        
        return nftId;
    }

    /* ========== REWARD DISTRIBUTION FUNCTIONS (ORACLE) ========== */
    
    /**
     * @notice Distribute $E production to all Live NFTs (O(1) operation)
     * @dev Only oracle can call. Updates global index, users claim individually
     * @param amount Amount of $E to distribute
     */
    function distributeProduced(uint256 amount) external onlyOracle nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(globalState.totalWeightedShares > 0, "No active NFTs");
        
        // Transfer $E from oracle to this contract
        eclvToken.transferFrom(msg.sender, address(this), amount);
        
        // Update global index (O(1) operation)
        globalState.accProducedPerWeight += (amount * PRECISION) / globalState.totalWeightedShares;
        globalState.lastUpdateTime = block.timestamp;
        
        emit ProducedDistributed(amount, globalState.accProducedPerWeight, block.timestamp);
    }
    
    /**
     * @notice Distribute reward tokens to all Live NFTs (O(1) operation)
     * @dev Only oracle can call. Updates global index for specific token
     * @param token Reward token address
     * @param amount Amount to distribute
     */
    function distributeReward(address token, uint256 amount) external onlyOracle nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(isRewardToken[token], "Token not supported");
        require(globalState.totalWeightedShares > 0, "No active NFTs");
        
        // Transfer reward token from oracle to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update global index for this token (O(1) operation)
        globalState.accRewardPerWeight[token] += (amount * PRECISION) / globalState.totalWeightedShares;
        globalState.lastUpdateTime = block.timestamp;
        
        emit RewardDistributed(token, amount, globalState.accRewardPerWeight[token], block.timestamp);
    }

    /* ========== CLAIM FUNCTIONS ========== */
    
    /**
     * @notice Claim $E production for a specific NFT
     * @param nftId NFT ID
     * @return amount Claimed amount
     */
    function claimProduced(uint256 nftId) public nonReentrant returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][msg.sender];
        
        require(userShare.shares > 0, "No shares owned");
        
        // Process unlock first
        _processUnlock(nftId);
        
        uint256 amount = _getPendingProduced(nftId, msg.sender);
        
        if (amount > 0) {
            // Update user's debt
            uint256 accIndex = pool.status == NFTStatus.Live 
                ? globalState.accProducedPerWeight 
                : pool.dissolvedAccProducedPerWeight;
            
            userShare.producedDebt = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
            
            // Transfer $E to user
            eclvToken.transfer(msg.sender, amount);
            
            emit ProducedClaimed(nftId, msg.sender, amount);
        }
        
        return amount;
    }
    
    /**
     * @notice Claim reward tokens for a specific NFT
     * @param nftId NFT ID
     * @param token Reward token address
     * @return amount Claimed amount
     */
    function claimReward(uint256 nftId, address token) public nonReentrant returns (uint256) {
        require(isRewardToken[token], "Token not supported");
        
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][msg.sender];
        
        require(userShare.shares > 0, "No shares owned");
        
        uint256 amount = _getPendingReward(nftId, msg.sender, token);
        
        if (amount > 0) {
            // Update user's debt
            uint256 accIndex = pool.status == NFTStatus.Live 
                ? globalState.accRewardPerWeight[token]
                : pool.dissolvedAccRewardPerWeight[token];
            
            userShare.rewardDebt[token] = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
            
            // Transfer reward token to user
            IERC20(token).safeTransfer(msg.sender, amount);
            
            emit RewardClaimed(nftId, msg.sender, token, amount);
        }
        
        return amount;
    }
    
    /**
     * @notice Batch claim $E production for multiple NFTs
     * @param nftIds Array of NFT IDs
     * @return totalAmount Total claimed amount
     */
    function batchClaimProduced(uint256[] calldata nftIds) external returns (uint256) {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < nftIds.length; i++) {
            totalAmount += claimProduced(nftIds[i]);
        }
        return totalAmount;
    }
    
    /**
     * @notice Batch claim rewards for multiple NFTs
     * @param nftIds Array of NFT IDs
     * @param token Reward token address
     * @return totalAmount Total claimed amount
     */
    function batchClaimReward(uint256[] calldata nftIds, address token) external returns (uint256) {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < nftIds.length; i++) {
            totalAmount += claimReward(nftIds[i], token);
        }
        return totalAmount;
    }

    /* ========== SHARE TRANSFER FUNCTIONS ========== */
    
    /**
     * @notice Transfer shares to another user (P2P)
     * @dev Claims all pending rewards before transfer
     * @param nftId NFT ID
     * @param to Recipient address
     * @param shares Number of shares to transfer
     */
    function transferShares(
        uint256 nftId,
        address to,
        uint256 shares
    ) public nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(to != msg.sender, "Cannot transfer to self");
        require(shares > 0, "Must transfer at least 1 share");
        
        NFTPool storage pool = nftPools[nftId];
        UserShare storage fromShare = userShares[nftId][msg.sender];
        UserShare storage toShare = userShares[nftId][to];
        
        require(fromShare.shares >= shares, "Insufficient shares");
        
        // Process unlock first
        _processUnlock(nftId);
        
        // Claim all pending rewards for sender
        _claimAllRewards(nftId, msg.sender);
        
        // Claim all pending rewards for recipient (if they have shares)
        if (toShare.shares > 0) {
            _claimAllRewards(nftId, to);
        }
        
        // Transfer shares
        fromShare.shares -= shares;
        toShare.shares += shares;
        
        // Update debts based on current indices
        uint256 accProduced = pool.status == NFTStatus.Live 
            ? globalState.accProducedPerWeight 
            : pool.dissolvedAccProducedPerWeight;
        
        fromShare.producedDebt = (fromShare.shares * pool.shareWeight * accProduced) / PRECISION;
        toShare.producedDebt = (toShare.shares * pool.shareWeight * accProduced) / PRECISION;
        
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            uint256 accReward = pool.status == NFTStatus.Live 
                ? globalState.accRewardPerWeight[token]
                : pool.dissolvedAccRewardPerWeight[token];
            
            fromShare.rewardDebt[token] = (fromShare.shares * pool.shareWeight * accReward) / PRECISION;
            toShare.rewardDebt[token] = (toShare.shares * pool.shareWeight * accReward) / PRECISION;
        }
        
        // Update shareholders list
        _addShareholder(nftId, to);
        _removeShareholder(nftId, msg.sender);
        
        // Add to recipient's NFT list if first time
        if (toShare.shares == shares) {
            userNFTList[to].push(nftId);
        }
        
        // Remove from sender's NFT list if no shares left
        if (fromShare.shares == 0) {
            _removeFromUserNFTList(msg.sender, nftId);
        }
        
        emit ShareTransferred(nftId, msg.sender, to, shares);
    }

    /* ========== UNLOCK FUNCTIONS ========== */
    
    /**
     * @notice Process unlock for an NFT
     * @dev Internal function, called automatically during claims/transfers
     * @param nftId NFT ID
     */
    function _processUnlock(uint256 nftId) internal {
        NFTPool storage pool = nftPools[nftId];
        
        // Skip if already fully unlocked
        if (pool.unlockedPeriods >= UNLOCK_PERIODS) {
            return;
        }
        
        // Check if lock period has passed
        if (block.timestamp < pool.createdAt + LOCK_PERIOD) {
            return;
        }
        
        // Calculate number of periods to unlock
        uint256 timeSinceFirstUnlock = block.timestamp - (pool.createdAt + LOCK_PERIOD);
        uint256 periodsElapsed = timeSinceFirstUnlock / UNLOCK_INTERVAL + 1;
        
        // Cap at max periods
        if (periodsElapsed > UNLOCK_PERIODS) {
            periodsElapsed = UNLOCK_PERIODS;
        }
        
        // Skip if no new periods to unlock
        if (periodsElapsed <= pool.unlockedPeriods) {
            return;
        }
        
        // Calculate unlock amount
        uint256 periodsToUnlock = periodsElapsed - pool.unlockedPeriods;
        uint256 unlockAmount = (pool.totalEclvLocked * UNLOCK_PERCENTAGE * periodsToUnlock) / 100;
        
        // Update pool state
        pool.remainingMintQuota -= unlockAmount;
        pool.unlockedNotWithdrawn += unlockAmount;
        pool.unlockedPeriods = periodsElapsed;
        pool.lastUnlockTime = block.timestamp;
        
        emit UnlockProcessed(nftId, periodsElapsed, unlockAmount, pool.remainingMintQuota);
    }
    
    /**
     * @notice Withdraw unlocked $E (only in Dissolved state)
     * @param nftId NFT ID
     * @param amount Amount to withdraw
     */
    function withdrawUnlocked(uint256 nftId, uint256 amount) external nonReentrant {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][msg.sender];
        
        require(pool.status == NFTStatus.Dissolved, "NFT must be dissolved");
        require(userShare.shares > 0, "No shares owned");
        require(amount > 0, "Amount must be positive");
        
        // Process unlock first
        _processUnlock(nftId);
        
        // Calculate user's portion of unlocked amount
        uint256 userPortion = (pool.unlockedNotWithdrawn * userShare.shares) / pool.totalShares;
        require(amount <= userPortion, "Exceeds available amount");
        
        // Update state
        pool.unlockedNotWithdrawn -= amount;
        userShare.withdrawnAfterDissolve += amount;
        
        // Transfer $E to user
        eclvToken.transfer(msg.sender, amount);
    }

    /* ========== DISSOLUTION FUNCTIONS ========== */
    
    /**
     * @notice Propose NFT dissolution
     * @dev Any shareholder can propose
     * @param nftId NFT ID
     */
    function proposeDissolution(uint256 nftId) external nonReentrant {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][msg.sender];
        
        require(pool.status == NFTStatus.Live, "NFT not live");
        require(userShare.shares > 0, "No shares owned");
        require(dissolutionProposals[nftId].proposer == address(0), "Proposal exists");
        
        // Create proposal
        DissolutionProposal storage proposal = dissolutionProposals[nftId];
        proposal.nftId = nftId;
        proposal.proposer = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.approvals[msg.sender] = true;
        proposal.approvalCount = 1;
        
        // Count total shareholders
        uint256 shareholderCount = _countShareholders(nftId);
        proposal.totalShareholderCount = shareholderCount;
        
        emit DissolutionProposed(nftId, msg.sender);
        
        // Auto-execute if proposer is sole owner
        if (shareholderCount == 1) {
            _executeDissolution(nftId);
        }
    }
    
    /**
     * @notice Approve dissolution proposal
     * @param nftId NFT ID
     */
    function approveDissolution(uint256 nftId) external nonReentrant {
        DissolutionProposal storage proposal = dissolutionProposals[nftId];
        UserShare storage userShare = userShares[nftId][msg.sender];
        
        require(proposal.proposer != address(0), "No proposal");
        require(!proposal.executed, "Already executed");
        require(userShare.shares > 0, "No shares owned");
        require(!proposal.approvals[msg.sender], "Already approved");
        
        // Record approval
        proposal.approvals[msg.sender] = true;
        proposal.approvalCount++;
        
        emit DissolutionApproved(nftId, msg.sender);
        
        // Execute if all shareholders approved
        if (proposal.approvalCount >= proposal.totalShareholderCount) {
            _executeDissolution(nftId);
        }
    }
    
    /**
     * @notice Execute dissolution
     * @dev Internal function
     * @param nftId NFT ID
     */
    function _executeDissolution(uint256 nftId) internal {
        NFTPool storage pool = nftPools[nftId];
        DissolutionProposal storage proposal = dissolutionProposals[nftId];
        
        require(pool.status == NFTStatus.Live, "NFT not live");
        require(!proposal.executed, "Already executed");
        
        // Process unlock before dissolution
        _processUnlock(nftId);
        
        // Freeze indices
        pool.dissolvedAccProducedPerWeight = globalState.accProducedPerWeight;
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            pool.dissolvedAccRewardPerWeight[token] = globalState.accRewardPerWeight[token];
        }
        
        // Update status
        pool.status = NFTStatus.Dissolved;
        pool.dissolvedAt = block.timestamp;
        proposal.executed = true;
        
        // Remove from global weighted shares
        globalState.totalWeightedShares -= pool.totalShares * pool.shareWeight;
        
        emit NFTDissolved(nftId, block.timestamp);
    }
    
    /**
     * @notice Get dissolution proposal info
     * @param nftId NFT ID
     * @return nftId NFT ID
     * @return proposer Proposer address
     * @return createdAt Creation timestamp
     * @return approvalCount Number of approvals
     * @return totalShareholderCount Total number of shareholders
     * @return executed Execution status
     */
    function getDissolutionProposal(uint256 nftId) external view returns (
        uint256,
        address,
        uint256,
        uint256,
        uint256,
        bool
    ) {
        DissolutionProposal storage proposal = dissolutionProposals[nftId];
        return (
            proposal.nftId,
            proposal.proposer,
            proposal.createdAt,
            proposal.approvalCount,
            proposal.totalShareholderCount,
            proposal.executed
        );
    }

    /* ========== MARKETPLACE FUNCTIONS ========== */
    
    /**
     * @notice Create sell order
     * @param nftId NFT ID
     * @param shares Number of shares to sell
     * @param pricePerShare Price per share in USDT
     * @return orderId Created order ID
     */
    function createSellOrder(
        uint256 nftId,
        uint256 shares,
        uint256 pricePerShare
    ) external nonReentrant returns (uint256) {
        require(shares > 0, "Must sell at least 1 share");
        require(pricePerShare > 0, "Price must be positive");
        
        // Check available shares (total shares - shares in active orders)
        uint256 availableShares = getAvailableShares(nftId, msg.sender);
        require(availableShares >= shares, "Insufficient available shares");
        
        uint256 orderId = nextOrderId++;
        
        sellOrders[orderId] = SellOrder({
            nftId: nftId,
            seller: msg.sender,
            shares: shares,
            pricePerShare: pricePerShare,
            createdAt: block.timestamp,
            active: true
        });
        
        nftSellOrders[nftId].push(orderId);
        
        emit SellOrderCreated(orderId, nftId, msg.sender, shares, pricePerShare);
        
        return orderId;
    }
    
    /**
     * @notice Cancel sell order
     * @param orderId Order ID
     */
    function cancelSellOrder(uint256 orderId) external nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        
        require(order.active, "Order not active");
        require(order.seller == msg.sender, "Not order owner");
        
        order.active = false;
        
        emit SellOrderCancelled(orderId);
    }
    
    /**
     * @notice Buy shares from sell order
     * @param orderId Order ID
     */
    function buyShares(uint256 orderId) external nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        
        require(order.active, "Order not active");
        require(order.seller != msg.sender, "Cannot buy own order");
        
        UserShare storage sellerShare = userShares[order.nftId][order.seller];
        require(sellerShare.shares >= order.shares, "Seller has insufficient shares");
        
        uint256 totalPrice = order.shares * order.pricePerShare;
        
        // Transfer USDT from buyer to seller
        usdtToken.safeTransferFrom(msg.sender, order.seller, totalPrice);
        
        // Transfer shares (seller transfers to buyer)
        // Note: We need to call this from seller's context, so we implement inline
        _executeShareTransferForOrder(order.nftId, order.seller, msg.sender, order.shares);
        
        // Deactivate order
        order.active = false;
        
        emit SharesSold(orderId, order.nftId, msg.sender, order.shares, totalPrice);
    }

    /* ========== INTERNAL HELPER FUNCTIONS ========== */
    
    /**
     * @notice Execute share transfer for marketplace order
     * @dev Internal function to handle share transfer in buy order context
     * @param nftId NFT ID
     * @param from Seller address
     * @param to Buyer address
     * @param shares Number of shares
     */
    function _executeShareTransferForOrder(
        uint256 nftId,
        address from,
        address to,
        uint256 shares
    ) internal {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage fromShare = userShares[nftId][from];
        UserShare storage toShare = userShares[nftId][to];
        
        require(fromShare.shares >= shares, "Insufficient shares");
        
        // Process unlock first
        _processUnlock(nftId);
        
        // Claim all pending rewards for seller
        _claimAllRewards(nftId, from);
        
        // Claim all pending rewards for buyer (if they have shares)
        if (toShare.shares > 0) {
            _claimAllRewards(nftId, to);
        }
        
        // Transfer shares
        fromShare.shares -= shares;
        toShare.shares += shares;
        
        // Update debts based on current indices
        uint256 accProduced = pool.status == NFTStatus.Live 
            ? globalState.accProducedPerWeight 
            : pool.dissolvedAccProducedPerWeight;
        
        fromShare.producedDebt = (fromShare.shares * pool.shareWeight * accProduced) / PRECISION;
        toShare.producedDebt = (toShare.shares * pool.shareWeight * accProduced) / PRECISION;
        
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            uint256 accReward = pool.status == NFTStatus.Live 
                ? globalState.accRewardPerWeight[token]
                : pool.dissolvedAccRewardPerWeight[token];
            
            fromShare.rewardDebt[token] = (fromShare.shares * pool.shareWeight * accReward) / PRECISION;
            toShare.rewardDebt[token] = (toShare.shares * pool.shareWeight * accReward) / PRECISION;
        }
        
        // Update shareholders list
        _addShareholder(nftId, to);
        _removeShareholder(nftId, from);
        
        // Add to recipient's NFT list if first time
        if (toShare.shares == shares) {
            userNFTList[to].push(nftId);
        }
        
        // Remove from seller's NFT list if no shares left
        if (fromShare.shares == 0) {
            _removeFromUserNFTList(from, nftId);
        }
        
        emit ShareTransferred(nftId, from, to, shares);
    }
    
    /**
     * @notice Claim all rewards for a user
     * @dev Internal function used during share transfers
     * @param nftId NFT ID
     * @param user User address
     */
    function _claimAllRewards(uint256 nftId, address user) internal {
        // Claim produced
        uint256 produced = _getPendingProduced(nftId, user);
        if (produced > 0) {
            UserShare storage userShare = userShares[nftId][user];
            NFTPool storage pool = nftPools[nftId];
            
            uint256 accIndex = pool.status == NFTStatus.Live 
                ? globalState.accProducedPerWeight 
                : pool.dissolvedAccProducedPerWeight;
            
            userShare.producedDebt = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
            eclvToken.transfer(user, produced);
            emit ProducedClaimed(nftId, user, produced);
        }
        
        // Claim all reward tokens
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            uint256 reward = _getPendingReward(nftId, user, token);
            if (reward > 0) {
                UserShare storage userShare = userShares[nftId][user];
                NFTPool storage pool = nftPools[nftId];
                
                uint256 accIndex = pool.status == NFTStatus.Live 
                    ? globalState.accRewardPerWeight[token]
                    : pool.dissolvedAccRewardPerWeight[token];
                
                userShare.rewardDebt[token] = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
                IERC20(token).safeTransfer(user, reward);
                emit RewardClaimed(nftId, user, token, reward);
            }
        }
    }
    
    /**
     * @notice Count shareholders for an NFT
     * @dev Internal function
     * TODO: In production, maintain a dynamic shareholders array per NFT
     * to avoid gas issues and properly count all shareholders
     * @return Number of shareholders (currently returns 1 as placeholder)
     */
    function _countShareholders(uint256 /* nftId */) internal pure returns (uint256) {
        // Simplified implementation: return 1 for now
        // In production, maintain a shareholders array per NFT
        return 1;
    }

    /* ========== VIEW FUNCTIONS ========== */
    
    /**
     * @notice Get user share count for an NFT
     * @param nftId NFT ID
     * @param user User address
     * @return shares Number of shares owned by user
     */
    function getUserShareCount(uint256 nftId, address user) external view returns (uint256) {
        return userShares[nftId][user].shares;
    }
    
    /**
     * @notice Get list of shareholders for an NFT
     * @param nftId NFT ID
     * @return List of addresses holding shares
     */
    function getShareholders(uint256 nftId) external view returns (address[] memory) {
        return nftPools[nftId].shareholders;
    }
    
    /**
     * @notice Add address to shareholders list if not already present
     * @param nftId NFT ID
     * @param user User address
     */
    function _addShareholder(uint256 nftId, address user) internal {
        NFTPool storage pool = nftPools[nftId];
        // Check if user is already in the list
        for (uint256 i = 0; i < pool.shareholders.length; i++) {
            if (pool.shareholders[i] == user) {
                return; // Already in list
            }
        }
        pool.shareholders.push(user);
    }
    
    /**
     * @notice Remove address from shareholders list if they have zero shares
     * @param nftId NFT ID
     * @param user User address
     */
    function _removeShareholder(uint256 nftId, address user) internal {
        if (userShares[nftId][user].shares > 0) {
            return; // Still has shares
        }
        
        NFTPool storage pool = nftPools[nftId];
        for (uint256 i = 0; i < pool.shareholders.length; i++) {
            if (pool.shareholders[i] == user) {
                // Replace with last element and pop
                pool.shareholders[i] = pool.shareholders[pool.shareholders.length - 1];
                pool.shareholders.pop();
                return;
            }
        }
    }
    
    /**
     * @notice Remove NFT from user's NFT list
     * @param user User address
     * @param nftId NFT ID to remove
     */
    function _removeFromUserNFTList(address user, uint256 nftId) internal {
        uint256[] storage userNFTs = userNFTList[user];
        for (uint256 i = 0; i < userNFTs.length; i++) {
            if (userNFTs[i] == nftId) {
                // Replace with last element and pop
                userNFTs[i] = userNFTs[userNFTs.length - 1];
                userNFTs.pop();
                return;
            }
        }
    }
    
    /**
     * @notice Get pending $E production for a user
     * @param nftId NFT ID
     * @param user User address
     * @return Pending amount
     */
    function _getPendingProduced(uint256 nftId, address user) internal view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][user];
        
        if (userShare.shares == 0) {
            return 0;
        }
        
        uint256 accIndex = pool.status == NFTStatus.Live 
            ? globalState.accProducedPerWeight 
            : pool.dissolvedAccProducedPerWeight;
        
        uint256 accumulatedProduced = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
        
        if (accumulatedProduced > userShare.producedDebt) {
            return accumulatedProduced - userShare.producedDebt;
        }
        
        return 0;
    }
    
    /**
     * @notice Get pending reward for a user
     * @param nftId NFT ID
     * @param user User address
     * @param token Reward token address
     * @return Pending amount
     */
    function _getPendingReward(uint256 nftId, address user, address token) internal view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        UserShare storage userShare = userShares[nftId][user];
        
        if (userShare.shares == 0) {
            return 0;
        }
        
        uint256 accIndex = pool.status == NFTStatus.Live 
            ? globalState.accRewardPerWeight[token]
            : pool.dissolvedAccRewardPerWeight[token];
        
        uint256 accumulatedReward = (userShare.shares * pool.shareWeight * accIndex) / PRECISION;
        
        if (accumulatedReward > userShare.rewardDebt[token]) {
            return accumulatedReward - userShare.rewardDebt[token];
        }
        
        return 0;
    }
    
    /**
     * @notice Get pending produced (public view)
     * @param nftId NFT ID
     * @param user User address
     * @return Pending amount
     */
    function getPendingProduced(uint256 nftId, address user) external view returns (uint256) {
        return _getPendingProduced(nftId, user);
    }
    
    /**
     * @notice Get pending reward (public view)
     * @param nftId NFT ID
     * @param user User address
     * @param token Reward token address
     * @return Pending amount
     */
    function getPendingReward(uint256 nftId, address user, address token) external view returns (uint256) {
        return _getPendingReward(nftId, user, token);
    }
    
    /**
     * @notice Get user's NFT list
     * @param user User address
     * @return Array of NFT IDs
     */
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        return userNFTList[user];
    }
    
    /**
     * @notice Get NFT sell orders
     * @param nftId NFT ID
     * @return Array of order IDs
     */
    function getNFTSellOrders(uint256 nftId) external view returns (uint256[] memory) {
        // 由于 Solidity 限制，不能直接返回公共映射的动态数组
        // 使用临时解决方案：手动遍历所有订单
        uint256[] memory tempOrders = new uint256[](10); // 假设最多10个订单
        uint256 count = 0;
        
        for (uint256 orderId = 1; orderId < nextOrderId && count < 10; orderId++) {
            SellOrder memory order = sellOrders[orderId];
            if (order.active && order.nftId == nftId) {
                tempOrders[count] = orderId;
                count++;
            }
        }
        
        // 创建正确大小的数组
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempOrders[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get all reward tokens
     * @return Array of token addresses
     */
    function getRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }
    
    /**
     * @notice Get available shares for a user (total shares - shares in active orders)
     * @param nftId NFT ID
     * @param user User address
     * @return Available shares for selling
     */
    function getAvailableShares(uint256 nftId, address user) public view returns (uint256) {
        uint256 totalShares = userShares[nftId][user].shares;
        
        // If user has no shares, return 0
        if (totalShares == 0) {
            return 0;
        }
        
        // Calculate shares already in active orders
        // Note: We can't call getNFTSellOrders here due to function order, so we'll use a simplified approach
        // For now, assume no active orders (this is a temporary fix)
        // TODO: Move getNFTSellOrders before this function or create an internal version
        uint256 sharesInOrders = 0;
        
        // Temporary: Check orders 1-10 manually (not ideal but works for now)
        for (uint256 orderId = 1; orderId <= 10; orderId++) {
            if (orderId < nextOrderId) {
                SellOrder memory order = sellOrders[orderId];
                if (order.active && order.seller == user && order.nftId == nftId) {
                    sharesInOrders += order.shares;
                }
            }
        }
        
        return totalShares >= sharesInOrders ? totalShares - sharesInOrders : 0;
    }

    /* ========== ADMIN FUNCTIONS ========== */
    
    /**
     * @notice Set oracle address
     * @param oracle_ New oracle address
     */
    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "Invalid address");
        oracle = oracle_;
    }
    
    /**
     * @notice Set treasury address
     * @param treasury_ New treasury address
     */
    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Invalid address");
        treasury = treasury_;
    }
    
    /**
     * @notice Add reward token
     * @param token Token address
     */
    function addRewardToken(address token) external onlyOwner {
        require(token != address(0), "Invalid address");
        require(!isRewardToken[token], "Already added");
        
        rewardTokens.push(token);
        isRewardToken[token] = true;
    }
    
    /**
     * @notice Update NFT configuration
     * @param nftType_ NFT type
     * @param mintPrice_ New mint price
     * @param eclvLockAmount_ New $E lock amount
     * @param shareWeight_ New share weight
     */
    function updateNFTConfig(
        NFTType nftType_,
        uint256 mintPrice_,
        uint256 eclvLockAmount_,
        uint256 shareWeight_
    ) external onlyOwner {
        require(shareWeight_ > 0, "Weight must be positive");
        
        nftConfigs[nftType_] = NFTConfig({
            nftType: nftType_,
            mintPrice: mintPrice_,
            eclvLockAmount: eclvLockAmount_,
            shareWeight: shareWeight_
        });
    }
    

    /* ========== UPGRADE AUTHORIZATION ========== */
    
    /**
     * @notice Authorize upgrade
     * @dev Required by UUPSUpgradeable
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

