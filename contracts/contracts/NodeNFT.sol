// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NodeNFT
 * @notice Node NFT contract for Enclave ecosystem
 * @dev ERC-721 implementation with transfer restrictions
 * 
 * Key Features:
 * - Only NFTManager can mint NFTs
 * - Transfers are disabled (except mint/burn)
 * - All share trading happens through NFTManager
 * - Prevents listing on OpenSea and other marketplaces
 */
contract NodeNFT is ERC721, Ownable {
    /// @notice NFT Manager contract address (only address allowed to mint)
    address public nftManager;
    
    /// @notice Next token ID to mint
    uint256 private _nextTokenId;
    
    /// @notice Base URI for token metadata
    string private _baseTokenURI;
    
    /// @notice Emitted when NFT Manager address is set
    event NFTManagerSet(address indexed manager);
    
    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string newBaseURI);
    
    /**
     * @notice Constructor
     * @param name_ Token name (e.g., "Enclave Node NFT")
     * @param symbol_ Token symbol (e.g., "ENFT")
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        _nextTokenId = 1; // Start token IDs from 1
    }
    
    /**
     * @notice Set NFT Manager address
     * @dev Only owner can call this function, can only be set once
     * @param manager_ NFT Manager contract address
     */
    function setNFTManager(address manager_) external onlyOwner {
        require(manager_ != address(0), "Invalid manager address");
        require(nftManager == address(0), "Manager already set");
        nftManager = manager_;
        emit NFTManagerSet(manager_);
    }
    
    /**
     * @notice Set base URI for token metadata
     * @dev Only owner can call this function
     * @param baseURI_ New base URI
     */
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }
    
    /**
     * @notice Mint new NFT
     * @dev Only NFT Manager can call this function
     * @param to Recipient address
     * @return tokenId Minted token ID
     */
    function mint(address to) external returns (uint256) {
        require(msg.sender == nftManager, "Only NFT Manager can mint");
        require(to != address(0), "Cannot mint to zero address");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _safeMint(to, tokenId);
        
        return tokenId;
    }
    
    /**
     * @notice Burn NFT
     * @dev Only NFT Manager can call this function
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external {
        require(msg.sender == nftManager, "Only NFT Manager can burn");
        _burn(tokenId);
    }
    
    /**
     * @notice Get next token ID that will be minted
     * @return Next token ID
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @notice Get total number of minted NFTs
     * @return Total minted count
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @notice Get base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @notice Hook that is called before any token transfer
     * @dev Prevents all transfers except mint and burn
     * This ensures NFTs cannot be listed on OpenSea or other marketplaces
     * All share trading must go through NFTManager contract
     * 
     * @param to Destination address (address(0) for burn)
     * @param firstTokenId First token ID
     * @param from Source address (address(0) for mint)
     */
    function _update(
        address to,
        uint256 firstTokenId,
        address from
    ) internal virtual override returns (address) {
        // Only allow mint (from == address(0)) and burn (to == address(0))
        require(
            from == address(0) || to == address(0),
            "Direct transfers not allowed"
        );
        
        return super._update(to, firstTokenId, from);
    }
}

