# Test Coverage Strategy

## Overview

Arbor follows a comprehensive testing strategy with strict coverage requirements to ensure system durability and reliability.

## Coverage Thresholds

### Unit Tests
- **Target**: ≥80% line and branch coverage
- **Rationale**: Unit tests are fast, cheap to maintain, and provide high confidence in individual components
- **Scope**: Individual functions, classes, and components in isolation

### Integration Tests
- **Target**: ≥50% line and branch coverage
- **Rationale**: Higher runtime and maintenance costs, but critical for testing component interactions
- **Scope**: Multiple components working together, database operations, API endpoints

### End-to-End (E2E) Tests
- **Target**: ≥30% line and branch coverage
- **Rationale**: Focus on critical user paths, not comprehensive coverage
- **Scope**: Complete user workflows from UI to database

## Running Tests

### All Tests
```bash
make test
```

### Unit Tests Only
```bash
make test-unit
# or
pnpm run test:unit
```

### Integration Tests Only
```bash
make test-integration
# or
pnpm run test:integration
```

### E2E Tests Only
```bash
make test-e2e
# or
pnpm run test:e2e
```

### With Coverage Reports
```bash
make test-coverage
# or
pnpm run test:coverage
```

### Individual Coverage Reports
```bash
# Unit tests only
pnpm run test:coverage:unit

# Integration tests only
pnpm run test:coverage:integration
```

## Coverage Reports

Coverage reports are generated in separate directories:

- **API Unit**: `./coverage/api-unit/index.html`
- **API Integration**: `./coverage/api-integration/index.html`
- **Web Unit**: `./apps/web/coverage/index.html`
- **Web Integration**: `./apps/web/coverage-integration/index.html`
- **Web E2E**: `./apps/web/coverage-e2e/index.html`

## Configuration Files

### API (Root Level)
- **Unit**: `vitest.config.ts`
- **Integration**: `vitest.integration.config.ts`

### Web App
- **Unit**: `apps/web/vitest.config.ts`
- **Integration**: `apps/web/vitest.integration.config.ts`
- **E2E**: `apps/web/vitest.e2e.config.ts`

## Test Organization

```
tests/
├── unit/                    # Unit tests (80% coverage target)
│   ├── services/
│   ├── utils/
│   └── components/
├── integration/             # Integration tests (50% coverage target)
│   ├── api/
│   ├── database/
│   └── trpc/
└── e2e/                     # End-to-end tests (30% coverage target)
    └── critical-paths/
```

## Best Practices

### Unit Tests
- ✅ Test individual functions/components in isolation
- ✅ Mock external dependencies
- ✅ Fast execution (< 100ms per test)
- ✅ High coverage of edge cases and error paths
- ❌ No database or network calls
- ❌ No file system operations

### Integration Tests
- ✅ Test multiple components working together
- ✅ Real database operations (with test database)
- ✅ Real API calls (to test server)
- ✅ Focus on happy paths and critical error scenarios
- ❌ No mocks for integration points (database, Redis, etc.)
- ❌ Avoid testing every edge case (that's for unit tests)

### E2E Tests
- ✅ Test complete user workflows
- ✅ Focus on critical business paths
- ✅ Synthetic user interactions
- ✅ Real browser environment (when applicable)
- ❌ Don't test every feature
- ❌ Don't duplicate unit/integration test coverage

## TDD Workflow

1. **Write failing test first** ✍️
2. **Run test to confirm it fails** ❌
3. **Write minimal code to pass** ✅
4. **Run test to confirm it passes** ✅
5. **Refactor if needed** 🔄
6. **Run test again to ensure still passing** ✅
7. **Check coverage** 📊
8. **Repeat** 🔁

## Coverage Enforcement

Coverage thresholds are enforced in CI/CD:
- Unit tests must meet 80% threshold or build fails
- Integration tests must meet 50% threshold or build fails
- E2E tests must meet 30% threshold or build fails

## Viewing Coverage Reports

After running tests with coverage:

```bash
# Open in browser
open coverage/api-unit/index.html
open apps/web/coverage/index.html
```

Or use the Makefile:
```bash
make test-coverage
# Reports are automatically generated and paths are displayed
```

