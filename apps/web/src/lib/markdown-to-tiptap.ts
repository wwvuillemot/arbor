/**
 * Convert a Markdown string to TipTap/ProseMirror JSON format.
 * Handles: headings, paragraphs, bold, italic, inline code, code blocks,
 * bullet lists, ordered lists, blockquotes, horizontal rules, links, images,
 * and GitHub-style pipe tables.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: Mark[];
  text?: string;
};

function parseMarkdownTableCells(line: string): string[] | null {
  const trimmedLine = line.trim();
  if (!trimmedLine.includes("|")) return null;

  const rawCells = trimmedLine.split("|");
  if (trimmedLine.startsWith("|")) rawCells.shift();
  if (trimmedLine.endsWith("|")) rawCells.pop();

  if (rawCells.length < 2) return null;
  return rawCells.map((cellText) => cellText.trim());
}

function isMarkdownTableDelimiter(
  line: string,
  expectedColumnCount: number,
): boolean {
  const cells = parseMarkdownTableCells(line);
  if (!cells || cells.length !== expectedColumnCount) return false;

  return cells.every((cellText) => /^:?-{3,}:?$/.test(cellText));
}

function createTableCellNode(
  cellText: string,
  cellType: "tableCell" | "tableHeader",
  imageMap?: Map<string, string>,
): Node {
  return {
    type: cellType,
    content: [
      {
        type: "paragraph",
        content: parseInline(cellText, imageMap),
      },
    ],
  };
}

function createTableRowNode(
  cellTexts: string[],
  cellType: "tableCell" | "tableHeader",
  imageMap?: Map<string, string>,
): Node {
  return {
    type: "tableRow",
    content: cellTexts.map((cellText) =>
      createTableCellNode(cellText, cellType, imageMap),
    ),
  };
}

// ─── Inline parser ───────────────────────────────────────────────────────────

function parseInline(text: string, imageMap?: Map<string, string>): Node[] {
  const nodes: Node[] = [];
  // Pattern order matters: images before links, wikilinks, longer patterns first
  // Group 1: bold+italic, 2: bold**, 3: bold__, 4: italic_, 5: italic*,
  // 6: code, 7: link text, 8: link href, 9: img alt, 10: img src,
  // 11: wikilink display (optional, after |), 12: wikilink target
  const pattern =
    /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\)|\[\[([^\]|]+)(?:\|([^\]]+))?\]\])/gs;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    const [
      full,
      ,
      boldItalic,
      bold,
      bold2,
      italic,
      italic2,
      code,
      linkText,
      linkHref,
      imgAlt,
      imgSrc,
      wikilinkTarget,
      wikilinkDisplay,
    ] = match;

    if (boldItalic) {
      nodes.push({
        type: "text",
        marks: [{ type: "bold" }, { type: "italic" }],
        text: boldItalic,
      });
    } else if (bold || bold2) {
      nodes.push({
        type: "text",
        marks: [{ type: "bold" }],
        text: bold || bold2,
      });
    } else if (italic || italic2) {
      nodes.push({
        type: "text",
        marks: [{ type: "italic" }],
        text: italic || italic2,
      });
    } else if (code) {
      nodes.push({ type: "text", marks: [{ type: "code" }], text: code });
    } else if (linkHref !== undefined && linkText !== undefined) {
      // Parse inline bold/italic within the link text, then add the link mark
      const linkMark = { type: "link", attrs: { href: linkHref } };
      const innerNodes = parseInline(linkText);
      for (const inner of innerNodes) {
        nodes.push({
          ...inner,
          marks: [...(inner.marks ?? []), linkMark],
        });
      }
      if (innerNodes.length === 0) {
        nodes.push({ type: "text", marks: [linkMark], text: linkText });
      }
    } else if (imgSrc !== undefined) {
      // Resolve image src — may be a local path (keyed in imageMap) or a URL
      const resolvedSrc =
        imageMap?.get(imgSrc) ??
        imageMap?.get(imgSrc.split("/").pop() ?? "") ??
        imgSrc;
      nodes.push({
        type: "image",
        attrs: { src: resolvedSrc, alt: imgAlt ?? null, title: null },
      });
    } else if (wikilinkTarget !== undefined) {
      // Obsidian-style wikilink: [[Target]] or [[Target|Display Text]]
      // Strip any heading anchor ([[Page#Section]] → href "Page.md")
      // rewriteImportedInternalHref resolves it by basename
      const targetWithoutAnchor = wikilinkTarget.replace(/#.*$/, "").trim();
      const displayText = wikilinkDisplay ?? wikilinkTarget;
      const linkMark = {
        type: "link",
        attrs: { href: targetWithoutAnchor + ".md" },
      };
      nodes.push({ type: "text", marks: [linkMark], text: displayText });
    } else {
      nodes.push({ type: "text", text: full });
    }

    lastIndex = match.index + full.length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.filter(
    (n) => n.type !== "text" || (n.text && n.text.length > 0),
  );
}

// ─── Block parser ────────────────────────────────────────────────────────────

export function markdownToTipTap(
  markdown: string,
  imageMap?: Map<string, string>,
): { type: "doc"; content: Node[] } {
  const lines = markdown.split("\n");
  const content: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block
    if (line.match(/^```/)) {
      const lang = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // ── ATX Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2], imageMap),
      });
      i++;
      continue;
    }

    // ── Setext Heading (next line is === or ---)
    if (i + 1 < lines.length && lines[i + 1].match(/^=+\s*$/) && line.trim()) {
      content.push({
        type: "heading",
        attrs: { level: 1 },
        content: parseInline(line, imageMap),
      });
      i += 2;
      continue;
    }
    if (i + 1 < lines.length && lines[i + 1].match(/^-+\s*$/) && line.trim()) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: parseInline(line, imageMap),
      });
      i += 2;
      continue;
    }

    const tableHeaderCells = parseMarkdownTableCells(line);
    if (
      tableHeaderCells &&
      i + 1 < lines.length &&
      isMarkdownTableDelimiter(lines[i + 1], tableHeaderCells.length)
    ) {
      const tableRows: Node[] = [
        createTableRowNode(tableHeaderCells, "tableHeader", imageMap),
      ];
      i += 2;

      while (i < lines.length) {
        const bodyCells = parseMarkdownTableCells(lines[i]);
        if (!bodyCells || bodyCells.length !== tableHeaderCells.length) {
          break;
        }

        tableRows.push(createTableRowNode(bodyCells, "tableCell", imageMap));
        i++;
      }

      content.push({ type: "table", content: tableRows });
      continue;
    }

    // ── Horizontal rule
    if (
      line.match(/^(\s*[-*_]){3,}\s*$/) &&
      line.replace(/[\s\-*_]/g, "").length === 0
    ) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // ── Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const inner = markdownToTipTap(quoteLines.join("\n"), imageMap);
      content.push({ type: "blockquote", content: inner.content });
      continue;
    }

    // ── Unordered list
    if (line.match(/^[\s]*[-*+]\s/)) {
      const _indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      const items: Node[] = [];
      while (i < lines.length && lines[i].match(/^[\s]*[-*+]\s/)) {
        const text = lines[i].replace(/^[\s]*[-*+]\s/, "");
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: parseInline(text, imageMap) },
          ],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // ── Ordered list
    if (line.match(/^\s*\d+[.)]\s/)) {
      const items: Node[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+[.)]\s/)) {
        const text = lines[i].replace(/^\s*\d+[.)]\s/, "");
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: parseInline(text, imageMap) },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // ── Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Standalone image line
    const standaloneImg = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImg) {
      const resolvedSrc =
        imageMap?.get(standaloneImg[2]) ??
        imageMap?.get(standaloneImg[2].split("/").pop() ?? "") ??
        standaloneImg[2];
      content.push({
        type: "image",
        attrs: { src: resolvedSrc, alt: standaloneImg[1] || null, title: null },
      });
      i++;
      continue;
    }

    // ── Paragraph (collect until blank line or block element)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^```/) &&
      !lines[i].match(/^(\s*[-*_]){3,}\s*$/) &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^[\s]*[-*+]\s/) &&
      !lines[i].match(/^\s*\d+[.)]\s/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      content.push({
        type: "paragraph",
        content: parseInline(paraLines.join("\n"), imageMap),
      });
    }
  }

  return {
    type: "doc",
    content:
      content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  };
}

/** Extract all image src values from a markdown string */
export function extractImagePaths(markdown: string): string[] {
  const paths: string[] = [];
  const pattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}
