/**
 * ProseMirror JSON node types (from TipTap)
 */
interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

const BLOCK_NODE_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
]);

export function extractTextFromContent(content: unknown): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  const documentNode = content as PMNode;
  if (!documentNode.content) {
    return documentNode.text || "";
  }

  return extractTextFromNodes(documentNode.content);
}

function extractTextFromNodes(pmNodes: PMNode[]): string {
  const parts: string[] = [];

  for (const node of pmNodes) {
    if (node.text) {
      parts.push(node.text);
    } else if (node.type === "hardBreak") {
      parts.push("\n");
    } else if (node.content) {
      parts.push(extractTextFromNodes(node.content));
    }

    if (BLOCK_NODE_TYPES.has(node.type)) {
      parts.push("\n");
    }
  }

  return parts.join("").trim();
}

export function buildEmbeddingText(nodeName: string, content: unknown): string {
  const contentText = extractTextFromContent(content);
  return `${nodeName}\n${contentText}`.trim();
}
