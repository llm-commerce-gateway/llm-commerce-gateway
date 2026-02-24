# Promotion Runbook

This runbook defines the promotion path from internal development in `bd-forge-main` to OSS packaging in `llm-commerce-gateway`, then to GitHub and npm.

## Repositories

- Internal source repo: `/Users/toddp/Projects/bd-forge-main`
- OSS release repo: `/Users/toddp/Projects/llm-commerce-gateway`

## OSS package surface

Only these packages are promoted as OSS:

- `@betterdata/commerce-gateway`
- `@betterdata/commerce-gateway-mcp`
- `@betterdata/registry-mcp`
- `@betterdata/commerce-gateway-connectors`

## Step 1: Develop in internal repo

1. Implement feature/fix in `bd-forge-main`.
2. Run local checks there (targeted tests, package typecheck, contract/boundary checks where applicable).
3. Confirm no proprietary/internal imports leak into OSS code paths.

## Step 2: Curate and copy to OSS repo

1. Create a branch in `llm-commerce-gateway` for promotion.
2. Copy only OSS-safe code and docs.
3. Keep public package names, exports, and examples aligned with OSS package manifests.
4. Exclude proprietary modules, hosted logic, and private infra assumptions.

## Step 3: Validate as an OSS user

Run from `llm-commerce-gateway` root:

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

pnpm --filter @betterdata/commerce-gateway exec vitest run tests/contract/v0.1.test.ts
pnpm --filter @betterdata/commerce-gateway exec vitest run tests/unit/telemetry.test.ts
pnpm --filter @betterdata/commerce-gateway exec vitest run tests/unit/adapters/grok-adapter.test.ts
```

If any command fails due to missing files/dependencies, promotion is blocked until the OSS repo is self-sufficient.

## Step 4: Open PR and merge

1. Commit curated changes with clear OSS-focused message.
2. Push branch and open PR in `llm-commerce-gateway`.
3. Ensure CI passes, especially `oss-split-verify`.
4. Merge to `main` when checks are green.

## Step 5: Package and publish

1. Bump versions in OSS repo.
2. Build and smoke-check packages again.
3. Publish the four OSS packages to npm.
4. Validate published versions.

## Step 6: Consume from internal repo

1. In `bd-forge-main`, update dependencies to published semver versions.
2. Prefer versioned npm refs for release parity (avoid `workspace:*` for production parity checks).
3. Verify app behavior using published artifacts.
