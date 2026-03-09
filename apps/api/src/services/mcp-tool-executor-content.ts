import type { TipTapDoc, TipTapNode } from "./mcp-tool-executor-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTipTapNode(value: unknown): value is TipTapNode {
  return isRecord(value) && typeof value.type === "string";
}

function createTipTapTextNode(text: string): TipTapNode {
  return { type: "text", text };
}

export function markdownToTipTap(markdown: string): TipTapDoc {
  const lines = markdown.split("\n");
  const content: TipTapNode[] = [];
  let lineIndex = 0;

  const parseInline = (text: string): TipTapNode[] => {
    const inlineNodes: TipTapNode[] = [];
    const pattern =
      /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/gs;

    let lastMatchEnd = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastMatchEnd) {
        inlineNodes.push(
          createTipTapTextNode(text.slice(lastMatchEnd, match.index)),
        );
      }

      const [
        ,
        ,
        boldItalic,
        bold,
        boldAlt,
        italic,
        italicAlt,
        code,
        linkText,
        linkHref,
      ] = match;

      if (boldItalic) {
        inlineNodes.push({
          type: "text",
          marks: [{ type: "bold" }, { type: "italic" }],
          text: boldItalic,
        });
      } else if (bold || boldAlt) {
        inlineNodes.push({
          type: "text",
          marks: [{ type: "bold" }],
          text: bold || boldAlt,
        });
      } else if (italic || italicAlt) {
        inlineNodes.push({
          type: "text",
          marks: [{ type: "italic" }],
          text: italic || italicAlt,
        });
      } else if (code) {
        inlineNodes.push({
          type: "text",
          marks: [{ type: "code" }],
          text: code,
        });
      } else if (linkText && linkHref) {
        inlineNodes.push({
          type: "text",
          marks: [{ type: "link", attrs: { href: linkHref } }],
          text: linkText,
        });
      }

      lastMatchEnd = match.index + match[0].length;
    }

    if (lastMatchEnd < text.length) {
      inlineNodes.push(createTipTapTextNode(text.slice(lastMatchEnd)));
    }

    return inlineNodes.filter(
      (node) => node.type !== "text" || Boolean(node.text),
    );
  };

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.match(/^```/)) {
      const language = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length && !lines[lineIndex].match(/^```/)) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      lineIndex += 1;
      content.push({
        type: "codeBlock",
        attrs: { language },
        content: [createTipTapTextNode(codeLines.join("\n"))],
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      lineIndex += 1;
      continue;
    }

    if (
      line.match(/^(\s*[-*_]){3,}\s*$/) &&
      line.replace(/[\s\-*_]/g, "").length === 0
    ) {
      content.push({ type: "horizontalRule" });
      lineIndex += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex].startsWith(">")) {
        quoteLines.push(lines[lineIndex].replace(/^>\s?/, ""));
        lineIndex += 1;
      }
      const quotedDocument = markdownToTipTap(quoteLines.join("\n"));
      content.push({ type: "blockquote", content: quotedDocument.content });
      continue;
    }

    if (line.match(/^[\s]*[-*+]\s/)) {
      const listItems: TipTapNode[] = [];
      while (
        lineIndex < lines.length &&
        lines[lineIndex].match(/^[\s]*[-*+]\s/)
      ) {
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInline(
                lines[lineIndex].replace(/^[\s]*[-*+]\s/, ""),
              ),
            },
          ],
        });
        lineIndex += 1;
      }
      content.push({ type: "bulletList", content: listItems });
      continue;
    }

    if (line.match(/^\s*\d+[.)]\s/)) {
      const listItems: TipTapNode[] = [];
      while (
        lineIndex < lines.length &&
        lines[lineIndex].match(/^\s*\d+[.)]\s/)
      ) {
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInline(
                lines[lineIndex].replace(/^\s*\d+[.)]\s/, ""),
              ),
            },
          ],
        });
        lineIndex += 1;
      }
      content.push({ type: "orderedList", content: listItems });
      continue;
    }

    if (line.trim() === "") {
      lineIndex += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() !== "" &&
      !lines[lineIndex].match(/^#{1,6}\s/) &&
      !lines[lineIndex].match(/^```/) &&
      !lines[lineIndex].startsWith(">") &&
      !lines[lineIndex].match(/^[\s]*[-*+]\s/) &&
      !lines[lineIndex].match(/^\s*\d+[.)]\s/)
    ) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }

    if (paragraphLines.length > 0) {
      content.push({
        type: "paragraph",
        content: parseInline(paragraphLines.join("\n")),
      });
    }
  }

  return {
    type: "doc",
    content:
      content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  };
}

function collectImageNodes(node: unknown): TipTapNode[] {
  if (!isTipTapNode(node)) {
    return [];
  }
  if (node.type === "image") {
    return [node];
  }
  if (!Array.isArray(node.content)) {
    return [];
  }
  return node.content.flatMap((childNode) => collectImageNodes(childNode));
}

export function buildUpdatedContent(
  existingContent: unknown,
  nextContent: unknown,
): unknown {
  if (typeof nextContent !== "string") {
    return nextContent;
  }

  const nextDocument = markdownToTipTap(nextContent);
  const imageNodes = collectImageNodes(existingContent);

  if (imageNodes.length > 0) {
    nextDocument.content.push(...imageNodes);
  }

  return nextDocument;
}
