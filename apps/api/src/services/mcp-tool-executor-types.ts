export type ToolArgs = Record<string, unknown>;

export type ExportFormat = "markdown" | "html";

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<Record<string, unknown>>;
  text?: string;
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}
