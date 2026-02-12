## Telemetry (Optional)

This gateway includes optional, opt-in telemetry to help us understand ecosystem health and prioritize fixes.

Telemetry is disabled by default.

### What telemetry does

If enabled, the gateway sends anonymous, aggregate metrics, such as:

- Gateway version
- Uptime
- Enabled features
- High-level usage counts
- Performance indicators (latency, error rate)

### What telemetry does NOT do

We never collect:

- Prompts or LLM inputs
- Tool input or output payloads
- API keys or secrets
- End-user or customer data
- Organization names or identifiers
- Headers/body captures or anything identifying

Telemetry data cannot be used to identify you or your users.

### Enabling Telemetry

```yaml
telemetry:
  enabled: true
  endpoint: https://telemetry.betterdata.co
```

### Disabling Telemetry

Telemetry is disabled by default.
To explicitly disable:

```yaml
telemetry:
  enabled: false
```

### Transparency

The telemetry payload schema is documented in:

`docs/telemetry/schema.json`

You can preview the payload locally:

`GET /telemetry/preview` (also available at `/api/telemetry/preview`)

The gateway works fully with telemetry disabled.
