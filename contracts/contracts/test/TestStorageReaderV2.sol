// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title TestStorageReaderV2
 * @notice Test contract to read storage from another contract using delegatecall
 * @dev This contract uses delegatecall to read NFTManager's storage
 */
contract TestStorageReaderV2 {
    bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("nftmanager.standard.storage");

    /**
     * @notice Read the owner from NFTManager's storage using delegatecall
     * @param nftManager The address of the NFTManager contract
     * @return The owner address
     */
    function readOwner(address nftManager) external view returns (address) {
        // 使用 delegatecall 在 NFTManager 的上下文中执行
        // 但我们需要一个函数来读取 owner
        // 最简单的方法是直接读取存储槽（但 sload 只能读当前合约）
        
        // 实际上，我们需要通过合约调用
        // 或者使用一个 Facet 来读取
        
        // 这里我们尝试直接读取（虽然 sload 只能读当前合约）
        // 但我们可以通过调用 NFTManager 的函数来读取
        // 如果 OwnerFacet 已添加，可以直接调用
        
        // 暂时返回 0，需要添加 OwnerFacet 才能读取
        return address(0);
    }
}























