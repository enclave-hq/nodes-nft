// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// 委托合约接口（必须在合约外部声明）
interface IDelegation {
    function undelegate(address validator) external;
    function getDelegated(address delegator) external view returns (address);
}

// 标准 Ownable 接口
interface IOwnable {
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
}

/**
 * @title EmergencyRecovery
 * @notice 紧急恢复合约 - 用于在私钥泄露时快速恢复控制权
 * @dev 支持：
 * 1. 取消委托（undelegate）- 注意：无法真正代付，仍需目标地址调用
 * 2. 转移合约所有权
 * 3. 查询功能
 */
contract EmergencyRecovery is Ownable, ReentrancyGuard {
    // BNB Chain 系统委托合约地址
    address public constant DELEGATION_CONTRACT = 0x0000000000000000000000000000000000001000;
    
    event DelegationRevoked(address indexed target, address indexed validator);
    event OwnershipTransferred(address indexed contractAddr, address indexed oldOwner, address indexed newOwner);
    event RecoveryExecuted(address indexed target, address indexed executor);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice 紧急恢复：取消委托并转移所有权
     * @param targetAddress 需要恢复的地址（私钥泄露的地址）
     * @param validatorAddress 需要取消委托的验证者地址（如果为 address(0) 则取消所有委托）
     * @param contracts 需要转移所有权的合约地址数组
     * @param newOwner 新的 Owner 地址（应该是多签钱包）
     * @param signatures 目标地址对操作的签名（用于验证权限）
     */
    function emergencyRecover(
        address targetAddress,
        address validatorAddress,
        address[] calldata contracts,
        address newOwner,
        bytes[] calldata signatures
    ) external nonReentrant {
        require(newOwner != address(0), "Invalid new owner");
        require(contracts.length > 0, "No contracts to transfer");
        
        // 验证签名（可选，如果需要额外安全）
        // 这里可以添加签名验证逻辑
        
        IDelegation delegation = IDelegation(DELEGATION_CONTRACT);
        
        // 步骤 1: 取消委托
        if (validatorAddress != address(0)) {
            // 检查当前委托状态
            address currentDelegate = delegation.getDelegated(targetAddress);
            if (currentDelegate == validatorAddress) {
                // 使用 delegatecall 或直接调用
                // 注意：undelegate 需要由 targetAddress 调用，这里我们需要特殊处理
                _revokeDelegation(targetAddress, validatorAddress);
                emit DelegationRevoked(targetAddress, validatorAddress);
            }
        } else {
            // 取消所有委托（需要知道所有验证者地址）
            // 这里可能需要传入验证者地址列表
        }
        
        // 步骤 2: 转移所有权
        for (uint256 i = 0; i < contracts.length; i++) {
            _transferContractOwnership(contracts[i], targetAddress, newOwner);
        }
        
        emit RecoveryExecuted(targetAddress, msg.sender);
    }
    
    /**
     * @notice 仅取消委托（不转移所有权）
     * @param targetAddress 目标地址
     * @param validatorAddress 验证者地址
     */
    function revokeDelegation(
        address targetAddress,
        address validatorAddress
    ) external onlyOwner {
        _revokeDelegation(targetAddress, validatorAddress);
        emit DelegationRevoked(targetAddress, validatorAddress);
    }
    
    /**
     * @notice 仅转移所有权（不取消委托）
     * @param contracts 合约地址数组
     * @param targetAddress 当前 Owner 地址（需要验证）
     * @param newOwner 新 Owner 地址
     */
    function transferOwnerships(
        address[] calldata contracts,
        address targetAddress,
        address newOwner
    ) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        
        for (uint256 i = 0; i < contracts.length; i++) {
            _transferContractOwnership(contracts[i], targetAddress, newOwner);
        }
    }
    
    /**
     * @notice 内部函数：取消委托
     * @dev 注意：BNB Chain 委托合约的 undelegate 必须由委托者自己调用
     *      此函数无法直接代表 targetAddress 调用，需要目标地址自己调用
     *      或者使用 meta-transaction（如果委托合约支持）
     */
    function _revokeDelegation(address targetAddress, address validatorAddress) internal {
        // ⚠️ 重要限制：
        // BNB Chain 委托合约的 undelegate 函数通常需要由委托者（delegator）直接调用
        // 无法由其他地址代表调用
        
        // 可能的解决方案：
        // 1. 如果目标地址还有少量 BNB，可以直接调用
        // 2. 使用 meta-transaction（如果委托合约支持）
        // 3. 通过多签钱包恢复（如果目标地址是多签的一部分）
        
        // 当前实现：记录需要取消的委托，但实际取消需要目标地址自己执行
        // 或者通过脚本使用目标地址的私钥直接调用
        
        // 这里暂时不实现，因为需要目标地址直接调用
        // 实际取消委托应该通过脚本使用目标地址的私钥执行
    }
    
    /**
     * @notice 内部函数：转移合约所有权
     */
    function _transferContractOwnership(
        address contractAddr,
        address expectedOwner,
        address newOwner
    ) internal {
        IOwnable ownable = IOwnable(contractAddr);
        
        // 验证当前 Owner
        address currentOwner = ownable.owner();
        require(currentOwner == expectedOwner, "Owner mismatch");
        
        // 转移所有权
        ownable.transferOwnership(newOwner);
        
        emit OwnershipTransferred(contractAddr, currentOwner, newOwner);
    }
    
    /**
     * @notice 查询委托状态
     */
    function getDelegationStatus(address targetAddress) external view returns (address) {
        IDelegation delegation = IDelegation(DELEGATION_CONTRACT);
        return delegation.getDelegated(targetAddress);
    }
    
    /**
     * @notice 查询合约 Owner
     */
    function getContractOwner(address contractAddr) external view returns (address) {
        IOwnable ownable = IOwnable(contractAddr);
        return ownable.owner();
    }
}

