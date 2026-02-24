# Marketplace Launch Checklist

## Pre-Launch Checklist

Use this checklist to ensure your marketplace is ready for production.

---

## 🗄️ Database & Schema

- [ ] **Schema deployed to production database**
  ```bash
  npx prisma db push
  ```

- [ ] **MySQL FULLTEXT indexes created**
  ```sql
  ALTER TABLE marketplace_search_index 
  ADD FULLTEXT INDEX idx_marketplace_fulltext (searchText);
  ```

- [ ] **MySQL SPATIAL indexes created** (if using location search)
  ```sql
  ALTER TABLE marketplace_search_index 
  ADD SPATIAL INDEX idx_marketplace_location (location);
  ```

- [ ] **Database connection pooling configured**
  - Recommended: Use PgBouncer or similar for production

- [ ] **Database backups scheduled**
  - Daily backups recommended

---

## 🔐 Security

- [ ] **Environment variables secured**
  - `DATABASE_URL` - Production MySQL connection
  - `SHOPIFY_WEBHOOK_SECRET` - Shopify HMAC secret
  - `SQUARE_WEBHOOK_SECRET` - Square webhook signature key

- [ ] **Webhook signature verification enabled**
  ```typescript
  verifyShopifyWebhook(req, res, next);
  verifySquareWebhook(req, res, next);
  ```

- [ ] **Rate limiting configured**
  - Search: 100 req/min per IP
  - Cart: 30 req/min per session

- [ ] **CORS configured for API endpoints**

- [ ] **Input validation using Zod schemas**

---

## 📦 Product Catalog

- [ ] **Initial ProductMaster data seeded**
  - GTINs for common products
  - Brand normalization rules

- [ ] **Search index populated**
  ```bash
  npm run db:seed:marketplace
  ```

- [ ] **FULLTEXT search tested**
  ```sql
  SELECT * FROM marketplace_search_index 
  WHERE MATCH(searchText) AGAINST('nike air max');
  ```

---

## 🔗 Vendor Integrations

### VendorPlatformAccount Setup
- [ ] **VendorPlatformAccount model exists in schema**
- [ ] **Platform identifiers stored correctly**
  - `platform`: shopify, square, woocommerce, google_merchant
  - `merchantId`: Platform-specific merchant ID
  - `domain`: Shopify store domain
  - `locationId`: Square location ID
- [ ] **Credentials encrypted at rest**
- [ ] **Token refresh mechanism tested**

### Shopify
- [ ] **OAuth app created in Shopify Partners**
- [ ] **Webhook endpoints registered**
  - `products/update`
  - `products/delete`
  - `inventory_levels/update`
- [ ] **Webhook signature verification tested**
- [ ] **Product sync tested end-to-end**
- [ ] **Platform identifiers extracted**
  - `shopifyProductId`
  - `shopifyVariantId`
  - `shopifyDomain`

### Square
- [ ] **OAuth app created in Square Developer**
- [ ] **Webhook subscriptions configured**
  - `catalog.version.updated`
  - `inventory.count.updated`
- [ ] **Webhook signature verification tested**
- [ ] **Product sync tested end-to-end**
- [ ] **Platform identifiers extracted**
  - `squareCatalogId`
  - `squareVariationId`
  - `squareLocationId`

### Google Merchant Center
- [ ] **Google Cloud project configured**
- [ ] **Content API access enabled**
- [ ] **Service account credentials stored**
- [ ] **Product sync tested end-to-end**

---

## 🎯 Runtime Scoping

- [ ] **Global search tested**
  ```typescript
  await searchProducts({
    text: 'Nike',
    scope: { type: 'global' },
  });
  ```

- [ ] **Shopify store scope tested**
  ```typescript
  await searchProducts({
    text: 'Nike',
    scope: { type: 'shopify_store', domain: 'test.myshopify.com' },
  });
  ```

- [ ] **Square merchant scope tested**
  ```typescript
  await searchProducts({
    text: 'Nike',
    scope: { type: 'square_merchant', merchantId: 'sq_123' },
  });
  ```

- [ ] **Vendor scope tested**
  ```typescript
  await searchProducts({
    text: 'Nike',
    scope: { type: 'vendor', vendorId: 'org-vendor-123' },
  });
  ```

- [ ] **MarketplaceSearchIndex has scoping indexes**
  ```sql
  SHOW INDEX FROM marketplace_search_index 
  WHERE Key_name LIKE 'idx_marketplace_%_scope';
  ```

