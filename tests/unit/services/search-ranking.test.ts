import { describe, expect, it } from "vitest";
import {
  buildKeywordSearchResults,
  mergeHybridSearchResults,
  scoreKeywordMatch,
} from "@/services/search-ranking";

describe("search ranking helpers", () => {
  it("scores exact, prefix, partial, and content-only matches in descending order", () => {
    expect(scoreKeywordMatch("Dragon", "Dragon")).toBe(1.0);
    expect(scoreKeywordMatch("Dragon Lore", "Dragon")).toBe(0.8);
    expect(scoreKeywordMatch("Ancient Dragon", "Dragon")).toBe(0.6);
    expect(scoreKeywordMatch("Wyvern Notes", "Dragon")).toBe(0.3);
  });

  it("builds keyword search results with keyword match type", () => {
    const keywordResults = buildKeywordSearchResults(
      [
        {
          id: "node-1",
          name: "Magic System",
        } as never,
      ],
      "Magic",
    );

    expect(keywordResults).toHaveLength(1);
    expect(keywordResults[0].matchType).toBe("keyword");
    expect(keywordResults[0].score).toBe(0.8);
  });

  it("merges vector and keyword results with weighted scoring", () => {
    const sharedNode = { id: "shared", name: "Arcane Power" } as never;
    const keywordOnlyNode = {
      id: "keyword-only",
      name: "Magic Rules",
    } as never;

    const mergedResults = mergeHybridSearchResults(
      [{ node: sharedNode, score: 0.9, matchType: "vector" }],
      [
        { node: sharedNode, score: 0.6, matchType: "keyword" },
        { node: keywordOnlyNode, score: 0.8, matchType: "keyword" },
      ],
      0.75,
      10,
      0,
    );

    expect(mergedResults).toHaveLength(2);
    expect(mergedResults[0].node.id).toBe("shared");
    expect(mergedResults[0].score).toBeCloseTo(0.825, 3);
    expect(mergedResults[1].node.id).toBe("keyword-only");
    expect(mergedResults.every((result) => result.matchType === "hybrid")).toBe(
      true,
    );
  });
});
