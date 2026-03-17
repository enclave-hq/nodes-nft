// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../diamond/libraries/LibNFTManager.sol";

/**
 * @title ReadContractOwner
 * @notice 简单的合约，用于读取 NFTManager 的 contractOwner
 * @dev 通过 delegatecall 调用 LibNFTManager.contractOwner()
 */
contract ReadContractOwner {
    /**
     * @notice 读取 NFTManager 的 contractOwner
     * @dev 通过 delegatecall 调用，在 NFTManager 的存储上下文中执行
     * @param nftManager NFTManager 合约地址
     * @return contractOwner 合约的 owner 地址
     */
    function readOwner(address nftManager) external view returns (address contractOwner) {
        // 通过 delegatecall 调用 LibNFTManager.contractOwner()
        // 这样可以在 NFTManager 的存储上下文中执行
        (bool success, bytes memory data) = nftManager.staticcall(
            abi.encodeWithSelector(this.readOwnerInternal.selector)
        );
        
        if (success && data.length >= 32) {
            contractOwner = abi.decode(data, (address));
        } else {
            revert("Failed to read owner");
        }
    }
    
    /**
     * @notice 内部函数，用于 delegatecall
     * @dev 这个函数会被 delegatecall 调用，在 NFTManager 的存储上下文中执行
     * @return contractOwner 合约的 owner 地址
     */
    function readOwnerInternal() external view returns (address contractOwner) {
        return LibNFTManager.contractOwner();
    }
}























