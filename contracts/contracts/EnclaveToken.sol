// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EnclaveToken ($E)
 * @dev Enclave project token contract (ERC-20)
 * Name: $E
 * Symbol: $E
 * Decimals: 18
 * Initial Supply: 100,000,000 $E
 */
contract EnclaveToken is ERC20, Ownable {
    /// @notice Initial token supply: 100 million $E
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18;

    constructor() ERC20("$E", "$E") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @notice Mint new tokens (only owner)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from sender
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
