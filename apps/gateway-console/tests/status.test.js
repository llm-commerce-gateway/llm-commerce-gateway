import test from "node:test";
import assert from "node:assert/strict";
import { getStatusData } from "../src/status.js";

test("status data returns stable shape", () => {
  const data = getStatusData();
  const keys = Object.keys(data).sort();

  assert.deepEqual(keys, [
    "errorRatePct",
    "federationEnabled",
    "gatewayVersion",
    "p95LatencyMs",
    "peers",
    "registryConnected",
    "stalePeers",
    "uptimeSeconds",
  ]);

  assert.equal(typeof data.gatewayVersion, "string");
  assert.equal(typeof data.uptimeSeconds, "number");
  assert.equal(typeof data.p95LatencyMs, "number");
  assert.equal(typeof data.errorRatePct, "number");
  assert.equal(typeof data.registryConnected, "boolean");
  assert.equal(typeof data.federationEnabled, "boolean");
});
