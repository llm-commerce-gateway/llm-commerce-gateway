# Troubleshooting Guide

## Common Issues and Solutions

---

## 🔍 Search Issues

### Products not appearing in search results

**Symptoms:**
- Search returns empty results
- Specific products are missing

**Solutions:**

1. **Check listing is active and in-stock**
   ```sql
   SELECT id, active, inStock FROM product_listings 
   WHERE vendorOrgId = 'your-vendor-id';
   ```

2. **Verify search index is populated**
   ```sql
   SELECT COUNT(*) FROM marketplace_search_index 
   WHERE vendorOrgId = 'your-vendor-id';
   ```

3. **Rebuild search index**
   ```typescript
   import { updateSearchIndex } from '@betterdata/llm-gateway';
   
   const listings = await prisma.productListing.findMany({
     where: { vendorOrgId: 'your-vendor-id', active: true },
   });
   
   for (const listing of listings) {
     await updateSearchIndex(listing.id, prisma);
   }
   ```

4. **Check MySQL FULLTEXT index exists**
   ```sql
   SHOW INDEX FROM marketplace_search_index 
   WHERE Key_name = 'idx_marketplace_fulltext';
   ```

### Search results not ranking correctly

**Symptoms:**
- Authenticated products not appearing first
- Distance not affecting ranking

**Solutions:**

1. **Verify authentication status**
   ```sql
   SELECT id, authenticated FROM product_listings 
   WHERE id = 'listing-id';
   ```

2. **Check location data is set**
   ```sql
   SELECT locationLat, locationLng FROM marketplace_search_index 
   WHERE listingId = 'listing-id';
   ```

3. **Verify user location is passed**
   ```typescript
   const results = await searchProducts({
     text: 'Nike Air Max',
     userLocation: { lat: 40.7128, lng: -74.0060 }, // Required for distance
   });
   ```

---

## 🛒 Cart Issues

### "Listing not found" error

**Symptoms:**
- `CartNotFoundError` when adding to cart
- Listing ID appears invalid

**Solutions:**

1. **Verify listing exists and is active**
   ```sql
   SELECT id, active, inStock FROM product_listings 
   WHERE id = 'listing-id';
   ```

2. **Check inventory availability**
   ```sql
   SELECT availableQuantity FROM product_listings 
   WHERE id = 'listing-id';
   ```

### Cart not persisting between requests

**Symptoms:**
- Cart appears empty after adding items
- Different carts for same user

**Solutions:**

1. **Ensure consistent sessionId**
   ```typescript
   // Use same sessionId for all cart operations
   const sessionId = 'user-session-123';
   
   await cartHandler.addToCart(
     { listingId: 'listing-abc' },
     { sessionId, llmProvider: 'anthropic', timestamp: new Date() }
   );
   
   await cartHandler.viewCart(
     {},
     { sessionId, llmProvider: 'anthropic', timestamp: new Date() } // Same sessionId
   );
   ```

2. **Check session expiration**
   - Sessions expire after inactivity
   - Ensure session is still valid

---

## 🔗 Platform Integration Issues

### Shopify OAuth fails

**Symptoms:**
- OAuth redirect fails
- "Invalid credentials" error

**Solutions:**

1. **Verify OAuth app configuration**
   - Check Client ID and Secret in Shopify Partners
   - Verify redirect URL matches exactly

2. **Check scopes requested**
   ```
   Required scopes:
   - read_products
   - read_inventory
   - write_products (optional)
   ```

3. **Verify webhook configuration**
   - Webhooks registered in Shopify admin
   - Endpoint URL is accessible from internet

### Shopify webhooks not received

**Symptoms:**
- Product updates not syncing
- Inventory changes not reflected

**Solutions:**

1. **Verify webhook registration**
   ```bash
   # List registered webhooks
   curl -X GET \
     "https://{shop}.myshopify.com/admin/api/2024-01/webhooks.json" \
     -H "X-Shopify-Access-Token: {token}"
   ```

2. **Check webhook signature verification**
   ```typescript
   // Ensure SHOPIFY_WEBHOOK_SECRET is set
   console.log(process.env.SHOPIFY_WEBHOOK_SECRET ? 'Set' : 'Missing');
   ```

3. **Test webhook endpoint directly**
   ```bash
   curl -X POST https://your-api.com/webhooks/shopify/products/update \
     -H "Content-Type: application/json" \
     -H "X-Shopify-Hmac-Sha256: test" \
     -d '{"id": 123}'
   ```

### Square connection fails

**Symptoms:**
- OAuth flow fails
- "Invalid credentials" error

**Solutions:**

1. **Verify Square OAuth app settings**
   - Check Application ID and Secret
   - Verify redirect URL in Square Developer Dashboard

