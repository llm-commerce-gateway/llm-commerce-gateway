# Connector Implementation Status

## ✅ Shopify Connector - COMPLETE

**Status**: Fully implemented with all methods

### Implemented Features:
- ✅ Product search with GraphQL Storefront API
- ✅ Product details retrieval
- ✅ Inventory checking
- ✅ Product recommendations
- ✅ Cart creation and management
- ✅ Add/update/remove cart items
- ✅ Order creation (via checkout)
- ✅ Totals calculation

### API Used:
- Shopify Storefront GraphQL API
- Cart API mutations
- Checkout API for orders

---

## ✅ BigCommerce Connector - COMPLETE

**Status**: Fully implemented with all methods

### Implemented Features:
- ✅ Product search via REST API `/v3/catalog/products`
- ✅ Product details with variants
- ✅ Inventory checking via `/v3/catalog/products/{id}/variants`
- ✅ Cart operations via `/v3/carts`
- ✅ Order creation via `/v3/orders`
- ✅ Shipping/tax calculation via `/v3/carts/{id}/estimate`

### API Details:
- Base URL: `https://api.bigcommerce.com/stores/{storeHash}/v3`
- Auth: OAuth token in `X-Auth-Token` header
- Rate Limit: 400 requests per second

---

## ✅ WooCommerce Connector - COMPLETE

**Status**: Fully implemented with all methods

### Implemented Features:
- ✅ Product search via REST API `/wp-json/wc/v3/products`
- ✅ Product details with variations
- ✅ Inventory checking
- ✅ Cart operations (in-memory session storage - no native cart API)
- ✅ Order creation via `/wp-json/wc/v3/orders`
- ✅ Shipping/tax calculation (simplified estimation)

### API Details:
- Base URL: `{storeUrl}/wp-json/wc/v3`
- Auth: Basic Auth (consumer key/secret)
- Rate Limit: Configurable in WooCommerce settings

### Note on Cart Storage:
WooCommerce doesn't have a native cart API, so carts are stored in-memory. In production, this should be replaced with Redis or database storage for persistence.

---

## Known gaps

- Shopify **order get / lookup** requires Admin API; Storefront connector throws.
- WooCommerce **cart** is in-memory; persist separately in production.
- This package does **not** speak Shopify UCP.

## Tests / docs

Prefer mocked unit tests and the public quickstarts on [commercegateway.io](https://commercegateway.io/docs/getting-started/quick-start).

**Last updated:** 2026-11-26 (Track A status hygiene)
