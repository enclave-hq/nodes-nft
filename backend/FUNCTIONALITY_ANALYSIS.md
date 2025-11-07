# Backend Functionality Analysis

## Overview

This NestJS backend service provides comprehensive administrative and public APIs for managing NFT minting, invite codes, whitelists, batches, and user hierarchies. It integrates with blockchain smart contracts using ethers.js and maintains a PostgreSQL database for tracking invite codes, NFT records, and administrative operations.

## Architecture

### Core Components

1. **Database Layer (Prisma)**
   - PostgreSQL database with Prisma ORM
   - Models: Admin, InviteCode, InviteCodeRequest, InviteCodeUsage, NftRecord, WhitelistHistory, Batch, AdminLog, StatsCache

2. **Blockchain Integration (ContractService)**
   - Uses ethers.js for direct contract interactions
   - No wallet SDK needed (uses admin private key directly)
   - Validates configuration and handles initialization gracefully

3. **Authentication (JWT)**
   - JWT-based authentication for admin endpoints
   - Signature verification for admin login
   - Contract owner verification

## Module Breakdown

### 1. Authentication Module (`/api/admin/auth`)

**Purpose**: Admin authentication and authorization

**Endpoints**:
- `POST /api/admin/auth/login`
  - Admin login with address and signature
  - Returns JWT token
  - Verifies contract owner status

**Features**:
- JWT token generation
- Contract owner verification
- Protected routes using `@UseGuards(JwtAuthGuard)`

---

### 2. Invite Codes Module

#### Admin Endpoints (`/api/admin/invite-codes`)

**Purpose**: Manage invite codes and requests

**Endpoints**:
- `GET /api/admin/invite-codes`
  - List all invite codes with pagination
  - Query params: `page`, `limit`, `status`
- `GET /api/admin/invite-codes/:id`
  - Get invite code details by ID
- `GET /api/admin/invite-codes/:id/descendants`
  - Get all descendant invite codes (recursive hierarchy)
- `PATCH /api/admin/invite-codes/requests/:id/approve`
  - Approve invite code request
  - Creates invite code and adds applicant to whitelist

#### Public Endpoints (`/api/invite-codes`)

**Purpose**: User-facing invite code operations

**Endpoints**:
- `POST /api/invite-codes/request`
  - Apply for invite code
  - Two-tier system:
    - Top-level: Requires admin approval
    - Subsequent-level: Auto-approved if user has minted NFT
- `POST /api/invite-codes/use`
  - Use invite code to join whitelist
  - Prevents duplicate usage (database unique constraint)
- `POST /api/invite-codes/validate`
  - Validate invite code format

**Key Features**:
- **Hierarchical Structure**: Supports parent-child relationships
- **Base32 Encoding**: Invite codes generated from address suffix (last 3 bytes)
- **Auto-approval**: Users who have minted NFTs can auto-approve subsequent requests
- **Status Tracking**: `pending`, `active`, `revoked`
- **Usage Limits**: Optional `maxUses` per invite code
- **Root Tracking**: Tracks root invite code and applicant for fast tracing

---

### 3. Whitelist Module

#### Admin Endpoints (`/api/admin/whitelist`)

**Purpose**: Manage whitelist addresses

**Endpoints**:
- `GET /api/admin/whitelist`
  - List whitelisted addresses with pagination
  - Query params: `page`, `limit`, `search`
- `POST /api/admin/whitelist`
  - Add addresses to whitelist (via contract)
  - Records operation in WhitelistHistory
- `DELETE /api/admin/whitelist/:address`
  - Remove address from whitelist (via contract)
  - Records operation in WhitelistHistory

#### Public Endpoints (`/api/whitelist`)

**Purpose**: Check whitelist status

**Endpoints**:
- `GET /api/whitelist/check?address=0x...`
  - Check if address is whitelisted
  - Reads from contract directly

**Key Features**:
- **Contract Integration**: All whitelist operations sync with smart contract
- **History Tracking**: Records all add/remove operations
- **Invite Code Association**: Records invite code used for whitelist entry

---

### 4. Batches Module (`/api/admin/batches`)

**Purpose**: Manage NFT minting batches

**Endpoints**:
- `GET /api/admin/batches`
  - List all batches
- `POST /api/admin/batches`
  - Create new batch
  - Body: `{ maxMintable: string, mintPrice: string }`
  - Calls contract `createBatch`
  - Records in database
- `PATCH /api/admin/batches/:batchId/activate`
  - Activate batch (only one active at a time)
  - Calls contract `activateBatch`
  - Deactivates previous active batch

**Key Features**:
- **Manual Management**: Only one active batch at a time
- **Price Setting**: Admin sets price when creating batch
- **Quantity Limits**: Each batch has `maxMintable` limit
- **Contract Sync**: All operations sync with smart contract

---

### 5. Users Module (`/api/admin/users`)

**Purpose**: Query user hierarchies and statistics

**Endpoints**:
- `GET /api/admin/users/:address/children`
  - Get direct children (immediate subordinates)
- `GET /api/admin/users/:address/descendants`
  - Get all descendants (recursive hierarchy)
- `GET /api/admin/users/:address/stats`
  - Get user statistics
  - Includes: NFT count, invite code usage, hierarchy depth

**Key Features**:
- **Hierarchical Queries**: Efficient tree traversal
- **Invite Code Tracing**: Tracks invite code relationships
- **Statistics**: User-level stats for admin dashboard

---

### 6. NFTs Module (`/api/admin/nfts`)

