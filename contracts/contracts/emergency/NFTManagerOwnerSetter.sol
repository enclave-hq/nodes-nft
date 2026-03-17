// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../diamond/libraries/LibNFTManager.sol";

/**
 * @title NFTManagerOwnerSetter
 * @notice 临时合约，用于通过 delegatecall 修改 NFTManager 的 owner
 * @dev 使用 LibNFTManager.setContractOwner 而不是直接修改存储槽
 * 当通过 delegatecall 调用时，会在调用者（NFTManager）的存储上下文中执行
 */
contract NFTManagerOwnerSetter {
    /**
     * @notice 设置 NFTManager 的 owner
     * @dev 通过 delegatecall 调用时，会在 NFTManager 的存储上下文中执行
     * 使用 LibNFTManager.setContractOwner 来正确设置 owner 并触发事件
     */
    function setOwner(address newOwner) external {
        // 使用 LibNFTManager.setContractOwner 而不是直接修改存储槽
        // 这样可以：
        // 1. 正确设置 owner
        // 2. 触发 OwnershipTransferred 事件
        // 3. 符合最佳实践
        LibNFTManager.setContractOwner(newOwner);
    }
}

