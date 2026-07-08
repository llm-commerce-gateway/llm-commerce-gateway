# Track C — promotion & docs flip (planning)

**Status:** Planning only — no implementation in this doc.  
**Depends on:** Track B rc.2 publish complete on npm (`1.0.0-rc.2` on `next` + `latest` per RC-OSS-2 pattern).

## Promotion gate (RC-OSS-2 → GA / `latest` semantics)

Before treating the scope as GA-ready:

1. Close or re-waive RC-OSS-2 checklist items **#2, #3, #9, #11** (coverage, connector sandbox, e2e smoke, bundle size).
2. Complete **RC-OSS-3** (README quickstarts, examples, community infra) — **excluding** deferred `createMCPServer` quickstart fix per Track B scope.
3. Run full 11-point checklist on the promotion commit.
4. Todd explicit go-ahead before any `latest` promotion that implies GA.

## RC-OSS-3 (content & community)

- README install paths for all four `@commercegateway/*` packages aligned with published bins (`registry-mcp`, `gateway-mcp`).
- Example apps / copy-paste flows that do not depend on proprietary `@betterdata/*` surfaces.
- Issue templates / contributing pointer on `llm-commerce-gateway/llm-commerce-gateway`.

## Docs flip (commercegateway.io)

- Retarget public docs from `@betterdata/commerce-gateway` → `@commercegateway/*` only after promotion gate sign-off.
- Keep pre-release warning until GA decision.

## Deferred (out of Track C unless re-scoped)

- `createMCPServer` quickstart correction.
- CI hygiene: remove duplicate pnpm version pin in GitHub Actions (infra red on PR #1 / main).
- `bd-forge-main` `oss-release.yml` as canonical publish path (GATEWAY-OSS follow-up).
- `commerce-registry-protocol` unscoped publish.

## Suggested sequencing

1. Operator completes rc.2 npm publish + verification smoke.
2. Merge docs sign-off PR (`docs/RC-OSS-2-SIGNOFF.md` evidence).
3. Open Track C epics for RC-OSS-3 + docs flip; fix CI in a small hygiene PR (outside Track B).
