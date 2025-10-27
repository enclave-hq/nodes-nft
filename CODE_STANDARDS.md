# Code Standards

## Language Requirements

### Comments and Documentation
- ✅ **All code comments MUST be in English**
- ✅ **All NatSpec documentation MUST be in English**
- ✅ **All error messages MUST be in English**
- ❌ **No Chinese characters in code**

### Exception
- 📝 Documentation files (`.md`) can be in Chinese
- 📝 User-facing UI text can be in Chinese (with i18n support)

## Solidity Standards

### NatSpec Comments

```solidity
/**
 * @title Contract Title
 * @notice Explain what this contract does (for end users)
 * @dev Technical details (for developers)
 */
contract Example {
    /**
     * @notice Brief description of what this function does
     * @dev Additional technical details if needed
     * @param paramName Description of parameter
     * @return Description of return value
     */
    function exampleFunction(uint256 paramName) external returns (uint256) {
        // Implementation
    }
}
```

### Naming Conventions

```solidity
// ✅ Good
contract EnclaveToken {}
function mintNFT() {}
uint256 public totalSupply;
mapping(address => uint256) private _balances;

// ❌ Bad
contract 代币合约 {}
function 铸造NFT() {}
uint256 public 总供应量;
```

### Error Messages

```solidity
// ✅ Good
require(amount > 0, "Amount must be positive");
revert("Insufficient balance");

// ❌ Bad
require(amount > 0, "数量必须大于零");
revert("余额不足");
```

## TypeScript/JavaScript Standards

### Comments

```typescript
// ✅ Good
/**
 * Calculate pending rewards for a user
 * @param nftId - NFT ID
 * @param userAddress - User's wallet address
 * @returns Pending reward amount in wei
 */
async function getPendingRewards(nftId: number, userAddress: string): Promise<bigint> {
  // Implementation
}

// ❌ Bad
/**
 * 计算用户的待领取奖励
 * @param nftId - NFT ID
 * @param userAddress - 用户钱包地址
 * @returns 待领取奖励数量（wei）
 */
```

### Variable Names

```typescript
// ✅ Good
const enclaveBalance = await getBalance();
const pendingRewards = calculateRewards();
const nftManager = new Contract();

// ❌ Bad
const 代币余额 = await getBalance();
const 待领取奖励 = calculateRewards();
```

## Documentation Standards

### Code Documentation
- All `.sol` files: English only
- All `.ts`/`.js` files: English only
- All `.tsx`/`.jsx` files: English comments, Chinese UI text allowed

### Design Documentation
- `docs/*.md`: Can be in Chinese
- README.md: Should have both English and Chinese versions
- API documentation: English preferred, Chinese optional

## Formatting Standards

### Solidity

```solidity
// Use 4 spaces for indentation
contract Example {
    uint256 public value;
    
    function setValue(uint256 _value) external {
        value = _value;
    }
}

// Line length: max 120 characters
// Use explicit visibility modifiers
// Order: public, external, internal, private
```

### TypeScript

```typescript
// Use 2 spaces for indentation
export async function fetchData() {
  const result = await api.call();
  return result;
}

// Line length: max 100 characters
// Use explicit types
// Prefer `const` over `let`
```

## Testing Standards

### Test Names

```typescript
// ✅ Good
describe("EnclaveToken", () => {
  it("should mint tokens correctly", async () => {
    // Test implementation
  });
  
  it("should revert when minting to zero address", async () => {
    // Test implementation
  });
});

// ❌ Bad
describe("Enclave代币", () => {
  it("应该正确铸造代币", async () => {
    // Test implementation
  });
});
```

## Git Commit Messages

### Commit Format

```bash
# ✅ Good
git commit -m "feat: add EnclaveToken contract"
git commit -m "fix: resolve precision loss in reward calculation"
git commit -m "docs: update implementation plan"

# ❌ Bad
git commit -m "添加了代币合约"
git commit -m "修复了奖励计算的精度问题"
```

### Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Linting and Formatting

### Solidity

```bash
# Install
npm install --save-dev solhint prettier-plugin-solidity

# Run linter
npx solhint 'contracts/**/*.sol'

# Format
npx prettier --write 'contracts/**/*.sol'
```

### Configuration: `.solhint.json`

```json
{
  "extends": "solhint:recommended",
  "rules": {
    "compiler-version": ["error", "^0.8.20"],
    "func-visibility": ["error", {"ignoreConstructors": true}],
    "not-rely-on-time": "off",
    "avoid-low-level-calls": "off"
  }
}
```

### TypeScript/JavaScript

```bash
# Install
npm install --save-dev eslint prettier

# Run linter
npx eslint 'src/**/*.{ts,tsx}'

# Format
npx prettier --write 'src/**/*.{ts,tsx}'
```

## Example: Complete Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NodeNFT
 * @notice Node NFT contract for Enclave ecosystem
 * @dev ERC-721 implementation with transfer restrictions
 */
contract NodeNFT is ERC721, Ownable {
    /// @notice NFT Manager contract address
    address public nftManager;
    
    /// @notice Next token ID to mint
    uint256 private _nextTokenId;
    
    /// @notice Emitted when NFT Manager is set
    event NFTManagerSet(address indexed manager);
    
    /**
     * @notice Constructor
     * @param name_ Token name
     * @param symbol_ Token symbol
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {}
    
    /**
     * @notice Set NFT Manager address
     * @dev Only owner can call this function
     * @param manager_ NFT Manager contract address
     */
    function setNFTManager(address manager_) external onlyOwner {
        require(manager_ != address(0), "Invalid manager address");
        nftManager = manager_;
        emit NFTManagerSet(manager_);
    }
    
    /**
     * @notice Mint new NFT
     * @dev Only NFT Manager can call this function
     * @param to Recipient address
     * @return tokenId Minted token ID
     */
    function mint(address to) external returns (uint256) {
        require(msg.sender == nftManager, "Only NFT Manager can mint");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
    
    /**
     * @notice Hook that is called before any token transfer
     * @dev Prevents transfers except mint and burn
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 /* tokenId */,
        uint256 /* batchSize */
    ) internal pure override {
        // Only allow mint (from == 0) and burn (to == 0)
        require(
            from == address(0) || to == address(0),
            "Transfer not allowed"
        );
    }
}
```

## Summary

✅ **ALWAYS use English for:**
- Contract names and function names
- Variable names and constant names
- Comments and documentation
- Error messages and revert reasons
- Test descriptions
- Git commit messages

📝 **Can use Chinese for:**
- Documentation files (`.md`)
- User interface text (with i18n)
- Internal discussions and notes

🚫 **NEVER use Chinese for:**
- Solidity code
- TypeScript/JavaScript code
- Function/variable names
- Comments in code files

