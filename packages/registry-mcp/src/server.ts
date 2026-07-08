import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { RegistryToolContext } from './tools/context.js';
import { ALL_TOOLS } from './tools/index.js';

export const ALL_REGISTRY_TOOLS = ALL_TOOLS;

/**
 * Register tenant registry tools on a low-level MCP Server.
 * Uses setRequestHandler (tools/list + tools/call) — same pattern as src/index.ts.
 * Low-level Server has no registerTool; that API lives on McpServer with Zod schemas.
 */
export function registerRegistryTools(server: Server, context: RegistryToolContext) {
  const toolMap = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolMap.get(request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const result = await tool.execute(request.params.arguments ?? {}, context);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  });
}
