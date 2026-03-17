// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title 验证存储布局的测试合约
 * @dev 用于验证 NFTManagerStorage 的存储布局
 */
contract StorageLayoutTest {
    bytes32 constant NFT_MANAGER_STORAGE_POSITION = keccak256("nftmanager.standard.storage");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition;
    }

    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition;
    }

    struct NFTManagerStorage {
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        address[] facetAddresses;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }

    function getStorageSlot() external pure returns (bytes32) {
        return NFT_MANAGER_STORAGE_POSITION;
    }

    function getOwnerSlot() external pure returns (bytes32) {
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        // 在 Solidity 中，结构体的存储布局：
        // - mappings 不占槽
        // - address[] facetAddresses 的数组长度在 base + 0
        // - address contractOwner 在 base + 1
        return bytes32(uint256(base) + 1);
    }

    function readOwner(address nftManager) external view returns (address) {
        bytes32 base = NFT_MANAGER_STORAGE_POSITION;
        bytes32 ownerSlot = bytes32(uint256(base) + 1);
        
        bytes32 value;
        assembly {
            value := sload(ownerSlot)
        }
        
        return address(uint160(uint256(value)));
    }
}























