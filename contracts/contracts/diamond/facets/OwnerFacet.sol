// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../libraries/LibNFTManager.sol";

/**
 * @title OwnerFacet
 * @notice Provides a public function to read the contract owner
 * @dev This facet can be added to NFTManager to expose the owner address
 */
contract OwnerFacet {
    /**
     * @notice Get the contract owner
     * @return The address of the contract owner
     */
    function owner() external view returns (address) {
        return LibNFTManager.contractOwner();
    }
    
    /**
     * @notice Get the contract owner (alias for owner)
     * @return The address of the contract owner
     */
    function contractOwner() external view returns (address) {
        return LibNFTManager.contractOwner();
    }
}























