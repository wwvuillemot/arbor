# Arbor with Traefik

This document explains how to run Arbor with Traefik reverse proxy for local development.

## Prerequisites

1. **Traefik must be running** in the parent traefik directory
2. **traefik-network must exist** (created when Traefik starts)
3. **Add arbor.local to /etc/hosts**

## Setup

### 1. Start Traefik (if not already running)

```bash
cd /Users/wwv/Projects/wwvuillemot/traefik
docker compose up -d
```

### 2. Create traefik-network (if it doesn't exist)

```bash
docker network create traefik-network
```

### 3. Add arbor.local to /etc/hosts

```bash
sudo sh -c 'echo "127.0.0.1 arbor.local api.arbor.local" >> /etc/hosts'
```

## Running Arbor with Traefik

### Option 1: From Traefik Directory (Recommended)

```bash
cd /Users/wwv/Projects/wwvuillemot/traefik/local

# Start Arbor services with Traefik
docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml up -d

# View logs
docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml logs -f

# Stop services
docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml down
```

### Option 2: From Arbor Directory

```bash
cd /Users/wwv/Projects/wwvuillemot/arbor

# Start with Traefik overlay
docker compose -f docker-compose.yml -f /Users/wwv/Projects/wwvuillemot/traefik/local/arbor-docker-compose.traefik.yml up -d
```

## Access Points

Once running with Traefik:

- **Frontend**: <http://arbor.local> (when frontend service is added)
- **Backend API**: <http://api.arbor.local> (when backend service is added)
- **PostgreSQL**: Not exposed (internal only)
- **Redis**: Not exposed (internal only)
- **Traefik Dashboard**: <http://traefik.localhost:8080>

## Current Status

Currently, the Traefik configuration is prepared but only includes PostgreSQL and Redis services.

When you add frontend and backend services to `docker-compose.yml`, update the Traefik overlay file at:
`/Users/wwv/Projects/wwvuillemot/traefik/local/arbor-docker-compose.traefik.yml`

### Example: Adding Frontend Service

Add to `/Users/wwv/Projects/wwvuillemot/traefik/local/arbor-docker-compose.traefik.yml`:

```yaml
services:
  frontend:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.arbor-frontend.rule=Host(`arbor.local`)"
      - "traefik.http.routers.arbor-frontend.entrypoints=web"
      - "traefik.http.services.arbor-frontend.loadbalancer.server.port=3000"
      - "traefik.docker.network=traefik-network"
```

### Example: Adding Backend Service

```yaml
services:
  backend:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.arbor-backend.rule=Host(`api.arbor.local`)"
      - "traefik.http.routers.arbor-backend.entrypoints=web"
      - "traefik.http.services.arbor-backend.loadbalancer.server.port=3001"
      - "traefik.docker.network=traefik-network"
```

## Troubleshooting

### Cannot access arbor.local

1. Check /etc/hosts has the entry:

   ```bash
   cat /etc/hosts | grep arbor
   ```

2. Verify Traefik is running:

   ```bash
   docker ps | grep traefik
   ```

3. Check traefik-network exists:

   ```bash
   docker network ls | grep traefik
   ```

### Services not showing in Traefik

1. Check service labels:

   ```bash
   docker inspect arbor-postgres | grep -A 10 Labels
   ```

2. View Traefik logs:

   ```bash
   docker logs traefik
   ```

3. Check Traefik dashboard:
   <http://traefik.localhost:8080>

## Development Workflow

For local development without Traefik, use the standard commands:

```bash
make up    # Start services normally (ports 5432, 6379)
make down  # Stop services
```

For development with Traefik (when services are added):

```bash
cd /Users/wwv/Projects/wwvuillemot/traefik/local
docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml up -d
```

## Next Steps

1. Add Dockerfile.frontend for Next.js app
2. Add Dockerfile.backend for Node.js API
3. Update docker-compose.yml with frontend and backend services
4. Update arbor-docker-compose.traefik.yml with Traefik labels
5. Test access at <http://arbor.local>
