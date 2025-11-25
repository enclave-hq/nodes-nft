// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title UnlockCalculator
 * @notice Library for calculating unlock periods and amounts
 * @dev Pure functions for unlock calculations
 */
library UnlockCalculator {
    /// @notice Total unlock periods (25 months)
    uint256 public constant UNLOCK_PERIODS = 25;
    
    /// @notice Unlock percentage per period (4%)
    uint256 public constant UNLOCK_PERCENTAGE = 4;
    
    /// @notice Unlock interval (30 days)
    uint256 public constant UNLOCK_INTERVAL = 30 days;
    
    /// @notice Lock period before first unlock (365 days)
    uint256 public constant LOCK_PERIOD = 365 days;
    
    /// @notice $E amount per NFT (2000 $E)
    uint256 public constant ECLV_PER_NFT = 2000 * 10**18;
    
    /**
     * @notice Calculate how many unlock periods have passed
     * @param tgeTime TGE timestamp
     * @return periods Number of unlock periods that have passed
     */
    function calculateUnlockedPeriods(uint256 tgeTime) internal view returns (uint256) {
        if (tgeTime == 0) {
            return 0;
        }
        
        uint256 currentTime = block.timestamp;
        if (currentTime < tgeTime + LOCK_PERIOD) {
            return 0; // Still in lock period
        }
        
        uint256 timeSinceUnlock = currentTime - (tgeTime + LOCK_PERIOD);
        uint256 periods = timeSinceUnlock / UNLOCK_INTERVAL;
        
        // Cap at maximum unlock periods
        if (periods > UNLOCK_PERIODS) {
            return UNLOCK_PERIODS;
        }
        
        return periods;
    }
    
    /**
     * @notice Calculate unlocked amount for an NFT
     * @param tgeTime TGE timestamp
     * @param totalLocked Total locked amount (ECLV_PER_NFT)
     * @return unlockedAmount Amount that has been unlocked
     */
    function calculateUnlockedAmount(uint256 tgeTime, uint256 totalLocked) internal view returns (uint256) {
        uint256 periods = calculateUnlockedPeriods(tgeTime);
        
        if (periods == 0) {
            return 0;
        }
        
        // Calculate unlocked amount: (periods * UNLOCK_PERCENTAGE * totalLocked) / 100
        uint256 unlockedAmount = (periods * UNLOCK_PERCENTAGE * totalLocked) / 100;
        
        // Cap at total locked amount
        if (unlockedAmount > totalLocked) {
            return totalLocked;
        }
        
        return unlockedAmount;
    }
}

