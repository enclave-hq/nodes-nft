// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RewardVault
 * @dev Upgradeable (UUPS) contract for storing and distributing referral rewards.
 *
 * Pattern: Pull Payment
 * - Operator sets user's cumulative entitled total (only-increase).
 * - Users withdraw (full or partial) from contract balance.
 */
contract RewardVault is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // The token being distributed (e.g., USDT)
    IERC20 public rewardToken;

    // Total amount allocated to each user (cumulative entitled total)
    mapping(address => uint256) public totalAllocated;

    // Total amount withdrawn by each user
    mapping(address => uint256) public totalWithdrawn;

    event RewardAllocated(address indexed user, uint256 amount);
    event TotalAllocatedSet(address indexed user, uint256 previousTotal, uint256 newTotal);
    event RewardWithdrawn(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _rewardToken, address _admin) public initializer {
        require(_rewardToken != address(0), "Invalid token address");
        require(_admin != address(0), "Invalid admin address");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        rewardToken = IERC20(_rewardToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        // only admin can upgrade
        (newImplementation);
    }

    /**
     * @dev Increases the reward allocation for a specific user.
     * Can only be called by an account with OPERATOR_ROLE (e.g., backend or multisig).
     * Note: This function does NOT transfer tokens to this contract. 
     * The admin must ensure the contract is funded separately.
     */
    function addAllocation(address user, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than 0");

        totalAllocated[user] += amount;
        emit RewardAllocated(user, amount);
    }

    /**
     * @dev Batch version of addAllocation to save gas.
     */
    function batchAddAllocation(address[] calldata users, uint256[] calldata amounts) external onlyRole(OPERATOR_ROLE) {
        require(users.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = amounts[i];
            
            if (user != address(0) && amount > 0) {
                totalAllocated[user] += amount;
                emit RewardAllocated(user, amount);
            }
        }
    }

    /**
     * @dev Idempotent update: set user's total allocation (cumulative entitled) to the latest total.
     * Only allows monotonic increase (newTotal >= current) to avoid any "admin decrease" risk.
     */
    function setTotalAllocated(address user, uint256 newTotal) external onlyRole(OPERATOR_ROLE) {
        require(user != address(0), "Invalid user address");
        uint256 prev = totalAllocated[user];
        require(newTotal >= prev, "Total can only increase");
        if (newTotal == prev) {
            return;
        }
        totalAllocated[user] = newTotal;
        emit TotalAllocatedSet(user, prev, newTotal);
    }

    /**
     * @dev Batch version of setTotalAllocated to save gas.
     * - Skips invalid/unchanged entries
     * - Only allows monotonic increase per user
     */
    function batchSetTotalAllocated(address[] calldata users, uint256[] calldata newTotals) external onlyRole(OPERATOR_ROLE) {
        require(users.length == newTotals.length, "Arrays length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 newTotal = newTotals[i];

            if (user == address(0)) {
                continue;
            }

            uint256 prev = totalAllocated[user];
            require(newTotal >= prev, "Total can only increase");
            if (newTotal == prev) {
                continue;
            }

            totalAllocated[user] = newTotal;
            emit TotalAllocatedSet(user, prev, newTotal);
        }
    }

    /**
     * @dev User withdraws their available rewards.
     * Available = Total Allocated - Total Withdrawn.
     */
    function withdraw() public nonReentrant {
        uint256 allocated = totalAllocated[msg.sender];
        uint256 withdrawn = totalWithdrawn[msg.sender];
        uint256 available = allocated > withdrawn ? allocated - withdrawn : 0;

        require(available > 0, "No rewards available for withdrawal");
        
        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance >= available, "Insufficient contract balance");

        totalWithdrawn[msg.sender] += available;
        rewardToken.safeTransfer(msg.sender, available);

        emit RewardWithdrawn(msg.sender, available);
    }

    /**
     * @dev Alias for withdraw() for UX consistency (claim).
     */
    function claim() external {
        withdraw();
    }

    /**
     * @dev Claim a specified amount (partial withdraw).
     * Useful when users want to withdraw part of their available rewards.
     *
     * Requirements:
     * - amount > 0
     * - amount <= available
     * - contract has enough token balance
     */
    function claimPartial(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        uint256 allocated = totalAllocated[msg.sender];
        uint256 withdrawn = totalWithdrawn[msg.sender];
        uint256 available = allocated > withdrawn ? allocated - withdrawn : 0;

        require(available > 0, "No rewards available for withdrawal");
        require(amount <= available, "Amount exceeds available");

        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient contract balance");

        totalWithdrawn[msg.sender] = withdrawn + amount;
        rewardToken.safeTransfer(msg.sender, amount);

        emit RewardWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Returns the current reward state for a user.
     */
    function getRewardState(address user) external view returns (uint256 allocated, uint256 withdrawn, uint256 available) {
        allocated = totalAllocated[user];
        withdrawn = totalWithdrawn[user];
        available = allocated > withdrawn ? allocated - withdrawn : 0;
    }

    /**
     * @dev Batch getter to reduce RPC calls for backend syncing.
     */
    function getTotalAllocatedBatch(address[] calldata users) external view returns (uint256[] memory totals) {
        totals = new uint256[](users.length);
        for (uint256 i = 0; i < users.length; i++) {
            totals[i] = totalAllocated[users[i]];
        }
    }

    /**
     * @dev Batch getter for full state.
     */
    function getRewardStateBatch(address[] calldata users) external view returns (
        uint256[] memory allocated,
        uint256[] memory withdrawn,
        uint256[] memory available
    ) {
        allocated = new uint256[](users.length);
        withdrawn = new uint256[](users.length);
        available = new uint256[](users.length);

        for (uint256 i = 0; i < users.length; i++) {
            uint256 a = totalAllocated[users[i]];
            uint256 w = totalWithdrawn[users[i]];
            allocated[i] = a;
            withdrawn[i] = w;
            available[i] = a > w ? a - w : 0;
        }
    }

    /**
     * @dev Version marker for upgrade verification.
     * This function is safe and helps confirm proxy implementation updates.
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }

    /**
     * @dev Emergency withdraw function to recover tokens (only admin).
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, to, amount);
    }
}

