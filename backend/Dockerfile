# Backend Dockerfile for NestJS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 4000

# Start the application
# For development, use: npm run start:dev
# For production, use: npm run start:prod
CMD ["npm", "run", "start:prod"]

