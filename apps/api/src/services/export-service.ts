import { NodeService } from "./node-service";

const nodeService = new NodeService();

/**
 * ProseMirror JSON node types from TipTap StarterKit + Image extension
 */
interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
  attrs?: Record<string, any>;
}

interface PMMark {
  type: string;
  attrs?: Record<string, any>;
}

export class ExportService {
  /**
   * Export a single node's content as Markdown
   */
  async exportNodeAsMarkdown(nodeId: string): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const lines: string[] = [];
    lines.push(`# ${node.name}\n`);

    if (node.content) {
      const contentObj = this.parseContent(node.content);
      if (contentObj) {
        lines.push(this.prosemirrorToMarkdown(contentObj));
      }
    }

    return lines.join("\n");
  }

  /**
   * Export a project (or folder) and all descendants as Markdown
   */
  async exportProjectAsMarkdown(nodeId: string): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const lines: string[] = [];
    lines.push(`# ${node.name}\n`);

    if (node.content) {
      const contentObj = this.parseContent(node.content);
      if (contentObj) {
        lines.push(this.prosemirrorToMarkdown(contentObj));
        lines.push("");
      }
    }

    // Get all descendants in order
    const descendants = await nodeService.getDescendants(nodeId);

    // Build a tree structure for proper heading levels
    const nodeDepthMap = new Map<string, number>();
    nodeDepthMap.set(nodeId, 1);

    // Calculate depths
    for (const desc of descendants) {
      const parentDepth = nodeDepthMap.get(desc.parentId!) ?? 1;
      nodeDepthMap.set(desc.id, parentDepth + 1);
    }

    for (const desc of descendants) {
      if (desc.type === "folder") {
        const depth = Math.min(nodeDepthMap.get(desc.id) ?? 2, 6);
        const heading = "#".repeat(depth);
        lines.push(`${heading} ${desc.name}\n`);
      } else if (desc.type === "note") {
        const depth = Math.min(nodeDepthMap.get(desc.id) ?? 2, 6);
        const heading = "#".repeat(depth);
        lines.push(`${heading} ${desc.name}\n`);

        if (desc.content) {
          const contentObj = this.parseContent(desc.content);
          if (contentObj) {
            lines.push(this.prosemirrorToMarkdown(contentObj));
            lines.push("");
          }
        }
      }
    }

    return lines.join("\n").trim() + "\n";
  }

  /**
   * Export a single node's content as styled HTML
   */
  async exportNodeAsHtml(nodeId: string): Promise<string> {
    const markdown = await this.exportNodeAsMarkdown(nodeId);
    return this.wrapInHtmlDocument(markdown, "");
  }

  /**
   * Export a project as styled HTML
   */
  async exportProjectAsHtml(nodeId: string): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");
    const markdown = await this.exportProjectAsMarkdown(nodeId);
    return this.wrapInHtmlDocument(markdown, node.name);
  }

  /**
   * Parse content from DB (could be JSON string or object)
   */
  private parseContent(content: any): PMNode | null {
    if (!content) return null;
    if (typeof content === "string") {
      try {
        return JSON.parse(content);
      } catch {
        return null;
      }
    }
    if (typeof content === "object") return content as PMNode;
    return null;
  }

  /**
   * Convert ProseMirror JSON to Markdown
   */
  prosemirrorToMarkdown(doc: PMNode): string {
    if (!doc.content) return "";
    return doc.content.map((node) => this.nodeToMarkdown(node)).join("\n");
  }

  /**
   * Convert a single ProseMirror node to Markdown
   */
  private nodeToMarkdown(node: PMNode, listIndent = 0): string {
    switch (node.type) {
      case "paragraph":
        return this.inlineToMarkdown(node) + "\n";

      case "heading": {
        const level = node.attrs?.level ?? 1;
        const prefix = "#".repeat(level);
        return `${prefix} ${this.inlineToMarkdown(node)}\n`;
      }

      case "bulletList":
        return (
          (node.content || [])
            .map((item) => this.listItemToMarkdown(item, "-", listIndent))
            .join("\n") + "\n"
        );

      case "orderedList":
        return (
          (node.content || [])
            .map((item, i) =>
              this.listItemToMarkdown(item, `${i + 1}.`, listIndent),
            )
            .join("\n") + "\n"
        );

      case "listItem": {
        const content = (node.content || [])
          .map((child) => this.nodeToMarkdown(child, listIndent))
          .join("");
        return content.trim();
      }

      case "codeBlock": {
        const lang = node.attrs?.language || "";
        const code = this.inlineToMarkdown(node);
        return `\`\`\`${lang}\n${code}\`\`\`\n`;
      }

      case "blockquote": {
        const inner = (node.content || [])
          .map((child) => this.nodeToMarkdown(child))
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
        const src = node.attrs?.src || "";
        const alt = node.attrs?.alt || "";
        return `![${alt}](${src})\n`;
      }

      case "hardBreak":
        return "  \n";

      default:
        // Fallback: try to render inline content
        if (node.content) {
          return (
            node.content
              .map((child) => this.nodeToMarkdown(child, listIndent))
              .join("") + "\n"
          );
        }
        return "";
    }
  }

  /**
   * Convert list item to Markdown with proper indentation
   */
  private listItemToMarkdown(
    item: PMNode,
    bullet: string,
    indent: number,
  ): string {
    const prefix = "  ".repeat(indent) + bullet + " ";
    const content = (item.content || [])
      .map((child, i) => {
        if (child.type === "bulletList" || child.type === "orderedList") {
          return this.nodeToMarkdown(child, indent + 1);
        }
        const text = this.inlineToMarkdown(child);
        return i === 0 ? text : text;
      })
      .join("\n");

    // Split into first line (with bullet) and rest
    const lines = content.split("\n");
    const firstLine = prefix + (lines[0] || "");
    const rest = lines
      .slice(1)
      .map((l) => (l.trim() ? "  ".repeat(indent + 1) + l : l));
    return [firstLine, ...rest].join("\n");
  }

  /**
   * Convert inline content (text with marks) to Markdown
   */
  private inlineToMarkdown(node: PMNode): string {
    if (!node.content) return node.text || "";
    return node.content.map((child) => this.renderInlineNode(child)).join("");
  }

  /**
   * Render a single inline node with its marks
   */
  private renderInlineNode(node: PMNode): string {
    if (node.type === "hardBreak") return "  \n";
    if (node.type === "image") {
      const src = node.attrs?.src || "";
      const alt = node.attrs?.alt || "";
      return `![${alt}](${src})`;
    }

    let text = node.text || "";
    if (!node.marks) return text;

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
          const href = mark.attrs?.href || "";
          text = `[${text}](${href})`;
          break;
        }
      }
    }
    return text;
  }

  /**
   * Wrap Markdown content in a styled HTML document for printing
   */
  private wrapInHtmlDocument(markdown: string, title: string): string {
    // Simple markdown → HTML (basic conversion for print)
    const htmlContent = this.markdownToBasicHtml(markdown);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title || "Export")}</title>
  <style>
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.3em; }
    h4, h5, h6 { font-size: 1.1em; margin-top: 1em; }
    p { margin: 0.8em 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    ul, ol { margin: 0.5em 0; padding-left: 2em; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  }

  /**
   * Basic Markdown to HTML conversion (for print preview)
   */
  private markdownToBasicHtml(markdown: string): string {
    let html = markdown;

    // Code blocks first (before other processing)
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`,
    );

    // Headings
    html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
    html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr>");

    // Bold, italic, strikethrough, inline code
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Blockquotes
    html = html.replace(/^(?:> (.+)\n?)+/gm, (match) => {
      const text = match.replace(/^> ?/gm, "").trim();
      return `<blockquote><p>${text}</p></blockquote>`;
    });

    // Paragraphs (lines that aren't already HTML)
    html = html
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (
          !trimmed ||
          trimmed.startsWith("<h") ||
          trimmed.startsWith("<pre") ||
          trimmed.startsWith("<hr") ||
          trimmed.startsWith("<blockquote") ||
          trimmed.startsWith("<ul") ||
          trimmed.startsWith("<ol") ||
          trimmed.startsWith("<img")
        ) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join("\n");

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
