import test from "node:test";
import assert from "node:assert/strict";
import { checkRegistryHealth, getRegistryUrl } from "../src/registry.js";

test("checkRegistryHealth returns connected when fetch succeeds", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(url.includes("/.well-known/commerce-gateway.json"));
    return {
      ok: true,
      json: async () => ({
        gateway: { name: "Test Gateway", version: "1.0.0", tenantId: "tenant-123" },
      }),
    };
  };
  try {
    const result = await checkRegistryHealth("https://registry.example.com");
    assert.equal(result.state, "connected");
    assert.equal(result.registryUrl, "https://registry.example.com");
    assert.ok(result.gatewayMetadata);
    assert.equal(result.gatewayMetadata.name, "Test Gateway");
    assert.equal(result.gatewayMetadata.version, "1.0.0");
    assert.equal(result.gatewayMetadata.tenantId, "tenant-123");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkRegistryHealth returns disconnected when fetch fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, statusText: "Not Found" });
  try {
    const result = await checkRegistryHealth("https://registry.example.com");
    assert.equal(result.state, "disconnected");
    assert.ok(result.error?.includes("404"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkRegistryHealth returns disconnected on timeout/network error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network error");
  };
  try {
    const result = await checkRegistryHealth("https://registry.example.com");
    assert.equal(result.state, "disconnected");
    assert.ok(result.error?.includes("network error"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getRegistryUrl returns env var when set", () => {
  const originalEnv = process.env.REGISTRY_URL;
  process.env.REGISTRY_URL = "https://custom.registry.test";
  try {
    const url = getRegistryUrl();
    assert.equal(url, "https://custom.registry.test");
  } finally {
    if (originalEnv !== undefined) {
      process.env.REGISTRY_URL = originalEnv;
    } else {
      delete process.env.REGISTRY_URL;
    }
  }
});
