/**
 * Gateway MCP Server (OSS)
 *
 * Thin wrapper around createGatewayMCPServer() that reads gateway.config.json
 * (or a built-in demo config) and starts stdio MCP with demo backends.
 */

import { createServer as createHttpServer } from 'node:http';
import {
  createGatewayMCPServer,
} from '@commercegateway/commerce-gateway/mcp';
import { DemoBackend } from '@commercegateway/commerce-gateway/backends/demo';
import { loadGatewayMcpConfig, resolveConfigPath } from './config.js';

function printHelp(): void {
  console.error(`Usage: gateway-mcp [--config <path>]

Starts a stdio MCP server with demo storefront backends.

Options:
  --config <path>   JSON config (default: ./gateway.config.json)
  --help            Show this message

If no config file is present, a built-in demo config is used so
\`npx @commercegateway/commerce-gateway-mcp\` works for a first test.

Env:
  GATEWAY_CONFIG    Absolute or relative path to JSON config
`);
}

function startHealthServer(port: number): void {
  const server = createHttpServer((req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, () => {
    console.error(`[gateway-mcp] Health endpoint on http://localhost:${port}/health`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const resolved = resolveConfigPath(args);
  const { config, source } = await loadGatewayMcpConfig(resolved);
  const backends = DemoBackend.create();

  const server = createGatewayMCPServer({
    slug: config.slug,
    brandName: config.brandName,
    endpoint: config.endpoint,
    protocol: config.protocol,
    capabilities: config.capabilities,
    backends,
  });

  server.start();
  if (source === 'demo-default') {
    console.error(
      '[gateway-mcp] No gateway.config.json found — using built-in demo backends. Pass --config or GATEWAY_CONFIG to customize.'
    );
  }
  console.error(`[gateway-mcp] Started MCP server for ${config.brandName}`);

  if (config.transport?.type === 'http') {
    const port = config.transport.port ?? 8080;
    startHealthServer(port);
  }
}

main().catch((error) => {
  console.error('[gateway-mcp] Failed to start:', error);
  process.exit(1);
});
