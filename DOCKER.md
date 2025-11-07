# Docker Compose Setup Guide

This guide explains how to run the Node NFT backend and frontend services using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured (see `.env.example`)

## Development vs Production

This project supports two modes:

- **Development Mode** (`docker-compose.yaml`): 
  - Hot reload enabled
  - Source code mounted as volumes
  - Development servers (no build step)
  - Suitable for local development

- **Production Mode** (`docker-compose.prod.yaml`):
  - Applications are built and compiled
  - Optimized Docker images
  - No source code volumes
  - Suitable for production deployment

## Quick Start

### Development Mode

1. **Create environment files:**
   ```bash
   # For backend
   cp .env.example .env
   
   # For frontend
   cp frontend/env.example frontend/.env.local
   ```

2. **Edit `.env` file** (backend configuration) with your actual values:
   - Set `DATABASE_URL` (optional, defaults to `postgresql://nft_admin:nft_password@postgres:5432/nft_db`)
     - **Important**: If setting DATABASE_URL, use `postgres` as hostname (not `localhost`) to access the database container
   - Set `JWT_SECRET` to a secure random string
   - Set `ADMIN_PRIVATE_KEY` to your admin wallet private key
   - Update contract addresses if needed
   - Update RPC URL for your network

3. **Edit `frontend/.env.local` file** (frontend configuration) with your actual values:
   - Update contract addresses if needed
   - Update network configuration (CHAIN_ID, RPC_URL)
   - Set `NEXT_PUBLIC_API_URL` to backend API URL (default: `https://nodes-back.enclave-hq.com/api`)
     - For local development, use `http://localhost:4000/api`

4. **Start all services (Development):**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations:**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

6. **Access the services:**
   - Frontend: http://localhost:4001 (or https://nodes.enclave-hq.com)
   - Backend API: http://localhost:4000/api (or https://nodes-back.enclave-hq.com/api)
   - PostgreSQL: localhost:5432

### Production Mode

1. **Create environment files** (same as development)

2. **Build and start production services:**
   ```bash
   # Build production images (includes compilation)
   docker-compose -f docker-compose.prod.yaml build
   
   # Start services
   docker-compose -f docker-compose.prod.yaml up -d
   ```

3. **Run database migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yaml exec backend npx prisma migrate deploy
   ```

**Note**: Production mode compiles both backend and frontend:
- **Backend**: TypeScript compiled to JavaScript, Prisma Client generated
- **Frontend**: Next.js built with standalone output for optimized Docker image

## Services

### PostgreSQL Database
- **Container**: `node-nft-postgres`
- **Port**: 5432
- **Database**: `nft_db`
- **User**: `nft_admin`
- **Password**: `nft_password`
- **Volume**: `postgres_data` (persistent storage)

### Backend (NestJS)
- **Container**: `node-nft-backend`
- **Port**: 4000
- **Domain**: nodes-back.enclave-hq.com
- **Environment File**: `.env` (in project root)
- **Health Check**: Depends on PostgreSQL
- **Auto-restart**: Enabled
- **CORS**: Configured to allow requests from `https://nodes.enclave-hq.com`
- **Build**: TypeScript compiled to JavaScript in Docker image (production mode)

### Frontend (Next.js)
- **Container**: `node-nft-frontend`
- **Port**: 4001
- **Domain**: nodes.enclave-hq.com
- **Environment File**: `.env.local` (in frontend directory)
- **Depends on**: Backend service
- **Auto-restart**: Enabled
- **API URL**: Configured to use `https://nodes-back.enclave-hq.com/api`
- **Build**: Next.js built with standalone output in Docker image (production mode)

## Common Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Rebuild services

**Development mode:**
```bash
docker-compose build
docker-compose up -d
```

**Production mode:**
```bash
docker-compose -f docker-compose.prod.yaml build
docker-compose -f docker-compose.prod.yaml up -d
```

