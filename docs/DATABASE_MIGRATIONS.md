# Database Migrations Guide

Arbor uses **Drizzle ORM** with a proper migration system to manage database schema changes safely and with version control.

## Quick Reference

```bash
# Generate migration from schema changes
make db-generate

# Apply pending migrations
make db-migrate

# Open database GUI
make db-studio

# Seed database with example data
make seed
```

## Why Migrations?

### ✅ Benefits of Migrations:
- **Version Control**: Schema changes are tracked in git
- **Data Safety**: Migrations preserve existing data
- **Rollback**: Can revert changes if needed
- **Team Collaboration**: Everyone gets the same schema
- **Production Ready**: Safe to run in production

### ❌ Problems with `db:push`:
- **Data Loss**: Can drop and recreate tables
- **No History**: No record of what changed
- **No Rollback**: Can't undo changes
- **Dangerous**: Not safe for production

## Migration Workflow

### 1. Edit Schema

Make changes to `apps/api/src/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const nodes = pgTable("nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  // Add new column:
  description: varchar("description", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 2. Generate Migration

```bash
make db-generate
```

This creates a new file in `apps/api/src/db/migrations/` like:
- `0001_cool_name.sql` - The SQL migration
- `meta/0001_snapshot.json` - Schema snapshot
- Updates `meta/_journal.json` - Migration history

### 3. Review Generated SQL

**CRITICAL:** Always review the generated SQL before applying!

```bash
cat apps/api/src/db/migrations/0001_*.sql
```

Check for:
- ✅ Correct column types
- ✅ Proper indexes
- ✅ Foreign key constraints
- ✅ No unintended data loss

### 4. Apply Migration

```bash
make db-migrate
```

This runs all pending migrations in order.

### 5. Commit to Git

```bash
git add apps/api/src/db/migrations/
git add apps/api/src/db/schema.ts
git commit -m "feat: add description field to nodes"
```

## Common Scenarios

### Adding a Column

```typescript
// schema.ts
export const nodes = pgTable("nodes", {
  // ... existing columns ...
  newField: varchar("new_field", { length: 255 }),
});
```

```bash
make db-generate  # Creates migration
make db-migrate   # Applies migration
```

### Adding an Index

```typescript
// schema.ts
export const nodes = pgTable("nodes", {
  // ... columns ...
}, (table) => ({
  nameIdx: index("idx_nodes_name").on(table.name),
}));
```

### Renaming a Column

**WARNING:** Drizzle sees this as DROP + ADD, which loses data!

Instead, do it manually:

1. Generate empty migration: `make db-generate`
2. Edit the SQL file:
```sql
ALTER TABLE nodes RENAME COLUMN old_name TO new_name;
```
3. Update schema.ts to match
4. Apply: `make db-migrate`

### Adding a Foreign Key

```typescript
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id").references(() => nodes.id, { onDelete: "cascade" }),
});
```

## Rollback Strategy

Drizzle doesn't have automatic rollback. Options:

### Option 1: Create Reverse Migration

```bash
# Edit schema.ts to remove the change
make db-generate
# Review the generated SQL
make db-migrate
```

### Option 2: Database Backup/Restore

```bash
# Before risky migration:
docker exec arbor-postgres pg_dump -U arbor arbor > backup.sql

# If something goes wrong:
docker exec -i arbor-postgres psql -U arbor arbor < backup.sql
```

## Team Collaboration

### Pulling Changes

```bash
git pull
make db-migrate  # Apply any new migrations
```

### Migration Conflicts

If two developers create migrations simultaneously:

1. Pull latest: `git pull`
2. Regenerate your migration: `make db-generate`
3. Review conflicts in generated SQL
4. Test thoroughly
5. Commit

## Production Deployment

```bash
# In CI/CD pipeline:
pnpm run db:migrate

# Or manually:
make db-migrate
```

**Never use `db:push` in production!**

## Troubleshooting

### "relation already exists"

Migration was already applied. Check:
```bash
docker exec arbor-postgres psql -U arbor -d arbor -c "SELECT * FROM drizzle.__drizzle_migrations;"
```

### Need to start fresh

```bash
make db-reset  # ⚠️ DESTROYS ALL DATA
```

### Migration fails mid-way

Drizzle runs migrations in a transaction, so partial failures rollback automatically.

## Best Practices

1. **Always review** generated SQL before applying
2. **Test migrations** on a copy of production data
3. **Keep migrations small** - one logical change per migration
4. **Never edit** applied migrations
5. **Always commit** migrations with schema changes
6. **Backup before** risky migrations
7. **Use migrations** even in local development

## Reference

- [Drizzle Migrations Docs](https://orm.drizzle.team/docs/migrations)
- [Migration Files](../apps/api/src/db/migrations/)
- [Schema Definition](../apps/api/src/db/schema.ts)

