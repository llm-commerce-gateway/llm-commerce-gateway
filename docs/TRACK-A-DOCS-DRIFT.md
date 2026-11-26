# Track A — docs drift punch list

Inventory of public install/tool-name claims vs code, as of 2026-11-26. Fixes landed on `docs/track-a-credibility` (this repo) and `commercegateway.io` PR.

| Location | Was | Now / remaining |
| --- | --- | --- |
| `commercegateway.io` Hero, TopNav, adapters, quick-start | `@commerce-gateway/sdk`, `@commerce-gateway/server` | `@commercegateway/commerce-gateway*` `1.0.0-rc.2` |
| Homepage tool chips | `product.search` | MCP names `search_products`, … |
| Well-known examples | `product.search` | Kept as **capability ids**; documented vs MCP names |
| `commerce-gateway-mcp/README.md` | License MIT | Apache-2.0 |
| `CONNECTOR_STATUS.md` | Skeleton / TODO | Storefront/Woo/BC + Admin order-get gap |
| Root README / API_REFERENCE | `createMCPServer`, `registerConnector` | `createGatewayMCPServer` + `getBackends()` |
| Hosted copy | Implied GA | Private beta, not self-serve |
| Docker | `commercegateway/server` image | No published image |
| UCP | Implied by “connect Shopify to AI” | Explicit: not implemented |
| Per-platform connector READMEs | `@betterdata/llm-gateway-*` | `@commercegateway/commerce-gateway-connectors/*` |
| `bd-forge-main` `CONNECTOR_STATUS.md` | Skeleton (canonical repo) | Follow-up PR on a clean branch |
| UCP binding / `/.well-known/ucp` | — | Track I, gated |
| Hosted self-serve / npm unfreeze | — | Not Track A |
