// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../interfaces/INFTManagerCut.sol";
import "../libraries/LibNFTManager.sol";

/**
 * @title NFTManagerCutFacet
 * @notice Handles facet management (add/replace/remove) for NFTManager
 * @dev Implements INFTManagerCut interface
 */
contract NFTManagerCutFacet is INFTManagerCut {
    /// @notice Add/replace/remove any number of functions and optionally execute
    ///         a function with delegatecall
    /// @param _nftManagerCut Contains the facet addresses and function selectors
    /// @param _init The address of the contract or facet to execute _calldata
    /// @param _calldata A function call, including function selector and arguments
    ///                  _calldata is executed with delegatecall on _init
    function nftManagerCut(
        FacetCut[] calldata _nftManagerCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        LibNFTManager.enforceIsContractOwner();
        LibNFTManager.nftManagerCut(_nftManagerCut, _init, _calldata);
    }
}


