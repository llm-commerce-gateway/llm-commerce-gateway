# OSS Split Checklist

This checklist defines the release gate for a clean OSS split. The goal is that a new OSS user can clone this repo and run `pnpm install && pnpm build` without private dependencies or hidden setup.

## Scope

The OSS package surface is:

- `@betterdata/commerce-gateway`
- `@betterdata/commerce-gateway-mcp`
- `@betterdata/registry-mcp`
- `@betterdata/commerce-gateway-connectors`

Any required runtime behavior for these packages must be fully contained in this repository.

## Hard Gates

- [ ] No imports from private/internal monorepo namespaces (for example `@repo/*`)
- [ ] No proprietary package references in OSS packages
- [ ] `pnpm install --frozen-lockfile` works in a fresh clone
- [ ] `pnpm build` works in a fresh clone
- [ ] OSS boundary checks pass for all OSS packages
- [ ] Contract checks pass for core gateway package
- [ ] Typecheck passes for all OSS packages
- [ ] Smoke tests for critical provider integrations (at minimum Grok)

## Release Verification Commands

Run from repository root:

```bash
pnpm install --frozen-lockfile
pnpm build

pnpm --filter @betterdata/commerce-gateway check:contract
pnpm --filter @betterdata/commerce-gateway-mcp check:oss-boundary
pnpm --filter @betterdata/registry-mcp check:oss-boundary

pnpm --filter @betterdata/commerce-gateway typecheck
pnpm --filter @betterdata/commerce-gateway-mcp typecheck
pnpm --filter @betterdata/registry-mcp typecheck
pnpm --filter @betterdata/commerce-gateway-connectors typecheck

pnpm --filter @betterdata/commerce-gateway exec vitest run tests/contract/v0.1.test.ts tests/unit/telemetry.test.ts
pnpm --filter @betterdata/commerce-gateway exec vitest run tests/unit/adapters/grok-adapter.test.ts
```

## CI Enforcement

CI workflow: `.github/workflows/oss-split-verify.yml`

It enforces:

- Node matrix install/build (`18`, `20`, `22`)
- OSS boundary and contract checks
- Typecheck across OSS packages
- Grok smoke tests
