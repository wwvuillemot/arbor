# Development Guidelines

## Core Principles

### 1. Test-Driven Development (TDD)

**Red → Green → Refactor**

1. **Write a failing test first** - Define expected behavior
2. **Write minimal code to pass** - Make the test green
3. **Refactor** - Improve code quality while keeping tests green
4. **Repeat** - For every feature, bug fix, or change

**Rules:**
- ✅ **No code without tests** - Every feature must have tests
- ✅ **Write tests before implementation** - TDD, not "tests after"
- ✅ **If something breaks, write a failing test first** - Then fix it
- ✅ **Test coverage must improve over time** - Never decrease TCC

### 2. Makefile-Driven Workflow

**All commands go through `make`** - Consistent interface for humans and AI

**Never run directly:**
- ❌ `pnpm install`
- ❌ `pnpm test`
- ❌ `docker-compose up`

**Always use make:**
- ✅ `make install`
- ✅ `make test`
- ✅ `make dev`

**Why?**
- Consistent commands across all services
- Orchestration logic in one place
- Easy to add pre/post hooks
- Self-documenting (`make help`)

### 3. Test Coverage Requirements

**Current Status:** 62.95% (as of 2024-02-08)

**Goal:** Meet or exceed Test Coverage Ceiling (TCC) across all systems

**Rules:**
- ✅ **Coverage must improve over time** - Each PR should increase TCC
- ✅ **New code must be well-tested** - Aim for 80%+ on new features
- ✅ **No coverage regressions** - CI fails if coverage decreases
- ✅ **Track coverage per service** - Backend, Web, Desktop, MCP

**Coverage Targets:**
- **Phase 0-1:** Maintain 60%+ (current baseline)
- **Phase 2-3:** Reach 70%+
- **Phase 4-5:** Reach 80%+

### 4. Atomic Commits

**Commit at logical breakpoints** - After `make preflight` passes

**Workflow:**
```bash
# 1. Make changes (TDD: test first, then code)
# 2. Run preflight checks
make preflight

# 3. If passes, commit atomically
git add -A
git commit -m "feat: descriptive commit message

- Bullet point of what changed
- Why it changed
- Any breaking changes or migrations"

# 4. If fails, fix and repeat
```

**Commit Message Format:**
```
<type>: <short summary>

<detailed description>
- Bullet points for changes
- Test coverage impact
- Breaking changes (if any)
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring (no behavior change)
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Build, CI, dependencies
- `perf:` - Performance improvements

### 5. Preflight Checks

**Before every commit, run:**
```bash
make preflight
```

**What it does:**
1. `make format` - Auto-format code (Prettier)
2. `make lint` - Check code quality (ESLint)
3. `make test` - Run all tests
4. `make coverage` - Check test coverage

**Only commit if all checks pass** ✅

---

## Development Workflow

### Starting a New Feature

```bash
# 1. Create a branch (optional, for larger features)
git checkout -b feature/my-feature

# 2. Write a failing test
# apps/api/src/services/my-feature.test.ts

# 3. Run tests (should fail)
make test

# 4. Implement the feature
# apps/api/src/services/my-feature.ts

# 5. Run tests (should pass)
make test

# 6. Refactor if needed
# Keep tests green

# 7. Run preflight
make preflight

# 8. Commit atomically
git add -A
git commit -m "feat: add my feature

- Implemented X functionality
- Added Y tests
- Coverage: +2.5%"
```

### Fixing a Bug

```bash
# 1. Write a failing test that reproduces the bug
# This is CRITICAL - proves the bug exists

# 2. Run tests (should fail)
make test

# 3. Fix the bug
# Minimal change to make test pass

# 4. Run tests (should pass)
make test

# 5. Run preflight
make preflight

# 6. Commit atomically
git add -A
git commit -m "fix: resolve issue with X

- Added regression test
- Fixed Y behavior
- Coverage: +1.2%"
```

### Adding a New Make Command

**If a command doesn't exist, add it!**

```makefile
# Root Makefile (orchestrator)
.PHONY: my-command
my-command:
	@echo "Running my-command across all services..."
	@$(MAKE) -C apps/api my-command
	@$(MAKE) -C apps/web my-command
	@$(MAKE) -C apps/desktop my-command

# Service-specific Makefile (e.g., apps/api/Makefile)
.PHONY: my-command
my-command:
	@echo "Running my-command for API service..."
	pnpm run my-command
```

**Common commands to add:**
- `make build` - Build for production
- `make watch` - Watch mode for development
- `make clean` - Clean build artifacts
- `make migrate` - Run database migrations
- `make seed` - Seed database with test data

---

## Make Commands Reference

### Root Commands (Orchestrator)

```bash
make help          # Show all available commands
make install       # Install dependencies for all services
make dev           # Start all services in development mode
make test          # Run tests for all services
make coverage      # Generate coverage reports
make lint          # Lint all services
make format        # Format all services
make preflight     # Run format → lint → test → coverage
make clean         # Clean all build artifacts
make docker-up     # Start Docker services (PostgreSQL, Redis, etc.)
make docker-down   # Stop Docker services
make docker-logs   # View Docker logs
```

### Service-Specific Commands

```bash
# Run command for specific service
make -C apps/api test
make -C apps/web dev
make -C apps/desktop build
```

---

## Test Coverage Tracking

### Check Current Coverage

```bash
make coverage
```

### Coverage Reports

- **Terminal:** Summary in console
- **HTML:** `coverage/index.html` (open in browser)
- **JSON:** `coverage/coverage-summary.json` (for CI)

### Coverage by Service

```bash
# API service
make -C apps/api coverage

# Web service
make -C apps/web coverage

# Desktop service
make -C apps/desktop coverage
```

### Coverage Goals

| Service | Current | Phase 1 | Phase 3 | Phase 5 |
|---------|---------|---------|---------|---------|
| API     | 60%     | 65%     | 75%     | 85%     |
| Web     | 63%     | 65%     | 75%     | 85%     |
| Desktop | 60%     | 65%     | 70%     | 80%     |
| MCP     | N/A     | 80%     | 85%     | 90%     |

---

## CI/CD Integration

### GitHub Actions (Future)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: make install
      - run: make preflight
      - run: make coverage
      - name: Check coverage threshold
        run: |
          # Fail if coverage < 60%
          # Fail if coverage decreased from main
```

---

## Best Practices

### ✅ Do

- Write tests first (TDD)
- Use `make` commands for everything
- Run `make preflight` before committing
- Commit atomically at logical breakpoints
- Improve test coverage with every PR
- Add new `make` commands when needed
- Document breaking changes in commits

### ❌ Don't

- Skip writing tests
- Run `pnpm` or `npm` directly
- Commit without running `make preflight`
- Decrease test coverage
- Make large, multi-purpose commits
- Break existing tests without fixing them
- Push broken code to main

---

## Questions?

If you're unsure about:
- **What to test?** - Test behavior, not implementation
- **How much to test?** - Aim for 80%+ on new code
- **When to commit?** - After `make preflight` passes
- **What make command?** - Run `make help` or add a new one

**Remember:** Quality over speed. Better to ship slowly with high confidence than quickly with bugs.

