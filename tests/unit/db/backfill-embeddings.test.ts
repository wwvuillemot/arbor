import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  parseBatchSize,
  parseCliOptions,
  parseMode,
} from "@/db/backfill-embeddings";

describe("backfill-embeddings CLI", () => {
  it("should ignore pnpm's standalone double-dash separator", () => {
    expect(parseCliOptions(["--", "--help"])).toEqual({
      mode: "missing",
      batchSize: DEFAULT_BATCH_SIZE,
      dryRun: false,
      help: true,
    });
  });

  it("should parse mode, batch size, and dry-run options", () => {
    expect(
      parseCliOptions(["--mode=all", "--batch-size=25", "--dry-run"]),
    ).toEqual({
      mode: "all",
      batchSize: 25,
      dryRun: true,
      help: false,
    });
  });

  it("should validate helper parsers", () => {
    expect(parseMode("missing")).toBe("missing");
    expect(parseMode("all")).toBe("all");
    expect(parseBatchSize("10")).toBe(10);
    expect(() => parseMode("other")).toThrow("Invalid mode");
    expect(() => parseBatchSize("0")).toThrow("Invalid batch size");
  });
});
