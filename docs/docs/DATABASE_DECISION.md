# Database Decision: PostgreSQL vs SQLite

## TL;DR: **PostgreSQL Recommended** for Node-Based Architecture

## Comparison Matrix

| Feature                  | PostgreSQL                 | SQLite                      | Winner        |
| ------------------------ | -------------------------- | --------------------------- | ------------- |
| **JSONB Support**        | Native, indexed, queryable | JSON functions, no indexing | 🏆 PostgreSQL |
| **Vector Search**        | pgvector (mature)          | sqlite-vss (newer)          | 🏆 PostgreSQL |
| **Recursive CTEs**       | Excellent optimizer        | Supported, slower           | 🏆 PostgreSQL |
| **Single File**          | No (directory)             | Yes                         | 🏆 SQLite     |
| **Git Friendly**         | pg_dump or JSON export     | Direct file commit          | 🏆 SQLite     |
| **Setup Complexity**     | Docker required            | Zero dependencies           | 🏆 SQLite     |
| **Performance (reads)**  | Excellent                  | Excellent                   | 🤝 Tie        |
| **Performance (writes)** | Better concurrency         | Single writer               | 🏆 PostgreSQL |
| **Scalability**          | Multi-device ready         | Local only                  | 🏆 PostgreSQL |
| **Query Power**          | Advanced features          | Basic SQL                   | 🏆 PostgreSQL |

## Why PostgreSQL Wins for Your Use Case

### 1. JSONB is Critical for Node-Based Model

**PostgreSQL**:

```sql
-- Query inside metadata
SELECT * FROM nodes
WHERE metadata @> '{"tags": ["writing"]}';

-- Index JSONB fields
CREATE INDEX idx_tags ON nodes USING GIN((metadata->'tags'));

-- Update nested JSONB
UPDATE nodes
SET metadata = jsonb_set(metadata, '{word_count}', '1500')
WHERE id = $1;
```

**SQLite**:

```sql
-- Less efficient, no indexing
SELECT * FROM nodes
WHERE json_extract(metadata, '$.tags') LIKE '%writing%';
```

### 2. Vector Search is First-Class

**PostgreSQL + pgvector**:

- Production-ready, used by major companies
- Efficient HNSW and IVFFlat indexes
- Native vector operations (`<=>`, `<->`, `<#>`)
- Hybrid search (text + vector) in single query

**SQLite + sqlite-vss**:

- Newer, less battle-tested
- Limited index options
- Requires separate extension compilation

### 3. Your Queries Will Be Complex

With node-based hierarchy, you'll frequently:

- Traverse trees (recursive CTEs)
- Filter by JSONB metadata
- Combine semantic + keyword search
- Aggregate across subtrees

PostgreSQL's query optimizer handles this much better.

### 4. Git Integration Still Works

**Option 1: JSON Export**

```bash
# Export all nodes as JSON (human-readable, Git-friendly)
psql -c "COPY (SELECT * FROM nodes) TO STDOUT WITH (FORMAT json)" > backup.json
git add backup.json && git commit -m "Backup notes"
```

**Option 2: SQL Dump**

```bash
# Export as SQL (complete schema + data)
pg_dump writing_assistant > backup.sql
git add backup.sql && git commit -m "Backup database"
```

**Option 3: Markdown Export**

```typescript
// Export notes as individual .md files
async function exportToMarkdown() {
  const notes = await db.query("SELECT * FROM nodes WHERE type = $1", ["note"]);
  for (const note of notes) {
    const path = await getNodePath(note.id); // Get folder hierarchy
    fs.writeFileSync(`${path}/${note.slug}.md`, note.content);
  }
}
```

## When to Choose SQLite Instead

Choose SQLite if:

- ✅ You want **zero Docker dependencies**
- ✅ You prioritize **simplicity over features**
- ✅ You're okay with **basic JSONB queries**
- ✅ You don't need **advanced vector search**
- ✅ You want **single-file portability**

## Hybrid Approach: Start SQLite, Migrate Later

You can start with SQLite and migrate to PostgreSQL later:

1. Use an ORM (Drizzle, Prisma) that supports both
2. Keep schema identical (both support JSONB-like JSON)
3. Migrate when you hit SQLite limitations

**Migration path**:

```bash
# Export from SQLite
sqlite3 data.db .dump > dump.sql

# Import to PostgreSQL (with minor syntax fixes)
psql writing_assistant < dump.sql
```

## Final Recommendation

**Use PostgreSQL** because:

1. Your node-based model relies heavily on JSONB
2. RAG/vector search is a core feature
3. Complex tree queries need good optimization
4. Docker is already in your stack (for Redis)
5. Future-proof for multi-device sync

**Trade-off**: Slightly more complex setup, but Docker Compose makes this trivial.

## Example: Node Query Performance

**Get all notes in a folder subtree with specific tags**:

```sql
-- PostgreSQL: Single efficient query
WITH RECURSIVE tree AS (
  SELECT id FROM nodes WHERE slug = 'projects'
  UNION ALL
  SELECT n.id FROM nodes n
  JOIN tree t ON n.parent_id = t.id
)
SELECT n.* FROM nodes n
JOIN tree t ON n.id = t.id
WHERE n.type = 'note'
  AND n.metadata @> '{"tags": ["writing"]}'
  AND n.deleted_at IS NULL;
```

This query is:

- ✅ Fast with proper indexes
- ✅ Readable and maintainable
- ✅ Leverages PostgreSQL's strengths

In SQLite, you'd need multiple queries or complex JSON string parsing.

---

**Decision**: Use **PostgreSQL** with **pgvector** for optimal node-based, semi-structured data with vector search.
