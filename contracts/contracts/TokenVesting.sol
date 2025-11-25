// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EnclaveToken.sol";
import "./interfaces/IConfigRegistry.sol";

/**
 * @title TokenVesting
 * @notice A flexible token vesting contract that supports multiple vesting schedules per beneficiary
 * @dev Each beneficiary can have multiple vesting schedules with different lock periods and release durations
 * 
 * Features:
 * - Multiple vesting schedules per beneficiary
 * - Custom lock period per schedule
 * - Linear release over specified duration
 * - Automatic calculation of releasable amounts
 * - Gas-optimized batch operations
 * - Safe ERC20 token handling
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ========== STRUCTS ========== */
    
    /**
     * @notice Vesting schedule for a beneficiary
     * @param beneficiary Address that will receive the tokens
     * @param totalAmount Total amount of tokens to be vested
     * @param lockPeriod Period in seconds before vesting starts (lock period)
     * @param releaseDuration Duration in seconds over which tokens are linearly released
     * @param startTime Timestamp when vesting starts (TGE + lockPeriod)
     * @param endTime Timestamp when vesting ends (startTime + releaseDuration)
     * @param released Amount of tokens already released
     * @param tgeTime TGE timestamp for this schedule
     */
    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 lockPeriod;      // Lock period in seconds
        uint256 releaseDuration;  // Release duration in seconds
        uint256 startTime;        // When vesting starts (TGE + lockPeriod)
        uint256 endTime;          // When vesting ends (startTime + releaseDuration)
        uint256 released;         // Amount already released
        uint256 tgeTime;          // TGE timestamp
    }

    /* ========== STATE VARIABLES ========== */
    
    /// @notice Configuration source (NFTManager) - single source of truth for all config
    IConfigRegistry public immutable configSource;
    
    // token and eclvToken removed - always read from configSource.eclvToken()
    // tgeTime removed - now read from eclvToken.tgeTime() (single source of truth)
    
    /// @notice Next schedule ID counter
    uint256 public nextScheduleId;
    
    /// @notice Mapping from schedule ID to vesting schedule
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    
    /// @notice Mapping from beneficiary address to array of schedule IDs
    mapping(address => uint256[]) public beneficiarySchedules;
    
    /// @notice Mapping to check if an address has any vesting schedules
    mapping(address => bool) public hasSchedules;
    
    /// @notice List of all unique beneficiaries
    address[] public beneficiaries;
    
    /// @notice Total amount of tokens in all vesting schedules
    uint256 public totalVested;
    
    /// @notice Total amount of tokens already released
    uint256 public totalReleased;

    /* ========== EVENTS ========== */
    
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 lockPeriod,
        uint256 releaseDuration,
        uint256 startTime,
        uint256 endTime
    );
    
    event TokensReleased(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        uint256 timestamp
    );
    
    // TGESet event removed - TGE is now managed by EnclaveToken
    
    event ConfigSourceSet(address indexed configSource);
    
    event VestingScheduleUpdated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 newTotalAmount
    );

    /* ========== MODIFIERS ========== */
    
    modifier onlyBeneficiary(address beneficiary) {
        require(
            msg.sender == beneficiary || msg.sender == owner(),
            "TokenVesting: not authorized"
        );
        _;
    }
    
    modifier validSchedule(uint256 scheduleId) {
        require(
            scheduleId < nextScheduleId && vestingSchedules[scheduleId].beneficiary != address(0),
            "TokenVesting: schedule does not exist"
        );
        _;
    }

    /* ========== CONSTRUCTOR ========== */
    
    /**
     * @notice Creates a TokenVesting contract
     * @param configSource_ Address of NFTManager (configuration source)
     * @param owner_ Address of the contract owner (can add vesting schedules)
     */
    constructor(address configSource_, address owner_) Ownable(owner_) {
        require(configSource_ != address(0), "TokenVesting: invalid config source address");
        require(owner_ != address(0), "TokenVesting: invalid owner address");
        
        configSource = IConfigRegistry(configSource_);
        
        // Verify ECLV Token is set in configSource
        address eclvTokenAddress = configSource.eclvToken();
        require(eclvTokenAddress != address(0), "TokenVesting: ECLV token not set in config source");
        
        emit ConfigSourceSet(configSource_);
    }

    /* ========== ADMIN FUNCTIONS ========== */
    
    // setTGETime removed - TGE is now managed by EnclaveToken
    // Use EnclaveToken.setTGETime() to set TGE time
    
    /**
     * @notice Get TGE time from EnclaveToken (single source of truth)
     * @return TGE timestamp
     */
    function tgeTime() public view returns (uint256) {
        return _getEclvToken().tgeTime();
    }
    
    /* ========== INTERNAL HELPER FUNCTIONS ========== */
    
    /**
     * @notice Get current ECLV Token contract (always read from configSource)
     * @return EnclaveToken instance
     */
    function _getEclvToken() internal view returns (EnclaveToken) {
        return EnclaveToken(configSource.eclvToken());
    }
    
    /**
     * @notice Get current token contract (always read from configSource)
     * @return IERC20 token instance
     */
    function _getToken() internal view returns (IERC20) {
        return IERC20(configSource.eclvToken());
    }

    /**
     * @notice Create a vesting schedule for a beneficiary (internal implementation)
     * @param beneficiary Address that will receive the tokens
     * @param totalAmount Total amount of tokens to be vested
     * @param lockPeriod Lock period in seconds (before vesting starts)
     * @param releaseDuration Release duration in seconds (linear release period)
     * @return scheduleId The ID of the created vesting schedule
     */
    function _createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 lockPeriod,
        uint256 releaseDuration
    ) internal returns (uint256 scheduleId) {
        require(beneficiary != address(0), "TokenVesting: invalid beneficiary");
        require(totalAmount > 0, "TokenVesting: invalid amount");
        require(releaseDuration > 0, "TokenVesting: invalid release duration");
        
        // Read TGE time from EnclaveToken (single source of truth)
        uint256 tgeTime_ = _getEclvToken().tgeTime();
        require(tgeTime_ > 0, "TokenVesting: TGE time not set in EnclaveToken");
        
        scheduleId = nextScheduleId;
        nextScheduleId++;
        
        uint256 startTime = tgeTime_ + lockPeriod;
        uint256 endTime = startTime + releaseDuration;
        
        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,
            lockPeriod: lockPeriod,
            releaseDuration: releaseDuration,
            startTime: startTime,
            endTime: endTime,
            released: 0,
            tgeTime: tgeTime_  // Store TGE time in schedule for historical reference
        });
        
        // Add to beneficiary's schedule list
        beneficiarySchedules[beneficiary].push(scheduleId);
        
        // Add to beneficiaries list if first schedule
        if (!hasSchedules[beneficiary]) {
            beneficiaries.push(beneficiary);
            hasSchedules[beneficiary] = true;
        }
        
        totalVested += totalAmount;
        
        emit VestingScheduleCreated(
            scheduleId,
            beneficiary,
            totalAmount,
            lockPeriod,
            releaseDuration,
            startTime,
            endTime
        );
        
        return scheduleId;
    }

    /**
     * @notice Create a new vesting schedule (public interface)
     * @param beneficiary Address that will receive the tokens
     * @param totalAmount Total amount of tokens to be vested
     * @param lockPeriod Lock period in seconds (before vesting starts)
     * @param releaseDuration Release duration in seconds (linear release period)
     * @return scheduleId The ID of the created vesting schedule
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 lockPeriod,
        uint256 releaseDuration
    ) external onlyOwner returns (uint256 scheduleId) {
        return _createVestingSchedule(beneficiary, totalAmount, lockPeriod, releaseDuration);
    }

    /**
     * @notice Create multiple vesting schedules in batch
     * @param beneficiaries_ Array of beneficiary addresses
     * @param totalAmounts_ Array of total amounts (same length as beneficiaries)
     * @param lockPeriods_ Array of lock periods (same length as beneficiaries)
     * @param releaseDurations_ Array of release durations (same length as beneficiaries)
     */
    function createVestingSchedulesBatch(
        address[] calldata beneficiaries_,
        uint256[] calldata totalAmounts_,
        uint256[] calldata lockPeriods_,
        uint256[] calldata releaseDurations_
    ) external onlyOwner {
        require(
            beneficiaries_.length == totalAmounts_.length &&
            beneficiaries_.length == lockPeriods_.length &&
            beneficiaries_.length == releaseDurations_.length,
            "TokenVesting: array length mismatch"
        );
        
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            _createVestingSchedule(
                beneficiaries_[i],
                totalAmounts_[i],
                lockPeriods_[i],
                releaseDurations_[i]
            );
        }
    }

    /**
     * @notice Update vesting schedule total amount (only before vesting starts)
     * @param scheduleId ID of the vesting schedule
     * @param newTotalAmount New total amount
     */
    function updateVestingSchedule(
        uint256 scheduleId,
        uint256 newTotalAmount
    ) external onlyOwner validSchedule(scheduleId) {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(block.timestamp < schedule.startTime, "TokenVesting: vesting already started");
        require(newTotalAmount > 0, "TokenVesting: invalid amount");
        
        uint256 diff = newTotalAmount > schedule.totalAmount
            ? newTotalAmount - schedule.totalAmount
            : schedule.totalAmount - newTotalAmount;
        
        if (newTotalAmount > schedule.totalAmount) {
            totalVested += diff;
        } else {
            totalVested -= diff;
        }
        
        schedule.totalAmount = newTotalAmount;
        
        emit VestingScheduleUpdated(scheduleId, schedule.beneficiary, newTotalAmount);
    }

    /**
     * @notice Emergency: withdraw tokens (only owner, should not be used normally)
     * @dev This should only be used in emergency situations
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "TokenVesting: invalid amount");
        IERC20 token_ = _getToken();
        uint256 balance = token_.balanceOf(address(this));
        require(balance >= amount, "TokenVesting: insufficient balance");
        token_.safeTransfer(owner(), amount);
    }

    /* ========== PUBLIC FUNCTIONS ========== */
    
    /**
     * @notice Release vested tokens for a specific schedule (internal implementation)
     * @param scheduleId ID of the vesting schedule
     * @dev Requires the contract to have sufficient token balance
     * @dev Authorization should be checked by the caller
     */
    function _release(uint256 scheduleId) internal validSchedule(scheduleId) {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        uint256 releasable = calculateReleasable(scheduleId);
        require(releasable > 0, "TokenVesting: no tokens to release");
        
        // Check contract balance
        IERC20 token_ = _getToken();
        uint256 contractBalance = token_.balanceOf(address(this));
        require(contractBalance >= releasable, "TokenVesting: insufficient contract balance");
        
        schedule.released += releasable;
        totalReleased += releasable;
        
        token_.safeTransfer(schedule.beneficiary, releasable);
        
        emit TokensReleased(scheduleId, schedule.beneficiary, releasable, block.timestamp);
    }

    /**
     * @notice Release vested tokens for a specific schedule (public interface)
     * @param scheduleId ID of the vesting schedule
     * @dev Requires the contract to have sufficient token balance
     */
    function release(uint256 scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        require(
            msg.sender == schedule.beneficiary || msg.sender == owner(),
            "TokenVesting: not authorized"
        );
        _release(scheduleId);
    }

    /**
     * @notice Release all vested tokens for a beneficiary (all their schedules)
     * @param beneficiary Address of the beneficiary
     * @dev Requires the contract to have sufficient token balance
     */
    function releaseAll(address beneficiary) external nonReentrant onlyBeneficiary(beneficiary) {
        releaseAllForBeneficiary(beneficiary);
    }

    /**
     * @notice Release all vested tokens for the caller
     */
    function releaseAll() external {
        releaseAllForBeneficiary(msg.sender);
    }

    /**
     * @notice Release all vested tokens for a beneficiary (all their schedules) - internal helper
     * @param beneficiary Address of the beneficiary
     */
    function releaseAllForBeneficiary(address beneficiary) internal {
        require(hasSchedules[beneficiary], "TokenVesting: no schedules found");
        
        uint256[] memory scheduleIds = beneficiarySchedules[beneficiary];
        uint256 totalReleasable = 0;
        
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            uint256 releasable = calculateReleasable(scheduleIds[i]);
            if (releasable > 0) {
                VestingSchedule storage schedule = vestingSchedules[scheduleIds[i]];
                schedule.released += releasable;
                totalReleasable += releasable;
                
                emit TokensReleased(scheduleIds[i], beneficiary, releasable, block.timestamp);
            }
        }
        
        require(totalReleasable > 0, "TokenVesting: no tokens to release");
        
        // Check contract balance
        IERC20 token_ = _getToken();
        uint256 contractBalance = token_.balanceOf(address(this));
        require(contractBalance >= totalReleasable, "TokenVesting: insufficient contract balance");
        
        totalReleased += totalReleasable;
        token_.safeTransfer(beneficiary, totalReleasable);
    }

    /**
     * @notice Release tokens for multiple schedules (owner only)
     * @param scheduleIds Array of schedule IDs
     */
    function releaseBatch(uint256[] calldata scheduleIds) external onlyOwner {
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            if (vestingSchedules[scheduleIds[i]].beneficiary != address(0)) {
                uint256 releasable = calculateReleasable(scheduleIds[i]);
                if (releasable > 0) {
                    _release(scheduleIds[i]);
                }
            }
        }
    }

    /* ========== VIEW FUNCTIONS ========== */
    
    /**
     * @notice Calculate the amount of tokens that can be released for a specific schedule
     * @param scheduleId ID of the vesting schedule
     * @return Amount of tokens that can be released
     */
    function calculateReleasable(uint256 scheduleId) public view validSchedule(scheduleId) returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[scheduleId];
        
        // If vesting hasn't started yet, nothing is releasable
        if (block.timestamp < schedule.startTime) {
            return 0;
        }
        
        // If vesting has ended, all remaining tokens are releasable
        if (block.timestamp >= schedule.endTime) {
            return schedule.totalAmount - schedule.released;
        }
        
        // Calculate linear release amount
        uint256 elapsed = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * elapsed) / schedule.releaseDuration;
        
        // Return the difference between vested and already released
        return vestedAmount - schedule.released;
    }

    /**
     * @notice Calculate total releasable amount for a beneficiary (all schedules)
     * @param beneficiary Address of the beneficiary
     * @return Total amount of tokens that can be released
     */
    function calculateReleasableAll(address beneficiary) public view returns (uint256) {
        if (!hasSchedules[beneficiary]) {
            return 0;
        }
        
        uint256[] memory scheduleIds = beneficiarySchedules[beneficiary];
        uint256 total = 0;
        
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            total += calculateReleasable(scheduleIds[i]);
        }
        
        return total;
    }

    /**
     * @notice Get vesting schedule information for a specific schedule
     * @param scheduleId ID of the vesting schedule
     * @return schedule VestingSchedule struct
     * @return releasable Amount of tokens currently releasable
     */
    function getVestingInfo(uint256 scheduleId) 
        external 
        view 
        validSchedule(scheduleId) 
        returns (VestingSchedule memory schedule, uint256 releasable) 
    {
        schedule = vestingSchedules[scheduleId];
        releasable = calculateReleasable(scheduleId);
    }

    /**
     * @notice Get all vesting schedules for a beneficiary
     * @param beneficiary Address of the beneficiary
     * @return scheduleIds Array of schedule IDs
     * @return schedules Array of VestingSchedule structs
     * @return totalReleasable Total releasable amount across all schedules
     */
    function getBeneficiarySchedules(address beneficiary)
        external
        view
        returns (
            uint256[] memory scheduleIds,
            VestingSchedule[] memory schedules,
            uint256 totalReleasable
        )
    {
        require(hasSchedules[beneficiary], "TokenVesting: no schedules found");
        
        scheduleIds = beneficiarySchedules[beneficiary];
        schedules = new VestingSchedule[](scheduleIds.length);
        totalReleasable = 0;
        
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            schedules[i] = vestingSchedules[scheduleIds[i]];
            totalReleasable += calculateReleasable(scheduleIds[i]);
        }
    }

    /**
     * @notice Get all beneficiaries
     * @return Array of beneficiary addresses
     */
    function getAllBeneficiaries() external view returns (address[] memory) {
        return beneficiaries;
    }

    /**
     * @notice Get total number of beneficiaries
     * @return Number of beneficiaries
     */
    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }

    /**
     * @notice Get total number of vesting schedules
     * @return Number of schedules
     */
    function getScheduleCount() external view returns (uint256) {
        return nextScheduleId;
    }

    /**
     * @notice Get schedule IDs for a beneficiary
     * @param beneficiary Address of the beneficiary
     * @return Array of schedule IDs
     */
    function getScheduleIds(address beneficiary) external view returns (uint256[] memory) {
        return beneficiarySchedules[beneficiary];
    }

    /**
     * @notice Get contract token balance
     * @return Balance of tokens in the contract
     */
    function getContractBalance() external view returns (uint256) {
        return _getToken().balanceOf(address(this));
    }

    /**
     * @notice Check if contract has sufficient balance for all vesting schedules
     * @return true if balance is sufficient, false otherwise
     * @return requiredAmount Total amount required for all vesting schedules
     * @return currentBalance Current contract balance
     */
    function checkBalanceSufficiency() external view returns (bool, uint256 requiredAmount, uint256 currentBalance) {
        requiredAmount = totalVested;
        currentBalance = _getToken().balanceOf(address(this));
        return (currentBalance >= requiredAmount, requiredAmount, currentBalance);
    }

    /**
     * @notice Check if contract has sufficient balance for a specific schedule
     * @param scheduleId ID of the vesting schedule
     * @return true if balance is sufficient for this schedule, false otherwise
     * @return requiredAmount Total amount required for this schedule
     * @return currentBalance Current contract balance
     */
    function checkScheduleBalance(uint256 scheduleId) 
        external 
        view 
        validSchedule(scheduleId) 
        returns (bool, uint256 requiredAmount, uint256 currentBalance) 
    {
        requiredAmount = vestingSchedules[scheduleId].totalAmount;
        currentBalance = _getToken().balanceOf(address(this));
        return (currentBalance >= requiredAmount, requiredAmount, currentBalance);
    }

    /**
     * @notice Check if vesting has started for a schedule
     * @param scheduleId ID of the vesting schedule
     * @return true if vesting has started, false otherwise
     */
    function hasVestingStarted(uint256 scheduleId) external view validSchedule(scheduleId) returns (bool) {
        return block.timestamp >= vestingSchedules[scheduleId].startTime;
    }

    /**
     * @notice Check if vesting has ended for a schedule
     * @param scheduleId ID of the vesting schedule
     * @return true if vesting has ended, false otherwise
     */
    function hasVestingEnded(uint256 scheduleId) external view validSchedule(scheduleId) returns (bool) {
        return block.timestamp >= vestingSchedules[scheduleId].endTime;
    }
}

