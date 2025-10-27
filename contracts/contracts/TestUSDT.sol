// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSDT
 * @notice Test USDT token for BSC Testnet
 * @dev ERC20 token with minting capability for testing
 */
contract TestUSDT is ERC20, Ownable {
    /**
     * @notice Constructor
     * @dev Deploys Test USDT with initial supply to deployer
     */
    constructor() ERC20("Test USDT", "USDT") Ownable(msg.sender) {
        // Mint initial 10 million USDT to deployer for testing
        _mint(msg.sender, 10_000_000 * 10**18);
    }

    /**
     * @notice Mint tokens to an address
     * @dev Only owner can mint
     * @param to Address to receive tokens
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from sender
     * @param amount Amount to burn (in wei)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}


