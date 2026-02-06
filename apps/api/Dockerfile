# Dockerfile for Arbor API Server (Monorepo)
# NEVER COPY SOURCE FILES - ALWAYS USE VOLUME MOUNTS FOR HOT-RELOADING
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy ONLY package files to install dependencies
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# DO NOT COPY SOURCE FILES - they come from volume mount in docker-compose.yml

# Expose API port
EXPOSE 3001

# Start API server from monorepo root
CMD ["pnpm", "run", "dev:api"]

