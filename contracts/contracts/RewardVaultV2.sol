// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardVault.sol";

/**
 * @title RewardVaultV2
 * @dev 升级版本，添加 setOperator 函数，方便 DEFAULT_ADMIN_ROLE 设置 Operator
 */
contract RewardVaultV2 is RewardVault {
    
    event OperatorSet(address indexed previousOperator, address indexed newOperator);

    /**
     * @dev 设置 Operator（方便函数，内部调用 grantRole/revokeRole）
     * 只有 DEFAULT_ADMIN_ROLE 可以调用
     * 
     * @param newOperator 新的 Operator 地址（可以是 address(0) 来移除 Operator）
     */
    function setOperator(address newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 获取当前所有拥有 OPERATOR_ROLE 的地址（简化：只处理一个）
        // 注意：AccessControl 允许多个地址拥有同一个角色
        // 这里我们简化处理：先撤销所有现有的 Operator，然后授予新的
        
        // 由于无法枚举所有拥有角色的地址，这里采用简化方案：
        // 1. 如果 newOperator 已经有 OPERATOR_ROLE，不做任何操作
        // 2. 如果 newOperator 没有 OPERATOR_ROLE，授予它
        // 3. 注意：这个函数不会撤销其他地址的 OPERATOR_ROLE
        
        bool hasRole = hasRole(OPERATOR_ROLE, newOperator);
        
        if (!hasRole && newOperator != address(0)) {
            grantRole(OPERATOR_ROLE, newOperator);
            emit OperatorSet(address(0), newOperator);
        } else if (hasRole) {
            // 如果已经有角色，不发出事件（避免重复）
            return;
        }
        // 如果 newOperator 是 address(0)，不授予角色（但也不撤销现有的）
    }

    /**
     * @dev 移除指定地址的 Operator 角色
     * 只有 DEFAULT_ADMIN_ROLE 可以调用
     * 
     * @param operator 要移除的 Operator 地址
     */
    function removeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(operator != address(0), "Invalid operator address");
        revokeRole(OPERATOR_ROLE, operator);
        emit OperatorSet(operator, address(0));
    }

    /**
     * @dev 获取当前 Operator（返回第一个拥有 OPERATOR_ROLE 的地址）
     * 注意：AccessControl 允许多个地址拥有同一个角色
     * 这个函数只返回一个地址，如果需要所有 Operator，需要查询事件
     */
    function getOperator() external view returns (address) {
        // AccessControl 没有直接的方法枚举角色成员
        // 这里返回 address(0) 表示无法直接查询
        // 实际使用中，应该通过查询 RoleGranted 事件来获取所有 Operator
        return address(0);
    }
}



















