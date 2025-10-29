// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSDT
 * @dev Test USDT token for BSC testnet
 * @notice This is a test token that mimics USDT behavior (18 decimals)
 */
contract TestUSDT is ERC20, Ownable {
    uint8 private constant _DECIMALS = 18;
    
    constructor() ERC20("Test USDT", "USDT") Ownable(msg.sender) {
        // No initial supply - mint as needed for testing
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
    
    /**
     * @dev Mint tokens to a specific address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in smallest unit)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from a specific address
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn (in smallest unit)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}