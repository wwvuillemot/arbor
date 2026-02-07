# Testing Guide for Arbor

## Overview

The Arbor project uses a comprehensive testing strategy with unit, integration, and e2e tests. All tests are orchestrated through Makefiles at both the root and app levels.

## Running Tests

### From Root Directory

```bash
# Run all tests across all apps
make test

# Run only unit tests
make test-unit

# Run only integration tests
make test-integration

# Run e2e tests
make test-e2e

# Run tests in watch mode
make test-watch

# Run tests with coverage
make test-coverage
```

### From Individual Apps

```bash
# API tests
cd apps/api && make test

# Web tests
cd apps/web && make test

# Key-value-store (no tests - service only)
cd apps/key-value-store && make test
```

## Prerequisites for Running Tests

### 1. Services Must Be Running

Tests require PostgreSQL and Redis to be running:

```bash
make up
```

### 2. Database Schema Must Be Pushed

```bash
make db-push
```

### 3. Dependencies Must Be Installed

```bash
pnpm install
```

## Test Structure

```
tests/
├── unit/              # Unit tests (isolated, fast)
│   ├── db/           # Database operation tests
│   └── services/     # Service layer tests
├── integration/       # Integration tests (multiple components)
├── e2e/              # End-to-end tests (full user flows)
├── helpers/          # Test utilities
│   ├── db.ts        # Database test helpers
│   └── fixtures.ts  # Test data fixtures
└── setup.ts          # Global test setup
```

## Current Test Files

1. **tests/unit/db/nodes.test.ts** - Node CRUD operations
2. **tests/unit/db/cascade-delete.test.ts** - Cascade deletion behavior
3. **tests/unit/services/node-service.test.ts** - NodeService business logic
4. **tests/unit/services/preferences-service.test.ts** - PreferencesService (session + app scopes)

## Test Configuration

- **Framework**: Vitest
- **Coverage Tool**: V8
- **Coverage Threshold**: 80% (lines, functions, branches, statements)
- **Test Timeout**: 10 seconds
- **Hook Timeout**: 10 seconds
- **Execution**: Sequential (to avoid database conflicts)

## Path Aliases

Tests use the following path aliases (configured in `tsconfig.json` and `vitest.config.ts`):

- `@/*` → `./apps/api/src/*`
- `@server` → `./apps/api/src`
- `@tests` → `./tests`

## Common Issues and Solutions

### Issue 1: Tests Timing Out

**Cause**: Services (PostgreSQL, Redis) not running or not accessible

**Solution**:

```bash
make up
docker logs arbor-postgres
docker logs arbor-redis
```

### Issue 2: Module Not Found Errors

**Cause**: Path aliases not configured correctly or dependencies missing

**Solution**:

```bash
pnpm install
# Check tsconfig.json and vitest.config.ts path aliases
```

### Issue 3: Database Connection Errors

**Cause**: Database schema not pushed or connection string incorrect

**Solution**:

```bash
make db-push
# Check DATABASE_URL in environment
```

### Issue 4: Redis Connection Errors

**Cause**: Redis not running or `redis` package not installed in Docker image

**Solution**:

```bash
# Rebuild API image with new dependencies
docker compose -f apps/key-value-store/docker-compose.yml \
  -f apps/api/docker-compose.yml \
  -f apps/web/docker-compose.yml \
  -f tmp/traefik/local/arbor-docker-compose.traefik.yml \
  build --no-cache api

make restart
```

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, resetTestDb } from "@tests/helpers/db";

describe("MyFeature", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("should do something", async () => {
    // Arrange
    const db = getTestDb();

    // Act
    const result = await myFunction();

    // Assert
    expect(result).toBe(expected);
  });
});
```

## Next Steps

1. **Fix API Container** - Rebuild with `redis` package
2. **Run Tests** - Verify all tests pass
3. **Add Missing Tests** - Ensure 80%+ coverage
4. **Create Integration Tests** - Test tRPC endpoints
5. **Add Frontend Tests** - Test React hooks and components
