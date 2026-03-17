// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../RewardVault.sol";

/**
 * @title EIP7702RewardVaultRecoveryProxy
 * @notice 通过 EIP-7702 恢复 RewardVault 的 DEFAULT_ADMIN_ROLE
 * @dev 当被盗的 admin 地址通过 EIP-7702 授权给本合约后，可以代表该地址执行操作
 * 
 * 关键特性：
 * - msg.sender = 被盗的 admin 地址（不是代理合约地址）✅
 * - 可以在一个交易中授予新 admin DEFAULT_ADMIN_ROLE 和 OPERATOR_ROLE
 * - 执行者可以代付 gas
 * 
 * 使用流程：
 * 1. 被盗的 admin 地址签名 EIP-7702 授权（授权给本合约）
 * 2. 执行者构建 EIP-7702 交易（支付 gas）
 * 3. 被盗的 admin 地址临时变成智能合约（拥有本合约的代码）
 * 4. 被盗的 admin 地址调用本合约的 recoverRewardVaultAdmin()
 * 5. 本合约执行操作，msg.sender = 被盗的 admin 地址 ✅
 */

contract EIP7702RewardVaultRecoveryProxy {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    
    event AdminRecovered(address indexed rewardVault, address indexed newAdmin);
    event OperatorGranted(address indexed rewardVault, address indexed operator);
    event DebugInfo(address indexed msgSender, address indexed txOrigin, address indexed thisAddress);
    
    /**
     * @notice 恢复 RewardVault 的 admin
     * @dev 通过 EIP-7702，msg.sender 是被盗的 admin 地址本身
     * @param rewardVault RewardVault 合约地址
     * @param newAdmin 新的 Admin 地址
     */
    function recoverRewardVaultAdmin(
        address rewardVault,
        address newAdmin
    ) external {
        require(rewardVault != address(0), "Invalid reward vault address");
        require(newAdmin != address(0), "Invalid new admin address");
        
        RewardVault vault = RewardVault(rewardVault);
        
        // 调试：记录 msg.sender 和 tx.origin
        // 在 EIP-7702 上下文中，msg.sender 应该是被盗的 admin 地址
        emit DebugInfo(msg.sender, tx.origin, address(this));
        
        // 直接尝试授予新地址 DEFAULT_ADMIN_ROLE
        // 如果 msg.sender 没有权限，AccessControl 会 revert 并给出详细错误
        vault.grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        emit AdminRecovered(rewardVault, newAdmin);
        
        // 同时授予新地址 OPERATOR_ROLE（通常 admin 也应该有 operator 权限）
        if (!vault.hasRole(OPERATOR_ROLE, newAdmin)) {
            vault.grantRole(OPERATOR_ROLE, newAdmin);
            emit OperatorGranted(rewardVault, newAdmin);
        }
    }
    
    /**
     * @notice 仅授予新地址 OPERATOR_ROLE（如果新 admin 已经设置）
     * @param rewardVault RewardVault 合约地址
     * @param operator 新的 Operator 地址
     */
    function grantOperatorRole(
        address rewardVault,
        address operator
    ) external {
        require(rewardVault != address(0), "Invalid reward vault address");
        require(operator != address(0), "Invalid operator address");
        
        RewardVault vault = RewardVault(rewardVault);
        
        // 验证 msg.sender 确实有 DEFAULT_ADMIN_ROLE
        require(
            vault.hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Msg.sender does not have DEFAULT_ADMIN_ROLE"
        );
        
        // 授予新地址 OPERATOR_ROLE
        if (!vault.hasRole(OPERATOR_ROLE, operator)) {
            vault.grantRole(OPERATOR_ROLE, operator);
            emit OperatorGranted(rewardVault, operator);
        }
    }
}

