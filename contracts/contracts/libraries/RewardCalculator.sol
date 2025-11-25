// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title RewardCalculator
 * @notice Library for calculating reward distributions and pending claims
 * @dev Pure functions for reward calculations
 */
library RewardCalculator {
    /**
     * @notice Calculate reward per NFT based on total amount and NFT count
     * @param totalAmount Total amount to distribute
     * @param nftCount Number of NFTs (can be MAX_SUPPLY for vault calculation)
     * @return rewardPerNFT Reward amount per NFT
     */
    function calculateRewardPerNFT(uint256 totalAmount, uint256 nftCount) internal pure returns (uint256) {
        require(nftCount > 0, "NFT count must be > 0");
        require(totalAmount >= nftCount, "Amount too small for distribution");
        return totalAmount / nftCount;
    }
    
    /**
     * @notice Calculate pending produced tokens for an NFT
     * @param accProducedPerNFT Global accumulated produced per NFT
     * @param producedWithdrawn NFT's withdrawn produced amount
     * @return pending Pending produced amount
     */
    function calculatePendingProduced(
        uint256 accProducedPerNFT,
        uint256 producedWithdrawn
    ) internal pure returns (uint256) {
        if (accProducedPerNFT > producedWithdrawn) {
            return accProducedPerNFT - producedWithdrawn;
        }
        return 0;
    }
    
    /**
     * @notice Calculate pending reward tokens for an NFT
     * @param accRewardPerNFT Global accumulated reward per NFT for token
     * @param rewardWithdrawn NFT's withdrawn reward amount for token
     * @return pending Pending reward amount
     */
    function calculatePendingReward(
        uint256 accRewardPerNFT,
        uint256 rewardWithdrawn
    ) internal pure returns (uint256) {
        if (accRewardPerNFT > rewardWithdrawn) {
            return accRewardPerNFT - rewardWithdrawn;
        }
        return 0;
    }
    
    /**
     * @notice Calculate distribution split (80% to NFTs, 20% to multisig)
     * @param totalAmount Total amount to distribute
     * @return nftAmount Amount for NFTs (80%)
     * @return multisigAmount Amount for multisig (20%)
     */
    function calculateDistributionSplit(uint256 totalAmount) internal pure returns (uint256 nftAmount, uint256 multisigAmount) {
        nftAmount = (totalAmount * 80) / 100;
        multisigAmount = totalAmount - nftAmount; // Ensures exact split
    }
}