---

## 🤖 LLM Integrations

### MCP (Claude Desktop)
- [ ] **MCP server built and deployed**
  ```bash
  pnpm build
  ```

- [ ] **Tools registered correctly**
  - `product_search` (with scope parameter)
  - `add_to_cart`
  - `view_cart`
  - `update_cart_quantity`
  - `remove_from_cart`

- [ ] **Claude Desktop config documented**
  ```json
  {
    "mcpServers": {
      "better-data-marketplace": {
        "command": "node",
        "args": ["/path/to/mcp-server.js"]
      }
    }
  }
  ```

- [ ] **End-to-end test with Claude Desktop**

### OpenAI Functions
- [ ] **Function definitions exported**
- [ ] **Response formatting tested**

### Grok
- [ ] **Tool definitions compatible**
- [ ] **Response formatting tested**

---

## 🧪 Testing

- [ ] **Unit tests passing**
  ```bash
  pnpm test:unit
  # Target: 80%+ coverage
  ```

- [ ] **Integration tests passing**
  ```bash
  pnpm test
  ```

- [ ] **E2E tests passing**
  ```bash
  pnpm test:e2e
  ```

- [ ] **Load testing completed**
  - Search: 100 req/sec
  - Cart: 50 req/sec

---

## 📊 Analytics & Monitoring

- [ ] **Analytics tables created**
  - `analytics_events`

- [ ] **Attribution tracking verified**
  - LLM provider captured
  - Search query captured
  - Rank position captured

- [ ] **Logging configured**
  ```typescript
  import { setLogger, StructuredLogger } from '@betterdata/commerce-gateway';
  setLogger(new StructuredLogger(winstonLogger));
  ```

- [ ] **Error tracking configured** (Sentry, etc.)

- [ ] **Health check endpoint available**
  ```
  GET /health → { status: 'healthy' }
  ```

---

## 🚀 Deployment

- [ ] **Build completes without errors**
  ```bash
  pnpm build
  ```

- [ ] **TypeScript types generate correctly**

- [ ] **Package exports correct**
  ```bash
  npm pack --dry-run
  ```

- [ ] **Documentation updated**
  - README.md
  - API_REFERENCE.md
  - VENDOR_GUIDE.md

---

## 📋 Vendor Onboarding

- [ ] **Onboarding flow tested**
  1. Welcome → Profile → Connect → Import → Complete

- [ ] **Shopify OAuth flow tested**

- [ ] **Square OAuth flow tested**

- [ ] **Product import tested**
  - GTIN matching
  - Fuzzy name matching
  - New product creation

- [ ] **Search index updates after import**

---

## 📝 Legal & Compliance

- [ ] **Terms of Service drafted**

- [ ] **Privacy Policy drafted**

- [ ] **Vendor Agreement drafted**

- [ ] **Marketplace fees documented**
  - FREE tier
  - HOSTED tier ($19/mo)
  - SCM tiers ($99-$999/mo)

---

## 🎯 Go-Live Checklist

### Day Before Launch

- [ ] Final database backup
- [ ] All tests passing
- [ ] Staging environment mirrors production
- [ ] Team briefed on launch plan

### Launch Day

- [ ] Switch DNS (if applicable)
- [ ] Enable production webhooks
- [ ] Monitor error rates
- [ ] Monitor search performance
- [ ] Verify first vendor onboarding

### Post-Launch

- [ ] Monitor analytics dashboard
- [ ] Review first-day errors
- [ ] Gather initial vendor feedback
- [ ] Plan first iteration improvements

---

## 📞 Support Readiness

- [ ] Support email configured: `support@betterdata.dev`
- [ ] Status page configured: `status.betterdata.dev`
- [ ] Documentation site deployed: `docs.betterdata.dev`
- [ ] FAQ written
- [ ] Troubleshooting guide written

---

## ✅ Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Product Manager | | | |
| Security Review | | | |
| QA Lead | | | |

---

## Rollback Plan

If issues occur post-launch:

1. **Revert database changes** (if schema changed)
2. **Disable webhooks** in Shopify/Square
3. **Point DNS to maintenance page**
4. **Notify vendors** via email
5. **Investigate and fix**
6. **Re-deploy when ready**

Emergency contacts:
- On-call: `oncall@betterdata.dev`
- PagerDuty: [link]

