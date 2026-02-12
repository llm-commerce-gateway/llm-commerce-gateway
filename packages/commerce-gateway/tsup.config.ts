import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // Main entry
    index: 'src/index.ts',
    
    // MCP Module (separate entry for Claude integration)
    mcp: 'src/mcp/index.ts',
    
    // Adapter Modules (OpenAI, Grok, etc.)
    adapters: 'src/adapters/index.ts',
    openai: 'src/adapters/openai/index.ts',
    grok: 'src/adapters/grok/index.ts',
    
    // Session Module
    session: 'src/session/index.ts',
    
    // Auth Module
    auth: 'src/auth/index.ts',
    
    // Links Module
    links: 'src/links/index.ts',
    
    // CLI Modules
    'cli/import': 'src/cli/import.ts',
    'cli/registry/index': 'src/cli/registry/index.ts',
    
    // Registry Module
    registry: 'src/registry/index.ts',
    
    // Sub-modules for advanced usage
    'backends/interfaces': 'src/backends/interfaces.ts',
    'backends/demo-backend': 'src/backends/demo-backend.ts',
    'core/Gateway': 'src/core/Gateway.ts',
    'core/ToolRegistry': 'src/core/ToolRegistry.ts',
    'core/types': 'src/core/types.ts',
    'session/SessionManager': 'src/session/SessionManager.ts',
    'session/EnhancedSessionManager': 'src/session/EnhancedSessionManager.ts',
    'tools/builtInTools': 'src/tools/builtInTools.ts',
    
    // MCP sub-modules
    'mcp/MCPServer': 'src/mcp/MCPServer.ts',
    'mcp/formatters': 'src/mcp/formatters.ts',
    'mcp/types': 'src/mcp/types.ts',
    
    // Adapter sub-modules
    'adapters/BaseAdapter': 'src/adapters/BaseAdapter.ts',
    'adapters/types': 'src/adapters/types.ts',
    
    // Auth sub-modules
    'auth/Auth': 'src/auth/Auth.ts',
    'auth/rateLimiter': 'src/auth/rateLimiter.ts',
    'auth/types': 'src/auth/types.ts',
    
    // Observability module
    observability: 'src/observability/index.ts',
    'observability/Logger': 'src/observability/Logger.ts',
    
    // Core sub-modules
    'core/errors': 'src/core/errors.ts',
    'core/validation': 'src/core/validation.ts',
    
    // Formatters module (for LLM provider formatting)
    'formatters/index': 'src/formatters/index.ts',
    
    // Tools sub-modules
    'tools/registry': 'src/tools/registry.ts',
    'tools/handlers/index': 'src/tools/handlers/index.ts',

    // Extensions module (v0.1 contract)
    'extensions/index': 'src/extensions/index.ts',
    'extensions/interfaces': 'src/extensions/interfaces.ts',
    'extensions/oss-defaults': 'src/extensions/oss-defaults.ts',

    // Feature flags module (v0.1 contract)
    'feature-flags': 'src/feature-flags.ts',

    // Capabilities module
    'capabilities/index': 'src/capabilities/index.ts',
    'capabilities/types': 'src/capabilities/types.ts',

    // Cloud module
    'cloud/capability-discovery': 'src/cloud/capability-discovery.ts',
    'cloud/capability-gate': 'src/cloud/capability-gate.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  external: [],
});
