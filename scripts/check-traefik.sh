#!/bin/bash
# Check Traefik setup for Arbor

echo "🔍 Checking Traefik Setup..."
echo ""

# Check if Traefik is running
echo "1. Traefik Container:"
if docker ps | grep -q traefik; then
    docker ps | grep traefik | awk '{print "   ✅ " $NF " is running"}'
else
    echo "   ❌ Traefik is NOT running"
    echo "   → Start Traefik first from /tmp/traefik directory"
fi
echo ""

# Check if traefik-network exists
echo "2. Traefik Network:"
if docker network ls | grep -q traefik-network; then
    echo "   ✅ traefik-network exists"
else
    echo "   ❌ traefik-network does NOT exist"
    echo "   → Create it with: docker network create traefik-network"
fi
echo ""

# Check if arbor containers are connected to traefik-network
echo "3. Arbor Containers on traefik-network:"
for container in arbor-postgres arbor-redis arbor-pgadmin arbor-api; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        networks=$(docker inspect $container --format '{{range .NetworkSettings.Networks}}{{.Name}} {{end}}')
        if echo "$networks" | grep -q "traefik-network"; then
            echo "   ✅ $container is connected to traefik-network"
        else
            echo "   ❌ $container is NOT connected to traefik-network"
            echo "      Current networks: $networks"
        fi
    else
        echo "   ⚠️  $container is not running"
    fi
done
echo ""

# Check /etc/hosts
echo "4. /etc/hosts entries:"
if grep -q "arbor.local" /etc/hosts; then
    echo "   ✅ arbor.local entries found:"
    grep "arbor.local" /etc/hosts | sed 's/^/      /'
else
    echo "   ❌ No arbor.local entries in /etc/hosts"
    echo "   → Add these lines to /etc/hosts:"
    echo "      127.0.0.1 arbor.local api.arbor.local pgadmin.arbor.local db.arbor.local"
fi
echo ""

# Check Traefik config file
echo "5. Traefik Configuration:"
TRAEFIK_CONFIG="/tmp/traefik/local/arbor-docker-compose.traefik.yml"
if [ -f "$TRAEFIK_CONFIG" ]; then
    echo "   ✅ Traefik config exists: $TRAEFIK_CONFIG"
else
    echo "   ❌ Traefik config NOT found: $TRAEFIK_CONFIG"
    echo "   → Run: bash scripts/update-traefik-config.sh"
fi
echo ""

echo "========================================="
echo "Summary:"
echo "========================================="
echo ""
echo "To fix arbor.local URLs:"
echo "1. Make sure Traefik is running"
echo "2. Make sure traefik-network exists"
echo "3. Start Arbor with Traefik overlay:"
echo "   cd /tmp/traefik/local"
echo "   docker compose -f arbor-docker-compose.yml -f arbor-docker-compose.traefik.yml up -d"
echo ""

