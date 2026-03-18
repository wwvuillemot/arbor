#!/usr/bin/env tsx

/**
 * Embedding backfill / rebuild command.
 *
 * Usage:
 *   pnpm run embeddings:backfill
 *   pnpm run embeddings:backfill -- --dry-run
 *   pnpm run embeddings:backfill -- --mode=all --batch-size=50
 */

import { pathToFileURL } from "node:url";
import { closeConnection } from "./index";
import {
  EmbeddingService,
  LocalEmbeddingProvider,
  type EmbeddingBackfillMode,
} from "../services/embedding-service";

export const DEFAULT_BATCH_SIZE = 100;

export type CliOptions = {
  mode: EmbeddingBackfillMode;
  batchSize: number;
  dryRun: boolean;
  help: boolean;
};

export function printUsage(): void {
  console.log(`
Embedding backfill / rebuild

Usage:
  pnpm run embeddings:backfill -- [options]

Options:
  --mode=missing|all   Backfill only missing embeddings or re-embed all nodes
  --missing            Shortcut for --mode=missing
  --all                Shortcut for --mode=all
  --batch-size=<n>     Number of nodes to process per batch (default: 100)
  --dry-run            Show how many nodes would be processed without writing
  --help, -h           Show this help message

Notes:
  Default mode is "missing".
  Use --mode=all (or --all) for a full historical rebuild.
`);
}

export function parseMode(modeValue: string): EmbeddingBackfillMode {
  if (modeValue === "missing" || modeValue === "all") {
    return modeValue;
  }

  throw new Error(`Invalid mode: ${modeValue}`);
}

export function parseBatchSize(batchSizeValue: string): number {
  const parsedBatchSize = Number.parseInt(batchSizeValue, 10);

  if (!Number.isInteger(parsedBatchSize) || parsedBatchSize < 1) {
    throw new Error(`Invalid batch size: ${batchSizeValue}`);
  }

  return parsedBatchSize;
}

export function parseCliOptions(argv: string[]): CliOptions {
  let mode: EmbeddingBackfillMode = "missing";
  let batchSize = DEFAULT_BATCH_SIZE;
  let dryRun = false;
  let help = false;

  for (const arg of argv) {
    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--all") {
      mode = "all";
      continue;
    }

    if (arg === "--missing") {
      mode = "missing";
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = parseMode(arg.slice("--mode=".length));
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      batchSize = parseBatchSize(arg.slice("--batch-size=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { mode, batchSize, dryRun, help };
}

function isDirectExecution(): boolean {
  const entryPointPath = process.argv[1];
  if (!entryPointPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPointPath).href;
}

export async function run(): Promise<void> {
  const cliOptions = parseCliOptions(process.argv.slice(2));

  if (cliOptions.help) {
    printUsage();
    return;
  }

  const embeddingService = new EmbeddingService(new LocalEmbeddingProvider());

  console.log("🔎 Starting embedding backfill...");
  console.log(`Provider: ${embeddingService.getProviderName()}`);
  console.log(`Mode: ${cliOptions.mode}`);
  console.log(`Batch size: ${cliOptions.batchSize}`);

  if (cliOptions.dryRun) {
    const candidateCount = await embeddingService.countBackfillCandidates(
      cliOptions.mode,
    );
    console.log(`🧪 Dry run: ${candidateCount} nodes would be processed.`);
    return;
  }

  const result = await embeddingService.backfillEmbeddings({
    mode: cliOptions.mode,
    batchSize: cliOptions.batchSize,
    onBatchComplete: (progress) => {
      console.log(
        `Batch ${progress.batchNumber}/${progress.totalBatches}: embedded ${progress.batchEmbeddedCount} nodes (${progress.processedCount}/${progress.totalCandidates} processed)`,
      );
    },
  });

  console.log("✅ Embedding backfill complete.");
  console.log(`Processed: ${result.processedCount}`);
  console.log(`Embedded: ${result.embeddedCount}`);
  console.log(`Skipped: ${result.processedCount - result.embeddedCount}`);
  console.log(`Batches: ${result.batches}`);
}

if (isDirectExecution()) {
  run()
    .catch((error) => {
      console.error("❌ Embedding backfill failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeConnection();
    });
}
