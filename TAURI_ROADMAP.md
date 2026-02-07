# Tauri Integration Roadmap

## Current Status ✅

**Infrastructure Ready:**

- ✅ Docker services running (PostgreSQL, Redis, pgAdmin)
- ✅ Database schema created with Project node type
- ✅ Traefik configured for local domains
- ✅ `make health` command to check service readiness
- ✅ All commands via `make` (no raw pnpm/npm)

**Access Points:**

- pgAdmin: http://pgadmin.arbor.local (or http://localhost:5050)
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Next Steps to Get Tauri Working ASAP

### Phase 1: Initialize Tauri (15-30 minutes)

```bash
# 1. Initialize Tauri in the project
pnpm create tauri-app --skip-install

# When prompted:
# - App name: Arbor
# - Window title: Arbor
# - UI template: Skip (we already have Next.js)
# - Package manager: pnpm

# 2. This will create src-tauri/ directory with:
#    - Cargo.toml (Rust dependencies)
#    - tauri.conf.json (Tauri configuration)
#    - src/main.rs (Rust entry point)

# 3. Update tauri.conf.json to point to Next.js dev server
```

**Key Configuration:**

```json
{
  "build": {
    "devPath": "http://localhost:3000",
    "distDir": "../out"
  }
}
```

### Phase 2: Create Backend API Server (1-2 hours)

**Why needed:** Currently there's no API server running, which is why api.arbor.local returns 404.

**Create:** `server/api/index.ts`

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: ["http://localhost:3000", "tauri://localhost"],
});

server.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

server.listen({ port: 3001, host: "0.0.0.0" });
```

**Add to Makefile:**

```makefile
dev:
	pnpm run dev:api & pnpm run dev:web

dev:api:
	tsx watch server/api/index.ts

dev:web:
	next dev
```

### Phase 3: Connect Frontend to Backend (30 minutes)

**Update:** `src/lib/api-client.ts`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const apiClient = createClient({
  baseURL: API_URL,
});
```

### Phase 4: Test Tauri (15 minutes)

```bash
# Start backend API
make dev:api

# In another terminal, start Tauri
make tauri-dev

# This will:
# 1. Start Next.js dev server (port 3000)
# 2. Launch Tauri window pointing to localhost:3000
# 3. Next.js connects to API at localhost:3001
```

## Dual Development Mode

### Browser Mode (for QA/Debugging)

```bash
# Terminal 1: Start services
make up

# Terminal 2: Start backend API
make dev:api

# Terminal 3: Start Next.js
make dev:web

# Access in browser:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001
# - pgAdmin: http://pgadmin.arbor.local
```

### Tauri Mode (primary interface)

```bash
# Terminal 1: Start services
make up

# Terminal 2: Start everything in Tauri
make tauri-dev

# This starts API + Next.js + Tauri window
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Tauri Desktop App               │
│  ┌───────────────────────────────────┐  │
│  │     Next.js Frontend              │  │
│  │     (http://localhost:3000)       │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│                  │ HTTP/tRPC             │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │     Backend API (Fastify/tRPC)    │  │
│  │     (http://localhost:3001)       │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼───────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   PostgreSQL        │
         │   (localhost:5432)  │
         └─────────────────────┘
```

## Benefits of This Approach

1. **Local-First**: Everything runs locally, no cloud dependency
2. **Dual Mode**: Can use browser OR Tauri for development
3. **Native Features**: Tauri provides file system access, native menus, etc.
4. **Fast Iteration**: Hot reload works in both modes
5. **Easy QA**: Browser mode for quick testing/debugging

## Estimated Timeline

- **Phase 1** (Tauri Init): 15-30 minutes
- **Phase 2** (Backend API): 1-2 hours
- **Phase 3** (Frontend Connection): 30 minutes
- **Phase 4** (Testing): 15 minutes

**Total: 2-3 hours to have Tauri fully working**

## Current Blockers

1. ❌ No backend API server (api.arbor.local returns 404)
2. ❌ Tauri not initialized (src-tauri/ is empty)
3. ❌ No frontend pages yet (Next.js app directory is minimal)

## Recommended Order

1. **First**: Create backend API with health endpoint
2. **Second**: Create basic Next.js pages
3. **Third**: Initialize Tauri
4. **Fourth**: Test in both browser and Tauri modes

This way you can QA in the browser while building, then switch to Tauri once everything works.
