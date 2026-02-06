# Development Dockerfile for Next.js app (Monorepo)
# NEVER COPY SOURCE FILES - ALWAYS USE VOLUME MOUNTS FOR HOT-RELOADING
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy ONLY package files to install dependencies
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including optional dependencies for native builds)
RUN pnpm install --frozen-lockfile

# DO NOT COPY SOURCE FILES - they come from volume mount in docker-compose.yml

# Set working directory to Next.js app
WORKDIR /app/apps/web

# Expose port 3000
EXPOSE 3000

# Start Next.js dev server
CMD ["pnpm", "run", "dev"]