2. **Check required permissions**
   ```
   Required permissions:
   - ITEMS_READ
   - INVENTORY_READ
   ```

---

## 📊 Analytics Issues

### Attribution not tracking

**Symptoms:**
- LLM provider showing as "unknown"
- Search query not captured

**Solutions:**

1. **Pass llmProvider in context**
   ```typescript
   await cartHandler.addToCart(
     { listingId: 'listing-abc' },
     {
       sessionId: 'session-123',
       llmProvider: 'anthropic', // Required!
       timestamp: new Date(),
       lastSearchQuery: 'Nike sneakers', // Recommended
       lastListingRank: 1, // Recommended
     }
   );
   ```

2. **Verify addedVia data stored**
   ```sql
   SELECT addedVia FROM cart_items 
   WHERE listingId = 'listing-id';
   ```

---

## 🔧 Database Issues

### "Unknown column" errors

**Symptoms:**
- Prisma queries fail
- Schema mismatch errors

**Solutions:**

1. **Regenerate Prisma client**
   ```bash
   npx prisma generate
   ```

2. **Push schema changes**
   ```bash
   npx prisma db push
   ```

3. **Check schema sync**
   ```bash
   npx prisma migrate status
   ```

### FULLTEXT index errors

**Symptoms:**
- Search queries fail
- "FULLTEXT index not found" error

**Solutions:**

1. **Create FULLTEXT index manually**
   ```sql
   ALTER TABLE marketplace_search_index 
   ADD FULLTEXT INDEX idx_marketplace_fulltext (searchText);
   ```

2. **Verify index exists**
   ```sql
   SHOW INDEX FROM marketplace_search_index;
   ```

### Connection pool exhausted

**Symptoms:**
- "Too many connections" error
- Queries timing out

**Solutions:**

1. **Increase connection limit**
   ```typescript
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + '?connection_limit=10',
       },
     },
   });
   ```

2. **Use connection pooler** (e.g., PgBouncer)

3. **Disconnect after operations**
   ```typescript
   await prisma.$disconnect();
   ```

---

## 🤖 LLM Integration Issues

### MCP server not connecting

**Symptoms:**
- Claude Desktop shows "Server disconnected"
- Tools not appearing

**Solutions:**

1. **Check MCP server logs**
   ```bash
   # Run server manually to see errors
   node dist/mcp-server.js
   ```

2. **Verify Claude Desktop config**
   ```json
   {
     "mcpServers": {
       "better-data-marketplace": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-server.js"],
         "env": {
           "DATABASE_URL": "mysql://..."
         }
       }
     }
   }
   ```

3. **Check file permissions**
   ```bash
   chmod +x /path/to/mcp-server.js
   ```

### Tool calls returning errors

**Symptoms:**
- "Tool execution failed" errors
- Empty results

**Solutions:**

1. **Check tool parameters**
   ```typescript
   // Ensure required parameters are passed
   {
     "name": "product_search",
     "arguments": {
       "query": "Nike shoes", // Required
       "scope": { "type": "global" } // Required
     }
   }
   ```

2. **Enable debug logging**
   ```typescript
   import { setLogger, ConsoleLogger } from '@betterdata/llm-gateway';
   setLogger(new ConsoleLogger('Gateway'));
   ```

---

## 🚀 Deployment Issues

### Build fails

**Symptoms:**
- TypeScript errors during build
- Module not found errors

**Solutions:**

1. **Clear cache and rebuild**
   ```bash
   rm -rf node_modules dist
   pnpm install
   pnpm build
   ```

2. **Check TypeScript version**
   ```bash
   npx tsc --version
   # Should be 5.0+
   ```

### Environment variables not loading

**Symptoms:**
- "DATABASE_URL not defined" error
- Connection failures

**Solutions:**

1. **Check .env file exists**
   ```bash
   ls -la .env*
   ```

2. **Load env in script**
   ```bash
   # start.sh
   source .env.local
   node dist/server.js
   ```

3. **Verify variable values**
   ```typescript
   console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
   ```

---

## 📞 Getting Help

If you're still stuck:

1. **Check logs**
   ```typescript
   import { setLogger, ConsoleLogger } from '@betterdata/llm-gateway';
   setLogger(new ConsoleLogger('Debug'));
   ```

2. **Run tests**
   ```bash
   pnpm test
   ```

3. **Contact support**
   - Email: `support@betterdata.dev`
   - GitHub Issues: [github.com/betterdata/llm-gateway/issues](https://github.com/betterdata/llm-gateway/issues)

---

## Quick Diagnostic Commands

```bash
# Check database connection
npx prisma db pull

# Verify schema
npx prisma validate

# Check migrations
npx prisma migrate status

# Test search index
mysql -e "SELECT COUNT(*) FROM marketplace_search_index"

# Run all tests
pnpm test

# Build check
pnpm build
```

