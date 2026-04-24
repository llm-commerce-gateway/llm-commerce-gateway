import test from "node:test";
import assert from "node:assert/strict";
import { buildTelemetryPreview, assertNoForbiddenFields } from "../src/telemetry.js";

test("telemetry payload contains no forbidden fields", () => {
  const payload = buildTelemetryPreview();
  const violations = assertNoForbiddenFields(payload);

  assert.equal(violations.length, 0, `Forbidden telemetry fields found: ${violations.join(", ")}`);
});

test("telemetry preview returns schema v1.1 payload shape", () => {
  const data = buildTelemetryPreview();

  assert.equal(data.schema_version, "1.1");
  assert.ok(data.gateway);
  assert.equal(typeof data.gateway.runtime_version, "string");
  assert.ok(data.features);
  assert.ok(data.usage);
  assert.ok(data.health);
  assert.equal(typeof data.timestamp, "string");
});
