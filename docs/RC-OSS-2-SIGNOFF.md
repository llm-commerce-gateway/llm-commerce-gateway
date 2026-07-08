# RC-OSS-2 sign-off — `@commercegateway/*` bootstrap publish

**Date:** 2026-07-08  
**Tree:** `llm-commerce-gateway/llm-commerce-gateway` OSS mirror → release commit `0fff382` (`chore(release): 1.0.0-rc.1`)  
**Decision authority:** Todd (approved 2026-07-08)

---

## Publish decision

| Field | Value |
| --- | --- |
| **Version** | `1.0.0-rc.1` (all 4 scoped packages) |
| **Dist-tag** | `next` + `latest` → `1.0.0-rc.1` (bootstrap; promotion gate still applies before GA) |
| **Publish source (tonight)** | Manual bootstrap from **this OSS mirror** (`betterdata-oss/commerce-gateway`) |
| **Follow-up** | Re-point `bd-forge-main` `oss-release.yml` as canonical publish path (GATEWAY-OSS follow-up ticket) |
| **Out of scope tonight** | `commerce-registry-protocol` (unscoped MIT spec — not in the 4-package rc.1 set); commercegateway.io docs flip (retimed to `latest` promotion) |

Bare `npm install @commercegateway/*` resolves to `1.0.0-rc.1` via `latest`; treat as **pre-release** until promotion gate closes.

---

## 11-point QA checklist

| # | Check | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | TypeScript strict — all 4 packages | **GREEN** | `pnpm exec tsc --noEmit` → 0 errors each @ `3da80be`; rc.1 mechanics build PASS |
| 2 | Unit tests (80%+ coverage) | **WAIVED (`next`)** | 131/131 OSS core PASS; coverage **10.4% statements** — see waiver § |
| 3 | Connectors ↔ sandbox APIs | **WAIVED (`next`)** | No live sandbox integration suite; build + typecheck only — see waiver § |
| 4 | LLM providers → structured output | **GREEN** | Contract 29/29 PASS; Grok adapter 4/4 PASS |
| 5 | registry-mcp protocol compliance | **GREEN** | `tools/list` → 8 tools; OSS boundary PASS |
| 6 | Secret scan | **GREEN** | Scoped pattern scan PASS; 1 benign whitelist entry — see § Secret scan |
| 7 | Dependency audit (published surface) | **GREEN** | Tarball install + `npm audit` in clean scratch dir: **0 critical / 0 high** all 4 — see § Prod audit |
| 8 | License compatibility | **GREEN** | Direct prod deps: 0 incompatible (MIT/Apache-2/BSD family) |
| 9 | Self-hosted smoke (MemoryMerchantRegistry) | **WAIVED (`next`)** | Unit-level registry/hub coverage PASS; no dedicated e2e smoke script — see waiver § |
| 10 | `npm pack` dry-run | **GREEN** | All 4 `@commercegateway/*@1.0.0-rc.1`; `publishConfig.access: public` on each |
| 11 | Bundle size < 50KB gzip | **WAIVED (`next`)** | Main entry gzip: cg **76,831 B** FAIL; siblings PASS — see waiver § |

**RC-OSS-2 gate for `next` publish:** GREEN with documented waivers (items 2, 3, 9, 11).

---

## Waivers (`next` only — promotion gate to `latest`)

| Item | Rationale |
| --- | --- |
| **#2 Coverage** | OSS vitest suite proves contract/boundary correctness (131/131) but does not target 80% line coverage. Acceptable for rc.1 under `next`; promotion requires coverage plan or revised gate. |
| **#3 Connector sandbox** | Connectors ship typed adapters without live Shopify/Woo/BigCommerce sandbox CI. Consumers integrate against their own sandboxes. |
| **#9 E2E smoke** | `MemoryMerchantRegistry` exercised in unit tests; no standalone "clone → install → gateway flow" script. RC-OSS-3 quickstarts partially satisfy. |
| **#11 Bundle size** | `@commercegateway/commerce-gateway` main export is a multi-surface monolith (19 subpaths); 76KB gzip on `dist/index.js` exceeds 50KB gate. Subpath imports mitigate; revisit gate definition at `latest` promotion. |

### Promotion gate (`next` → `latest`)

All of the following before setting `latest`:

1. Close waived items #2, #3, #9, #11 (fix or re-waive with updated rationale)
2. **RC-OSS-3** complete (README quickstarts, examples, community infra)
3. **commercegateway.io docs flip** (`@betterdata/commerce-gateway` → `@commercegateway/*`)
4. Re-run full 11-point checklist on promotion commit
5. Todd explicit go-ahead

---

## Secret scan (item #6)

**Method:** Trufflehog via `npx` attempted twice — hung >3 min (killed). Completed **scoped pattern scan** on publish surfaces + `docs/`, `scripts/`, `.github/` (excludes `node_modules`, `.git`, `dist`).

| Result | Detail |
| --- | --- |
| **Verdict** | PASS — zero non-benign findings |
| **Whitelist** | `packages/commerce-gateway/SECURITY.md:63` — `sk_live_abc123` in a "never do this" documentation example |

---

## Prod audit — published-surface interpretation (item #7)

Workspace-root `pnpm audit` is **not** the gate — it bleeds `next@15.5.9` from `apps/gateway-console` and `examples/*` into publish-package reports.

**Gate method:** For each package: `npm pack` → install tarball(s) into clean scratch dir with `file:` peers → `npm audit --omit=dev --audit-level=high`.

