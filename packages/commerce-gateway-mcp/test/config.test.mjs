import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configUrl = pathToFileURL(path.resolve(here, '../dist/config.js')).href;

const { DEFAULT_DEMO_CONFIG, loadGatewayMcpConfig, resolveConfigPath } = await import(
  configUrl
);

describe('gateway-mcp config', () => {
  it('defaults to gateway.config.json when unset', () => {
    const resolved = resolveConfigPath([], {});
    assert.equal(resolved.path, 'gateway.config.json');
    assert.equal(resolved.explicit, false);
  });

  it('treats --config and GATEWAY_CONFIG as explicit', () => {
    assert.deepEqual(resolveConfigPath(['--config', 'custom.json'], {}), {
      path: 'custom.json',
      explicit: true,
    });
    assert.deepEqual(resolveConfigPath([], { GATEWAY_CONFIG: 'from-env.json' }), {
      path: 'from-env.json',
      explicit: true,
    });
  });

  it('uses built-in demo config when the default file is missing', async () => {
    const { config, source } = await loadGatewayMcpConfig({
      path: path.join(tmpdir(), 'missing-gateway.config.json'),
      explicit: false,
    });
    assert.equal(source, 'demo-default');
    assert.equal(config.slug, DEFAULT_DEMO_CONFIG.slug);
  });

  it('errors when an explicit config path is missing', async () => {
    await assert.rejects(
      () =>
        loadGatewayMcpConfig({
          path: path.join(tmpdir(), 'missing-explicit.json'),
          explicit: true,
        }),
      /Gateway config not found/
    );
  });

  it('loads JSON from disk when present', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'gateway-mcp-'));
    const file = path.join(dir, 'gateway.config.json');
    await writeFile(
      file,
      JSON.stringify({
        slug: 'loaded',
        brandName: 'Loaded',
        endpoint: 'https://example.com/mcp',
        protocol: 'mcp',
      })
    );
    const { config, source } = await loadGatewayMcpConfig({
      path: file,
      explicit: true,
    });
    assert.equal(source, 'file');
    assert.equal(config.slug, 'loaded');
  });
});
