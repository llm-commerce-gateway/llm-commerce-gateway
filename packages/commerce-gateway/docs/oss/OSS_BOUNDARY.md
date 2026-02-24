# OSS Boundary Guardrail

OSS packages must not import proprietary code. A lightweight scan enforces this
boundary across OSS packages:

- `packages/commerce-gateway`
- `packages/registry-mcp`
- `packages/commerce-gateway-mcp`

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
pnpm --filter @betterdata/commerce-gateway check:oss-boundary
pnpm --filter @betterdata/registry-mcp check:oss-boundary
pnpm --filter @betterdata/commerce-gateway-mcp check:oss-boundary
```

## CI Integration

- `@betterdata/commerce-gateway` runs the check as part of `check:contract`.
- `@betterdata/registry-mcp` and `@betterdata/commerce-gateway-mcp` expose `test` scripts
  that run this boundary scan.
