// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../diamond/interfaces/INFTManagerCut.sol";
import "../diamond/libraries/LibNFTManager.sol";

/**
 * @title EIP7702RecoveryProxy
 * @notice 通过 EIP-7702 实现的紧急恢复代理合约
 * @dev 当目标地址通过 EIP-7702 授权给本合约后，可以代表目标地址执行操作
 * 
 * 关键特性：
 * - msg.sender = 目标地址（不是代理合约地址）✅
 * - 可以在一个交易中执行多个操作
 * - 多签可以代付 gas
 * 
 * 使用流程：
 * 1. 目标地址签名 EIP-7702 授权（授权给本合约）
 * 2. 多签构建 EIP-7702 交易（支付 gas）
 * 3. 目标地址临时变成智能合约（拥有本合约的代码）
 * 4. 目标地址调用本合约的 emergencyRecover()
 * 5. 本合约执行操作，msg.sender = 目标地址 ✅
 */

// 委托合约接口
interface IDelegation {
    function undelegate(address validator) external;
    function getDelegated(address delegator) external view returns (address);
}

// 标准 Ownable 接口
interface IOwnable {
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
}

// NFTManager (Diamond) 接口 - 用于检查 owner
interface INFTManagerOwner {
    // 通过 AdminFacet 的 contractOwner() 或直接读取存储
    // 注意：NFTManager 没有标准的 owner() 函数，需要通过存储读取
}

// 不再需要 OwnerTransferFacet 接口，直接内联逻辑

