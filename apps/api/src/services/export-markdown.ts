/**
 * ProseMirror JSON node types from TipTap StarterKit + Image extension
 */
export interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
  attrs?: Record<string, unknown>;
}

interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export function parseProseMirrorContent(content: unknown): PMNode | null {
  if (!content) {
    return null;
  }

  if (typeof content === "string") {
    try {
      return JSON.parse(content) as PMNode;
    } catch {
      return null;
    }
  }

  if (typeof content === "object") {
    return content as PMNode;
  }

  return null;
}

export function prosemirrorToMarkdown(doc: PMNode): string {
  if (!doc.content) {
    return "";
  }

  return doc.content.map((node) => nodeToMarkdown(node)).join("\n");
}

function nodeToMarkdown(node: PMNode, listIndent = 0): string {
  switch (node.type) {
    case "paragraph":
      return `${inlineToMarkdown(node)}\n`;

    case "heading": {
      const level = getNumericAttr(node.attrs, "level") ?? 1;
      const prefix = "#".repeat(level);
      return `${prefix} ${inlineToMarkdown(node)}\n`;
    }

    case "bulletList":
      return (
        (node.content ?? [])
          .map((item) => listItemToMarkdown(item, "-", listIndent))
          .join("\n") + "\n"
      );

    case "orderedList":
      return (
        (node.content ?? [])
          .map((item, index) =>
            listItemToMarkdown(item, `${index + 1}.`, listIndent),
          )
          .join("\n") + "\n"
      );

    case "listItem": {
      const content = (node.content ?? [])
        .map((child) => nodeToMarkdown(child, listIndent))
        .join("");
      return content.trim();
    }

    case "codeBlock": {
      const language = getStringAttr(node.attrs, "language");
      const code = inlineToMarkdown(node);
      return `\`\`\`${language}\n${code}\`\`\`\n`;
    }

    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => nodeToMarkdown(child))
        .join("");
      return (
        inner
          .split("\n")
          .map((line) => (line.trim() ? `> ${line}` : ">"))
          .join("\n") + "\n"
      );
    }

    case "horizontalRule":
      return "---\n";

    case "image": {
      const source = getStringAttr(node.attrs, "src");
      const alt = getStringAttr(node.attrs, "alt");
      return `![${alt}](${source})\n`;
    }

    case "hardBreak":
      return "  \n";

    default:
      if (node.content) {
        return (
          node.content
            .map((child) => nodeToMarkdown(child, listIndent))
            .join("") + "\n"
        );
      }
      return "";
  }
}

function listItemToMarkdown(
  item: PMNode,
  bullet: string,
  indent: number,
): string {
  const prefix = `${"  ".repeat(indent)}${bullet} `;
  const content = (item.content ?? [])
    .map((child) => {
      if (child.type === "bulletList" || child.type === "orderedList") {
        return nodeToMarkdown(child, indent + 1);
      }

      return inlineToMarkdown(child);
    })
    .join("\n");

  const lines = content.split("\n");
  const firstLine = `${prefix}${lines[0] ?? ""}`;
  const rest = lines
    .slice(1)
    .map((line) => (line.trim() ? `${"  ".repeat(indent + 1)}${line}` : line));

  return [firstLine, ...rest].join("\n");
}

function inlineToMarkdown(node: PMNode): string {
  if (!node.content) {
    return node.text ?? "";
  }

  return node.content.map((child) => renderInlineNode(child)).join("");
}

function renderInlineNode(node: PMNode): string {
  if (node.type === "hardBreak") {
    return "  \n";
  }

  if (node.type === "image") {
    const source = getStringAttr(node.attrs, "src");
    const alt = getStringAttr(node.attrs, "alt");
    return `![${alt}](${source})`;
  }

  let text = node.text ?? "";
  if (!node.marks) {
    return text;
  }

  for (const mark of node.marks) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `*${text}*`;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      case "code":
        text = `\`${text}\``;
        break;
      case "link": {
        const href = getStringAttr(mark.attrs, "href");
        text = `[${text}](${href})`;
        break;
      }
    }
  }

  return text;
}

function getStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = attrs?.[key];
  return typeof value === "string" ? value : "";
}

function getNumericAttr(
  attrs: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = attrs?.[key];
  return typeof value === "number" ? value : undefined;
}
