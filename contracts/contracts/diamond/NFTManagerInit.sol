// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./libraries/LibNFTManagerStorage.sol";

/**
 * @title NFTManagerInit
 * @notice Initialization contract for NFTManager
 * @dev This contract is called once when NFTManager is first deployed
 */
contract NFTManagerInit {
    /**
     * @notice Initialize the NFTManager contract
     * @param nodeNFT_ NodeNFT contract address
     * @param eclvToken_ EnclaveToken contract address
     * @param usdtToken_ USDT token contract address
     * @param oracle_ Oracle address
     * @param treasury_ Treasury address
     */
    function init(
        address nodeNFT_,
        address eclvToken_,
        address usdtToken_,
        address oracle_,
        address treasury_
    ) external {
        require(nodeNFT_ != address(0), "Invalid NodeNFT address");
        require(eclvToken_ != address(0), "Invalid $E address");
        require(usdtToken_ != address(0), "Invalid USDT address");
        require(oracle_ != address(0), "Invalid oracle address");
        require(treasury_ != address(0), "Invalid treasury address");
        
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        // Initialize constants
        s.MAX_SUPPLY = 5000;
        s.ECLV_PER_NFT = 2000 * 10**18;
        s.UNLOCK_PERIODS = 25;
        s.UNLOCK_PERCENTAGE = 4;
        s.UNLOCK_INTERVAL = 30 days;
        s.LOCK_PERIOD = 365 days;
        s.TERMINATION_COOLDOWN = 1 days;
        s.TERMINATION_TIMEOUT = 30 days;
        
        // Initialize contract references
        s.nodeNFT = NodeNFT(nodeNFT_);
        s.eclvToken = EnclaveToken(eclvToken_);
        s.usdtToken = IERC20(usdtToken_);
        s.nftContract = IERC721(nodeNFT_);
        s.paymentToken = IERC20(usdtToken_);
        
        // Initialize roles
        s.oracle = oracle_;
        s.treasury = treasury_;
        s.master = msg.sender; // Owner is master by default
        s.oracleMultisig = oracle_; // Oracle multisig = oracle by default
        s.operator = address(0); // Operator not set by default
        s.multisigNode = address(0); // Will be set later
        
        // Initialize state
        s.globalState.lastUpdateTime = block.timestamp;
        s.currentBatchId = 1;
        s.transfersEnabled = false;
        s.nextOrderId = 1; // Marketplace starts from order ID 1
        s.marketFeeRate = 0; // Default 0% fee
        
        // Add USDT as default reward token
        s.rewardTokens.push(usdtToken_);
        s.isRewardToken[usdtToken_] = true;
    }
}


