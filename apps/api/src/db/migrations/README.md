# Database Migrations

This directory contains versioned database migrations for Arbor.

## Migration Workflow

### 1. Making Schema Changes

Edit the schema in `apps/api/src/db/schema.ts`:

```typescript
// Example: Add a new column
export const nodes = pgTable("nodes", {
  // ... existing columns ...
  newColumn: varchar("new_column", { length: 255 }),
});
```

### 2. Generate Migration

```bash
make db-generate
# or
pnpm run db:generate
```

This creates a new migration file in this directory with a timestamp and descriptive name.

### 3. Review the Migration

**IMPORTANT:** Always review the generated SQL before applying it!

Check the new `.sql` file in this directory to ensure:

- The changes match your intent
- No data will be lost unintentionally
- Indexes are created appropriately
- Foreign keys are correct

### 4. Apply Migration

```bash
make db-migrate
# or
pnpm run db:migrate
```

This runs all pending migrations in order.

### 5. Commit the Migration

```bash
git add apps/api/src/db/migrations/
git commit -m "feat: add new_column to nodes table"
```

## Migration Files

Each migration consists of:

- `XXXX_description.sql` - The SQL migration file
- `meta/XXXX_snapshot.json` - Schema snapshot for that migration
- `meta/_journal.json` - Migration history journal

## Best Practices

### ✅ DO:

- **Always use migrations** for schema changes in production
- **Review generated SQL** before applying
- **Test migrations** on a copy of production data
- **Keep migrations small** and focused on one change
- **Commit migrations** to version control
- **Run migrations** as part of deployment process

### ❌ DON'T:

- **Don't use `db:push`** in production (it can lose data)
- **Don't edit** existing migration files after they've been applied
- **Don't delete** migration files
- **Don't skip** reviewing generated SQL

## Rollback Strategy

Drizzle doesn't have built-in rollback. To rollback:

1. **Create a new migration** that reverses the changes
2. **Or restore** from database backup

Example rollback migration:

```bash
# Generate a new migration that removes the column
pnpm run db:generate
# Edit the generated SQL to drop the column
# Apply the rollback migration
make db-migrate
```

## Troubleshooting

### Migration fails with "relation already exists"

The migration was already applied. Check `meta/_journal.json` to see applied migrations.

### Need to reset database completely

```bash
make db-reset  # ⚠️ Destroys all data!
```

### Migration conflicts

If multiple developers create migrations simultaneously:

1. Pull latest migrations from git
2. Regenerate your migration
3. Review and resolve conflicts
4. Test thoroughly

## Migration vs Push

| Command           | Use Case                              | Safety                   |
| ----------------- | ------------------------------------- | ------------------------ |
| `make db-migrate` | Production, staging, team development | ✅ Safe - preserves data |
| `make db-push`    | Local development only, prototyping   | ⚠️ Can lose data         |

**Default:** Always use `make db-migrate` unless you're prototyping and don't care about data.
