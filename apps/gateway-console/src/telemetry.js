const FORBIDDEN_KEY_SUBSTRINGS = [
  'prompt',
  'payload',
  'secret',
  'apikey',
  'api_key',
  'token',
  'tenant',
  'org',
  'organization',
  'email',
  'domain',
  'header',
  'body',
];

function hasForbiddenKey(key) {
  const lowered = String(key).toLowerCase();
  return FORBIDDEN_KEY_SUBSTRINGS.some((substr) => lowered.includes(substr));
}

export function buildTelemetryPreview() {
  return {
    schema_version: '1.1',
    timestamp: new Date().toISOString(),
    gateway: {
      version: 'v0.1.0',
      runtime: 'node',
      runtime_version: process.version,
      deployment: 'self-hosted',
      uptime_seconds: Math.floor(process.uptime()),
    },
    features: {
      registry_enabled: false,
      federation_enabled: false,
      streaming_enabled: false,
    },
    usage: {
      request_count_session: 0,
      tool_invocations_session: 0,
      providers_used: [],
      tool_count: 0,
    },
    health: {
      error_rate_pct: 0,
      p95_latency_ms: 0,
    },
  };
}

export function assertNoForbiddenFields(payload) {
  const violations = [];

  const visit = (value, path) => {
    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        const nextPath = `${path}.${key}`;
        if (hasForbiddenKey(key)) {
          violations.push(nextPath);
        }
        visit(nested, nextPath);
      }
    }
  };

  visit(payload, 'telemetry');
  return violations;
}

export { FORBIDDEN_KEY_SUBSTRINGS };
