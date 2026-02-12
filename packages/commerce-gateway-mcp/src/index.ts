/**
 * Gateway MCP Server (OSS)
 *
 * Thin wrapper around createGatewayMCPServer() that reads gateway.config.json
 * and starts the MCP server with demo backends by default.
 */

import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { resolve as resolvePath } from 'node:path';
import {
  createGatewayMCPServer,
  type GatewayConfig,
} from '@betterdata/commerce-gateway/mcp';
import { DemoBackend } from '@betterdata/commerce-gateway/backends/demo';

type TransportConfig = {
  type?: 'stdio' | 'http';
  port?: number;
};

type GatewayMcpConfig = GatewayConfig & {
  transport?: TransportConfig;
  backends?: { type?: 'demo' };
};

function getArgValue(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

async function loadConfig(configPath: string): Promise<GatewayMcpConfig> {
  const fullPath = resolvePath(process.cwd(), configPath);
  const raw = await readFile(fullPath, 'utf-8');
  return JSON.parse(raw) as GatewayMcpConfig;
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
  const configPath =
    getArgValue(args, '--config') ||
    process.env.GATEWAY_CONFIG ||
    'gateway.config.json';

  const config = await loadConfig(configPath);
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
