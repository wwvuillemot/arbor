import { pathToFileURL } from "node:url";
import { createServer } from "./server.js";

const DEFAULT_API_PORT = 3001;
const DEFAULT_API_HOST = "0.0.0.0";

function getApiPort(): number {
  return Number.parseInt(process.env.API_PORT || `${DEFAULT_API_PORT}`, 10);
}

function getApiHost(): string {
  return process.env.API_HOST || DEFAULT_API_HOST;
}

function isDirectExecution(): boolean {
  const entryPointPath = process.argv[1];
  if (!entryPointPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPointPath).href;
}

async function main() {
  const { server } = await createServer();
  const apiPort = getApiPort();
  const apiHost = getApiHost();

  try {
    await server.listen({ port: apiPort, host: apiHost });
    console.log(`
🚀 Arbor API Server Ready!

   URL: http://localhost:${apiPort}
   tRPC: http://localhost:${apiPort}/trpc
   GraphQL: http://localhost:${apiPort}/graphql
   Health: http://localhost:${apiPort}/health
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  });
}

if (isDirectExecution()) {
  void main().catch((error) => {
    console.error("Fatal error starting Arbor API:", error);
    process.exit(1);
  });
}

export { createServer } from "./server.js";
