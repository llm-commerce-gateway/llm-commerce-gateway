import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readGatewayConsoleConfig, writeGatewayConsoleConfig } from "../src/config-store.js";

test("config-store reads registration fields round-trip", () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-console-config-"));

  process.chdir(tempDir);
  try {
    writeGatewayConsoleConfig({
      claimToken: "bd-claim-test-token",
      registryGatewayId: "gw_123",
      registryBrandSlug: "acme",
      registrationTimestamp: "2026-02-21T12:00:00.000Z",
      environment: "production",
    });

    const config = readGatewayConsoleConfig();
    assert.equal(config.claimToken, "bd-claim-test-token");
    assert.equal(config.registryGatewayId, "gw_123");
    assert.equal(config.registryBrandSlug, "acme");
    assert.equal(config.registrationTimestamp, "2026-02-21T12:00:00.000Z");
    assert.equal(config.environment, "production");
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
