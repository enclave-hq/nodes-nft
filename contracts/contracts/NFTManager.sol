// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./NodeNFT.sol";
import "./EnclaveToken.sol";

/**
 * @title NFTManager
 * @notice Core contract for managing Node NFTs, rewards, and unlock mechanism
 * @dev Upgradeable contract using UUPS proxy pattern
 * 
 * Key Features:
 * - Whitelist-based NFT minting (max 5000 NFTs)
 * - Batch management with price and quantity control
 * - Two-step termination process (1-day cooldown + 30-day timeout)
 * - O(1) global index reward distribution for Active NFTs only
 * - Dual reward system ($E production + multi-token rewards)
 * - 25-month linear unlock schedule (4% per month after 1 year)
 * - Transfer control (disabled by default to prevent OpenSea listing)
 */
contract NFTManager is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /* ========== CONSTANTS ========== */
    
    /// @notice Maximum total supply of NFTs
    uint256 public constant MAX_SUPPLY = 5000;
    
    /// @notice $E amount per NFT (2000 $E)
    uint256 public constant ECLV_PER_NFT = 2000 * 10**18;
    
    /// @notice Total unlock periods (25 months)
    uint256 public constant UNLOCK_PERIODS = 25;
    
    /// @notice Unlock percentage per period (4%)
    uint256 public constant UNLOCK_PERCENTAGE = 4;
    
    /// @notice Unlock interval (30 days)
    uint256 public constant UNLOCK_INTERVAL = 30 days;
    
    /// @notice Lock period before first unlock (365 days)
    uint256 public constant LOCK_PERIOD = 365 days;
    
    /// @notice Termination cooldown period (1 day)
    uint256 public constant TERMINATION_COOLDOWN = 1 days;
    
    /// @notice Termination timeout period (30 days after cooldown)
    uint256 public constant TERMINATION_TIMEOUT = 30 days;

    /* ========== ENUMS ========== */
    
    /// @notice NFT status enumeration
    enum NFTStatus {
        Active,            // Producing, can receive rewards
        PendingTermination, // Termination initiated, waiting for confirmation or timeout
        Terminated         // Terminated, no new rewards, cannot recover
    }
    

    
    /// @notice Order status enumeration
    enum OrderStatus {
        Active,     // Order is active and can be filled
        Cancelled,  // Order was cancelled by seller
        Filled      // Order was completely filled
    }

    /* ========== STRUCTS ========== */
    
    /**
     * @notice Global state for reward distribution
     * @dev Uses O(1) global index model for scalability
     */
    struct GlobalState {
        /// @notice Accumulated $E produced per NFT
        uint256 accProducedPerNFT;
        
        /// @notice Accumulated reward per NFT for each token
        mapping(address => uint256) accRewardPerNFT;
        
        /// @notice Total Active NFTs (for reward distribution)
        uint256 totalActiveNFTs;
        
        /// @notice Last update timestamp
        uint256 lastUpdateTime;
    }
    
    /**
     * @notice Batch configuration
     */
    struct Batch {
        uint256 batchId;
        uint256 maxMintable;      // Maximum mintable amount for this batch
        uint256 currentMinted;    // Current minted amount
        uint256 mintPrice;        // Mint price in USDT (wei)
        bool active;             // Whether this batch is active
        uint256 createdAt;        // Creation timestamp
    }
    
    /**
     * @notice NFT pool data
     * @dev Contains all data for a specific NFT
     */
    struct NFTPool {
        uint256 nftId;
        NFTStatus status;              // Current status
        uint256 createdAt;
        uint256 terminationInitiatedAt; // Termination initiation time (if status is PendingTermination)
        uint256 unlockedWithdrawn;      // Unlocked and withdrawn $E (default 0)
        uint256 producedWithdrawn;      // $E production withdrawn (accumulated)
        mapping(address => uint256) rewardWithdrawn; // Reward withdrawn per token (accumulated)
    }
    
    /**
     * @notice Sell order for NFT
     * @dev On-chain order book entry
     */
    struct SellOrder {
        uint256 orderId;        // Order ID
        uint256 nftId;          // NFT ID
        address seller;         // Seller address
        uint256 price;          // Price in USDT (wei)
        uint256 createdAt;      // Order creation timestamp
        OrderStatus status;     // Order status
    }

    /* ========== STATE VARIABLES ========== */
    
    /// @notice Global state for reward distribution
    /// @dev Must come after OpenZeppelin base contracts to avoid storage conflicts
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
    
    /// @notice Multi-signature node address (receives 20% of mining rewards)
    address public multisigNode;
    
    /// @notice Multisig reward total distributed per token (accumulated)
    mapping(address => uint256) public multisigRewardDistributed;
    
    /// @notice Multisig reward withdrawn per token (accumulated)
    mapping(address => uint256) public multisigRewardWithdrawn;
    
    /// @notice Whitelist mapping
    mapping(address => bool) public whitelist;
    
    /// @notice Whitelist count
    uint256 public whitelistCount;
    
    /// @notice Get whitelist count (custom getter to work around compiler issue)
    function getWhitelistCount() external view returns (uint256) {
        return whitelistCount;
    }
    
    /// @notice Whether transfers are enabled (default false)
    bool public transfersEnabled;
    
    /// @notice Batch configurations
    mapping(uint256 => Batch) public batches;
    
    /// @notice Current batch ID
    uint256 public currentBatchId;
    
    /// @notice Get current batch ID (custom getter to work around compiler issue)
    function getCurrentBatchId() external view returns (uint256) {
        return currentBatchId;
    }
    
    /// @notice Total minted NFTs
    uint256 public totalMinted;
    
    /// @notice NFT pools (nftId => NFTPool)
    mapping(uint256 => NFTPool) public nftPools;
    
    /// @notice User NFT list (user => nftId[])
    mapping(address => uint256[]) public userNFTList;
    
    /// @notice Reward tokens list
    address[] public rewardTokens;
    
    /// @notice Whether a token is a reward token
    mapping(address => bool) public isRewardToken;
    
    /// @notice Sell orders (orderId => SellOrder)
    mapping(uint256 => SellOrder) public sellOrders;
    
    /// @notice NFT to active order ID (nftId => orderId, 0 if no active order)
    mapping(uint256 => uint256) public nftActiveOrder;
    
    /// @notice Next order ID
    uint256 public nextOrderId;
    
    /// @notice TGE (Token Generation Event) timestamp - global unlock start time
    /// @dev Placed after all inherited variables for storage compatibility
    uint256 public tgeTime;
    
    /// @notice Market fee rate (basis points, e.g., 250 = 2.5%)
    uint256 public marketFeeRate;
    
    /// @notice Active order IDs list (for querying all active orders)
    uint256[] public activeOrderIds;

    /* ========== EVENTS ========== */
    
    event NFTMinted(uint256 indexed nftId, address indexed minter, uint256 indexed batchId, uint256 mintPrice, uint256 timestamp);
    event TerminationInitiated(uint256 indexed nftId, address indexed owner, uint256 initiateTime, uint256 confirmDeadline);
    event TerminationConfirmed(uint256 indexed nftId, address indexed owner, uint256 timestamp);
    event TerminationCancelled(uint256 indexed nftId, address indexed owner, uint256 timestamp);
    event UnlockedWithdrawn(uint256 indexed nftId, address indexed owner, uint256 amount, uint256 timestamp);
    event TgeTimeSet(uint256 tgeTime);
    event BatchCreated(uint256 indexed batchId, uint256 maxMintable, uint256 mintPrice);
    event BatchActivated(uint256 indexed batchId);
    event BatchDeactivated(uint256 indexed batchId);
    event WhitelistAdded(address[] users);
    event WhitelistRemoved(address user);
    event TransfersEnabled(bool enabled);
    event ProducedDistributed(uint256 amount, uint256 accProducedPerNFT, uint256 timestamp);
    event RewardDistributed(address indexed token, uint256 totalAmount, uint256 nftAmount, uint256 multisigAmount, uint256 accRewardPerNFT, uint256 timestamp);
    event MultisigRewardClaimed(address indexed token, uint256 amount, uint256 timestamp);
    event ProducedClaimed(uint256 indexed nftId, address indexed user, uint256 amount);
    event RewardClaimed(uint256 indexed nftId, address indexed user, address indexed token, uint256 amount);
    event RewardTokenAdded(address indexed token);
    event RewardTokenRemoved(address indexed token);
    event OracleSet(address indexed oracle);
    event TreasurySet(address indexed treasury);
    event NodeNFTSet(address indexed nodeNFT);
    event SellOrderCreated(uint256 indexed orderId, uint256 indexed nftId, address indexed seller, uint256 price, uint256 timestamp);
    event SellOrderCancelled(uint256 indexed orderId, uint256 indexed nftId, address seller, uint256 timestamp);
    event NFTBought(uint256 indexed orderId, uint256 indexed nftId, address indexed seller, address buyer, uint256 price, uint256 timestamp);
    event MarketFeeRateUpdated(uint256 newFeeRate);
    event MultisigNodeSet(address indexed multisigNode);
    event MiningDistributed(uint256 totalAmount, uint256 nftAmount, uint256 multisigAmount);
    event TokensBurnedFromSwap(uint256 amount, string reason);
    event UsdtTokenUpdated(address indexed oldUsdt, address indexed newUsdt);
    event UserNFTListSynced(uint256 indexed nftId, address indexed from, address indexed to);

    /* ========== MODIFIERS ========== */
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    /* ========== INITIALIZATION ========== */
    
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
        
        // Add USDT as default reward token
        rewardTokens.push(usdtToken_);
        isRewardToken[usdtToken_] = true;
        
        // Initialize global state
        globalState.lastUpdateTime = block.timestamp;
        
        // Initialize batch ID
        currentBatchId = 1;
        
        // Initialize order ID
        nextOrderId = 1;
        
        // Transfers disabled by default
        transfersEnabled = false;
        
        // Market fee rate (default 0%, can be set by owner)
        marketFeeRate = 0;
    }

    /* ========== WHITELIST MANAGEMENT ========== */
    
    /**
     * @notice Add users to whitelist
     * @param users Array of user addresses to add
     */
    function addToWhitelist(address[] calldata users) external onlyOwner {
        require(users.length > 0, "Empty array");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (!whitelist[users[i]]) {
                whitelist[users[i]] = true;
                whitelistCount++;
            }
        }
        
        emit WhitelistAdded(users);
    }
    
    /**
     * @notice Remove user from whitelist
     * @param user User address to remove
     */
    function removeFromWhitelist(address user) external onlyOwner {
        require(whitelist[user], "User not in whitelist");
        
        whitelist[user] = false;
        whitelistCount--;
        
        emit WhitelistRemoved(user);
    }
    
    /**
     * @notice Check if user is whitelisted
     * @param user User address to check
     * @return Whether user is whitelisted
     */
    function isWhitelisted(address user) external view returns (bool) {
        return whitelist[user];
    }

    /* ========== MULTISIG NODE MANAGEMENT ========== */
    
    /**
     * @notice Set multi-signature node address
     * @param multisigNode_ Multi-signature node address
     */
    function setMultisigNode(address multisigNode_) external onlyOwner {
        require(multisigNode_ != address(0), "Invalid multisig node address");
        multisigNode = multisigNode_;
        emit MultisigNodeSet(multisigNode_);
    }

    /* ========== CONTRACT CONFIGURATION ========== */
    
    /**
     * @notice Set oracle address
     * @param oracle_ New oracle address
     */
    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "Invalid oracle address");
        oracle = oracle_;
        emit OracleSet(oracle_);
    }
    
    /**
     * @notice Set treasury address
     * @param treasury_ New treasury address
     */
    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Invalid treasury address");
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }
    
    /**
     * @notice Set NodeNFT contract address
     * @dev Only owner can call this function
     * @param nodeNFT_ New NodeNFT contract address
     */
    function setNodeNFT(address nodeNFT_) external onlyOwner {
        require(nodeNFT_ != address(0), "Invalid NodeNFT address");
        nodeNFT = NodeNFT(nodeNFT_);
        emit NodeNFTSet(nodeNFT_);
    }
    
    /**
     * @notice Set USDT token address
     * @dev Updates USDT token address and manages reward token list
     * @param usdtToken_ New USDT token address
     */
    function setUsdtToken(address usdtToken_) external onlyOwner {
        require(usdtToken_ != address(0), "Invalid USDT address");
        require(usdtToken_ != address(usdtToken), "Same address");
        
        address oldUsdt = address(usdtToken);
        
        // Remove old USDT from reward tokens if it was added
        if (isRewardToken[oldUsdt]) {
            isRewardToken[oldUsdt] = false;
            
            // Remove from reward tokens array
            for (uint256 i = 0; i < rewardTokens.length; i++) {
                if (rewardTokens[i] == oldUsdt) {
                    rewardTokens[i] = rewardTokens[rewardTokens.length - 1];
                    rewardTokens.pop();
                    break;
                }
            }
            
            emit RewardTokenRemoved(oldUsdt);
        }
        
        // Update USDT token address
        usdtToken = IERC20(usdtToken_);
        
        // Add new USDT as reward token if not already added
        if (!isRewardToken[usdtToken_]) {
            rewardTokens.push(usdtToken_);
            isRewardToken[usdtToken_] = true;
            emit RewardTokenAdded(usdtToken_);
        }
        
        emit UsdtTokenUpdated(oldUsdt, usdtToken_);
    }

    /* ========== BATCH MANAGEMENT ========== */
    
    /**
     * @notice Create a new batch
     * @dev Batch is created as active by default. All batches' maxMintable sum must not exceed MAX_SUPPLY (5000).
     * @param maxMintable Maximum mintable amount for this batch
     * @param mintPrice Mint price in USDT (wei)
     * @return batchId The created batch ID
     */
    function createBatch(uint256 maxMintable, uint256 mintPrice) external onlyOwner returns (uint256) {
        require(maxMintable > 0, "maxMintable must be > 0");
        require(mintPrice > 0, "mintPrice must be > 0");
        
        // Calculate total maxMintable from all existing batches
        uint256 totalMaxMintable = 0;
        for (uint256 i = 1; i < currentBatchId; i++) {
            totalMaxMintable += batches[i].maxMintable;
        }
        
        // Check that adding this batch won't exceed MAX_SUPPLY
        require(totalMaxMintable + maxMintable <= MAX_SUPPLY, "Total maxMintable exceeds MAX_SUPPLY");
        
        uint256 batchId = currentBatchId;
        currentBatchId++;
        
        // Deactivate current active batch if exists (only one batch can be active at a time)
        for (uint256 i = 1; i < batchId; i++) {
            if (batches[i].active) {
                batches[i].active = false;
                emit BatchDeactivated(i);
            }
        }
        
        batches[batchId] = Batch({
            batchId: batchId,
            maxMintable: maxMintable,
            currentMinted: 0,
            mintPrice: mintPrice,
            active: true, // Created as active by default
            createdAt: block.timestamp
        });
        
        emit BatchCreated(batchId, maxMintable, mintPrice);
        emit BatchActivated(batchId);
        
        return batchId;
    }
    
    /**
     * @notice Activate a batch
     * @param batchId Batch ID to activate
     */
    function activateBatch(uint256 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        require(batch.batchId == batchId, "Batch does not exist");
        require(!batch.active, "Batch already active");
        
        // Deactivate current active batch if exists
        for (uint256 i = 1; i < currentBatchId; i++) {
            if (batches[i].active) {
                batches[i].active = false;
                emit BatchDeactivated(i);
            }
        }
        
        batch.active = true;
        emit BatchActivated(batchId);
    }
    
    /**
     * @notice Deactivate a batch
     * @param batchId Batch ID to deactivate
     */
    function deactivateBatch(uint256 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        require(batch.batchId == batchId, "Batch does not exist");
        require(batch.active, "Batch not active");
        
        batch.active = false;
        emit BatchDeactivated(batchId);
    }
    
    /**
     * @notice Get active batch
     * @return batchId Active batch ID, 0 if none
     */
    function getActiveBatch() external view returns (uint256) {
        for (uint256 i = 1; i < currentBatchId; i++) {
            if (batches[i].active) {
                return i;
            }
        }
        return 0;
    }

    /* ========== TRANSFER CONTROL ========== */
    
    /**
     * @notice Set transfers enabled/disabled
     * @param enabled Whether transfers are enabled
     */
    function setTransfersEnabled(bool enabled) external onlyOwner {
        transfersEnabled = enabled;
        emit TransfersEnabled(enabled);
    }
    
    /**
     * @notice Set TGE (Token Generation Event) time
     * @dev Only owner can set. TGE is the global unlock start time.
     *      Unlock starts at TGE + LOCK_PERIOD (365 days), then every 30 days unlocks 4%.
     * @param tgeTime_ TGE timestamp
     */
    function setTgeTime(uint256 tgeTime_) external onlyOwner {
        require(tgeTime_ > 0, "Invalid TGE time");
        tgeTime = tgeTime_;
        emit TgeTimeSet(tgeTime_);
    }

    /* ========== MINTING ========== */
    
    /**
     * @notice Mint a new NFT
     * @dev User must be whitelisted, batch must be active, and not exceed limits
     * @return nftId Minted NFT ID
     */
    function mintNFT() external nonReentrant returns (uint256) {
        // Check whitelist
        require(whitelist[msg.sender], "Not whitelisted");
        
        // Find active batch
        uint256 activeBatchId = 0;
        for (uint256 i = 1; i < currentBatchId; i++) {
            if (batches[i].active) {
                activeBatchId = i;
                break;
            }
        }
        require(activeBatchId > 0, "No active batch");
        
        Batch storage batch = batches[activeBatchId];
        
        // Check batch limit
        require(batch.currentMinted < batch.maxMintable, "Batch sold out");
        
        // Check global limit
        require(totalMinted < MAX_SUPPLY, "Max supply reached");
        
        // Transfer USDT from user to treasury
        usdtToken.safeTransferFrom(msg.sender, treasury, batch.mintPrice);
        
        // Mint NFT
        uint256 nftId = nodeNFT.mint(msg.sender);
        
        // Create NFT pool
        NFTPool storage pool = nftPools[nftId];
        pool.nftId = nftId;
        pool.status = NFTStatus.Active;
        pool.createdAt = block.timestamp;
        pool.unlockedWithdrawn = 0; // Initialize to 0
        pool.producedWithdrawn = 0; // Initialize to 0
        
        // Initialize reward withdrawn for all reward tokens
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            pool.rewardWithdrawn[token] = 0; // Initialize to 0
        }
        
        // Add to user's NFT list
        userNFTList[msg.sender].push(nftId);
        
        // Update counters
        batch.currentMinted++;
        totalMinted++;
        globalState.totalActiveNFTs++;
        
        emit NFTMinted(nftId, msg.sender, activeBatchId, batch.mintPrice, block.timestamp);
        
        return nftId;
    }

    /* ========== TERMINATION MANAGEMENT ========== */
    
    /**
     * @notice Initiate NFT termination
     * @param nftId NFT ID
     */
    function initiateTermination(uint256 nftId) external {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        require(pool.status == NFTStatus.Active, "NFT not active");
        
        pool.status = NFTStatus.PendingTermination;
        pool.terminationInitiatedAt = block.timestamp;
        
        emit TerminationInitiated(nftId, msg.sender, block.timestamp, block.timestamp + TERMINATION_COOLDOWN);
    }
    
    /**
     * @notice Confirm termination (after cooldown)
     * @param nftId NFT ID
     */
    function confirmTermination(uint256 nftId) external {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        require(pool.status == NFTStatus.PendingTermination, "NFT not terminating");
        require(
            block.timestamp >= pool.terminationInitiatedAt + TERMINATION_COOLDOWN,
            "Cooldown not passed"
        );
        
        pool.status = NFTStatus.Terminated;
        globalState.totalActiveNFTs--;
        
        emit TerminationConfirmed(nftId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Cancel termination
     * @param nftId NFT ID
     */
    function cancelTermination(uint256 nftId) external {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        require(pool.status == NFTStatus.PendingTermination, "NFT not terminating");
        
        // Check timeout (if more than 30 days after cooldown, cannot cancel)
        require(
            block.timestamp < pool.terminationInitiatedAt + TERMINATION_COOLDOWN + TERMINATION_TIMEOUT,
            "Termination timeout exceeded"
        );
        
        pool.status = NFTStatus.Active;
        pool.terminationInitiatedAt = 0;
        
        emit TerminationCancelled(nftId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Check and auto-confirm termination if timeout exceeded
     * @param nftId NFT ID
     */
    function _checkTerminationTimeout(uint256 nftId) internal {
        NFTPool storage pool = nftPools[nftId];
        
        if (
            pool.status == NFTStatus.PendingTermination &&
            block.timestamp >= pool.terminationInitiatedAt + TERMINATION_COOLDOWN + TERMINATION_TIMEOUT
        ) {
            pool.status = NFTStatus.Terminated;
            globalState.totalActiveNFTs--;
            emit TerminationConfirmed(nftId, nodeNFT.ownerOf(nftId), block.timestamp);
        }
    }

    /* ========== REWARD DISTRIBUTION (ORACLE) ========== */
    
    /**
     * @notice Distribute $E production by mining from EnclaveToken
     * @dev Only oracle can call. Mines tokens from EnclaveToken contract:
     *      - 80% to NFTManager (distributed to Active NFTs)
     *      - 20% directly to multisig node address
     *      Note: This contract must be set as EnclaveToken's oracle or owner
     *            to have permission to call mineTokens()
     * @param totalAmount Total amount of $E to mine (from EnclaveToken)
     */
    function distributeProduced(uint256 totalAmount) external onlyOracle nonReentrant {
        require(totalAmount > 0, "Amount must be positive");
        require(multisigNode != address(0), "Multisig node not set");
        require(globalState.totalActiveNFTs > 0, "No active NFTs");
        
        // Calculate distribution: 80% to NFTs, 20% to multisig node
        uint256 nftAmount = (totalAmount * 80) / 100;
        uint256 multisigAmount = totalAmount - nftAmount; // Ensures exact split
        
        // Mine tokens to NFTManager contract (80% for NFT distribution)
        if (nftAmount > 0) {
            eclvToken.mineTokens(address(this), nftAmount);
            
            // Update global index (O(1) operation)
            // nftAmount is already in wei, so we don't need to multiply by PRECISION
            globalState.accProducedPerNFT += nftAmount / globalState.totalActiveNFTs;
        }
        
        // Mine tokens directly to multisig node (20%)
        if (multisigAmount > 0) {
            eclvToken.mineTokens(multisigNode, multisigAmount);
        }
        
        globalState.lastUpdateTime = block.timestamp;
        
        emit MiningDistributed(totalAmount, nftAmount, multisigAmount);
        emit ProducedDistributed(nftAmount, globalState.accProducedPerNFT, block.timestamp);
    }
    
    /**
     * @notice Burn tokens from Swap buyback (called by Oracle)
     * @dev Only oracle can call. Oracle purchases tokens from Swap, then either:
     *      Option 1: Oracle transfers tokens to NFTManager, then calls this function
     *      Option 2: Oracle approves tokens to NFTManager, then calls this function (NFTManager will pull)
     *      Note: This contract must be set as EnclaveToken's oracle to have permission to call burnFromSwap()
     * @param amount Amount of tokens to burn
     * @param reason Reason for burn (e.g., "swap_buyback")
     */
    function burnTokensFromSwap(uint256 amount, string memory reason) external onlyOracle nonReentrant {
        require(amount > 0, "Amount must be positive");
        
        // Ensure this contract has enough tokens
        uint256 balance = eclvToken.balanceOf(address(this));
        if (balance < amount) {
            // Try to pull tokens from oracle (Oracle must have approved first)
            uint256 needed = amount - balance;
            IERC20(address(eclvToken)).safeTransferFrom(msg.sender, address(this), needed);
        }
        
        // Approve EnclaveToken to spend tokens from this contract
        // Note: OpenZeppelin v5 uses forceApprove instead of safeApprove
        IERC20(address(eclvToken)).forceApprove(address(eclvToken), amount);
        
        // Call EnclaveToken's burnFromSwap function
        // This contract must be set as EnclaveToken's oracle
        eclvToken.burnFromSwap(amount, reason);
        
        emit TokensBurnedFromSwap(amount, reason);
    }
    
    /**
     * @notice Distribute reward tokens to all Active NFTs (O(1) operation)
     * @dev Only oracle can call. Updates global index for specific token
     *      Distribution: 80% to NFTs, 20% to multisig node
     * @param token Reward token address
     * @param amount Total amount to distribute
     */
    function distributeReward(address token, uint256 amount) external onlyOracle nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(isRewardToken[token], "Token not supported");
        require(multisigNode != address(0), "Multisig node not set");
        require(globalState.totalActiveNFTs > 0, "No active NFTs");
        
        // Calculate distribution: 80% to NFTs, 20% to multisig node
        uint256 nftAmount = (amount * 80) / 100;
        uint256 multisigAmount = amount - nftAmount; // Ensures exact split
        
        // Transfer reward token from oracle to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Accumulate multisig reward (multisig can claim later)
        multisigRewardDistributed[token] += multisigAmount;
        
        // Update global index for this token (O(1) operation)
        // Only nftAmount is distributed to NFTs
        // amount is already in wei, so we don't need to multiply by PRECISION
        globalState.accRewardPerNFT[token] += nftAmount / globalState.totalActiveNFTs;
        globalState.lastUpdateTime = block.timestamp;
        
        emit RewardDistributed(token, amount, nftAmount, multisigAmount, globalState.accRewardPerNFT[token], block.timestamp);
    }

    /* ========== REWARD TOKEN MANAGEMENT ========== */
    
    /**
     * @notice Add a reward token
     * @param token Token address to add
     */
    function addRewardToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!isRewardToken[token], "Token already added");
        
        rewardTokens.push(token);
        isRewardToken[token] = true;
        
        emit RewardTokenAdded(token);
    }
    
    /**
     * @notice Remove a reward token
     * @param token Token address to remove
     */
    function removeRewardToken(address token) external onlyOwner {
        require(isRewardToken[token], "Token not added");
        
        isRewardToken[token] = false;
        
        // Remove from array
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (rewardTokens[i] == token) {
                rewardTokens[i] = rewardTokens[rewardTokens.length - 1];
                rewardTokens.pop();
                break;
            }
        }
        
        emit RewardTokenRemoved(token);
    }

    /* ========== UNLOCK MECHANISM ========== */
    
    /**
     * @notice Calculate unlocked periods based on TGE and current time
     * @dev Internal function to calculate how many periods should be unlocked
     * @return periods Number of periods unlocked (0-25)
     */
    function _calculateUnlockedPeriods() internal view returns (uint256) {
        if (tgeTime == 0) {
            return 0; // TGE not set yet
        }
        
        // Unlock starts at TGE + LOCK_PERIOD (365 days)
        uint256 unlockStartTime = tgeTime + LOCK_PERIOD;
        
        // Check if unlock period has started
        if (block.timestamp < unlockStartTime) {
            return 0; // Lock period not passed yet
        }
        
        // Calculate time since unlock started
        uint256 timeSinceUnlockStart = block.timestamp - unlockStartTime;
        
        // Calculate periods (every 30 days = 1 period)
        uint256 periods = timeSinceUnlockStart / UNLOCK_INTERVAL;
        
        // Cap at max periods
        if (periods > UNLOCK_PERIODS) {
            periods = UNLOCK_PERIODS;
        }
        
        return periods;
        }
        
    /**
     * @notice Calculate unlocked amount based on TGE and current time
     * @dev Automatically calculates based on TGE + lock period + unlock intervals
     *      All NFTs have the same locked amount (ECLV_PER_NFT = 2000 $E)
     * @return unlockedAmount Total unlocked amount
     */
    function _calculateUnlockedAmount() internal view returns (uint256) {
        uint256 periods = _calculateUnlockedPeriods();
        if (periods == 0) {
            return 0;
        }
        uint256 unlockAmountPerPeriod = (ECLV_PER_NFT * UNLOCK_PERCENTAGE) / 100;
        return periods * unlockAmountPerPeriod;
    }
    
    /**
     * @notice Calculate unlocked amount for an NFT (public view)
     * @param nftId NFT ID (for validation only, all NFTs have same unlock schedule)
     * @return unlockedAmount Total unlocked amount based on TGE and current time
     */
    function calculateUnlockedAmount(uint256 nftId) external view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        require(pool.nftId == nftId, "NFT does not exist");
        return _calculateUnlockedAmount();
    }
    
    /**
     * @notice Get current unlocked periods (public view)
     * @return periods Number of periods unlocked based on TGE and current time
     */
    function getUnlockedPeriods() external view returns (uint256) {
        return _calculateUnlockedPeriods();
    }

    /* ========== CLAIM FUNCTIONS ========== */
    
    /**
     * @notice Claim $E production for a specific NFT
     * @param nftId NFT ID
     * @return amount Claimed amount
     */
    function claimProduced(uint256 nftId) public nonReentrant returns (uint256) {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        
        // Check termination timeout
        _checkTerminationTimeout(nftId);
        
        uint256 amount = _getPendingProduced(nftId);
        
        if (amount > 0) {
            // Accumulate withdrawn amount
            if (pool.status == NFTStatus.Active || pool.status == NFTStatus.PendingTermination) {
                pool.producedWithdrawn += amount;
            }
            
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
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        require(isRewardToken[token], "Token not supported");
        
        NFTPool storage pool = nftPools[nftId];
        
        // Check termination timeout
        _checkTerminationTimeout(nftId);
        
        uint256 amount = _getPendingReward(nftId, token);
        
        if (amount > 0) {
            // Accumulate withdrawn amount
            if (pool.status == NFTStatus.Active || pool.status == NFTStatus.PendingTermination) {
                pool.rewardWithdrawn[token] += amount;
            }
            
            // Transfer reward to user
            IERC20(token).safeTransfer(msg.sender, amount);
            
            emit RewardClaimed(nftId, msg.sender, token, amount);
        }
        
        return amount;
    }
    
    /**
     * @notice Claim all reward tokens for a specific NFT (claim all tokens at once)
     * @param nftId NFT ID
     * @return tokens Array of token addresses that were claimed
     * @return amounts Array of claimed amounts for each token
     * @return totalClaimed Total amount claimed across all tokens
     */
    function claimAllRewards(uint256 nftId) external nonReentrant returns (
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 totalClaimed
    ) {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        
        // Check termination timeout
        _checkTerminationTimeout(nftId);
        
        // Get all reward tokens
        uint256 tokenCount = rewardTokens.length;
        tokens = new address[](tokenCount);
        amounts = new uint256[](tokenCount);
        
        // Claim rewards for each token
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = rewardTokens[i];
            tokens[i] = token;
            
            uint256 amount = _getPendingReward(nftId, token);
            amounts[i] = amount;
            
            if (amount > 0) {
                // Accumulate withdrawn amount
                if (pool.status == NFTStatus.Active || pool.status == NFTStatus.PendingTermination) {
                    pool.rewardWithdrawn[token] += amount;
                }
                
                // Transfer reward to user
                IERC20(token).safeTransfer(msg.sender, amount);
                
                totalClaimed += amount;
                
                emit RewardClaimed(nftId, msg.sender, token, amount);
            }
        }
        
        return (tokens, amounts, totalClaimed);
    }
    
    /**
     * @notice Withdraw unlocked $E (only for Terminated NFTs)
     * @dev Can withdraw: calculateUnlockedAmount() - unlockedWithdrawn
     * @param nftId NFT ID
     * @param amount Amount to withdraw (0 = withdraw all available)
     * @return withdrawnAmount Actual withdrawn amount
     */
    function withdrawUnlocked(uint256 nftId, uint256 amount) external nonReentrant returns (uint256) {
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        NFTPool storage pool = nftPools[nftId];
        require(pool.status == NFTStatus.Terminated, "NFT not terminated");
        
        // Calculate total unlocked amount based on TGE and current time
        uint256 totalUnlocked = _calculateUnlockedAmount();
        
        // Calculate available amount: totalUnlocked - withdrawn
        uint256 available = totalUnlocked > pool.unlockedWithdrawn
            ? totalUnlocked - pool.unlockedWithdrawn
            : 0;
        
        require(available > 0, "No unlocked amount available");
        
        // If amount is 0, withdraw all available
        if (amount == 0) {
            amount = available;
        } else {
            require(amount <= available, "Insufficient unlocked amount");
        }
        
        // Update withdrawn amount
        pool.unlockedWithdrawn += amount;
        
        // Transfer $E to user
        eclvToken.transfer(msg.sender, amount);
        
        emit UnlockedWithdrawn(nftId, msg.sender, amount, block.timestamp);
        
        return amount;
    }

    /* ========== VIEW FUNCTIONS ========== */
    
    /**
     * @notice Get pending $E production for an NFT
     * @param nftId NFT ID
     * @return Pending amount
     */
    function _getPendingProduced(uint256 nftId) internal view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        
        if (pool.status == NFTStatus.Active || pool.status == NFTStatus.PendingTermination) {
            if (globalState.accProducedPerNFT > pool.producedWithdrawn) {
                // accProducedPerNFT is already in wei (no PRECISION scaling)
                return globalState.accProducedPerNFT - pool.producedWithdrawn;
            }
        }
        
        return 0;
    }
    
    /**
     * @notice Get pending reward for an NFT
     * @param nftId NFT ID
     * @param token Reward token address
     * @return Pending amount
     */
    function _getPendingReward(uint256 nftId, address token) internal view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        
        if (pool.status == NFTStatus.Active || pool.status == NFTStatus.PendingTermination) {
            if (globalState.accRewardPerNFT[token] > pool.rewardWithdrawn[token]) {
                // accRewardPerNFT is already in wei (no PRECISION scaling)
                return globalState.accRewardPerNFT[token] - pool.rewardWithdrawn[token];
            }
        }
        
        return 0;
    }
    
    /**
     * @notice Get pending $E production for an NFT (public view)
     * @param nftId NFT ID
     * @return Pending amount
     */
    function getPendingProduced(uint256 nftId) external view returns (uint256) {
        return _getPendingProduced(nftId);
    }
    
    /**
     * @notice Get pending reward for an NFT (public view)
     * @param nftId NFT ID
     * @param token Reward token address
     * @return Pending amount
     */
    function getPendingReward(uint256 nftId, address token) external view returns (uint256) {
        return _getPendingReward(nftId, token);
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
     * @notice Get NFT pool data
     * @param nftId NFT ID
     * @return status NFT status
     * @return createdAt Creation timestamp
     * @return terminationInitiatedAt Termination initiation time
     * @return totalEclvLocked Total $E locked (always ECLV_PER_NFT = 2000 $E)
     * @return remainingMintQuota Remaining locked quota (calculated)
     * @return unlockedAmount Total unlocked amount (calculated from TGE and current time)
     * @return unlockedWithdrawn Unlocked and withdrawn
     * @return unlockedPeriods Current unlocked periods (calculated from TGE and current time)
     * @return producedWithdrawn $E production withdrawn (accumulated)
     */
    function getNFTPool(uint256 nftId) external view returns (
        NFTStatus status,
        uint256 createdAt,
        uint256 terminationInitiatedAt,
        uint256 totalEclvLocked,
        uint256 remainingMintQuota,
        uint256 unlockedAmount,
        uint256 unlockedWithdrawn,
        uint256 unlockedPeriods,
        uint256 producedWithdrawn
    ) {
        NFTPool storage pool = nftPools[nftId];
        uint256 calculatedUnlocked = _calculateUnlockedAmount();
        uint256 calculatedPeriods = _calculateUnlockedPeriods();
        uint256 calculatedRemaining = ECLV_PER_NFT > calculatedUnlocked
            ? ECLV_PER_NFT - calculatedUnlocked
            : 0;
        return (
            pool.status,
            pool.createdAt,
            pool.terminationInitiatedAt,
            ECLV_PER_NFT, // Always 2000 $E
            calculatedRemaining,
            calculatedUnlocked,
            pool.unlockedWithdrawn,
            calculatedPeriods,
            pool.producedWithdrawn
        );
    }
    
    /**
     * @notice Get reward withdrawn for a specific NFT and token
     * @param nftId NFT ID
     * @param token Reward token address
     * @return rewardWithdrawn Reward withdrawn (accumulated amount for this token)
     */
    function getRewardWithdrawn(uint256 nftId, address token) external view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        require(pool.nftId == nftId, "NFT does not exist");
        return pool.rewardWithdrawn[token];
    }
    
    /**
     * @notice Get reward debt for a specific NFT and token (deprecated, use getRewardWithdrawn)
     * @dev Kept for backward compatibility
     */
    function getRewardDebt(uint256 nftId, address token) external view returns (uint256) {
        NFTPool storage pool = nftPools[nftId];
        require(pool.nftId == nftId, "NFT does not exist");
        return pool.rewardWithdrawn[token];
    }
    
    /**
     * @notice Get accumulated reward per NFT for a specific token
     * @param token Reward token address
     * @return accRewardPerNFT Accumulated reward per NFT for this token
     */
    function getAccRewardPerNFT(address token) external view returns (uint256) {
        return globalState.accRewardPerNFT[token];
    }
    
    /**
     * @notice Get multisig reward info for a specific token
     * @param token Reward token address
     * @return totalDistributed Total amount distributed to multisig (20% of all distributions)
     * @return withdrawn Amount already withdrawn by multisig
     * @return available Available amount for multisig to claim
     */
    function getMultisigRewardInfo(address token) external view returns (
        uint256 totalDistributed,
        uint256 withdrawn,
        uint256 available
    ) {
        totalDistributed = multisigRewardDistributed[token];
        withdrawn = multisigRewardWithdrawn[token];
        available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
        return (totalDistributed, withdrawn, available);
    }
    
    /**
     * @notice Claim multisig reward for a specific token
     * @dev Only multisig node can call
     * @param token Reward token address
     * @return amount Claimed amount
     */
    function claimMultisigReward(address token) external nonReentrant returns (uint256) {
        require(msg.sender == multisigNode, "Only multisig node can claim");
        require(isRewardToken[token], "Token not supported");
        
        // Calculate available reward
        uint256 totalDistributed = multisigRewardDistributed[token];
        uint256 withdrawn = multisigRewardWithdrawn[token];
        uint256 available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
        
        require(available > 0, "No reward available");
        
        // Update withdrawn amount
        multisigRewardWithdrawn[token] += available;
        
        // Transfer reward to multisig
        IERC20(token).safeTransfer(multisigNode, available);
        
        emit MultisigRewardClaimed(token, available, block.timestamp);
        
        return available;
    }
    
    /**
     * @notice Claim all multisig rewards (claim all tokens at once)
     * @dev Only multisig node can call
     * @return tokens Array of token addresses that were claimed
     * @return amounts Array of claimed amounts for each token
     * @return totalClaimed Total amount claimed across all tokens
     */
    function claimAllMultisigRewards() external nonReentrant returns (
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 totalClaimed
    ) {
        require(msg.sender == multisigNode, "Only multisig node can claim");
        
        uint256 tokenCount = rewardTokens.length;
        tokens = new address[](tokenCount);
        amounts = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = rewardTokens[i];
            tokens[i] = token;
            
            // Calculate available reward for this token
            uint256 totalDistributed = multisigRewardDistributed[token];
            uint256 withdrawn = multisigRewardWithdrawn[token];
            uint256 available = totalDistributed > withdrawn ? totalDistributed - withdrawn : 0;
            amounts[i] = available;
            
            if (available > 0) {
                // Update withdrawn amount
                multisigRewardWithdrawn[token] += available;
                
                // Transfer reward to multisig
                IERC20(token).safeTransfer(multisigNode, available);
                
                totalClaimed += available;
                
                emit MultisigRewardClaimed(token, available, block.timestamp);
            }
        }
        
        return (tokens, amounts, totalClaimed);
    }
    
    /**
     * @notice Get all reward token addresses
     * @return tokens Array of reward token addresses
     */
    function getAllRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }
    
    /**
     * @notice Get reward token count
     * @return count Number of reward tokens
     */
    function getRewardTokenCount() external view returns (uint256) {
        return rewardTokens.length;
    }

    /* ========== MARKET FUNCTIONS ========== */
    
    /**
     * @notice Set market fee rate
     * @param feeRate Fee rate in basis points (e.g., 250 = 2.5%)
     */
    function setMarketFeeRate(uint256 feeRate) external onlyOwner {
        require(feeRate <= 1000, "Fee rate too high"); // Max 10%
        marketFeeRate = feeRate;
        emit MarketFeeRateUpdated(feeRate);
    }
    
    /**
     * @notice Create a sell order for an NFT
     * @param nftId NFT ID to sell
     * @param price Price in USDT (wei)
     * @return orderId Created order ID
     */
    function createSellOrder(uint256 nftId, uint256 price) external nonReentrant returns (uint256) {
        require(transfersEnabled, "Transfers not enabled");
        require(nodeNFT.ownerOf(nftId) == msg.sender, "Not NFT owner");
        require(price > 0, "Price must be > 0");
        require(nftActiveOrder[nftId] == 0, "NFT already has active order");
        
        // Check if NFT exists in pool
        NFTPool storage pool = nftPools[nftId];
        require(pool.nftId == nftId, "NFT not found");
        
        // Ensure this contract is approved to transfer the NFT when the order is filled
        // This is required for buyNFT to successfully transfer the NFT
        // Check current approval status
        address currentApproval = nodeNFT.getApproved(nftId);
        bool isApprovedForAll = nodeNFT.isApprovedForAll(msg.sender, address(this));
        
        // If not approved, revert with clear error message
        // Note: The owner must call approve() on the NodeNFT contract before creating the order
        if (currentApproval != address(this) && !isApprovedForAll) {
            revert("NFTManager not approved. Owner must call NodeNFT.approve(NFTManager, tokenId) first");
        }
        
        uint256 orderId = nextOrderId;
        nextOrderId++;
        
        sellOrders[orderId] = SellOrder({
            orderId: orderId,
            nftId: nftId,
            seller: msg.sender,
            price: price,
            createdAt: block.timestamp,
            status: OrderStatus.Active
        });
        
        nftActiveOrder[nftId] = orderId;
        activeOrderIds.push(orderId);
        
        emit SellOrderCreated(orderId, nftId, msg.sender, price, block.timestamp);
        
        return orderId;
    }
    
    /**
     * @notice Cancel a sell order
     * @param orderId Order ID to cancel
     */
    function cancelSellOrder(uint256 orderId) external nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        require(order.orderId == orderId, "Order does not exist");
        require(order.seller == msg.sender, "Not order seller");
        require(order.status == OrderStatus.Active, "Order not active");
        
        order.status = OrderStatus.Cancelled;
        nftActiveOrder[order.nftId] = 0;
        _removeFromActiveOrders(orderId);
        
        emit SellOrderCancelled(orderId, order.nftId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Buy an NFT from a sell order
     * @param orderId Order ID to fill
     */
    function buyNFT(uint256 orderId) external nonReentrant {
        SellOrder storage order = sellOrders[orderId];
        require(order.orderId == orderId, "Order does not exist");
        require(order.status == OrderStatus.Active, "Order not active");
        require(msg.sender != order.seller, "Cannot buy own NFT");
        
        // Check NFT ownership hasn't changed
        require(nodeNFT.ownerOf(order.nftId) == order.seller, "NFT ownership changed");
        
        // Calculate fee
        uint256 fee = (order.price * marketFeeRate) / 10000;
        uint256 sellerAmount = order.price - fee;
        
        // Transfer USDT from buyer
        usdtToken.safeTransferFrom(msg.sender, address(this), order.price);
        
        // Transfer USDT to seller (minus fee)
        usdtToken.safeTransfer(order.seller, sellerAmount);
        
        // Transfer fee to treasury (if any)
        if (fee > 0) {
            usdtToken.safeTransfer(treasury, fee);
        }
        
        // Transfer NFT from seller to buyer
        // NOTE: This will trigger NodeNFT._update, which calls onNFTTransfer
        // onNFTTransfer automatically syncs userNFTList, so we don't need to update it manually
        nodeNFT.transferFrom(order.seller, msg.sender, order.nftId);
        
        // Update order status
        order.status = OrderStatus.Filled;
        nftActiveOrder[order.nftId] = 0;
        _removeFromActiveOrders(orderId);
        
        // NOTE: userNFTList is automatically updated by onNFTTransfer hook
        // No need to manually update it here
        
        emit NFTBought(orderId, order.nftId, order.seller, msg.sender, order.price, block.timestamp);
    }
    
    /**
     * @notice Remove NFT from user's list (internal)
     * @param user User address
     * @param nftId NFT ID to remove
     */
    function _removeFromUserList(address user, uint256 nftId) internal {
        uint256[] storage userNFTs = userNFTList[user];
        for (uint256 i = 0; i < userNFTs.length; i++) {
            if (userNFTs[i] == nftId) {
                userNFTs[i] = userNFTs[userNFTs.length - 1];
                userNFTs.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Called by NodeNFT when NFT is transferred directly
     * @dev Only NodeNFT can call this function to sync userNFTList
     * @param from Previous owner address
     * @param to New owner address
     * @param nftId NFT ID that was transferred
     */
    function onNFTTransfer(address from, address to, uint256 nftId) external {
        // Only NodeNFT can call this function
        require(msg.sender == address(nodeNFT), "Only NodeNFT can call");
        require(from != address(0) && to != address(0), "Invalid addresses");
        
        // Remove from old owner's list
        _removeFromUserList(from, nftId);
        
        // Add to new owner's list (if not already there)
        uint256[] storage newOwnerNFTs = userNFTList[to];
        bool alreadyInList = false;
        for (uint256 i = 0; i < newOwnerNFTs.length; i++) {
            if (newOwnerNFTs[i] == nftId) {
                alreadyInList = true;
                break;
            }
        }
        if (!alreadyInList) {
            newOwnerNFTs.push(nftId);
        }
        
        emit UserNFTListSynced(nftId, from, to);
    }
    
    /**
     * @notice Remove order from active orders list (internal)
     * @param orderId Order ID to remove
     */
    function _removeFromActiveOrders(uint256 orderId) internal {
        for (uint256 i = 0; i < activeOrderIds.length; i++) {
            if (activeOrderIds[i] == orderId) {
                activeOrderIds[i] = activeOrderIds[activeOrderIds.length - 1];
                activeOrderIds.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Get order details
     * @param orderId Order ID
     * @return order Order details
     */
    function getOrder(uint256 orderId) external view returns (SellOrder memory) {
        return sellOrders[orderId];
    }
    
    /**
     * @notice Get active order ID for an NFT
     * @param nftId NFT ID
     * @return orderId Active order ID, 0 if none
     */
    function getActiveOrderByNFT(uint256 nftId) external view returns (uint256) {
        return nftActiveOrder[nftId];
    }
    
    /**
     * @notice Get total number of active orders
     * @return count Total active orders count
     */
    function getActiveOrdersCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
    
    /**
     * @notice Get active orders with pagination
     * @param offset Starting index
     * @param limit Maximum number of orders to return
     * @return orders Array of active orders
     * @return total Total number of active orders
     */
    function getActiveOrders(uint256 offset, uint256 limit) external view returns (SellOrder[] memory orders, uint256 total) {
        total = activeOrderIds.length;
        require(offset < total, "Offset out of range");
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 count = end - offset;
        orders = new SellOrder[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 orderId = activeOrderIds[offset + i];
            SellOrder storage order = sellOrders[orderId];
            // Only return if still active (in case of race condition)
            if (order.status == OrderStatus.Active) {
                orders[i] = order;
            }
        }
        
        return (orders, total);
    }
    
    /**
     * @notice Get all active orders (use with caution - may exceed gas limit)
     * @return orders Array of all active orders
     */
    function getAllActiveOrders() external view returns (SellOrder[] memory) {
        uint256 count = activeOrderIds.length;
        SellOrder[] memory orders = new SellOrder[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 orderId = activeOrderIds[i];
            SellOrder storage order = sellOrders[orderId];
            if (order.status == OrderStatus.Active) {
                orders[i] = order;
            }
        }
        
        return orders;
    }
    
    /**
     * @notice Get orders by seller with pagination
     * @param seller Seller address
     * @param offset Starting index
     * @param limit Maximum number of orders to return
     * @return orders Array of orders
     * @return total Total number of orders by this seller
     */
    function getOrdersBySeller(address seller, uint256 offset, uint256 limit) external view returns (SellOrder[] memory orders, uint256 total) {
        // First, count total orders by seller
        uint256 count = 0;
        for (uint256 i = 1; i < nextOrderId; i++) {
            if (sellOrders[i].seller == seller) {
                count++;
            }
        }
        
        total = count;
        if (offset >= total) {
            return (new SellOrder[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 resultCount = end - offset;
        orders = new SellOrder[](resultCount);
        uint256 currentIndex = 0;
        uint256 found = 0;
        
        for (uint256 i = 1; i < nextOrderId && found < end; i++) {
            if (sellOrders[i].seller == seller) {
                if (found >= offset) {
                    orders[currentIndex] = sellOrders[i];
                    currentIndex++;
                }
                found++;
            }
        }
        
        return (orders, total);
    }

    /* ========== UUPS UPGRADE ========== */
    
    /**
     * @notice Authorize upgrade (only owner)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
