/**
 * @betterdata/commerce-gateway - MCP Server
 * 
 * Production-ready Model Context Protocol (MCP) server implementation.
 * Exposes commerce backends to Claude.ai through the MCP standard.
 * 
 * @see https://modelcontextprotocol.io/
 * @license MIT
 */

import * as readline from 'readline';
import type {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPServerCapabilities,
  MCPToolContext,
  MCPMethod,
  MCPBuiltInTool,
} from './types';
import { ALL_MCP_TOOLS } from './types';
import { defaultCommerceCapabilitySet, filterToolsByCapabilities } from '../capabilities';
import { getMCPToolDefinitions, executeTool } from './tools/index';
import { getStaticResources, getResourceTemplates, readResource } from './resources/index';
import { getPrompts, executePrompt } from './prompts/index';
import type { Cart } from '../backends/interfaces';
import { createRegistryClient, type RegistryClient } from '../registry/client';

// ============================================================================
// MCP Server
// ============================================================================

/**
 * MCP Server for conversational commerce.
 * 
 * Implements the Model Context Protocol to expose commerce tools to Claude.
 * Works with any ProductBackend, CartBackend, and OrderBackend implementation.
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
 *   tools: ['search_products', 'add_to_cart'],
 * });
 * 
 * server.start(); // Starts stdio transport
 * ```
 */
export class MCPServer {
  private config: Required<MCPServerConfig>;
  private enabledTools: MCPBuiltInTool[];
  private sessionId: string;
  private cart?: Cart;
  private running = false;
  private rl?: readline.Interface;
  private registryClient?: RegistryClient;

  constructor(config: MCPServerConfig) {
    // Set defaults
    const capabilitySet = config.capabilitySet ?? defaultCommerceCapabilitySet();
    const baseTools = config.tools ?? [...ALL_MCP_TOOLS];
    const enabledTools = filterToolsByCapabilities(baseTools, capabilitySet);

    this.config = {
      backends: config.backends,
      session: config.session,
      tools: enabledTools,
      capabilitySet,
      name: config.name ?? 'commerce-server',
      version: config.version ?? '1.0.0',
      enableResources: config.enableResources ?? true,
      enablePrompts: config.enablePrompts ?? true,
      prompts: config.prompts ?? [],
      registry: config.registry,
      debug: config.debug ?? false,
    } as Required<MCPServerConfig>;

    this.enabledTools = this.config.tools;
    this.sessionId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Create registry client if shop tool is enabled
    if (this.enabledTools.includes('shop') && this.config.registry !== undefined) {
      this.registryClient = createRegistryClient(this.config.registry);
    }
  }

  /**
   * Start the MCP server with stdio transport.
   * This is the standard way to run an MCP server for Claude Desktop.
   */
  start(): void {
    if (this.running) {
      this.log('Server already running');
      return;
    }

    this.running = true;
    this.log('MCP Server starting...');

    // Set up readline for stdio transport
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Handle incoming messages
    this.rl.on('line', async (line) => {
      if (!line.trim()) return;

      try {
        const request = JSON.parse(line) as MCPRequest | MCPNotification;
        await this.handleMessage(request);
      } catch (error) {
        this.logError('Failed to parse message', error);
        this.sendError(null, -32700, 'Parse error');
      }
    });

    // Handle close
    this.rl.on('close', () => {
      this.log('Connection closed');
      this.running = false;
    });

    this.log('MCP Server ready (stdio transport)');
  }

  /**
   * Stop the MCP server.
   */
  stop(): void {
    if (!this.running) return;
    
    this.running = false;
    this.rl?.close();
    this.log('MCP Server stopped');
  }

