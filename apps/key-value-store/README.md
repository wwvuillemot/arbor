# Key-Value Store (Redis)

Session-scope preference storage for Arbor.

## Overview

This app provides a Redis instance for storing temporary, session-scoped data:

- User session preferences
- Temporary UI state
- Cache data
- Real-time collaboration state

## Access

- **Internal (Docker network)**: `redis://arbor-redis:6379`
- **External (via Traefik)**: `redis.arbor.local:6379`
- **Local development**: `localhost:6379` (if port is exposed)

## Commands

```bash
# Start Redis
make up

# Stop Redis
make down

# Restart Redis
make restart

# View logs
make logs

# Open Redis CLI
make cli

# Clean data (removes all stored data)
make clean
```

## Data Persistence

Redis is configured with AOF (Append-Only File) persistence:

- Data is persisted to disk automatically
- Survives container restarts
- Can be cleared with `make clean`

## Configuration

- **Image**: `redis:7-alpine`
- **Persistence**: AOF enabled
- **Health check**: Ping every 5 seconds
- **Volume**: `redis-data` (persistent)

## Usage in Code

### Node.js (apps/api)

```typescript
import { createClient } from "redis";

const client = createClient({
  url: "redis://arbor-redis:6379",
});

await client.connect();
```

### Environment Variables

```bash
REDIS_URL=redis://arbor-redis:6379
```

## Monitoring

Check Redis health:

```bash
docker exec arbor-redis redis-cli ping
# Should return: PONG
```

View Redis info:

```bash
docker exec arbor-redis redis-cli info
```

## Security Notes

- Redis is NOT exposed to the public internet
- Only accessible within the Docker network
- No authentication required (internal use only)
- For production, add authentication via `requirepass`