contract EIP7702RecoveryProxy {
    // BNB Chain 系统委托合约地址
    address public constant DELEGATION_CONTRACT = 0x0000000000000000000000000000000000001000;
    
    // NFTManager 合约地址（BSC 主网）
    // 如果地址匹配，直接使用特殊处理，避免函数检测失败
    address public constant NFT_MANAGER_ADDRESS = 0xD9eA9F4B8F24872262568fB2C6133117EC02C774;
    
    event DelegationRevoked(address indexed validator);
    event OwnershipTransferred(address indexed contractAddr, address indexed newOwner);
    event RecoveryExecuted(address[] contracts, address indexed newOwner);
    event DebugInfo(address indexed msgSender, address indexed txOrigin, address indexed thisAddress);
    
    /**
     * @notice 紧急恢复：在一个交易中取消委托并转移所有权
     * @dev 通过 EIP-7702，msg.sender 是目标地址本身
     * @param validatorAddress 需要取消委托的验证者地址（如果为 address(0) 则跳过）
     * @param contracts 需要转移所有权的合约地址数组
     * @param newOwner 新的 Owner 地址（应该是多签钱包）
     */
    function emergencyRecover(
        address validatorAddress,
        address[] calldata contracts,
        address newOwner
    ) external {
        require(newOwner != address(0), "Invalid new owner");
        require(contracts.length > 0, "No contracts to transfer");
        
        // 调试：记录 msg.sender 和 tx.origin
        // 在 EIP-7702 上下文中，msg.sender 应该是目标地址
        emit DebugInfo(msg.sender, tx.origin, address(this));
        
        // 步骤 1: 取消委托（如果指定了验证者地址）
        if (validatorAddress != address(0)) {
            IDelegation delegation = IDelegation(DELEGATION_CONTRACT);
            
            // 检查当前委托状态
            address currentDelegate = delegation.getDelegated(msg.sender);
            if (currentDelegate == validatorAddress) {
                // 调用 undelegate
                // msg.sender 是目标地址，所以可以成功调用
                delegation.undelegate(validatorAddress);
                emit DelegationRevoked(validatorAddress);
            }
        }
        
        // 步骤 2: 转移所有权或 Master
        for (uint256 i = 0; i < contracts.length; i++) {
            address contractAddr = contracts[i];
            
            // 检查是否是 NFTManager (Diamond Pattern)
            bool isNFTManager = (contractAddr == NFT_MANAGER_ADDRESS) || _isNFTManager(contractAddr);
            
            if (isNFTManager) {
                // NFTManager 特殊处理
                // 先尝试改 owner（需要 owner 权限）
                // 如果失败，再尝试改 master（也需要 owner 权限）
                // 注意：try 只能用于 external 函数调用，所以直接调用 internal 函数
                // 如果失败会 revert，但这是预期的行为
                _transferNFTManagerOwnership(contractAddr, newOwner);
                emit OwnershipTransferred(contractAddr, newOwner);
            } else {
                // 标准 Ownable 合约
                IOwnable ownable = IOwnable(contractAddr);
                ownable.transferOwnership(newOwner);
            }
            
            emit OwnershipTransferred(contractAddr, newOwner);
        }
        
        emit RecoveryExecuted(contracts, newOwner);
    }
    
    /**
     * @notice 仅取消委托
     * @param validatorAddress 验证者地址
     */
    function revokeDelegation(address validatorAddress) external {
        require(validatorAddress != address(0), "Invalid validator");
        
        IDelegation delegation = IDelegation(DELEGATION_CONTRACT);
        address currentDelegate = delegation.getDelegated(msg.sender);
        require(currentDelegate == validatorAddress, "Not delegated to this validator");
        
        delegation.undelegate(validatorAddress);
        emit DelegationRevoked(validatorAddress);
    }
    
    /**
     * @notice 仅转移所有权
     * @param contracts 合约地址数组
     * @param newOwner 新 Owner 地址
     */
    function transferOwnerships(
        address[] calldata contracts,
        address newOwner
    ) external {
        require(newOwner != address(0), "Invalid new owner");
        
        for (uint256 i = 0; i < contracts.length; i++) {
            IOwnable ownable = IOwnable(contracts[i]);
            
            // 注意：在 EIP-7702 上下文中，msg.sender 应该是目标地址
            // 直接调用 transferOwnership，如果目标地址不是 owner，会失败
            // 不需要预先检查，让 transferOwnership 自己验证
            ownable.transferOwnership(newOwner);
            emit OwnershipTransferred(contracts[i], newOwner);
        }
    }
    
    /**
     * @notice 检查是否是 NFTManager (Diamond Pattern)
     * @dev 通过尝试调用 owner() 函数来判断
     * NFTManager 使用 Diamond Pattern，没有标准的 owner() 函数
     * 如果 owner() 调用失败，且合约有代码，可能是 NFTManager
     */
    function _isNFTManager(address contractAddr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(contractAddr)
        }
        if (size == 0) return false;
        
        // 尝试调用标准的 owner() 函数
        // NFTManager (Diamond) 没有标准的 owner() 函数，调用会失败
        (bool success, ) = contractAddr.staticcall(
            abi.encodeWithSignature("owner()")
        );
        
        // 如果 owner() 调用失败，且合约有代码，很可能是 NFTManager
        // 为了更准确，我们可以检查是否有 nftManagerCut 函数
        if (!success) {
            // 尝试调用 nftManagerCut (函数选择器: 0x52ef6b2c)
            // 注意：即使函数存在，调用也可能 revert（因为参数验证）
            // 但我们只关心函数是否存在，不关心调用是否成功
            // 使用 try-catch 或者直接检查 revert 原因
            // 更简单的方法：直接返回 true，因为如果 owner() 不存在，很可能是 NFTManager
            // 或者我们可以通过检查合约地址是否在已知列表中
            return true; // 简化：如果 owner() 不存在，假设是 NFTManager
        }
        
        // 如果 owner() 调用成功，说明是标准 Ownable 合约，不是 NFTManager
        return false;
    }
    
    /**
     * @notice 转移 NFTManager 的 Master（而不是 Owner）
     * @dev 通过 AdminFacet 的 setMaster 函数
     * @param nftManager NFTManager 合约地址
     * @param newMaster 新 Master 地址
     */
    function _transferNFTManagerMaster(address nftManager, address newMaster) external {
        // 注意：这个函数需要 external，因为要通过 this 调用
        // 但 setMaster 需要 onlyOwner，所以如果 msg.sender 不是 owner，会失败
        // 使用 interface 调用 AdminFacet 的 setMaster
        // AdminFacet 的 setMaster 函数签名: setMaster(address)
        bytes4 setMasterSelector = 0x13af4035;
        bytes memory calldata_ = abi.encodeWithSelector(setMasterSelector, newMaster);
        
        (bool success, bytes memory returnData) = nftManager.call(calldata_);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert("Failed to set master");
            }
        }
    }
    
    /**
     * @notice 转移 NFTManager 的所有权（内联逻辑）
     * @dev 通过 nftManagerCut 的 _init 参数 delegatecall 本合约的 transferNFTManagerOwner 函数
     * @param nftManager NFTManager 合约地址
     * @param newOwner 新 Owner 地址
     */
    function _transferNFTManagerOwnership(address nftManager, address newOwner) internal {
        // 方案：通过 nftManagerCut 的 _init 参数 delegatecall 本合约的 transferNFTManagerOwner 函数
        // 注意：在 EIP-7702 上下文中，msg.sender 应该是目标地址
        
        // 调试：记录 msg.sender
        emit DebugInfo(msg.sender, tx.origin, address(this));
        
        // 使用空的 FacetCut 数组（不添加 Facet）
        INFTManagerCut.FacetCut[] memory emptyCut = new INFTManagerCut.FacetCut[](0);
        
        // 构建 transferNFTManagerOwner 的调用数据
        bytes memory transferCalldata = abi.encodeWithSelector(
            this.transferNFTManagerOwner.selector,
            newOwner
        );
        
        // 调用 nftManagerCut，通过 _init 参数 delegatecall 本合约的 transferNFTManagerOwner 函数
        // 在 EIP-7702 上下文中，msg.sender 应该是目标地址
        // _init 参数会通过 delegatecall 执行，所以 msg.sender 仍然是目标地址
        // 在 delegatecall 中，LibNFTManager.setContractOwner 会在 NFTManager 的存储上下文中执行
        
        INFTManagerCut(nftManager).nftManagerCut(
            emptyCut,           // 空的 FacetCut 数组（不添加 Facet）
            address(this),      // _init: 本合约地址
            transferCalldata    // _calldata: transferNFTManagerOwner(newOwner)
        );
    }
    
    /**
     * @notice 转移 NFTManager 的所有权（供 delegatecall 调用）
     * @dev 通过 delegatecall 在 NFTManager 的存储上下文中执行
     * 在 delegatecall 中，LibNFTManager.setContractOwner 会在 NFTManager 的存储上下文中执行
     * @param newOwner 新 Owner 地址
     */
    function transferNFTManagerOwner(address newOwner) external {
        // 在 delegatecall 中，msg.sender 保持不变（目标地址）
        // LibNFTManager.setContractOwner 会在 NFTManager 的存储上下文中执行
        // 不需要检查 owner，因为 nftManagerCut 已经检查了权限（只有 owner 可以调用）
        LibNFTManager.setContractOwner(newOwner);
    }
    
    /**
     * @notice 读取 NFTManager 的 contractOwner（供 delegatecall 调用）
     * @dev 通过 delegatecall 在 NFTManager 的存储上下文中执行
     * 在 delegatecall 中，LibNFTManager.contractOwner() 会在 NFTManager 的存储上下文中执行
     * @return contractOwner 合约的 owner 地址
     */
    function readNFTManagerOwner() external view returns (address contractOwner) {
        // 在 delegatecall 中，LibNFTManager.contractOwner() 会在 NFTManager 的存储上下文中执行
        return LibNFTManager.contractOwner();
    }
    
    /**
     * @notice 添加 OwnerFacet 到 NFTManager
     * @dev 通过 nftManagerCut 添加 OwnerFacet，使其可以通过 owner() 函数查询
     * @param nftManager NFTManager 合约地址
     * @param ownerFacet OwnerFacet 合约地址
     */
    function addOwnerFacet(address nftManager, address ownerFacet) external {
        // 在 EIP-7702 上下文中，msg.sender 应该是目标地址（owner）
        // 通过 nftManagerCut 添加 OwnerFacet
        INFTManagerCut.FacetCut[] memory addCut = new INFTManagerCut.FacetCut[](1);
        bytes4[] memory selectors = new bytes4[](2);
        // 使用函数选择器常量，而不是 keccak256（更可靠）
        // owner() 函数选择器: 0x8da5cb5b
        selectors[0] = 0x8da5cb5b;
        // contractOwner() 函数选择器: 0xce606ee0
        selectors[1] = 0xce606ee0;
        addCut[0] = INFTManagerCut.FacetCut({
            facetAddress: ownerFacet,
            action: INFTManagerCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
        
        INFTManagerCut(nftManager).nftManagerCut(addCut, address(0), "");
    }
}

