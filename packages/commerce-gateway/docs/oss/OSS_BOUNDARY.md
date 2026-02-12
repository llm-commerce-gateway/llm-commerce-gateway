# OSS Boundary Guardrail

OSS packages must not import proprietary code. A lightweight scan enforces this
boundary across OSS packages:

- `packages/llm-gateway`
- `packages/registry-mcp`
- `packages/gateway-mcp`

## Forbidden Imports (Examples)

- `apps/*`
- `betterdata-llm-gateway-adapters`
- `@betterdata/hosted-gateway`
- `@betterdata/hosted-gateway-mcp`

## How to Run

From the repo root:

```bash
node scripts/check-oss-boundary.mjs
```

From a package:

```bash
pnpm --filter @betterdata/llm-gateway check:oss-boundary
pnpm --filter @betterdata/registry-mcp check:oss-boundary
pnpm --filter @betterdata/gateway-mcp check:oss-boundary
```

## CI Integration

- `@betterdata/llm-gateway` runs the check as part of `check:contract`.
- `@betterdata/registry-mcp` and `@betterdata/gateway-mcp` expose `test` scripts
  that run this boundary scan.