**Purpose**: NFT tracing and querying

**Endpoints**:
- `GET /api/admin/nfts/:id/trace`
  - Trace NFT back to root invite code
  - Returns full invite code chain
- `GET /api/admin/nfts/root/:rootInviteCodeId`
  - Get all NFTs traced to a root invite code
- `GET /api/admin/nfts/user/:address`
  - Get all NFTs owned by user address

**Key Features**:
- **Tracing**: Full traceability from NFT to root invite code
- **Invite Chain**: Stores invite code chain as JSON
- **Root Tracking**: Fast lookup via `rootInviteCodeId`
- **Event Listening**: (Future) Listen to `NFTMinted` events to auto-record

---

### 7. Stats Module (`/api/admin/stats`)

**Purpose**: System-wide statistics

**Endpoints**:
- `GET /api/admin/stats/overview`
  - Overall system statistics
  - Includes: total NFTs, invite codes, users, etc.
- `GET /api/admin/stats/invite-codes`
  - Invite code statistics
  - Usage rates, hierarchy depth, etc.

**Key Features**:
- **Caching**: Optional `StatsCache` model for performance
- **Real-time**: Calculates stats on-demand
- **Comprehensive**: Covers all major entities

---

### 8. Contract Service (Internal)

**Purpose**: Blockchain interaction layer

**Methods**:
- `readContract()`: Read-only contract calls
- `writeContract()`: Transaction sending
- `waitForTransaction()`: Wait for confirmation
- `isWhitelisted()`: Check whitelist status
- `addToWhitelist()`: Add addresses via contract
- `removeFromWhitelist()`: Remove address via contract
- `getOwner()`: Get contract owner
- `createBatch()`: Create batch via contract
- `activateBatch()`: Activate batch via contract
- `getActiveBatch()`: Get current active batch

**Key Features**:
- **Graceful Degradation**: Continues operation even if contract not configured
- **Validation**: Validates private key format and configuration
- **Error Handling**: Comprehensive error handling and logging
- **ABI Loading**: Dynamically loads NFTManager ABI from multiple paths

---

## Database Schema

### Core Models

1. **Admin**: Admin addresses (contract owners)
2. **InviteCodeRequest**: User applications for invite codes
3. **InviteCode**: Generated invite codes with hierarchy
4. **InviteCodeUsage**: Records of invite code usage
5. **NftRecord**: NFT minting records with invite code tracing
6. **WhitelistHistory**: History of whitelist operations
7. **Batch**: Batch records synced with contract
8. **AdminLog**: Administrative operation logs
9. **StatsCache**: Cached statistics (optional)

---

## API Routes Summary

### Admin Routes (JWT Protected)
```
POST   /api/admin/auth/login
GET    /api/admin/invite-codes
GET    /api/admin/invite-codes/:id
GET    /api/admin/invite-codes/:id/descendants
PATCH  /api/admin/invite-codes/requests/:id/approve
GET    /api/admin/whitelist
POST   /api/admin/whitelist
DELETE /api/admin/whitelist/:address
GET    /api/admin/batches
POST   /api/admin/batches
PATCH  /api/admin/batches/:batchId/activate
GET    /api/admin/users/:address/children
GET    /api/admin/users/:address/descendants
GET    /api/admin/users/:address/stats
GET    /api/admin/nfts/:id/trace
GET    /api/admin/nfts/root/:rootInviteCodeId
GET    /api/admin/nfts/user/:address
GET    /api/admin/stats/overview
GET    /api/admin/stats/invite-codes
```

### Public Routes
```
POST /api/invite-codes/request
POST /api/invite-codes/use
POST /api/invite-codes/validate
GET  /api/whitelist/check
```

---

## Key Features

### 1. Two-Tier Invite Code System
- **Top-level**: Requires admin approval
- **Subsequent-level**: Auto-approved for users who have minted NFTs

### 2. Hierarchical Invite Code Tracking
- Parent-child relationships
- Root tracking for fast queries
- Full invite chain storage

### 3. NFT Traceability
- Every NFT traced back to root invite code
- Stores invite code chain
- Fast queries via root invite code ID

### 4. Whitelist Management
- Contract-synced whitelist
- History tracking
- Invite code association

### 5. Batch Management
- Manual batch creation
- Only one active batch at a time
- Price and quantity limits

### 6. User Hierarchy Queries
- Direct children lookup
- Recursive descendants
- User statistics

### 7. Comprehensive Statistics
- System overview
- Invite code stats
- Cached for performance

---

## Security Features

1. **JWT Authentication**: All admin endpoints protected
2. **Contract Owner Verification**: Admin must be contract owner
3. **Input Validation**: DTOs with class-validator
4. **CORS**: Configured for frontend origin
5. **Error Handling**: Comprehensive error filters

---

## Configuration

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `RPC_URL`: Blockchain RPC endpoint
- `NFT_MANAGER_ADDRESS`: NFTManager contract address
- `ADMIN_PRIVATE_KEY`: Admin wallet private key

---

## Future Enhancements

1. **Event Listening**: Listen to blockchain events for auto-sync
2. **WebSocket Support**: Real-time updates for admin dashboard
3. **Rate Limiting**: API rate limiting
4. **Caching**: Redis for stats caching
5. **Monitoring**: Health checks and metrics
6. **Documentation**: Swagger/OpenAPI documentation

---

## Status

✅ **Completed**: Core functionality implemented
⚠️ **Partial**: Some service methods need implementation
🔲 **Planned**: Event listening, WebSocket, enhanced caching

