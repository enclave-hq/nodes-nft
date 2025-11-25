// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EnclaveToken ($E)
 * @dev Enclave project token contract with mining and burn management
 * 
 * Token Specifications:
 * - Name: $E
 * - Symbol: $E
 * - Decimals: 18
 * - Initial Supply: 70,000,000 $E (7000万)
 * - Max Supply: 100,000,000 $E (hard cap - 1亿)
 * 
 * Mining Rules:
 * - First 6 years: 5,000,000 $E per year (500万/年)
 * - From year 7: min(previous year's burned amount, 2,000,000 $E) per year
 * 
 * Burn Mechanism:
 * - Oracle can burn tokens purchased from Swap
 * - All burns are recorded with history
 */
contract EnclaveToken is ERC20, Ownable {
    /* ========== CONSTANTS ========== */
    
    /// @notice Maximum token supply: 100 million $E (hard cap)
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    
    /// @notice Initial token supply: 70 million $E
    uint256 public constant INITIAL_SUPPLY = 70_000_000 * 10**18;
    
    /// @notice Mining constants
    uint256 public constant FIRST_6_YEARS_TOTAL = 30_000_000 * 10**18;  // 前6年总共3000万
    uint256 public constant YEARLY_MINING_FIRST_6 = 5_000_000 * 10**18;  // 前6年每年500万
    uint256 public constant YEARLY_MINING_AFTER_6_MAX = 2_000_000 * 10**18;  // 第7年起每年最大200万
    
    /* ========== MINING STATE ========== */
    
    /// @notice TGE (Token Generation Event) time - set after deployment
    uint256 public tgeTime;
    
    /// @notice Total amount of tokens mined
    uint256 public totalMined;
    
    /// @notice Mining record per year (year => amount mined)
    mapping(uint256 => uint256) public yearlyMined;
    
    /// @notice Oracle address (authorized to trigger mining and burn)
    address public oracle;
    
    /* ========== BURN STATE ========== */
    
    /// @notice Total amount of tokens burned
    uint256 public totalBurned;
    
    /// @notice Burn record per year (year => amount burned)
    mapping(uint256 => uint256) public yearlyBurned;
    
    /// @notice Burn record structure
    struct BurnRecord {
        uint256 amount;        // Amount burned
        uint256 timestamp;      // Burn timestamp
        address executor;       // Address that executed the burn
        string reason;          // Reason for burn (e.g., "swap_buyback")
    }
    
    /// @notice Array of all burn records
    BurnRecord[] public burnHistory;
    
    /* ========== EVENTS ========== */
    
    /// @notice Emitted when TGE time is set
    event TGESet(uint256 tgeTime);
    
    /// @notice Emitted when tokens are mined
    event TokensMined(
        address indexed to,
        uint256 amount,
        uint256 totalMined,
        uint256 year
    );
    
    /// @notice Emitted when oracle is set
    event OracleSet(address indexed oracle);
    
    /// @notice Emitted when tokens are burned
    event TokensBurned(
        address indexed executor,
        uint256 amount,
        uint256 totalBurned,
        string reason
    );
    
    /* ========== MODIFIERS ========== */
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }
    
    /* ========== CONSTRUCTOR ========== */
    
    /**
     * @notice Constructor - no initial minting, tokens will be minted by oracle as needed
     * @dev Initial supply (70M) can be minted by oracle through mineTokens() function
     *      This allows flexible distribution based on actual needs
     */
    constructor() ERC20("$E", "$E") Ownable(msg.sender) {
        // No initial minting - tokens will be minted by oracle as needed
        // Initial supply (70M) can be distributed gradually through mineTokens()
    }
    
    /* ========== ADMIN FUNCTIONS ========== */
    
    /**
     * @notice Set TGE time (can be set after deployment)
     * @param tgeTime_ TGE timestamp
     */
    function setTGETime(uint256 tgeTime_) external onlyOwner {
        require(tgeTime_ > 0, "Invalid TGE time");
        require(tgeTime_ <= block.timestamp, "TGE time cannot be in the future");
        
        tgeTime = tgeTime_;
        emit TGESet(tgeTime_);
    }

    /**
     * @notice Set oracle address
     * @param oracle_ Oracle address
     */
    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "Invalid oracle address");
        oracle = oracle_;
        emit OracleSet(oracle_);
    }
    
    /* ========== MINING FUNCTIONS ========== */
    
    /**
     * @notice Get current year based on TGE time
     * @return Current year (0-indexed from TGE year)
     */
    function getCurrentYear() public view returns (uint256) {
        require(tgeTime > 0, "TGE time not set");
        return (block.timestamp - tgeTime) / 365 days;
    }

    /**
     * @notice Get years from TGE
     * @return Number of years since TGE
     */
    function getYearsFromTGE() public view returns (uint256) {
        require(tgeTime > 0, "TGE time not set");
        return (block.timestamp - tgeTime) / 365 days;
    }

    /**
     * @notice Calculate mining allowance for current year
     * @return Amount of tokens that can be mined this year
     */
    function calculateMiningAllowance() public view returns (uint256) {
        require(tgeTime > 0, "TGE time not set");
        
        uint256 yearsFromTGE = getYearsFromTGE();
        uint256 currentYear = getCurrentYear();
        
        if (yearsFromTGE < 6) {
            // First 6 years: fixed 5M per year
            uint256 yearMined = yearlyMined[currentYear];
            uint256 remaining = YEARLY_MINING_FIRST_6 - yearMined;
            
            // Check total mining limit for first 6 years
            uint256 totalRemaining = FIRST_6_YEARS_TOTAL - totalMined;
            
            return remaining < totalRemaining ? remaining : totalRemaining;
        } else {
            // After 6 years: dynamic calculation
            return calculateMiningAfter6Years(currentYear);
        }
    }

    /**
     * @notice Calculate mining allowance for years after 6
     * @param currentYear Current year index
     * @return Amount of tokens that can be mined this year
     */
    function calculateMiningAfter6Years(uint256 currentYear) internal view returns (uint256) {
        // From year 7 (currentYear >= 6), use previous year's burned amount
        require(currentYear >= 6, "Must be after 6 years");
        uint256 previousYear = currentYear - 1; // previousYear >= 5
        uint256 previousYearBurned = yearlyBurned[previousYear];
        
        // Mining amount = Min(previous year's burned amount, 2M)
        uint256 calculatedMining = previousYearBurned < YEARLY_MINING_AFTER_6_MAX 
            ? previousYearBurned 
            : YEARLY_MINING_AFTER_6_MAX;
        
        // Get already mined this year
        uint256 yearMined = yearlyMined[currentYear];
        uint256 remaining = calculatedMining > yearMined ? calculatedMining - yearMined : 0;
        
        // Check total supply limit
        uint256 currentSupply = totalSupply();
        uint256 maxCanMint = MAX_SUPPLY - currentSupply;
        
        // Take minimum of remaining allowance and max supply limit
        return remaining < maxCanMint ? remaining : maxCanMint;
    }

    /**
     * @notice Mine tokens (called by Oracle)
     * @dev Flexible minting mechanism:
     *      - Before TGE: Can mint initial supply (70M) as needed for distribution
     *        * Can mint to TokenVesting contract for locked allocations (Team, SAFT1, SAFT2)
     *        * Can mint to Treasury, Liquidity pools, Airdrop addresses, etc.
     *        * No year restrictions, but total cannot exceed INITIAL_SUPPLY (70M)
     *      - After TGE: Follow annual mining rules (5M/year for first 6 years, then dynamic)
     *        * Mining rewards for NFT holders and multisig nodes
     *        * Subject to annual mining allowance limits
     * @param to Address to receive minted tokens (can be TokenVesting, Treasury, etc.)
     * @param amount Amount of tokens to mine
     */
    function mineTokens(address to, uint256 amount) external onlyOracle {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");
        
        uint256 currentSupply = totalSupply();
        require(currentSupply + amount <= MAX_SUPPLY, "Exceeds max supply");
        
        // If TGE is not set yet, allow minting initial supply (70M) as needed
        // This allows flexible distribution to TokenVesting, Treasury, Liquidity, etc.
        if (tgeTime == 0) {
            // Before TGE: can mint up to INITIAL_SUPPLY (70M) without year restrictions
            // This allows gradual distribution based on actual needs:
            // - Mint to TokenVesting for Team/SAFT1/SAFT2 (locked allocations)
            // - Mint to Treasury for Ecosystem, CEX Listing, etc.
            // - Mint to Liquidity pools
            // - Mint to Airdrop addresses
            uint256 canMintBeforeTGE = INITIAL_SUPPLY - currentSupply;
            require(amount <= canMintBeforeTGE, "Exceeds initial supply limit");
            
            // Update records (no year tracking before TGE)
            totalMined += amount;
            
            // Mint tokens
            _mint(to, amount);
            
            emit TokensMined(to, amount, totalMined, 0);
        } else {
            // After TGE: follow mining rules with year restrictions
            // This is for ongoing mining rewards (30M over 6 years, then dynamic)
            uint256 currentYear = getCurrentYear();
            uint256 allowance = calculateMiningAllowance();
            
            require(amount <= allowance, "Exceeds mining allowance");
            
            // Update records
            totalMined += amount;
            yearlyMined[currentYear] += amount;
            
            // Mint tokens
            _mint(to, amount);
            
            emit TokensMined(to, amount, totalMined, currentYear);
        }
    }

    /**
     * @notice Get remaining mining allowance for current year
     * @return Remaining amount that can be mined this year
     */
    function getRemainingMiningForYear() external view returns (uint256) {
        return calculateMiningAllowance();
    }

    /**
     * @notice Get mining statistics
     * @return totalMined_ Total amount mined
     * @return currentYear_ Current year index
     * @return yearMined_ Amount mined this year
     * @return allowance_ Remaining allowance for this year
     */
    function getMiningStats() 
        external 
        view 
        returns (
            uint256 totalMined_,
            uint256 currentYear_,
            uint256 yearMined_,
            uint256 allowance_
        ) 
    {
        totalMined_ = totalMined;
        currentYear_ = tgeTime > 0 ? getCurrentYear() : 0;
        yearMined_ = tgeTime > 0 ? yearlyMined[currentYear_] : 0;
        allowance_ = tgeTime > 0 ? calculateMiningAllowance() : 0;
    }
    
    /* ========== BURN FUNCTIONS ========== */
    
    /**
     * @notice Burn tokens from sender
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from Swap buyback (called by Oracle)
     * @dev Oracle purchases tokens from Swap, then calls this function to burn them
     *      Oracle must approve this contract to spend tokens first (via approve())
     * @param amount Amount of tokens to burn
     * @param reason Reason for burn (e.g., "swap_buyback")
     */
    function burnFromSwap(uint256 amount, string memory reason) external onlyOracle {
        require(amount > 0, "Amount must be positive");
        require(tgeTime > 0, "TGE time not set");
        
        // Burn tokens from caller (Oracle must have approved this contract)
        _spendAllowance(msg.sender, address(this), amount);
        _burn(msg.sender, amount);
        
        // Update total burned
        totalBurned += amount;
        
        // Update yearly burned amount
        uint256 currentYear = getCurrentYear();
        yearlyBurned[currentYear] += amount;
        
        // Record burn history
        burnHistory.push(BurnRecord({
            amount: amount,
            timestamp: block.timestamp,
            executor: msg.sender,
            reason: reason
        }));
        
        emit TokensBurned(msg.sender, amount, totalBurned, reason);
    }

    /**
     * @notice Get total burned amount
     * @return Total amount of tokens burned
     */
    function getTotalBurned() external view returns (uint256) {
        return totalBurned;
    }

    /**
     * @notice Get burn history count
     * @return Number of burn records
     */
    function getBurnHistoryCount() external view returns (uint256) {
        return burnHistory.length;
    }

    /**
     * @notice Get burn history records
     * @param start Starting index
     * @param count Number of records to retrieve
     * @return Array of burn records
     */
    function getBurnHistory(uint256 start, uint256 count) 
        external 
        view 
        returns (BurnRecord[] memory) 
    {
        require(start < burnHistory.length, "Start index out of bounds");
        
        uint256 end = start + count;
        if (end > burnHistory.length) {
            end = burnHistory.length;
        }
        
        BurnRecord[] memory records = new BurnRecord[](end - start);
        for (uint256 i = start; i < end; i++) {
            records[i - start] = burnHistory[i];
        }
        
        return records;
    }

    /**
     * @notice Get latest burn records
     * @param count Number of latest records to retrieve
     * @return Array of burn records
     */
    function getLatestBurnHistory(uint256 count) 
        external 
        view 
        returns (BurnRecord[] memory) 
    {
        if (burnHistory.length == 0) {
            return new BurnRecord[](0);
        }
        
        uint256 start = burnHistory.length > count ? burnHistory.length - count : 0;
        
        uint256 end = start + count;
        if (end > burnHistory.length) {
            end = burnHistory.length;
        }
        
        BurnRecord[] memory records = new BurnRecord[](end - start);
        for (uint256 i = start; i < end; i++) {
            records[i - start] = burnHistory[i];
        }
        
        return records;
    }
}
