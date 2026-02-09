import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

/**
 * Entry point for the Arbor MCP server.
 *
 * Connects via stdio transport for use with Claude Desktop, Cursor, etc.
 * For testing, use InMemoryTransport via createMcpServer() directly.
 */
async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Arbor MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { createMcpServer } from "./server.js";
