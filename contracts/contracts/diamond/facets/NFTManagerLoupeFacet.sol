// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../interfaces/INFTManagerLoupe.sol";
import "../interfaces/IERC165.sol";
import "../libraries/LibNFTManager.sol";

/**
 * @title NFTManagerLoupeFacet
 * @notice Provides introspection functions to query NFTManager facets
 * @dev Implements INFTManagerLoupe and IERC165 interfaces
 */
contract NFTManagerLoupeFacet is INFTManagerLoupe, IERC165 {
    // NFTManager Loupe Functions
    // These functions are expected to be called frequently
    // by tools.

    /// @notice Gets all facets and their selectors.
    /// @return facets_ Facet
    function facets() external view override returns (Facet[] memory facets_) {
        LibNFTManager.NFTManagerStorage storage ds = LibNFTManager.nftManagerStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].functionSelectors;
        }
    }

    /// @notice Gets all the function selectors provided by a facet.
    /// @param _facet The facet address.
    /// @return facetFunctionSelectors_
    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory facetFunctionSelectors_) {
        LibNFTManager.NFTManagerStorage storage ds = LibNFTManager.nftManagerStorage();
        facetFunctionSelectors_ = ds.facetFunctionSelectors[_facet].functionSelectors;
    }

    /// @notice Get all the facet addresses used by NFTManager.
    /// @return facetAddresses_
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        LibNFTManager.NFTManagerStorage storage ds = LibNFTManager.nftManagerStorage();
        facetAddresses_ = ds.facetAddresses;
    }

    /// @notice Gets the facet that supports the given selector.
    /// @dev If facet is not found return address(0).
    /// @param _functionSelector The function selector.
    /// @return facetAddress_ The facet address.
    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        LibNFTManager.NFTManagerStorage storage ds = LibNFTManager.nftManagerStorage();
        facetAddress_ = ds.selectorToFacetAndPosition[_functionSelector].facetAddress;
    }

    // This implements ERC-165.
    function supportsInterface(bytes4 _interfaceId) external view override returns (bool) {
        LibNFTManager.NFTManagerStorage storage ds = LibNFTManager.nftManagerStorage();
        return ds.supportedInterfaces[_interfaceId];
    }
}


