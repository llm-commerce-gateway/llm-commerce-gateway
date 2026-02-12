import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ALL_TOOLS } from './tools';

export const ALL_REGISTRY_TOOLS = ALL_TOOLS;

export function registerRegistryTools(server: Server) {
  for (const tool of ALL_REGISTRY_TOOLS) {
    server.registerTool(tool as never);
  }
}
