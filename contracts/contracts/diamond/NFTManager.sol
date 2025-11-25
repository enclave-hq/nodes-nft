// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./libraries/LibNFTManager.sol";
import "./interfaces/INFTManagerCut.sol";
import "./interfaces/INFTManagerLoupe.sol";
import "./interfaces/IERC165.sol";

/**
 * @title NFTManager
 * @notice Main NFT Manager contract using Diamond Pattern (EIP-2535)
 * @dev This is the main entry point for all NFT Manager, Marketplace, and Reward Distributor functionality
 */
contract NFTManager {
    constructor(address _contractOwner, address _nftManagerCutFacet) payable {
        LibNFTManager.setContractOwner(_contractOwner);

        // Add the nftManagerCut external function from the nftManagerCutFacet
        INFTManagerCut.FacetCut[] memory cut = new INFTManagerCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = INFTManagerCut.nftManagerCut.selector;
        cut[0] = INFTManagerCut.FacetCut({
            facetAddress: _nftManagerCutFacet,
            action: INFTManagerCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
        LibNFTManager.nftManagerCut(cut, address(0), "");
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibNFTManager.NFTManagerStorage storage ds;
        bytes32 position = LibNFTManager.NFT_MANAGER_STORAGE_POSITION;
        // get nft manager storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), "NFTManager: Function does not exist");
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}


