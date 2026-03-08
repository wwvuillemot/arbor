import { and, between, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { nodeHistory, type NodeHistory } from "../db/schema";
import type { AuditLogFilterParams } from "./provenance-types";

const AUDIT_CSV_HEADER = "id,nodeId,version,actorType,actorId,action,createdAt";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAuditLogWhereClause(
  params: AuditLogFilterParams,
): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];

  if (params.actorType) {
    conditions.push(eq(nodeHistory.actorType, params.actorType));
  }

  if (params.action) {
    conditions.push(eq(nodeHistory.action, params.action));
  }

  if (params.startDate && params.endDate) {
    conditions.push(
      between(nodeHistory.createdAt, params.startDate, params.endDate),
    );
  }

  if (params.nodeId) {
    conditions.push(eq(nodeHistory.nodeId, params.nodeId));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function formatAuditCsv(entries: NodeHistory[]): string {
  const rows = entries.map((entry) => {
    const actorId = (entry.actorId ?? "").replace(/,/g, ";");
    return `${entry.id},${entry.nodeId},${entry.version},${entry.actorType},${actorId},${entry.action},${entry.createdAt.toISOString()}`;
  });

  return [AUDIT_CSV_HEADER, ...rows].join("\n");
}

export function formatAuditHtml(
  entries: NodeHistory[],
  generatedAt: Date = new Date(),
): string {
  const tableRows = entries
    .map(
      (entry) =>
        `<tr><td>${entry.version}</td><td>${entry.actorType}</td><td>${escapeHtml(entry.actorId ?? "")}</td><td>${entry.action}</td><td>${entry.nodeId}</td><td>${entry.createdAt.toISOString()}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Audit Report</title>
  <style>
    body { font-family: sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .meta { color: #666; margin-bottom: 16px; }
    @media print { body { padding: 0; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <h1>Audit Report</h1>
  <p class="meta">Generated: ${generatedAt.toISOString()} | Entries: ${entries.length}</p>
  <table>
    <thead><tr><th>Version</th><th>Actor</th><th>Actor ID</th><th>Action</th><th>Node ID</th><th>Timestamp</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}
