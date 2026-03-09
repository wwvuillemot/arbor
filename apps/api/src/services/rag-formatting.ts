import type { SearchResult } from "./search-service";
import type { RAGDocument } from "./rag-types";

const RAG_CONTEXT_HEADER = "# Relevant Context\n\n";

export function rerankSearchResults(
  results: SearchResult[],
  recencyWeight: number,
): SearchResult[] {
  if (results.length === 0) {
    return [];
  }

  const timestamps = results.map((result) => result.node.updatedAt.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  return results
    .map((result) => {
      const recencyScore =
        (result.node.updatedAt.getTime() - minTime) / timeRange;
      const finalScore =
        (1 - recencyWeight) * result.score + recencyWeight * recencyScore;

      return { ...result, score: finalScore };
    })
    .sort((leftResult, rightResult) => rightResult.score - leftResult.score);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatDocument(doc: RAGDocument, index: number): string {
  const lines: string[] = [];
  lines.push(`## Document ${index}: ${doc.name}`);
  lines.push(`Path: ${doc.path}`);

  if (doc.tags.length > 0) {
    lines.push(`Tags: ${doc.tags.join(", ")}`);
  }

  lines.push("Content:");
  lines.push(doc.content || "(empty)");
  lines.push("");
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

export function formatWithTokenLimit(
  documents: RAGDocument[],
  maxTokens: number,
): { contextString: string; includedDocuments: RAGDocument[] } {
  let currentTokens = estimateTokens(RAG_CONTEXT_HEADER);
  const includedDocuments: RAGDocument[] = [];
  const sections: string[] = [RAG_CONTEXT_HEADER];

  for (
    let documentIndex = 0;
    documentIndex < documents.length;
    documentIndex++
  ) {
    const document = documents[documentIndex];
    const section = formatDocument(document, documentIndex + 1);
    const sectionTokens = estimateTokens(section);

    if (currentTokens + sectionTokens > maxTokens) {
      break;
    }

    sections.push(section);
    includedDocuments.push(document);
    currentTokens += sectionTokens;
  }

  return {
    contextString: sections.join("").trimEnd(),
    includedDocuments,
  };
}