  /**
   * Handle incoming MCP message.
   */
  private async handleMessage(message: MCPRequest | MCPNotification): Promise<void> {
    // Check if it's a notification (no id)
    if (!('id' in message)) {
      // Handle notification
      if (message.method === 'notifications/initialized') {
        this.log('Client initialized');
      }
      return;
    }

    const request = message as MCPRequest;
    const method = request.method as MCPMethod;

    try {
      switch (method) {
        case 'initialize':
          await this.handleInitialize(request);
          break;

        case 'ping':
          this.sendResult(request.id, {});
          break;

        case 'tools/list':
          this.handleToolsList(request);
          break;

        case 'tools/call':
          await this.handleToolCall(request);
          break;

        case 'resources/list':
          this.handleResourcesList(request);
          break;

        case 'resources/templates/list':
          this.handleResourceTemplatesList(request);
          break;

        case 'resources/read':
          await this.handleResourceRead(request);
          break;

        case 'prompts/list':
          this.handlePromptsList(request);
          break;

        case 'prompts/get':
          this.handlePromptGet(request);
          break;

        default:
          this.sendError(request.id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      this.logError(`Error handling ${method}`, error);
      this.sendError(
        request.id,
        -32603,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  // ============================================================================
  // Protocol Handlers
  // ============================================================================

  private async handleInitialize(request: MCPRequest): Promise<void> {
    const capabilities: MCPServerCapabilities = {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
    };

    // Add resource capabilities if enabled
    if (this.config.enableResources) {
      capabilities.capabilities.resources = {
        subscribe: false,
        listChanged: false,
      };
    }

    // Add prompt capabilities if enabled
    if (this.config.enablePrompts) {
      capabilities.capabilities.prompts = {
        listChanged: false,
      };
    }

    this.sendResult(request.id, capabilities);
    this.log('Initialized with capabilities');
  }

  private handleToolsList(request: MCPRequest): void {
    const tools = getMCPToolDefinitions(this.enabledTools, this.config.capabilitySet);
    this.sendResult(request.id, { tools });
  }

  private async handleToolCall(request: MCPRequest): Promise<void> {
    const params = request.params as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    if (!params?.name) {
      this.sendError(request.id, -32602, 'Missing tool name');
      return;
    }

    // Check if tool is enabled
    if (!this.enabledTools.includes(params.name as MCPBuiltInTool)) {
      this.sendError(request.id, -32602, `Tool not enabled: ${params.name}`);
      return;
    }

    // Build tool context
    const context: MCPToolContext = {
      backends: this.config.backends,
      sessionId: this.sessionId,
      session: this.config.session,
      cart: this.cart,
      registryClient: this.registryClient,
      debug: this.config.debug,
    };

    // Execute tool
    this.log(`Executing tool: ${params.name}`);
    const result = await executeTool(params.name, params.arguments ?? {}, context);

    // Update cart if changed
    if (context.cart) {
      this.cart = context.cart;
    }

    this.sendResult(request.id, result);
  }

  private handleResourcesList(request: MCPRequest): void {
    if (!this.config.enableResources) {
      this.sendResult(request.id, { resources: [] });
      return;
    }

    const resources = getStaticResources();
    this.sendResult(request.id, { resources });
  }

  private handleResourceTemplatesList(request: MCPRequest): void {
    if (!this.config.enableResources) {
      this.sendResult(request.id, { resourceTemplates: [] });
      return;
    }

    const resourceTemplates = getResourceTemplates();
    this.sendResult(request.id, { resourceTemplates });
  }

  private async handleResourceRead(request: MCPRequest): Promise<void> {
    const params = request.params as { uri: string };

    if (!params?.uri) {
      this.sendError(request.id, -32602, 'Missing resource URI');
      return;
    }

    if (!this.config.enableResources) {
      this.sendError(request.id, -32602, 'Resources not enabled');
      return;
    }

    const context: MCPToolContext = {
      backends: this.config.backends,
      sessionId: this.sessionId,
      session: this.config.session,
      cart: this.cart,
      registryClient: this.registryClient,
      debug: this.config.debug,
    };

    const content = await readResource(params.uri, this.config.backends, context);

    this.sendResult(request.id, {
      contents: content.map(c => ({
        uri: params.uri,
        mimeType: 'text/plain',
        ...c,
      })),
    });
  }

  private handlePromptsList(request: MCPRequest): void {
    if (!this.config.enablePrompts) {
      this.sendResult(request.id, { prompts: [] });
      return;
    }

    const prompts = getPrompts();
    
    // Add custom prompts if configured
    const allPrompts = [...prompts, ...this.config.prompts];
    
    this.sendResult(request.id, { prompts: allPrompts });
  }

  private handlePromptGet(request: MCPRequest): void {
    const params = request.params as {
      name: string;
      arguments?: Record<string, string>;
    };

    if (!params?.name) {
      this.sendError(request.id, -32602, 'Missing prompt name');
      return;
    }

    if (!this.config.enablePrompts) {
      this.sendError(request.id, -32602, 'Prompts not enabled');
      return;
    }

    const result = executePrompt(params.name, params.arguments ?? {});

    if (!result) {
      this.sendError(request.id, -32602, `Prompt not found: ${params.name}`);
      return;
    }

    this.sendResult(request.id, result);
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  private sendResult(id: string | number | null, result: unknown): void {
    if (id === null) return;
    
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    
    this.sendMessage(response);
  }

  private sendError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: id ?? 0,
      error: { code, message, data },
    };
    
    this.sendMessage(response);
  }

  private sendMessage(message: MCPResponse | MCPNotification): void {
    const json = JSON.stringify(message);
    console.log(json);
  }

  // ============================================================================
  // Logging
  // ============================================================================

  private log(message: string): void {
    if (this.config.debug) {
      console.error(`[MCP] ${message}`);
    }
  }

  private logError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MCP ERROR] ${message}: ${errorMessage}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

export { ALL_MCP_TOOLS } from './types';
export type { MCPServerConfig, MCPBuiltInTool } from './types';

