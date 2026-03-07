/**
 * Fix broken link hrefs and convert markdown link syntax to TipTap link marks.
 *
 * 1. Remaps fabricated "https://arbor/..." hrefs to "?node=<uuid>" by looking up
 *    the node name from the URL's last path segment.
 * 2. Converts broken italic-split markdown links (e.g. [text_with_italic](url))
 *    to proper TipTap link marks using paragraph-level flattening.
 *
 * Run with:
 *   DATABASE_URL="..." pnpm tsx apps/api/src/db/fix-broken-links.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://arbor:local_dev_only@postgres.arbor.local:5432/arbor_dev";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ── Inline parser ──────────────────────────────────────────────────────────────

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

function nodeToMarkdown(node: any): string {
  if (node.type !== "text") return "";
  const text = node.text ?? "";
  const marks: string[] = (node.marks ?? []).map((m: any) => m.type);
  if (marks.includes("link")) return text; // link mark stripped — we re-parse to reconstruct
  if (marks.includes("bold") && marks.includes("italic"))
    return `***${text}***`;
  if (marks.includes("bold")) return `**${text}**`;
  if (marks.includes("italic")) return `_${text}_`;
  return text;
}

function inlineHasBrokenLink(inlineNodes: any[]): boolean {
  const flat = inlineNodes.map((n: any) => n.text ?? "").join("");
  MD_LINK_RE.lastIndex = 0;
  return MD_LINK_RE.test(flat);
}

function fixInlineContent(inlineNodes: any[]): [unknown[], boolean] {
  const md = inlineNodes.map(nodeToMarkdown).join("");
  MD_LINK_RE.lastIndex = 0;
  if (!MD_LINK_RE.test(md)) return [inlineNodes, false];
  const reparsed = parseInline(md);
  const before = JSON.stringify(inlineNodes);
  const after = JSON.stringify(reparsed);
  if (before === after) return [inlineNodes, false];
  return [reparsed, true];
}

// ── Step 1: Remap fabricated "https://arbor/..." hrefs to "?node=uuid" ────────

function remapArborHrefs(
  node: any,
  nameToId: Map<string, string>,
): [any, boolean] {
  if (node.type === "text") {
    const marks = node.marks ?? [];
    let changed = false;
    const newMarks = marks.map((m: any) => {
      if (m.type !== "link") return m;
      const href: string = m.attrs?.href ?? "";
      try {
        const url = new URL(href);
        if (url.hostname === "arbor" || url.hostname.endsWith(".arbor")) {
          const seg = url.pathname.split("/").filter(Boolean).pop() ?? "";
          const uuid = nameToId.get(seg);
          if (uuid) {
            changed = true;
            return { type: "link", attrs: { href: `?node=${uuid}` } };
          }
        }
      } catch {
        /* not a URL */
      }
      return m;
    });
    if (!changed) return [node, false];
    return [{ ...node, marks: newMarks }, true];
  }
  if (!node.content || !Array.isArray(node.content)) return [node, false];
  let changed = false;
  const newContent = node.content.map((child: any) => {
    const [newChild, c] = remapArborHrefs(child, nameToId);
    if (c) changed = true;
    return newChild;
  });
  if (!changed) return [node, false];
  return [{ ...node, content: newContent }, true];
}

// ── Step 2: Convert broken italic-split markdown links to proper link marks ───

function fixBrokenLinks(node: any): [any, boolean] {
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

  // Paragraph-level fix for italic-split links
  const isInlineContainer =
    ["paragraph", "heading"].includes(node.type) ||
    node.content.every((c: any) => c.type === "text" || c.type === "hardBreak");

  if (isInlineContainer && inlineHasBrokenLink(node.content)) {
    const [fixed, changed] = fixInlineContent(node.content);
    if (changed) return [{ ...node, content: fixed }, true];
  }

  let changed = false;
  const newContent: unknown[] = [];
  for (const child of node.content) {
    const [result, childChanged] = fixBrokenLinks(child);
    if (childChanged) {
      changed = true;
      if (Array.isArray(result)) newContent.push(...result);
      else newContent.push(result);
    } else {
      newContent.push(child);
    }
  }
  if (!changed) return [node, false];
  return [{ ...node, content: newContent }, true];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  // Build name→uuid lookup from ALL nodes
  console.log("Building node name lookup...");
  const allNodes = await db.execute(sql`SELECT id, name FROM nodes`);
  const nameToId = new Map<string, string>();
  for (const row of allNodes) {
    nameToId.set(row.name as string, row.id as string);
  }
  console.log(`Loaded ${nameToId.size} node names.`);

  // Find candidates
  const rows = await db.execute(sql`
    SELECT id, name, content
    FROM nodes
    WHERE content IS NOT NULL
      AND (
        content::text LIKE '%](%'
        OR content::text LIKE '%"href": "https://arbor/%'
        OR content::text LIKE '%"href":"https://arbor/%'
      )
  `);
  console.log(`Found ${rows.length} candidate nodes.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const { id, name, content } = row as {
      id: string;
      name: string;
      content: unknown;
    };
    if (!content || typeof content !== "object") {
      skipped++;
      continue;
    }

    try {
      let current = content;
      let anyChanged = false;

      // Pass 1: remap https://arbor/... hrefs
      const [remapped, remapChanged] = remapArborHrefs(current, nameToId);
      if (remapChanged) {
        current = remapped;
        anyChanged = true;
      }

      // Pass 2: fix broken italic-split markdown links
      const [fixed, fixChanged] = fixBrokenLinks(current);
      if (fixChanged) {
        current = fixed;
        anyChanged = true;
      }

      if (!anyChanged) {
        skipped++;
        continue;
      }

      await db.execute(sql`
        UPDATE nodes
        SET content = ${JSON.stringify(current)}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
      `);
      console.log(`  Updated: ${name} (${id})`);
      updated++;
    } catch (err) {
      console.error(`  ERROR on ${name} (${id}):`, err);
      errors++;
    }
  }

  console.log(
    `\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
  );
  await client.end();
}

run().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
