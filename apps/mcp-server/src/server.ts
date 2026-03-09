import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExportTools } from "./registrations/register-export-tools.js";
import { registerNodeTools } from "./registrations/register-node-tools.js";
import { registerPrompts } from "./registrations/register-prompts.js";
import { registerResources } from "./registrations/register-resources.js";
import { registerTagTools } from "./registrations/register-tag-tools.js";
import {
  createMcpServerServices,
  type McpRegistration,
} from "./registrations/shared.js";

const registrations: McpRegistration[] = [
  registerNodeTools,
  registerTagTools,
  registerExportTools,
  registerResources,
  registerPrompts,
];

/**
 * Creates and configures the Arbor MCP server with tools, resources, and prompts.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "arbor-mcp",
    version: "0.1.0",
  });
  const services = createMcpServerServices();

  for (const register of registrations) {
    register(server, services);
  }

  return server;
}
