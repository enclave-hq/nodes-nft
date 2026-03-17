// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../diamond/libraries/LibNFTManager.sol";

/**
 * @title VerifyStorageLayout
 * @notice 验证 NFTManagerStorage 的存储布局
 */
contract VerifyStorageLayout {
    bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("nftmanager.standard.storage");
    
    /**
     * @notice 读取 contractOwner 的存储槽
     * @dev 直接使用 sload 读取存储槽
     */
    function readContractOwnerSlot() external view returns (bytes32) {
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        bytes32 ownerSlot = bytes32(uint256(base) + 1);
        
        bytes32 value;
        assembly {
            value := sload(ownerSlot)
        }
        
        return value;
    }
    
    /**
     * @notice 读取 facetAddresses 数组长度的存储槽
     */
    function readFacetAddressesLengthSlot() external view returns (bytes32) {
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        
        bytes32 value;
        assembly {
            value := sload(base)
        }
        
        return value;
    }
    
    /**
     * @notice 通过 LibNFTManager 读取 contractOwner
     */
    function readContractOwnerViaLib() external view returns (address) {
        return LibNFTManager.contractOwner();
    }
}























