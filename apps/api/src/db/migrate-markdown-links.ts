/**
 * Migration: Convert embedded markdown links in TipTap JSON to proper link marks.
 *
 * Two cases handled:
 *  1. Text nodes containing literal "[text](url)" → split into proper link marks.
 *  2. Inline-content sequences where "[" and "](url)" are split across nodes due to
 *     bold/italic marks on the link text — flattens to markdown, re-parses.
 *
 * Run with:
 *   DATABASE_URL="..." pnpm tsx apps/api/src/db/migrate-markdown-links.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://arbor:local_dev_only@postgres.arbor.local:5432/arbor_dev";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ── Inline parser (mirrors mcp-integration-service markdownToTipTap's parseInline) ──

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function parseInline(text: string): unknown[] {
  const nodes: unknown[] = [];
  const pattern =
    /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last)
      nodes.push({ type: "text", text: text.slice(last, m.index) });
    const [, , bi, b, b2, it, it2, code, linkText, linkHref] = m;
    if (bi)
      nodes.push({
        type: "text",
        marks: [{ type: "bold" }, { type: "italic" }],
        text: bi,
      });
    else if (b || b2)
      nodes.push({ type: "text", marks: [{ type: "bold" }], text: b || b2 });
    else if (it || it2)
      nodes.push({
        type: "text",
        marks: [{ type: "italic" }],
        text: it || it2,
      });
    else if (code)
      nodes.push({ type: "text", marks: [{ type: "code" }], text: code });
    else if (linkHref !== undefined && linkText !== undefined) {
      nodes.push({
        type: "text",
        marks: [{ type: "link", attrs: { href: linkHref } }],
        text: linkText,
      });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return (nodes as any[]).filter((n) => n.type !== "text" || n.text);
}

// ── Helpers ──

/** Convert a TipTap inline node back to markdown string for re-parsing. */
function nodeToMarkdown(node: any): string {
  if (node.type !== "text") return ""; // skip non-text (e.g. hardBreak) — shouldn't appear in inline
  const text = node.text ?? "";
  const marks: string[] = (node.marks ?? []).map((m: any) => m.type);
  // Only re-escape marks that could fragment a link. Don't try to round-trip code marks
  // because backtick content shouldn't contain links anyway.
  if (marks.includes("bold") && marks.includes("italic"))
    return `***${text}***`;
  if (marks.includes("bold")) return `**${text}**`;
  if (marks.includes("italic")) return `_${text}_`;
  return text; // plain text, link marks are ignored (we're re-parsing to fix them)
}

/** Return true if the inline content array, when concatenated as plain text, contains "[..](". */
function inlineHasBrokenLink(inlineNodes: any[]): boolean {
  const flat = inlineNodes.map((n: any) => n.text ?? "").join("");
  MD_LINK_RE.lastIndex = 0;
  return MD_LINK_RE.test(flat);
}

/** Re-process an inline content array:
 *  1. Flatten all nodes to markdown text.
 *  2. Re-parse with full parseInline.
 *  Returns [newNodes, changed]. */
function fixInlineContent(inlineNodes: any[]): [unknown[], boolean] {
  const md = inlineNodes.map(nodeToMarkdown).join("");
  MD_LINK_RE.lastIndex = 0;
  if (!MD_LINK_RE.test(md)) return [inlineNodes, false];

  const reparsed = parseInline(md);

  // Only replace if something actually changed
  const before = JSON.stringify(inlineNodes);
  const after = JSON.stringify(reparsed);
  if (before === after) return [inlineNodes, false];

  return [reparsed, true];
}

/** Walk a TipTap node tree, fixing broken links in inline content arrays. */
function walkNode(node: any): [any, boolean] {
  // Leaf text node — Case 1: literal "[text](url)" in a plain text node.
  if (node.type === "text") {
    const hasNoLinkMark = !node.marks?.some((m: any) => m.type === "link");
    if (hasNoLinkMark && typeof node.text === "string") {
      MD_LINK_RE.lastIndex = 0;
      if (MD_LINK_RE.test(node.text)) {
        const replacement = parseInline(node.text);
        return [replacement, true];
      }
    }
    return [node, false];
  }

  if (!node.content || !Array.isArray(node.content)) return [node, false];

  // Inline container (paragraph, heading, listItem>paragraph, etc.):
  // Check if the whole inline sequence has a broken link pattern.
  const isInlineContainer =
    ["paragraph", "heading", "blockquote"].includes(node.type) ||
    node.content.every((c: any) => c.type === "text" || c.type === "hardBreak");

  if (isInlineContainer && inlineHasBrokenLink(node.content)) {
    const [fixed, changed] = fixInlineContent(node.content);
    if (changed) return [{ ...node, content: fixed }, true];
  }

  // Recurse into children
  let changed = false;
  const newContent: unknown[] = [];
  for (const child of node.content) {
    const [result, childChanged] = walkNode(child);
    if (childChanged) {
      changed = true;
      if (Array.isArray(result)) {
        newContent.push(...result);
      } else {
        newContent.push(result);
      }
    } else {
      newContent.push(child);
    }
  }

  if (!changed) return [node, false];
  return [{ ...node, content: newContent }, true];
}

// ── Main ──

async function run() {
  console.log("Scanning nodes for embedded markdown links...");

  const rows = await db.execute(sql`
    SELECT id, content
    FROM nodes
    WHERE content IS NOT NULL
      AND content::text LIKE '%](%'
  `);

  console.log(`Found ${rows.length} candidate nodes.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const { id, content } = row as { id: string; content: unknown };
    if (!content || typeof content !== "object") {
      skipped++;
      continue;
    }

    try {
      const [newContent, changed] = walkNode(content);
      if (!changed) {
        skipped++;
        continue;
      }

      await db.execute(sql`
        UPDATE nodes
        SET content = ${JSON.stringify(newContent)}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
      `);
      console.log(`  Updated node ${id}`);
      updated++;
    } catch (err) {
      console.error(`  ERROR on node ${id}:`, err);
      errors++;
    }
  }

  console.log(
    `\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
  );
  await client.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