### Run database migrations
```bash
docker-compose exec backend npx prisma migrate deploy
```

### Generate Prisma Client
```bash
docker-compose exec backend npx prisma generate
```

### Access database
```bash
docker-compose exec postgres psql -U nft_admin -d nft_db
```

### Access backend shell
```bash
docker-compose exec backend sh
```

### Access frontend shell
```bash
docker-compose exec frontend sh
```

## Development Mode

The docker-compose.yaml is configured for development with:
- Hot reload enabled (volumes mounted)
- Development commands (`npm run start:dev` and `npm run dev`)
- Source code changes reflected immediately

## Production Mode

For production, you should:

1. **Update Dockerfiles** to use production builds:
   - Backend: Change CMD to `npm run start:prod`
   - Frontend: Change CMD to `npm run build && npm run start`

2. **Use environment-specific `.env` files**:
   ```bash
   docker-compose --env-file .env.production up -d
   ```

3. **Remove volume mounts** for source code (only keep node_modules volumes)

4. **Add health checks** and restart policies

## Troubleshooting

### Database connection errors
- Ensure PostgreSQL is healthy: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`
- Verify DATABASE_URL in backend environment

### Port conflicts
- Change ports in `docker-compose.yaml` if 3000, 3001, or 5432 are in use
- Update `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` accordingly

### Build errors
- Clear Docker cache: `docker-compose build --no-cache`
- Check Dockerfile syntax
- Verify package.json files exist

### Permission errors
- Ensure Docker has proper permissions
- Check file ownership in volumes

## Environment Variables

### Backend Environment Variables (`.env`)

Backend reads environment variables from `.env` file in the project root. Key variables:

- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://nft_admin:nft_password@postgres:5432/nft_db`)
  - **Note**: Use `postgres` as hostname (not `localhost`) to access the database container
- `JWT_SECRET`: Secret key for JWT token signing
- `JWT_EXPIRES_IN`: JWT token expiration time (default: `7d`)
- `NFT_MANAGER_ADDRESS`: NFT Manager contract address
- `ENCLAVE_TOKEN_ADDRESS`: Enclave Token contract address
- `USDT_TOKEN_ADDRESS`: USDT Token contract address
- `RPC_URL`: Blockchain RPC endpoint
- `ADMIN_PRIVATE_KEY`: Admin wallet private key for contract calls
- `PORT`: Backend service port (default: `4000`)
- `FRONTEND_URL`: Allowed frontend origins for CORS (comma-separated)

### Frontend Environment Variables (`.env.local`)

Frontend reads environment variables from `frontend/.env.local` file. Key variables:

- `NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS`: Enclave Token contract address
- `NEXT_PUBLIC_NODE_NFT_ADDRESS`: Node NFT contract address
- `NEXT_PUBLIC_NFT_MANAGER_ADDRESS`: NFT Manager contract address
- `NEXT_PUBLIC_USDT_ADDRESS`: USDT Token contract address
- `NEXT_PUBLIC_CHAIN_ID`: Blockchain chain ID (default: `97` for BSC Testnet)
- `NEXT_PUBLIC_RPC_URL`: Blockchain RPC endpoint
- `NEXT_PUBLIC_ENABLE_TESTNET`: Enable testnet features (default: `true`)
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `https://nodes-back.enclave-hq.com/api`)
- `PORT`: Frontend service port (default: `4001`)

All variables in `docker-compose.yaml` can also be overridden by setting them in the respective `.env` files.

## Data Persistence

- PostgreSQL data is stored in Docker volume `postgres_data`
- To backup: `docker-compose exec postgres pg_dump -U nft_admin nft_db > backup.sql`
- To restore: `docker-compose exec -T postgres psql -U nft_admin nft_db < backup.sql`

## Network

All services are on the `node-nft-network` bridge network, allowing them to communicate using service names:
- Backend can access database at `postgres:5432`
- Frontend can access backend at `backend:3001`