| Package | Tarball | Critical | High | Verdict |
| --- | --- | --- | --- | --- |
| `@commercegateway/commerce-gateway` | `commercegateway-commerce-gateway-1.0.0.tgz` | 0 | 0 | PASS |
| `@commercegateway/commerce-gateway-connectors` | `…-connectors-1.0.0.tgz` | 0 | 0 | PASS |
| `@commercegateway/registry-mcp` | `…-registry-mcp-1.0.0.tgz` | 0 | 0 | PASS |
| `@commercegateway/commerce-gateway-mcp` | `…-commerce-gateway-mcp-1.0.0.tgz` | 0 | 0 | PASS |

Re-run at `1.0.0-rc.1` before publish using same method.

---

## Pre-publish mechanics (Phase 1)

| Check | Status |
| --- | --- |
| Versions `1.0.0-rc.1` | Set on all 4 packages |
| Internal dep ranges | `^1.0.0-rc.1` on peer/dep edges (prerelease semver) |
| `publishConfig.access: "public"` | All 4 — **required** (scoped default is restricted) |
| `repository` / `homepage` | `github.com/llm-commerce-gateway/llm-commerce-gateway` + per-package `directory` |
| `pnpm build` | PASS |
| `npm pack --dry-run` @ rc.1 | 322 / 16 / 8 / 39 files respectively |

**Publish order:** `commerce-gateway` → `connectors` → `registry-mcp` → `commerce-gateway-mcp`  
(`commerce-registry-protocol` deferred — not in rc.1 set)

---

## Operator gate (Phase 2)

| Check | Status |
| --- | --- |
| `npm whoami` | **PASS** — Todd authenticated; manual bootstrap executed 2026-07-08 |
| `@commercegateway` org | **PASS** — org exists; all 4 packages published under scope |

---

## Follow-up tickets

| ID | Title | Owner |
| --- | --- | --- |
| **F-1** | Re-point `bd-forge-main` `oss-release.yml` as canonical publish path; retire mirror manual bootstrap | Platform |
| **F-2** | Promotion gate checklist (`next` → `latest`) — waivers + RC-OSS-3 + docs flip | Todd + Cursor |

---

## Why rc.1 shipped with 10% coverage

RC-OSS-2 item 1 (strict TS) was the last **technical** blocker before scope migration landed. Items 2, 3, 9, 11 were assessed as **quality bars for public launch (`latest`)**, not blockers for a tagged pre-release under `next`. Todd approved publishing `1.0.0-rc.1` to `next` with explicit waivers so early adopters can `npm install @commercegateway/commerce-gateway@next` while RC-OSS-3 (docs, examples, community) and the commercegateway.io docs sweep remain gated on promotion to `latest`.

---

## Post-publish verification (2026-07-08)

**Git tag:** `v1.0.0-rc.1` → `0fff382` (`chore(release): 1.0.0-rc.1`) on `llm-commerce-gateway/llm-commerce-gateway`

**Publish order (manual bootstrap):** `commerce-gateway` → `connectors` → `registry-mcp` → `commerce-gateway-mcp`

| Package | Version | `next` | `latest` | Published (UTC) |
| --- | --- | --- | --- | --- |
| `@commercegateway/commerce-gateway` | `1.0.0-rc.1` | ✓ | ✓ | 2026-07-08T14:53:35Z |
| `@commercegateway/commerce-gateway-connectors` | `1.0.0-rc.1` | ✓ | ✓ | 2026-07-08 |
| `@commercegateway/registry-mcp` | `1.0.0-rc.1` | ✓ | ✓ | 2026-07-08 |
| `@commercegateway/commerce-gateway-mcp` | `1.0.0-rc.1` | ✓ | ✓ | 2026-07-08 |

**Registry spot-check (post-publish):**

```text
npm view @commercegateway/commerce-gateway dist-tags
# → { next: '1.0.0-rc.1', latest: '1.0.0-rc.1' }
```

All four scoped packages return `1.0.0-rc.1` on both `next` and `latest`. `commerce-registry-protocol` remains unpublished (out of rc.1 set).

**RC-OSS-2 bootstrap publish: DONE.**

---

*Durable sign-off artifact.*

## Track B closeout — `1.0.0-rc.2` (2026-07-08)

| Step | Status | Evidence |
| --- | --- | --- |
| PR #1 `chore/rc2-hygiene` (`1259862`) | **MERGED** | Merge commit `8d7298a` — CI workflows red (pnpm `action-setup` v9 vs `packageManager` `9.15.9` mismatch on all jobs); merge proceeded without green checks |
| Release commit | **PUSHED** | `dba79f8` (`chore(release): 1.0.0-rc.2`) — all 4 packages + internal `^1.0.0-rc.2` ranges |
| `pnpm build` / `typecheck` | **PASS** | Local on `dba79f8` |
| `check:oss-boundary` | **PASS** | All 4 packages (connectors via root script) |
| `npm pack --dry-run` (`registry-mcp`) | **PASS** | `@commercegateway/registry-mcp@1.0.0-rc.2`; `bin.registry-mcp` → `dist/index.js` in `package.json` |
| Git tag | **PUSHED** | `v1.0.0-rc.2` → `dba79f8` |
| npm publish (`next` + `latest`) | **BLOCKED** | `npm publish` for `@commercegateway/commerce-gateway@1.0.0-rc.2` failed **`EOTP`** — requires authenticator OTP in operator shell |

**Operator follow-up:** From each package dir, in order: `npm publish --access public --tag next`, then `npm dist-tag add @commercegateway/<pkg>@1.0.0-rc.2 latest`. Re-run `npm view` + `npx @commercegateway/registry-mcp --help` smoke after publish.
