// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IConfigRegistry
 * @notice Interface for centralized configuration registry
 * @dev All contracts can read configuration from NFTManager through this interface
 */
interface IConfigRegistry {
    /**
     * @notice Get Oracle address
     * @return Oracle address
     */
    function oracle() external view returns (address);

    /**
     * @notice Get TGE time
     * @return TGE timestamp
     */
    function tgeTime() external view returns (uint256);

    /**
     * @notice Get Treasury address
     * @return Treasury address
     */
    function treasury() external view returns (address);

    /**
     * @notice Get ECLV Token address
     * @return ECLV Token address
     */
    function eclvToken() external view returns (address);

    /**
     * @notice Get NodeNFT address
     * @return NodeNFT address
     */
    function nodeNFT() external view returns (address);

    /**
     * @notice Get USDT Token address
     * @return USDT Token address
     */
    function usdtToken() external view returns (address);
}

