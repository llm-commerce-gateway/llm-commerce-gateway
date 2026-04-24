# Promotion Runbook

This runbook defines the promotion path from internal development in `bd-forge-main` to OSS packaging in `llm-commerce-gateway`, then to GitHub and npm.

## Repositories

- Internal source repo: `/Users/toddp/Projects/bd-forge-main`
- OSS release repo: `/Users/toddp/Projects/llm-commerce-gateway`

## OSS package surface

The following packages are promoted as OSS under Apache-2.0:

- `@betterdata/commerce-gateway`
- `@betterdata/commerce-gateway-mcp`
- `@betterdata/registry-mcp`
- `@betterdata/commerce-gateway-connectors`

## OSS application surface

The following applications are promoted as OSS under Apache-2.0 and ship
as part of this repository (not published to npm):

- `@betterdata/gateway-console` — self-hosted, single-tenant operator
  UI at `apps/gateway-console/`. Canonical OSS home. No longer lives
  in `bd-forge-main`. See the "Gateway Console promotion" section
  below for boundary rules.

## OSS example surface

The following runnable examples live under `examples/` and are shipped
with the repo (not published to npm). They exist to teach the pattern
`LLM → Commerce Gateway → Data source` end to end.

- `@betterdata/commerce-chat-ui` — LLM chat UI at `examples/commerce-chat-ui/`.
  Provider picked by `LLM_PROVIDER` env var, no in-app toggles.
- `@betterdata/demo-gateway` — reference Commerce Gateway at
  `examples/demo-gateway/`. Works out of the box over a static JSON catalog
  (`DATA_SOURCE=demo`); swap in a custom backend with `DATA_SOURCE=custom`.
- `examples/demo-data/luxe-bond/` — bundled static catalog.
- `examples/recipes/*/` — per-recipe README + `.env.example` that configure
  the two apps for different use cases.

See the "Examples promotion" section below for boundary rules. These
examples were promoted out of `bd-forge-main/apps/{commerce-demo,demo-gateway}`
in 2026-04 and now live canonically in this repository.

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

---

## Gateway Console promotion

`@betterdata/gateway-console` (at `apps/gateway-console/`) is the
Apache-2.0, self-hosted, single-tenant operator UI for Commerce
Gateway. It was promoted out of `bd-forge-main` in 2026-04 and now
lives canonically in this repository. Future changes to Gateway
Console happen in this repo directly — there is no upstream source in
`bd-forge-main` to re-promote from.

### Boundary rules

Gateway Console must remain:

- **Single-tenant**. No tenant/org identifier flows through config or
  routes. Local `gateway.config.json` only.
- **Login-free**. No Clerk, NextAuth, or other auth provider. No
  `(authenticated)` route groups. The app is intended to run bound to
  localhost or private infrastructure.
- **Local-first**. Persistence is `gateway.config.json` on disk. No
  Prisma, no database client, no ORM. Read-path fallbacks are allowed
  (e.g. env var `REGISTRY_URL` overriding config).
- **Free of `@repo/*` imports**. Only `@betterdata/commerce-gateway*`
  sibling packages, standard Node.js, Next.js, and React.
- **Free of `apps/*` cross-imports**. The console must not reach into
  another app's source or public assets (this was an explicit finding
  during the 2026-04 promotion).

### OSS compliance requirements

| Requirement | Enforced by |
|---|---|
| `license: "Apache-2.0"` in `package.json` | Code review + boundary check |
| No Prisma / `@repo/*` / Clerk / DATABASE_URL imports | `scripts/check-oss-boundary.mjs --package apps/gateway-console` |
| No `.vercel/project.json` committed | `.gitignore` + PR review |
| `README.md` declares SCM-vs-console boundary | README lint / code review |
| Builds on Node 18, 20, 22 | `oss-split-verify` workflow matrix |
| Sibling workspace deps (`@betterdata/commerce-gateway*`) resolve | `pnpm install --frozen-lockfile` in CI |

### Verification steps

