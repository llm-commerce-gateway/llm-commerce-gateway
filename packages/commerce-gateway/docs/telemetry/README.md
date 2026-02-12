## Telemetry (Optional)

Telemetry is optional and **OFF by default**.

When enabled, the gateway sends **anonymous, aggregate** metrics to improve ecosystem health and reliability.

### What is collected (aggregate + anonymous)

- Gateway version
- Uptime
- Enabled features (registry/federation/streaming)
- High-level usage counts
- Performance indicators (latency, error rate)

### What is NEVER collected

- Prompts or LLM inputs
- Tool input/output payloads
- API keys or secrets
- Tenant/org/customer identifiers (names, domains, emails)
- Headers/body captures or anything identifying

### Enable / Disable (config)

```yaml
telemetry:
  enabled: true
  endpoint: https://telemetry.betterdata.co
```

To explicitly disable:

```yaml
telemetry:
  enabled: false
```

### Enable / Disable (env)

Map an environment variable to the config you pass to the gateway:

```typescript
const telemetryEnabled = process.env.TELEMETRY_ENABLED === 'true';

const gateway = new LLMGateway({
  telemetry: {
    enabled: telemetryEnabled,
  },
});
```

### Preview payload locally (no sending)

You can inspect the exact payload without enabling telemetry:

- `GET /telemetry/preview`
- `GET /api/telemetry/preview`

### Schema

The canonical payload schema is defined in:

`docs/telemetry/schema.json`
