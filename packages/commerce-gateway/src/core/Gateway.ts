/**
 * @betterdata/commerce-gateway - Main Gateway Class
 * 
 * The core LLM Gateway that handles tool execution, session management,
 * and multi-provider support. Designed to work with any commerce backend.
 * 
 * @license Apache-2.0
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type {
  GatewayConfig,
  ToolContext,
  ToolResult,
  LLMProvider,
  ToolCallRequest,
  ToolCallResponse,
  APIResponse,
} from './types';
import type { GatewayBackends } from '../backends/interfaces';
import { ToolRegistry } from './ToolRegistry';
import { SessionManager } from '../session/SessionManager';
import { registerBuiltInTools } from '../tools/builtInTools';
import { getLogger, type Logger } from '../observability/index';
import {
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ToolNotFoundError,
  ToolExecutionError,
  SessionNotFoundError,
  isGatewayError,
  wrapError,
} from './errors';
import {
  validateRequest,
  SessionCreateRequestSchema,
} from './validation';
import { addProtocolEndpoints } from './protocol-endpoints';
import { TelemetryService } from '../telemetry/TelemetryService';
import { VERSION } from '../version';

// ============================================================================
// LLM Gateway Class
// ============================================================================

export class LLMGateway {
  private app: Hono;
  private config: GatewayConfig;
  private backends: GatewayBackends;
  private sessionManager: SessionManager;
  private logger: Logger;
  private telemetry: TelemetryService;
  private server: ReturnType<typeof serve> | null = null;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.backends = config.backends;
    this.logger = getLogger('Gateway');
    this.telemetry = new TelemetryService(config.telemetry, VERSION, config.llmProviders);
    
    // Initialize session manager
    this.sessionManager = new SessionManager(config.session);
    
    // Initialize Hono app
    this.app = new Hono();
    
    // Register built-in tools
    registerBuiltInTools();
    
    // Setup error handler, middleware, and routes
    this.setupErrorHandler();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.logger.info('LLM Gateway initialized', {
      providers: config.llmProviders ?? ['anthropic', 'openai', 'grok'],
      tools: ToolRegistry.getNames(),
    });
  }

  // ==========================================================================
  // Error Handler Setup
  // ==========================================================================

  private setupErrorHandler(): void {
    // Global error handler
    this.app.onError((err, c) => {
      const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
      
      // Log the error
      this.logger.error('Request error', err instanceof Error ? err : null, {
        method: c.req.method,
        path: c.req.path,
        requestId,
      });

      // Handle GatewayError (our typed errors)
      if (isGatewayError(err)) {
        err.requestId = requestId;
        c.header('X-Request-ID', requestId);
        return c.json(err.toJSON(), err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502);
      }

      // Handle validation errors from Zod
      if (err instanceof ValidationError) {
        err.requestId = requestId;
        c.header('X-Request-ID', requestId);
        return c.json(err.toJSON(), 400);
      }

      // Wrap unexpected errors
      const wrapped = wrapError(err);
      wrapped.requestId = requestId;
      c.header('X-Request-ID', requestId);
      
      return c.json(wrapped.toJSON(), 500);
    });
  }

  // ==========================================================================
  // Middleware Setup
  // ==========================================================================

  private setupMiddleware(): void {
    // CORS
    if (this.config.cors) {
      const corsConfig = typeof this.config.cors === 'boolean'
        ? { origin: '*' }  // Allow all origins if cors is simply true
        : { origin: this.config.cors.origins };
      this.app.use('*', cors(corsConfig));
    }

    // Request logging
    this.app.use('*', async (c, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      this.telemetry.recordRequest();
      this.logger.info(`${c.req.method} ${c.req.path}`, {
        status: c.res.status,
        duration: `${duration}ms`,
      });
    });

    // API Key authentication (if configured)
    if (this.config.auth?.apiKeys?.length) {
      this.app.use('/api/*', async (c, next) => {
        // Skip auth for health check
        if (c.req.path === '/api/health') {
          return next();
        }

        // Allow anonymous if configured
        if (this.config.auth?.allowAnonymous) {
          return next();
        }

        const apiKey = c.req.header('x-api-key') ?? c.req.header('authorization')?.replace('Bearer ', '');
        
        if (!apiKey || !this.config.auth?.apiKeys?.includes(apiKey)) {
          throw new AuthenticationError('Invalid or missing API key');
        }

        await next();
      });
    }

    // Rate limiting (simplified)
    if (this.config.rateLimits) {
      const requestCounts = new Map<string, { count: number; resetAt: number }>();
      
      this.app.use('/api/*', async (c, next) => {
        const key = c.req.header('x-api-key') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
        const now = Date.now();
        const limits = this.config.rateLimits!;
        
        let entry = requestCounts.get(key);
        if (!entry || now > entry.resetAt) {
          entry = { count: 0, resetAt: now + limits.windowMs };
          requestCounts.set(key, entry);
        }
        
        entry.count++;
        
        c.header('X-RateLimit-Limit', limits.requests.toString());
        c.header('X-RateLimit-Remaining', Math.max(0, limits.requests - entry.count).toString());
        c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
        
        if (entry.count > limits.requests) {
          const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
          throw new RateLimitError('Too many requests. Please try again later.', retryAfter);
        }

        await next();
      });
    }
  }

  // ==========================================================================
  // Route Setup
  // ==========================================================================

  private setupRoutes(): void {
    const basePath = this.config.basePath ?? '/api';

    // Telemetry preview (operator-visible, does not require telemetry to be enabled)
    this.app.get('/telemetry/preview', (c) => {
      return c.json(this.telemetry.buildPayload({
        toolCount: ToolRegistry.getNames().length,
      }));
    });

    this.app.get(`${basePath}/telemetry/preview`, (c) => {
      return c.json(this.telemetry.buildPayload({
        toolCount: ToolRegistry.getNames().length,
      }));
    });

    // Health check (will be overridden by protocol endpoints, but keep for backward compatibility)
    // Protocol-compliant /health is added in addProtocolEndpoints below

    // List available tools
    this.app.get(`${basePath}/tools`, (c) => {
      const provider = c.req.query('provider') as LLMProvider | undefined;
      
      if (provider) {
        return c.json<APIResponse>({
          success: true,
          data: {
            provider,
            tools: ToolRegistry.getForProvider(provider),
          },
        });
      }

      return c.json<APIResponse>({
        success: true,
        data: {
          tools: ToolRegistry.getAll().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      });
    });

    // Execute a tool
    this.app.post(`${basePath}/tools/execute`, async (c) => {
      const body = await c.req.json<ToolCallRequest>();
      const { sessionId, toolName, input, provider } = body;

      // Validate tool exists
      if (!ToolRegistry.has(toolName)) {
        throw new ToolNotFoundError(toolName);
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreate(sessionId);

      // Build tool context
      const context: ToolContext = {
        sessionId: session.id,
        session,
        cartId: session.cartId,
        userId: session.userId,
        backends: this.backends,
      };

      // Execute tool with error handling
      let result: ToolResult;
      try {
        result = await ToolRegistry.execute(toolName, input, context);
      } catch (error) {
        this.logger.error('Tool execution failed', error instanceof Error ? error : null, {
          toolName,
          sessionId: session.id,
        });
        throw new ToolExecutionError(
          toolName,
          error instanceof Error ? error.message : 'Unknown error',
          error instanceof Error ? error : undefined
        );
      }

      this.telemetry.recordToolInvocation(provider);

      // Log conversation
      await this.sessionManager.addMessage(session.id, {
        role: 'tool',
        content: JSON.stringify(result),
        toolName,
        toolResult: result,
      });

      // Format response for provider if specified
      let formattedResponse: ToolCallResponse['formattedResponse'];
      if (provider && result.success) {
        const tool = ToolRegistry.get(toolName);
        if (tool) {
          formattedResponse = {
            [provider]: this.formatToolResult(provider, toolName, result),
          };
        }
      }

      return c.json<APIResponse<ToolCallResponse>>({
        success: true,
        data: {
          sessionId: session.id,
          toolName,
          result,
          formattedResponse,
        },
      });
    });

    // Anthropic MCP-compatible endpoint
    this.app.post(`${basePath}/mcp/tools/call`, async (c) => {
      try {
        const { name, arguments: args } = await c.req.json<{
          name: string;
          arguments: unknown;
        }>();

        const sessionId = c.req.header('x-session-id');
        const session = await this.sessionManager.getOrCreate(sessionId);

        const context: ToolContext = {
          sessionId: session.id,
          session,
          cartId: session.cartId,
          userId: session.userId,
          backends: this.backends,
        };

        const result = await ToolRegistry.execute(name, args, context);
        this.telemetry.recordToolInvocation();

        // MCP format response
        return c.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data ?? result.error),
            },
          ],
          isError: !result.success,
        });
      } catch (error) {
        return c.json({
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          isError: true,
        }, 500);
      }
    });

    // OpenAI-compatible function calling endpoint
    this.app.post(`${basePath}/openai/functions`, async (c) => {
      try {
        const { function_call } = await c.req.json<{
          function_call: { name: string; arguments: string };
        }>();

        const { name, arguments: argsJson } = function_call;
        const args = JSON.parse(argsJson);

        const sessionId = c.req.header('x-session-id');
        const session = await this.sessionManager.getOrCreate(sessionId);

        const context: ToolContext = {
          sessionId: session.id,
          session,
          backends: this.backends,
        };

        const result = await ToolRegistry.execute(name, args, context);
        this.telemetry.recordToolInvocation();

        return c.json({
          role: 'function',
          name,
          content: JSON.stringify(result.data ?? { error: result.error }),
        });
      } catch (error) {
        return c.json({
          role: 'function',
          name: 'error',
          content: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        }, 500);
      }
    });

    // Session management endpoints
    this.app.post(`${basePath}/sessions`, async (c) => {
      const body = await c.req.json();
      
      // Validate request body
      const validatedBody = validateRequest(SessionCreateRequestSchema, body);
      
      const session = await this.sessionManager.create({
        userId: validatedBody.userId,
        preferences: validatedBody.metadata,
      });

      this.logger.debug('Session created', { sessionId: session.id });

      return c.json<APIResponse>({
        success: true,
        data: { sessionId: session.id, expiresAt: session.expiresAt },
      });
    });

    this.app.get(`${basePath}/sessions/:id`, async (c) => {
      const sessionId = c.req.param('id');
      const session = await this.sessionManager.get(sessionId);
      
      if (!session) {
        throw new SessionNotFoundError(sessionId);
      }

      return c.json<APIResponse>({
        success: true,
        data: session,
      });
    });

    this.app.get(`${basePath}/sessions/:id/history`, async (c) => {
      const sessionId = c.req.param('id');
      const session = await this.sessionManager.get(sessionId);
      
      if (!session) {
        throw new SessionNotFoundError(sessionId);
      }

      const limit = parseInt(c.req.query('limit') ?? '50');
      const history = await this.sessionManager.getHistory(sessionId, limit);
      
      return c.json<APIResponse>({
        success: true,
        data: { history },
      });
    });

    // OpenAPI documentation
    this.app.get(`${basePath}/openapi.json`, (c) => {
      return c.json(this.generateOpenAPISpec());
    });

    // Protocol-compliant endpoints (Section 6 of spec)
    addProtocolEndpoints(this.app, {
      basePath,
      backends: this.backends,
      logger: this.logger,
      version: '1.0.0', // Gateway version for health check endpoint
    });
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private formatToolResult(
    provider: LLMProvider,
    toolName: string,
    result: ToolResult
  ): unknown {
    switch (provider) {
      case 'anthropic':
        return {
          type: 'tool_result',
          tool_use_id: toolName,
          content: JSON.stringify(result.data),
        };
      case 'openai':
        return {
          role: 'function',
          name: toolName,
          content: JSON.stringify(result.data),
        };
      case 'grok':
      case 'google':
      default:
        return result.data;
    }
  }

  private generateOpenAPISpec(): object {
    return {
      openapi: '3.1.0',
      info: {
        title: 'LLM Gateway API',
        description: 'Universal LLM Gateway for Conversational Commerce',
        version: '1.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: `http://localhost:${this.config.port ?? 3000}`,
          description: 'Local development',
        },
      ],
      paths: {
        '/api/health': {
          get: {
            summary: 'Health check',
            responses: {
              200: { description: 'Gateway is healthy' },
            },
          },
        },
        '/api/tools': {
          get: {
            summary: 'List available tools',
            parameters: [
              {
                name: 'provider',
                in: 'query',
                schema: { type: 'string', enum: ['anthropic', 'openai', 'grok', 'google'] },
              },
            ],
            responses: {
              200: { description: 'List of tools' },
            },
          },
        },
        '/api/tools/execute': {
          post: {
            summary: 'Execute a tool',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'string' },
                      toolName: { type: 'string' },
                      input: { type: 'object' },
                      provider: { type: 'string' },
                    },
                    required: ['toolName', 'input'],
                  },
                },
              },
            },
            responses: {
              200: { description: 'Tool execution result' },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the gateway server
   */
  async start(port?: number): Promise<void> {
    const serverPort = port ?? this.config.port ?? 3000;
    const host = this.config.host ?? '0.0.0.0';

    this.server = serve({
      fetch: this.app.fetch,
      port: serverPort,
      hostname: host,
    });

    this.telemetry.startSender({
      toolCount: () => ToolRegistry.getNames().length,
    });

    this.logger.info(`🚀 LLM Gateway running at http://${host}:${serverPort}`);
    this.logger.info(`📚 API docs: http://${host}:${serverPort}${this.config.basePath ?? '/api'}/openapi.json`);
  }

  /**
   * Stop the gateway server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.logger.info('LLM Gateway stopped');
    }

    this.telemetry.stopSender();
  }

  /**
   * Get the Hono app instance (for custom routing)
   */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Get the session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: Parameters<typeof ToolRegistry.register>[0]): void {
    ToolRegistry.register(tool);
    this.logger.info(`Registered custom tool: ${tool.name}`);
  }

  /**
   * Execute a tool programmatically
   */
  async executeTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    sessionId?: string
  ): Promise<ToolResult<TOutput>> {
    const session = await this.sessionManager.getOrCreate(sessionId);
    
    const context: ToolContext = {
      sessionId: session.id,
      session,
      cartId: session.cartId,
      userId: session.userId,
      backends: this.backends,
    };

    return ToolRegistry.execute<TInput, TOutput>(toolName, input, context);
  }
}

// Export factory function
export function createGateway(config: GatewayConfig): LLMGateway {
  return new LLMGateway(config);
}
