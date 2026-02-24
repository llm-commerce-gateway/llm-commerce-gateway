/**
 * @betterdata/commerce-gateway/mcp
 * 
 * Model Context Protocol (MCP) server module for Claude.ai integration.
 * Expose your commerce backend to Claude through the MCP standard.
 * 
 * @example
 * ```typescript
 * import { MCPServer } from '@betterdata/commerce-gateway/mcp';
 * import { MyBackend } from './my-backend';
 * 
 * const server = new MCPServer({
 *   backends: {
 *     products: new MyBackend(),
 *     cart: new MyBackend(),
 *     orders: new MyBackend(),
 *   },
 *   tools: ['search_products', 'add_to_cart', 'check_inventory'],
 * });
 * 
 * server.start(); // Starts stdio transport for Claude Desktop
 * ```
 * 
 * @license MIT
 */

// Main export
export { MCPServer, ALL_MCP_TOOLS } from './MCPServer';
export type { MCPServerConfig, MCPBuiltInTool } from './MCPServer';

// Gateway MCP Server factory
export { createGatewayMCPServer } from './gateway-server';
export type { GatewayConfig } from './gateway-server';

// Types for advanced usage
export type {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPToolDefinition,
  MCPToolResult,
  MCPToolContext,
  MCPContent,
  MCPTextContent,
  MCPImageContent,
  MCPResource,
  MCPResourceTemplate,
  MCPPrompt,
  MCPPromptMessage,
} from './types';

// Formatters for custom tool implementations
export {
  formatProduct,
  formatProductList,
  formatCart,
  formatCartUpdate,
  formatInventoryStatus,
  formatRecommendations,
  formatOrder,
  formatError,
  formatNotFound,
} from './formatters';

// Tool utilities
export {
  getMCPToolDefinitions,
  executeTool,
  MCP_TOOLS,
} from './tools/index';

// Resource utilities
export {
  getStaticResources,
  getResourceTemplates,
  readResource,
} from './resources/index';

// Prompt utilities
export {
  getPrompts,
  getPrompt,
  executePrompt,
  BUILT_IN_PROMPTS,
} from './prompts/index';

