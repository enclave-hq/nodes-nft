// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../diamond/libraries/LibNFTManager.sol";

/**
 * @title OwnerTransferFacet
 * @notice 临时 Facet，用于转移 NFTManager 的所有权
 * @dev 通过 nftManagerCut 添加，并通过 _init 参数执行
 * 注意：不需要检查 owner，因为 nftManagerCut 已经检查了权限
 */
contract OwnerTransferFacet {
    /**
     * @notice 转移 NFTManager 的所有权
     * @dev 通过 nftManagerCut 的 _init 参数调用，已经通过权限检查
     * 在 delegatecall 中，msg.sender 保持不变（目标地址），
     * 但 LibNFTManager.contractOwner() 读取的是 NFTManager 的存储
     * 所以直接设置，不检查 owner
     */
    function transferOwnership(address newOwner) external {
        // 不需要检查 owner，因为：
        // 1. nftManagerCut 已经检查了权限（只有 owner 可以调用）
        // 2. 在 delegatecall 中，msg.sender 可能不是目标地址
        // 3. 直接设置 owner
        LibNFTManager.setContractOwner(newOwner);
    }
}

