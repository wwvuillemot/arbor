import { NodeService } from "./node-service";
import {
  parseProseMirrorContent,
  prosemirrorToMarkdown as renderProsemirrorToMarkdown,
  type PMNode,
} from "./export-markdown";
import { wrapMarkdownInHtmlDocument } from "./export-html";

const nodeService = new NodeService();

export class ExportService {
  /**
   * Export a single node's content as Markdown
   */
  async exportNodeAsMarkdown(nodeId: string): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const lines: string[] = [];
    lines.push(`# ${node.name}\n`);
    this.appendMarkdownContent(lines, node.content);

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
    this.appendMarkdownContent(lines, node.content, true);

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
        this.appendMarkdownContent(lines, desc.content, true);
      }
    }

    return lines.join("\n").trim() + "\n";
  }

  /**
   * Export a single node's content as styled HTML
   */
  async exportNodeAsHtml(nodeId: string): Promise<string> {
    const markdown = await this.exportNodeAsMarkdown(nodeId);
    return wrapMarkdownInHtmlDocument(markdown, "");
  }

  /**
   * Export a project as styled HTML
   */
  async exportProjectAsHtml(nodeId: string): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");
    const markdown = await this.exportProjectAsMarkdown(nodeId);
    return wrapMarkdownInHtmlDocument(markdown, node.name);
  }

  /**
   * Convert ProseMirror JSON to Markdown
   */
  prosemirrorToMarkdown(doc: PMNode): string {
    return renderProsemirrorToMarkdown(doc);
  }

  private appendMarkdownContent(
    lines: string[],
    content: unknown,
    appendTrailingSpacer = false,
  ): void {
    const contentObject = parseProseMirrorContent(content);
    if (!contentObject) {
      return;
    }

    lines.push(this.prosemirrorToMarkdown(contentObject));
    if (appendTrailingSpacer) {
      lines.push("");
    }
  }
}
