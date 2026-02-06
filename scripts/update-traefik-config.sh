#!/bin/bash
# Update Traefik configuration for Arbor services

TRAEFIK_CONFIG="/tmp/traefik/local/arbor-docker-compose.traefik.yml"

cat > "$TRAEFIK_CONFIG" << 'EOF'
# Arbor - Traefik Configuration
# Access at: http://api.arbor.local, http://pgadmin.arbor.local
# Requires: traefik-network must exist (start Traefik first)
# Usage: docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml up -d

services:
  postgres:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=false"

  redis:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=false"

  pgadmin:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.arbor-pgadmin.rule=Host(\`pgadmin.arbor.local\`)"
      - "traefik.http.routers.arbor-pgadmin.entrypoints=web"
      - "traefik.http.services.arbor-pgadmin.loadbalancer.server.port=80"
      - "traefik.docker.network=traefik-network"

  api:
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.arbor-api.rule=Host(\`api.arbor.local\`)"
      - "traefik.http.routers.arbor-api.entrypoints=web"
      - "traefik.http.services.arbor-api.loadbalancer.server.port=3001"
      - "traefik.docker.network=traefik-network"

networks:
  traefik-network:
    external: true
EOF

echo "✅ Traefik configuration updated at: $TRAEFIK_CONFIG"