Run from repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @betterdata/gateway-console typecheck
pnpm --filter @betterdata/gateway-console build
pnpm --filter @betterdata/gateway-console test
node scripts/check-oss-boundary.mjs --package apps/gateway-console
```

All five commands must pass before merging Gateway Console changes to
`main`. The same steps are enforced by the `oss-split-verify` workflow
in CI.

### What does NOT belong in Gateway Console

These are the surfaces that live in `bd-forge-main` and must **never**
land in this app:

- Multi-tenant gateway UI (`apps/scm/app/(authenticated)/(gateway)/`
  in `bd-forge-main`)
- Tenant provisioning, billing, rate-limits, federation notifications
  tied to the SCM platform
- Any database-backed registry store (`PrismaRegistryStore` etc.)
- Any proprietary auth provider (`SecurityAuthProvider` etc.)

If a feature request for Gateway Console would require any of the
above, the answer is "build it in SCM" — not here.

---

## Examples promotion

The runnable examples in `examples/` implement a single pattern:
**LLM → Commerce Gateway → Data source**. They are deliberately narrow
and should stay that way. Architecture details live in
`docs/architecture/examples.md`.

### Invariants

Any change under `examples/` must preserve all of the following:

- **LLM is always present.** There is no non-LLM code path. If text goes
  in, an LLM sees it.
- **LLM provider is env-driven.** Selection happens in
  `LLM_PROVIDER={anthropic|openai|xai}`. There is no in-app toggle.
  Add a new provider by implementing `LlmProvider`, never by adding a
  button.
- **No route fragmentation.** `commerce-chat-ui` exposes exactly one
  API route: `POST /api/chat`. Alternate transports (staging-only, direct,
  remote MCP) belong in their own future recipe, not inline in this app.
- **No workflow toggles.** No governed / standard / custom switcher in
  the UI. Governance belongs in a separate loop-engine OSS surface.
- **Data source is the primary variable.** `DATA_SOURCE={demo|custom}`
  in `demo-gateway` is the main knob; recipes differ on this value.
- **Gateway contract is constant.** Every recipe — and anything a third
  party plugs in — speaks `POST /api/gateway/query` with the shape
  documented in `packages/commerce-gateway`.

### Boundary rules

Examples inherit every constraint imposed on apps. They must remain:

- **Free of `@repo/*`, `@prisma/*`, `@clerk/*`, `next-auth` imports.**
  Enforced by `scripts/check-oss-boundary.mjs` (which treats
  `examples/*` with the same strict rules as `apps/*`).
- **Free of hosted-gateway / proprietary backend imports.** No reaching
  back into `bd-forge-main` shapes.
- **Runnable with no external services.** `DATA_SOURCE=demo` must not
  need a database, Redis, queue, or cloud account.
- **Single-process, single-user.** No auth, no tenant IDs, no
  multi-user assumptions.

### OSS compliance requirements

| Requirement | Enforced by |
|---|---|
| `license: "Apache-2.0"` in each example's `package.json` | Code review + boundary check |
| No forbidden imports under `examples/**` | `scripts/check-oss-boundary.mjs --package examples/commerce-chat-ui --package examples/demo-gateway` |
| `.env.example` documents every required env var | Code review |
| Each recipe has a `README.md` with goal, data source, run steps, expected behavior | Code review |
| Typecheck + build passes for both apps | `oss-split-verify` workflow |
| `examples/demo-data/luxe-bond/products.json` stays in sync with `demo-gateway/lib/static-catalog.ts` fallback | Code review when editing either |

### Verification steps

Run from repository root:

```bash
pnpm install --frozen-lockfile
node scripts/check-oss-boundary.mjs \
  --package examples/commerce-chat-ui \
  --package examples/demo-gateway
pnpm --filter @betterdata/commerce-chat-ui typecheck
pnpm --filter @betterdata/commerce-chat-ui build
pnpm --filter @betterdata/demo-gateway typecheck
pnpm --filter @betterdata/demo-gateway build
```

All six commands must pass before merging example changes to `main`.
CI runs the same steps via `oss-split-verify`.

### What does NOT belong in `examples/`

- Control-plane UIs, dashboards, toggle farms.
- Multi-tenant, auth, billing, or org concepts.
- Workflow governance (approvals, evidence rails) — that belongs in a
  future loop-engine OSS surface.
- Backend-specific code paths (Prisma, PlanetScale, Shopify SDK, etc.).
  A recipe that needs one of those should implement a `DataSource`
  under `examples/demo-gateway/lib/data-source/`, not fork the apps.
- Anything named "demo control panel". If you find yourself building
  one, stop and write a recipe instead.

### Adding a new recipe

1. Create `examples/recipes/<name>/README.md` explaining goal, data
   source, env vars, run steps, and expected behavior.
2. Create `examples/recipes/<name>/.env.example` split between
   `commerce-chat-ui` and `demo-gateway` values.
3. If a new data source is needed, implement it under
   `examples/demo-gateway/lib/data-source/<name>.ts` and register it in
   `lib/data-source/index.ts`. Do not fork the chat UI.
4. Link the recipe from `examples/README.md`.
