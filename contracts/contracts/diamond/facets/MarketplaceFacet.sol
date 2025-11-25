// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibNFTManagerStorage.sol";
import "../libraries/LibNFTManager.sol";

/**
 * @title MarketplaceFacet
 * @notice Handles all marketplace functionality: orders, trading, queries, config
 * @dev Unified Facet combining 4 smaller Facets
 */
contract MarketplaceFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using LibNFTManagerStorage for LibNFTManagerStorage.NFTManagerStorage;

    /* ========== MODIFIERS ========== */
    
    modifier onlyMaster() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.master || msg.sender == LibNFTManager.contractOwner(), "Only master or owner");
        _;
    }
    

    /* ========== ORDER FUNCTIONS ========== */
    
    function createSellOrder(uint256 nftId, uint256 price) external nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        require(price > 0, "Price must be > 0");
        require(s.nftActiveOrder[nftId] == 0, "NFT already has active order");
        require(s.transfersEnabled, "Transfers not enabled");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.nftId == nftId, "NFT not found in pool");
        
        address diamondAddress = address(this);
        address currentApproval = s.nftContract.getApproved(nftId);
        bool isApprovedForAll = s.nftContract.isApprovedForAll(msg.sender, diamondAddress);
        
        if (currentApproval != diamondAddress && !isApprovedForAll) {
            revert("Diamond not approved. Owner must call NodeNFT.approve(Diamond, tokenId) first");
        }
        
        uint256 orderId = s.nextOrderId;
        s.nextOrderId++;
        
        s.sellOrders[orderId] = LibNFTManagerStorage.SellOrder({
            orderId: orderId,
            nftId: nftId,
            seller: msg.sender,
            price: price,
            createdAt: block.timestamp,
            status: LibNFTManagerStorage.OrderStatus.Active
        });
        
        s.nftActiveOrder[nftId] = orderId;
        s.activeOrderIds.push(orderId);
        
        emit SellOrderCreated(orderId, nftId, msg.sender, price, block.timestamp);
        return orderId;
    }
    
    function cancelSellOrder(uint256 orderId) external nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        LibNFTManagerStorage.SellOrder storage order = s.sellOrders[orderId];
        require(order.orderId == orderId, "Order does not exist");
        require(order.seller == msg.sender, "Not order seller");
        require(order.status == LibNFTManagerStorage.OrderStatus.Active, "Order not active");
        
        order.status = LibNFTManagerStorage.OrderStatus.Cancelled;
        s.nftActiveOrder[order.nftId] = 0;
        _removeFromActiveOrders(s, orderId);
        
        emit SellOrderCancelled(orderId, order.nftId, msg.sender, block.timestamp);
    }

    /* ========== TRADE FUNCTIONS ========== */
    
    function buyNFT(uint256 orderId) external nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        LibNFTManagerStorage.SellOrder storage order = s.sellOrders[orderId];
        require(order.orderId == orderId, "Order does not exist");
        require(order.status == LibNFTManagerStorage.OrderStatus.Active, "Order not active");
        require(msg.sender != order.seller, "Cannot buy own NFT");
        require(s.nftContract.ownerOf(order.nftId) == order.seller, "NFT ownership changed");
        
        // Check NFT is in system and active
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[order.nftId];
        require(pool.nftId == order.nftId, "NFT not found in pool");
        require(
            pool.status == LibNFTManagerStorage.NFTStatus.Active,
            "NFT not active"
        );
        
        uint256 fee = (order.price * s.marketFeeRate) / 10000;
        uint256 sellerAmount = order.price - fee;
        
        // Transfer payment first (Checks-Effects-Interactions pattern)
        s.paymentToken.safeTransferFrom(msg.sender, address(this), order.price);
        s.paymentToken.safeTransfer(order.seller, sellerAmount);
        
        if (fee > 0) {
            s.paymentToken.safeTransfer(s.treasury, fee);
        }
        
        // Transfer NFT (this may revert, so we do it after payment)
        s.nftContract.transferFrom(order.seller, msg.sender, order.nftId);
        
        // Update state only after all transfers succeed
        order.status = LibNFTManagerStorage.OrderStatus.Filled;
        s.nftActiveOrder[order.nftId] = 0;
        _removeFromActiveOrders(s, orderId);
        
        emit NFTBought(orderId, order.nftId, order.seller, msg.sender, order.price, block.timestamp);
    }

    /* ========== QUERY FUNCTIONS ========== */
    
    function getOrder(uint256 orderId) external view returns (LibNFTManagerStorage.SellOrder memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.sellOrders[orderId];
    }
    
    function getActiveOrderByNFT(uint256 nftId) external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.nftActiveOrder[nftId];
    }
    
    function getActiveOrderIds() external view returns (uint256[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.activeOrderIds;
    }
    
    function getActiveOrderCount() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.activeOrderIds.length;
    }
    
    function getActiveOrders(uint256 offset, uint256 limit) external view returns (
        LibNFTManagerStorage.SellOrder[] memory orders,
        uint256 total
    ) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        total = s.activeOrderIds.length;
        
        if (offset >= total) {
            return (new LibNFTManagerStorage.SellOrder[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 count = end - offset;
        orders = new LibNFTManagerStorage.SellOrder[](count);
        
        for (uint256 i = 0; i < count; i++) {
            orders[i] = s.sellOrders[s.activeOrderIds[offset + i]];
        }
        
        return (orders, total);
    }
    
    function getAllActiveOrders() external view returns (LibNFTManagerStorage.SellOrder[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        uint256 count = s.activeOrderIds.length;
        LibNFTManagerStorage.SellOrder[] memory orders = new LibNFTManagerStorage.SellOrder[](count);
        
        for (uint256 i = 0; i < count; i++) {
            orders[i] = s.sellOrders[s.activeOrderIds[i]];
        }
        
        return orders;
    }

    /* ========== CONFIG FUNCTIONS ========== */
    
    function setMarketFeeRate(uint256 feeRate) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(feeRate <= 1000, "Fee rate too high");
        s.marketFeeRate = feeRate;
        emit MarketFeeRateUpdated(feeRate);
    }
    
    function setTreasury(address treasury_) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(treasury_ != address(0), "Invalid treasury");
        s.treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /* ========== INTERNAL FUNCTIONS ========== */
    
    function _removeFromActiveOrders(
        LibNFTManagerStorage.NFTManagerStorage storage s,
        uint256 orderId
    ) internal {
        for (uint256 i = 0; i < s.activeOrderIds.length; i++) {
            if (s.activeOrderIds[i] == orderId) {
                s.activeOrderIds[i] = s.activeOrderIds[s.activeOrderIds.length - 1];
                s.activeOrderIds.pop();
                break;
            }
        }
    }

    /* ========== EVENTS ========== */
    
    event SellOrderCreated(uint256 indexed orderId, uint256 indexed nftId, address indexed seller, uint256 price, uint256 timestamp);
    event SellOrderCancelled(uint256 indexed orderId, uint256 indexed nftId, address seller, uint256 timestamp);
    event NFTBought(uint256 indexed orderId, uint256 indexed nftId, address indexed seller, address buyer, uint256 price, uint256 timestamp);
    event MarketFeeRateUpdated(uint256 newFeeRate);
    event TreasuryUpdated(address indexed newTreasury);
}

