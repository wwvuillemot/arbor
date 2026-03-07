/**
 * Shared utilities for working with TipTap JSON documents on the client.
 */

/** Recursively find the first image node's src in a TipTap doc. */
export function extractHeroImage(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const node = content as Record<string, unknown>;
  if (node.type === "image")
    return (node.attrs as Record<string, string>)?.src ?? null;
  for (const child of (node.content as unknown[]) ?? []) {
    const found = extractHeroImage(child);
    if (found) return found;
  }
  return null;
}

/** Convert a TipTap inline node to markdown text. */
function inlineToMarkdown(n: unknown): string {
  if (!n || typeof n !== "object") return "";
  const node = n as Record<string, unknown>;
  if (node.type === "text") {
    let t: string = (node.text as string) ?? "";
    const marks: string[] = ((node.marks as { type: string }[]) ?? []).map(
      (m) => m.type,
    );
    if (marks.includes("bold")) t = `**${t}**`;
    if (marks.includes("italic")) t = `_${t}_`;
    if (marks.includes("code")) t = `\`${t}\``;
    return t;
  }
  if (node.type === "hardBreak") return "  \n";
  return ((node.content as unknown[]) ?? []).map(inlineToMarkdown).join("");
}

/** Convert a TipTap doc to a markdown string for preview rendering. */
export function tiptapToMarkdown(doc: unknown, limit = 500): string {
  const parts: string[] = [];

  function walk(n: unknown): void {
    if (!n || typeof n !== "object") return;
    const node = n as Record<string, unknown>;
    if (parts.join("").length >= limit) return;
    switch (node.type) {
      case "heading": {
        const level = "#".repeat(
          (node.attrs as { level?: number })?.level ?? 1,
        );
        parts.push(
          `${level} ${((node.content as unknown[]) ?? []).map(inlineToMarkdown).join("")}\n\n`,
        );
        break;
      }
      case "paragraph": {
        const text = ((node.content as unknown[]) ?? [])
          .map(inlineToMarkdown)
          .join("");
        if (text.trim()) parts.push(`${text}\n\n`);
        break;
      }
      case "bulletList":
        for (const item of (node.content as unknown[]) ?? []) {
          const itemNode = item as Record<string, unknown>;
          const text = ((itemNode.content as unknown[]) ?? [])
            .flatMap((p: unknown) => {
              const pn = p as Record<string, unknown>;
              return ((pn.content as unknown[]) ?? []).map(inlineToMarkdown);
            })
            .join("");
          parts.push(`- ${text}\n`);
        }
        parts.push("\n");
        break;
      case "orderedList":
        ((node.content as unknown[]) ?? []).forEach(
          (item: unknown, i: number) => {
            const itemNode = item as Record<string, unknown>;
            const text = ((itemNode.content as unknown[]) ?? [])
              .flatMap((p: unknown) => {
                const pn = p as Record<string, unknown>;
                return ((pn.content as unknown[]) ?? []).map(inlineToMarkdown);
              })
              .join("");
            parts.push(`${i + 1}. ${text}\n`);
          },
        );
        parts.push("\n");
        break;
      case "blockquote":
        for (const child of (node.content as unknown[]) ?? []) {
          walk(child);
          // prefix last part with >
          if (parts.length > 0) {
            parts[parts.length - 1] = parts[parts.length - 1]
              .split("\n")
              .map((l) => (l ? `> ${l}` : l))
              .join("\n");
          }
        }
        break;
      case "codeBlock": {
        const lang = (node.attrs as { language?: string })?.language ?? "";
        const code = ((node.content as unknown[]) ?? [])
          .map(
            (c: unknown) =>
              ((c as Record<string, unknown>).text as string) ?? "",
          )
          .join("");
        parts.push(`\`\`\`${lang}\n${code}\n\`\`\`\n\n`);
        break;
      }
      default:
        for (const child of (node.content as unknown[]) ?? []) {
          walk(child);
        }
    }
  }

  if (doc && typeof doc === "object") {
    const docNode = doc as Record<string, unknown>;
    for (const child of (docNode.content as unknown[]) ?? []) {
      walk(child);
      if (parts.join("").length >= limit) break;
    }
  }

  return parts.join("").slice(0, limit);
}
