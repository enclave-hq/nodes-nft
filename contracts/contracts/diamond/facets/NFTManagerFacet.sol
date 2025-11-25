// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibNFTManagerStorage.sol";
import "../libraries/LibNFTManager.sol";
import "../../libraries/UnlockCalculator.sol";

/**
 * @title NFTManagerFacet
 * @notice Handles all NFT core functionality: minting, batches, termination, unlock, vault, transfer, minter, whitelist
 * @dev Unified Facet combining 8 smaller Facets
 */
contract NFTManagerFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ========== MODIFIERS ========== */
    
    modifier onlyMaster() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == s.master || msg.sender == LibNFTManager.contractOwner(), "Only master or owner");
        _;
    }
    
    modifier onlyOperator() {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(
            msg.sender == s.operator || 
            msg.sender == LibNFTManager.contractOwner() || 
            msg.sender == s.master,
            "Only operator, owner, or master"
        );
        _;
    }

    /* ========== MINTING FUNCTIONS ========== */
    
    function mintNFT() external nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        require(s.whitelist[msg.sender], "Not whitelisted");
        
        uint256 activeBatchId = 0;
        for (uint256 i = 1; i < s.currentBatchId; i++) {
            if (s.batches[i].active) {
                activeBatchId = i;
                break;
            }
        }
        require(activeBatchId > 0, "No active batch");
        
        LibNFTManagerStorage.Batch storage batch = s.batches[activeBatchId];
        require(batch.currentMinted < batch.maxMintable, "Batch sold out");
        require(s.totalMinted < s.MAX_SUPPLY, "Max supply reached");
        
        IERC20(address(s.paymentToken)).safeTransferFrom(msg.sender, s.treasury, batch.mintPrice);
        
        uint256 nftId = s.nodeNFT.mint(msg.sender);
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        pool.nftId = nftId;
        pool.status = LibNFTManagerStorage.NFTStatus.Active;
        pool.createdAt = block.timestamp;
        pool.unlockedWithdrawn = 0;
        pool.producedWithdrawn = s.globalState.accProducedPerNFT;
        pool.minter = msg.sender;
        
        for (uint256 i = 0; i < s.rewardTokens.length; i++) {
            address token = s.rewardTokens[i];
            pool.rewardWithdrawn[token] = s.globalState.accRewardPerNFT[token];
        }
        
        s.userNFTList[msg.sender].push(nftId);
        batch.currentMinted++;
        s.totalMinted++;
        s.globalState.totalActiveNFTs++;
        
        emit NFTMinted(nftId, msg.sender, activeBatchId, batch.mintPrice, block.timestamp);
        return nftId;
    }

    /* ========== SYNC FUNCTIONS (for existing NFTs) ========== */
    
    /**
     * @notice Import existing NFT into NFTManager
     * @dev Only master can call this. Used when migrating from old NFTManager or syncing existing NFTs
     * @param nftId NFT ID to import
     * @param owner Current owner of the NFT
     * @param minter Original minter address
     * @param createdAt Timestamp when NFT was originally minted
     * @param batchId Batch ID this NFT belongs to (0 if unknown)
     */
    function importExistingNFT(
        uint256 nftId,
        address owner,
        address minter,
        uint256 createdAt,
        uint256 batchId
    ) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        // Verify NFT exists in NodeNFT
        require(s.nodeNFT.ownerOf(nftId) == owner, "Owner mismatch");
        
        // Check if already imported
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.nftId == 0, "NFT already imported");
        
        // Import NFT
        pool.nftId = nftId;
        pool.status = LibNFTManagerStorage.NFTStatus.Active;
        pool.createdAt = createdAt;
        pool.unlockedWithdrawn = 0;
        pool.producedWithdrawn = s.globalState.accProducedPerNFT;
        pool.minter = minter;
        
        // Initialize reward withdrawals
        for (uint256 i = 0; i < s.rewardTokens.length; i++) {
            address token = s.rewardTokens[i];
            pool.rewardWithdrawn[token] = s.globalState.accRewardPerNFT[token];
        }
        
        // Add to user list
        s.userNFTList[owner].push(nftId);
        
        // Update batch if provided
        if (batchId > 0 && batchId < s.currentBatchId) {
            s.batches[batchId].currentMinted++;
        }
        
        // Update totals
        s.totalMinted++;
        s.globalState.totalActiveNFTs++;
        
        emit NFTImported(nftId, owner, minter, createdAt, batchId);
    }
    
    /**
     * @notice Batch import existing NFTs
     * @dev Only master can call this. More gas efficient for multiple NFTs
     * @param nftIds Array of NFT IDs to import
     * @param owners Array of current owners
     * @param minters Array of original minters
     * @param createdAts Array of creation timestamps
     * @param batchIds Array of batch IDs (0 if unknown)
     */
    function batchImportExistingNFTs(
        uint256[] calldata nftIds,
        address[] calldata owners,
        address[] calldata minters,
        uint256[] calldata createdAts,
        uint256[] calldata batchIds
    ) external onlyMaster {
        require(
            nftIds.length == owners.length &&
            nftIds.length == minters.length &&
            nftIds.length == createdAts.length &&
            nftIds.length == batchIds.length,
            "Array length mismatch"
        );
        
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        for (uint256 i = 0; i < nftIds.length; i++) {
            uint256 nftId = nftIds[i];
            address owner = owners[i];
            address minter = minters[i];
            uint256 createdAt = createdAts[i];
            uint256 batchId = batchIds[i];
            
            // Verify NFT exists in NodeNFT
            require(s.nodeNFT.ownerOf(nftId) == owner, "Owner mismatch");
            
            // Check if already imported
            LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
            require(pool.nftId == 0, "NFT already imported");
            
            // Import NFT
            pool.nftId = nftId;
            pool.status = LibNFTManagerStorage.NFTStatus.Active;
            pool.createdAt = createdAt;
            pool.unlockedWithdrawn = 0;
            pool.producedWithdrawn = s.globalState.accProducedPerNFT;
            pool.minter = minter;
            
            // Initialize reward withdrawals
            for (uint256 j = 0; j < s.rewardTokens.length; j++) {
                address token = s.rewardTokens[j];
                pool.rewardWithdrawn[token] = s.globalState.accRewardPerNFT[token];
            }
            
            // Add to user list
            s.userNFTList[owner].push(nftId);
            
            // Update batch if provided
            if (batchId > 0 && batchId < s.currentBatchId) {
                s.batches[batchId].currentMinted++;
            }
            
            // Update totals
            s.totalMinted++;
            s.globalState.totalActiveNFTs++;
            
            emit NFTImported(nftId, owner, minter, createdAt, batchId);
        }
    }

    /* ========== BATCH FUNCTIONS ========== */
    
    function createBatch(uint256 maxMintable, uint256 mintPrice) external onlyMaster returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(maxMintable > 0, "maxMintable must be > 0");
        require(mintPrice > 0, "mintPrice must be > 0");
        
        uint256 totalMaxMintable = 0;
        for (uint256 i = 1; i < s.currentBatchId; i++) {
            totalMaxMintable += s.batches[i].maxMintable;
        }
        require(totalMaxMintable + maxMintable <= s.MAX_SUPPLY, "Total maxMintable exceeds MAX_SUPPLY");
        
        uint256 batchId = s.currentBatchId;
        s.currentBatchId++;
        
        for (uint256 i = 1; i < batchId; i++) {
            if (s.batches[i].active) {
                s.batches[i].active = false;
                emit BatchDeactivated(i);
            }
        }
        
        s.batches[batchId] = LibNFTManagerStorage.Batch({
            batchId: batchId,
            maxMintable: maxMintable,
            currentMinted: 0,
            mintPrice: mintPrice,
            active: true,
            createdAt: block.timestamp
        });
        
        emit BatchCreated(batchId, maxMintable, mintPrice);
        emit BatchActivated(batchId);
        return batchId;
    }
    
    function activateBatch(uint256 batchId) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.Batch storage batch = s.batches[batchId];
        require(batch.batchId == batchId, "Batch does not exist");
        require(!batch.active, "Batch already active");
        
        for (uint256 i = 1; i < s.currentBatchId; i++) {
            if (s.batches[i].active) {
                s.batches[i].active = false;
                emit BatchDeactivated(i);
            }
        }
        
        batch.active = true;
        emit BatchActivated(batchId);
    }
    
    function deactivateBatch(uint256 batchId) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.Batch storage batch = s.batches[batchId];
        require(batch.batchId == batchId, "Batch does not exist");
        require(batch.active, "Batch not active");
        
        batch.active = false;
        emit BatchDeactivated(batchId);
    }
    
    function getActiveBatch() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        for (uint256 i = 1; i < s.currentBatchId; i++) {
            if (s.batches[i].active) {
                return i;
            }
        }
        return 0;
    }
    
    function getCurrentBatchId() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.currentBatchId;
    }

    /* ========== TERMINATION FUNCTIONS ========== */
    
    function initiateTermination(uint256 nftId) external nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.status == LibNFTManagerStorage.NFTStatus.Active, "NFT not active");
        
        pool.status = LibNFTManagerStorage.NFTStatus.PendingTermination;
        pool.terminationInitiatedAt = block.timestamp;
        
        emit TerminationInitiated(nftId, msg.sender, block.timestamp, block.timestamp + s.TERMINATION_COOLDOWN);
    }
    
    function confirmTermination(uint256 nftId) external nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination, "NFT not pending termination");
        require(
            block.timestamp >= pool.terminationInitiatedAt + s.TERMINATION_COOLDOWN,
            "Cooldown not passed"
        );
        require(
            block.timestamp <= pool.terminationInitiatedAt + s.TERMINATION_TIMEOUT,
            "Termination timeout"
        );
        
        pool.status = LibNFTManagerStorage.NFTStatus.Terminated;
        s.globalState.totalActiveNFTs--;
        
        emit TerminationConfirmed(nftId, msg.sender, block.timestamp);
    }
    
    function cancelTermination(uint256 nftId) external nonReentrant {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.status == LibNFTManagerStorage.NFTStatus.PendingTermination, "NFT not pending termination");
        
        pool.status = LibNFTManagerStorage.NFTStatus.Active;
        pool.terminationInitiatedAt = 0;
        
        emit TerminationCancelled(nftId, msg.sender, block.timestamp);
    }

    /* ========== UNLOCK FUNCTIONS ========== */
    
    function withdrawUnlocked(uint256 nftId) external nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.nftContract.ownerOf(nftId) == msg.sender, "Not NFT owner");
        
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.status == LibNFTManagerStorage.NFTStatus.Active, "NFT not active");
        
        uint256 unlockedAmount = calculateUnlockedAmount(nftId);
        require(unlockedAmount > 0, "No unlocked amount");
        
        uint256 withdrawable = unlockedAmount - pool.unlockedWithdrawn;
        require(withdrawable > 0, "Nothing to withdraw");
        
        // Check contract balance before updating state
        uint256 balance = s.eclvToken.balanceOf(address(this));
        require(balance >= withdrawable, "Insufficient contract balance");
        
        pool.unlockedWithdrawn += withdrawable;
        
        // Use safeTransfer for better error handling
        IERC20(address(s.eclvToken)).safeTransfer(msg.sender, withdrawable);
        
        emit UnlockedWithdrawn(nftId, msg.sender, withdrawable, block.timestamp);
        return withdrawable;
    }
    
    function calculateUnlockedAmount(uint256 nftId) public view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        
        if (pool.nftId == 0) {
            return 0; // NFT not in system
        }
        
        // Read TGE time from EnclaveToken (single source of truth)
        uint256 tgeTime_ = s.eclvToken.tgeTime();
        return UnlockCalculator.calculateUnlockedAmount(
            tgeTime_,
            s.ECLV_PER_NFT
        );
    }

    /* ========== VAULT FUNCTIONS ========== */
    
    function getVaultBalance() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.eclvToken.balanceOf(address(this));
    }
    
    function extractVaultRewards(address token) external onlyMaster nonReentrant returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        // Extract from vaultRewards which accumulates rewards allocated to vault
        uint256 amount = s.vaultRewards[token];
        require(amount > 0, "No rewards to extract");
        
        // Check contract balance
        uint256 balance;
        if (token == address(s.eclvToken)) {
            balance = s.eclvToken.balanceOf(address(this));
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }
        require(balance >= amount, "Insufficient contract balance");
        
        // Actually transfer the tokens to treasury
        if (token == address(s.eclvToken)) {
            s.eclvToken.transfer(s.treasury, amount);
        } else {
            IERC20(token).safeTransfer(s.treasury, amount);
        }
        
        // Update vault rewards tracking
        s.vaultRewards[token] = 0;
        emit VaultUpdated(token, 0);
        
        return amount;
    }

    /* ========== TRANSFER FUNCTIONS ========== */
    
    function onNFTTransfer(address from, address to, uint256 nftId) external {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(msg.sender == address(s.nodeNFT), "Only NodeNFT can call");
        require(from != address(0) && to != address(0), "Invalid addresses");
        
        _removeFromUserList(s, from, nftId);
        
        uint256[] storage newOwnerNFTs = s.userNFTList[to];
        bool alreadyInList = false;
        for (uint256 i = 0; i < newOwnerNFTs.length; i++) {
            if (newOwnerNFTs[i] == nftId) {
                alreadyInList = true;
                break;
            }
        }
        if (!alreadyInList) {
            newOwnerNFTs.push(nftId);
        }
        
        emit UserNFTListSynced(nftId, from, to);
    }
    
    function _removeFromUserList(
        LibNFTManagerStorage.NFTManagerStorage storage s,
        address user,
        uint256 nftId
    ) internal {
        uint256[] storage userNFTs = s.userNFTList[user];
        for (uint256 i = 0; i < userNFTs.length; i++) {
            if (userNFTs[i] == nftId) {
                userNFTs[i] = userNFTs[userNFTs.length - 1];
                userNFTs.pop();
                break;
            }
        }
    }

    /* ========== MINTER FUNCTIONS ========== */
    
    function getMinter(uint256 nftId) external view returns (address) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.nftPools[nftId].minter;
    }
    
    function setMinter(uint256 nftId, address minter) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftId];
        require(pool.nftId == nftId, "NFT does not exist");
        pool.minter = minter;
        emit MinterSet(nftId, minter);
    }
    
    function batchSetMinters(uint256[] calldata nftIds, address[] calldata minterAddresses) external onlyMaster nonReentrant {
        require(nftIds.length == minterAddresses.length, "Array length mismatch");
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        
        for (uint256 i = 0; i < nftIds.length; i++) {
            LibNFTManagerStorage.NFTPool storage pool = s.nftPools[nftIds[i]];
            require(pool.nftId == nftIds[i], "NFT does not exist");
            pool.minter = minterAddresses[i];
            emit MinterSet(nftIds[i], minterAddresses[i]);
        }
    }

    /* ========== WHITELIST FUNCTIONS ========== */
    
    function addToWhitelist(address[] calldata users) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(users.length > 0, "Empty array");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (!s.whitelist[users[i]]) {
                s.whitelist[users[i]] = true;
                s.whitelistAddresses.push(users[i]); // Add to array only if not already whitelisted
                s.whitelistCount++;
            }
        }
        
        emit WhitelistAdded(users);
    }
    
    function removeFromWhitelist(address user) external onlyMaster {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        require(s.whitelist[user], "User not in whitelist");
        
        s.whitelist[user] = false;
        s.whitelistCount--;
        
        // Remove from whitelistAddresses array to prevent array growth
        for (uint256 i = 0; i < s.whitelistAddresses.length; i++) {
            if (s.whitelistAddresses[i] == user) {
                s.whitelistAddresses[i] = s.whitelistAddresses[s.whitelistAddresses.length - 1];
                s.whitelistAddresses.pop();
                break;
            }
        }
        
        emit WhitelistRemoved(user);
    }
    
    function isWhitelisted(address user) external view returns (bool) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.whitelist[user];
    }
    
    function getWhitelistCount() external view returns (uint256) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        return s.whitelistCount;
    }
    
    /**
     * @notice Get all whitelisted addresses
     * @return Array of all whitelisted addresses (only active ones)
     * @dev Filters out removed addresses by checking whitelist mapping
     */
    function getAllWhitelistedAddresses() external view returns (address[] memory) {
        LibNFTManagerStorage.NFTManagerStorage storage s = LibNFTManagerStorage.getStorage();
        uint256 count = 0;
        
        // First pass: count active addresses
        for (uint256 i = 0; i < s.whitelistAddresses.length; i++) {
            if (s.whitelist[s.whitelistAddresses[i]]) {
                count++;
            }
        }
        
        // Second pass: build result array
        address[] memory result = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < s.whitelistAddresses.length; i++) {
            if (s.whitelist[s.whitelistAddresses[i]]) {
                result[index] = s.whitelistAddresses[i];
                index++;
            }
        }
        
        return result;
    }

    /* ========== EVENTS ========== */
    
    event NFTMinted(uint256 indexed nftId, address indexed minter, uint256 indexed batchId, uint256 mintPrice, uint256 timestamp);
    event NFTImported(uint256 indexed nftId, address indexed owner, address indexed minter, uint256 createdAt, uint256 batchId);
    event BatchCreated(uint256 indexed batchId, uint256 maxMintable, uint256 mintPrice);
    event BatchActivated(uint256 indexed batchId);
    event BatchDeactivated(uint256 indexed batchId);
    event TerminationInitiated(uint256 indexed nftId, address indexed owner, uint256 initiateTime, uint256 confirmDeadline);
    event TerminationConfirmed(uint256 indexed nftId, address indexed owner, uint256 timestamp);
    event TerminationCancelled(uint256 indexed nftId, address indexed owner, uint256 timestamp);
    event UnlockedWithdrawn(uint256 indexed nftId, address indexed owner, uint256 amount, uint256 timestamp);
    event UserNFTListSynced(uint256 indexed nftId, address indexed from, address indexed to);
    event MinterSet(uint256 indexed nftId, address indexed minter);
    event WhitelistAdded(address[] users);
    event WhitelistRemoved(address indexed user);
    event VaultUpdated(address indexed token, uint256 amount);
}
