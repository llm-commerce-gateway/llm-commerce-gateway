/**
 * @betterdata/commerce-gateway - MCP Types
 * 
 * Type definitions for Model Context Protocol (MCP) server implementation.
 * These types follow the MCP specification for Claude.ai integration.
 * 
 * @see https://modelcontextprotocol.io/
 * @license Apache-2.0
 */

import type { GatewayBackends, Product, Cart, Order } from '../backends/interfaces';
import type { SessionManager } from '../session/SessionManager';

// ============================================================================
// MCP Protocol Types
// ============================================================================

/** JSON-RPC 2.0 request format */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response format */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

/** JSON-RPC 2.0 error format */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/** MCP notification (no response expected) */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/** JSON Schema for tool parameters */
export interface MCPJSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, MCPJSONSchema>;
  items?: MCPJSONSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** MCP Tool Definition */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: MCPJSONSchema;
  requiredCapabilities?: string[];
}

/** Tool call request */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** Tool call result */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

// ============================================================================
// MCP Content Types
// ============================================================================

/** Text content */
export interface MCPTextContent {
  type: 'text';
  text: string;
}

/** Image content */
export interface MCPImageContent {
  type: 'image';
  data: string; // Base64 encoded
  mimeType: string;
}

/** Resource content (embedded) */
export interface MCPResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // Base64 encoded
  };
}

/** Union of all content types */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

// ============================================================================
// MCP Resource Types
// ============================================================================

/** Resource definition */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** Resource template (for dynamic resources) */
export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// ============================================================================
// MCP Prompt Types
// ============================================================================

/** Prompt argument definition */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/** Prompt definition */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/** Prompt message */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPContent;
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

/** Built-in tool names */
export type MCPBuiltInTool = 
  | 'search_products'
  | 'get_product_details'
  | 'add_to_cart'
  | 'check_availability'
  | 'check_inventory'
  | 'get_recommendations'
  | 'create_order'
  | 'shop'
  | 'get_shipment_status'
  | 'get_purchase_order_status'
  | 'get_trace_events'
  | 'get_demand_forecast';

/** All built-in tools */
export const ALL_MCP_TOOLS: MCPBuiltInTool[] = [
  'search_products',
  'get_product_details',
  'add_to_cart',
  'check_availability',
  'check_inventory',
  'get_recommendations',
  'create_order',
  'shop',
  'get_shipment_status',
  'get_purchase_order_status',
  'get_trace_events',
  'get_demand_forecast',
];

/** MCP Server configuration */
export interface MCPServerConfig {
  /** Backend implementations */
  backends: GatewayBackends;
  
  /** Optional: Session manager for cart persistence */
  session?: SessionManager;
  
  /** Which tools to enable (defaults to all) */
  tools?: MCPBuiltInTool[];

  /** Capability set for tool gating */
  capabilitySet?: import('../capabilities/capability-set').CapabilitySet;
  
  /** Server name shown to Claude */
  name?: string;
  
  /** Server version */
  version?: string;
  
  /** Optional: Enable resources */
  enableResources?: boolean;
  
  /** Optional: Enable prompts */
  enablePrompts?: boolean;
  
  /** Optional: Custom prompt templates */
  prompts?: MCPPrompt[];
  
  /** Optional: Registry client configuration for @shop support */
  registry?: {
    /** Registry API base URL */
    baseUrl?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
  };
  
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// MCP Server Capabilities
// ============================================================================

/** Server capabilities response */
export interface MCPServerCapabilities {
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
    logging?: Record<string, unknown>;
  };
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
}

// ============================================================================
// Tool Context
// ============================================================================

/** Context passed to tool handlers */
export interface MCPToolContext {
  /** Backend implementations */
  backends: GatewayBackends;
  
  /** Session ID for this conversation */
  sessionId: string;
  
  /** Session manager */
  session?: SessionManager;
  
  /** Current cart (if any) */
  cart?: Cart;
  
  /** User ID (if authenticated) */
  userId?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Registry client for @shop resolution (optional) */
  registryClient?: any; // Using any to avoid circular dependency
  
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// Response Formatters
// ============================================================================

/** Product formatted for Claude display */
export interface FormattedProduct {
  markdown: string;
  structured: Product;
}

/** Cart formatted for Claude display */
export interface FormattedCart {
  markdown: string;
  structured: Cart;
}

/** Order formatted for Claude display */
export interface FormattedOrder {
  markdown: string;
  structured: Order;
}

// ============================================================================
// MCP Protocol Methods
// ============================================================================

/** All MCP methods */
export type MCPMethod =
  | 'initialize'
  | 'initialized'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/templates/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get'
  | 'ping';

