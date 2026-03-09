import { router, publicProcedure } from "../trpc";
import { buildMcpToolDefinitions } from "../../services/mcp-tool-definitions";

export const mcpRouter = router({
  listTools: publicProcedure.query(() => {
    return buildMcpToolDefinitions();
  }),
});
