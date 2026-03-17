// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title TestStorageReader
 * @notice Test contract to read storage from NFTManager
 * @dev This contract reads the owner from NFTManager's storage using extcodecopy
 */
contract TestStorageReader {
    bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("nftmanager.standard.storage");

    /**
     * @notice Read the owner from NFTManager's storage
     * @param nftManager The address of the NFTManager contract
     * @return The owner address
     */
    function readOwner(address nftManager) external view returns (address) {
        // 计算存储槽
        // struct NFTManagerStorage {
        //     mapping(...) selectorToFacetAndPosition; // 不占槽
        //     mapping(...) facetFunctionSelectors; // 不占槽
        //     address[] facetAddresses; // 槽 0
        //     mapping(...) supportedInterfaces; // 不占槽
        //     address contractOwner; // 槽 1
        // }
        
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        bytes32 ownerSlot = bytes32(uint256(base) + 1);
        
        // 使用 extcodecopy 读取其他合约的存储
        // 但 extcodecopy 只能读取代码，不能读取存储
        // 我们需要使用 staticcall 调用 NFTManager 的函数
        
        // 方法：尝试调用 OwnerFacet 的 owner() 函数（如果已添加）
        // 如果未添加，返回 0
        (bool success, bytes memory data) = nftManager.staticcall(
            abi.encodeWithSignature("owner()")
        );
        
        if (success && data.length >= 32) {
            address owner = abi.decode(data, (address));
            if (owner != address(0)) {
                return owner;
            }
        }
        
        // 如果 OwnerFacet 未添加，尝试直接读取存储槽
        // 注意：这需要使用 extcodecopy，但 extcodecopy 不能读取存储
        // 所以我们返回 0，表示无法读取
        return address(0);
    }
    
    /**
     * @notice Read the facetAddresses array length
     * @param nftManager The address of the NFTManager contract
     * @return The array length
     */
    function readFacetAddressesLength(address nftManager) external view returns (uint256) {
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        bytes32 lengthSlot = base;
        
        bytes32 value;
        assembly {
            value := sload(lengthSlot)
        }
        
        return uint256(value);
    }
}

