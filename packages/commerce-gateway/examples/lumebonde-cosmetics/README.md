# Lumebondé Cosmetics Demo (OSS)

> **In-memory product catalog demo for LLM Gateway**
> No SCM dependencies, no auth required.

This example showcases the `@betterdata/commerce-gateway` with a beauty/cosmetics catalog aligned with the [Lumebondé Data Bible](/demo/docs/LUMEBONDE_DATA_BIBLE.md).

## 🌟 Features

- ✅ 15-product cosmetics catalog (skincare, haircare, makeup)
- ✅ In-memory catalog (no database required)
- ✅ Simple keyword search
- ✅ Category filtering
- ✅ CSV and JSON import examples
- ✅ No authentication required
- ✅ OSS-compatible (no SCM dependencies)

## 📦 Product Catalog

| SKU | Product | Category | Price |
|-----|---------|----------|-------|
| LMBD-SERUM-001 | Radiance Serum | Skincare > Serums | $89 |
| LMBD-MOIST-001 | Hydra Glow Moisturizer | Skincare > Moisturizers | $65 |
| LMBD-SHAMP-001 | Silk Repair Shampoo | Haircare > Shampoos | $42 |
| LMBD-COND-001 | Silk Repair Conditioner | Haircare > Conditioners | $42 |
| LMBD-LIPOIL-001 | Rose Petal Lip Oil | Makeup > Lip | $28 |
| LMBD-KIT-SKIN | Complete Skincare Set | Skincare > Sets | $139 |
| LMBD-KIT-HAIR | Hair Repair Duo | Haircare > Sets | $74 |
| LMBD-KIT-HOLIDAY | Holiday Gift Set | Skincare > Sets | $129 |
| + 7 more... | | | |

## 🚀 Quick Start

### Run the Demo Script

```bash
# Navigate to the example
cd packages/commerce-gateway/examples/lumebonde-cosmetics

# Run full demo
npx tsx demo.ts

# Search for products
npx tsx demo.ts search "vitamin C serum"
npx tsx demo.ts search "gift set"
npx tsx demo.ts search "damaged hair"

# List all products
npx tsx demo.ts list

# List by category
npx tsx demo.ts list Skincare
```

### Import with CLI

```bash
# Import from JSON
npx llm-gateway json --file ./data/catalog.json

# Import from CSV
npx llm-gateway csv --file ./data/catalog.csv
```

## 📁 Project Structure

```
lumebonde-cosmetics/
├── data/
│   ├── catalog.json     # Full product catalog (JSON)
│   └── catalog.csv      # Same catalog as CSV
├── demo.ts              # Demo script with search examples
├── package.json
└── README.md
```

## 🔌 Integration Example

### Using with LLM Gateway

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { createInMemoryCatalog } from '@betterdata/commerce-gateway/catalog';
import catalog from './data/catalog.json';

// Create in-memory catalog
const productCatalog = createInMemoryCatalog(catalog);

// Initialize gateway
const gateway = new LLMGateway({
  extensions: { productCatalog },
  llmProviders: ['anthropic', 'openai'],
});

await gateway.start(3000);
```

### Using with MCP Server (Claude)

```typescript
import { MCPServer } from '@betterdata/commerce-gateway/mcp';
import { createInMemoryCatalog, BasicSearchService } from '@betterdata/commerce-gateway/catalog';
import catalog from './data/catalog.json';

const productCatalog = createInMemoryCatalog(catalog);
const searchService = new BasicSearchService(productCatalog);

const server = new MCPServer({
  name: 'lumebonde-cosmetics',
  extensions: {
    productCatalog,
    searchService,
  },
  tools: ['search_products', 'get_product_details'],
});

server.start();
```

### Programmatic Import

```typescript
import { importFromJSON, importFromCSV, importToCatalog } from '@betterdata/commerce-gateway/ingestion';
import { createInMemoryCatalog } from '@betterdata/commerce-gateway/catalog';

// Option 1: Import from JSON file
const jsonResult = await importFromJSON('./data/catalog.json');
console.log(`Imported ${jsonResult.imported} products from JSON`);

// Option 2: Import from CSV file
const csvResult = await importFromCSV('./data/catalog.csv');
console.log(`Imported ${csvResult.imported} products from CSV`);

// Option 3: Import directly to catalog
const catalog = createInMemoryCatalog();
await importToCatalog(catalog, {
  platform: 'json',
  credentials: { source: './data/catalog.json', isFilePath: true },
});
console.log(`Catalog now has ${catalog.count()} products`);
```

## 🔍 Example Queries

The demo script includes example searches:

| Query | Expected Results |
|-------|------------------|
| "vitamin C serum for brightening" | LMBD-SERUM-001 (Radiance Serum) |
| "gift set" | LMBD-KIT-SKIN, LMBD-KIT-HAIR, LMBD-KIT-HOLIDAY |
| "damaged hair repair" | LMBD-SHAMP-001, LMBD-COND-001 |
| "hydrating moisturizer" | LMBD-MOIST-001 |
| "lip" | LMBD-LIPOIL-001 (Rose Petal Lip Oil) |
| "sample" | LMBD-SAMPLE-SERUM, LMBD-SAMPLE-MOIST, LMBD-SAMPLE-SHAMP |

## 📊 CSV Column Mapping

The CSV file uses these columns:

| Column | Description | Required |
|--------|-------------|----------|
| `id` | Unique product ID | ✅ |
| `name` | Product name | ✅ |
| `description` | Product description | |
| `brand` | Brand name | |
| `category` | Category path (> separated) | |
| `price` | Price in currency | ✅ |
| `currency` | Currency code (default: USD) | |
| `sku` | Stock keeping unit | |
| `gtin` | UPC/EAN/GTIN | |
| `inStock` | true/false | |
| `quantity` | Stock quantity | |
| `tags` | Comma-separated tags | |

## 🆚 OSS vs Cloud Feature Matrix

| Feature | OSS (This Demo) | Cloud Free | Cloud Pro |
|---------|:---------------:|:----------:|:---------:|
| **Ingestion** ||||
| CSV/JSON import | ✅ | ✅ | ✅ |
| Shopify/Square sync | ✅ | ✅ | ✅ |
| Auto-sync scheduling | ❌ | ✅ | ✅ |
| **Search** ||||
| Keyword search | ✅ | ✅ | ✅ |
| Filters & pagination | ✅ | ✅ | ✅ |
| ML-ranked results | ❌ | ❌ | ✅ |
| Semantic search | ❌ | ❌ | ✅ |
| **Catalog** ||||
| In-memory | ✅ | ✅ | ✅ |
| PostgreSQL | ❌ | ✅ | ✅ |
| Multi-tenant | ❌ | ✅ | ✅ |
| **Analytics** ||||
| Basic events | ✅ | ✅ | ✅ |
| Full event suite | ❌ | ✅ | ✅ |
| Realtime streaming | ❌ | ❌ | ✅ |

## 🔍 Capability Discovery

Use runtime capability discovery to feature-gate appropriately:

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: { type: 'memory' },
  discovery: { type: 'tag-based' },
});

// Query what's available
const caps = await hub.getCapabilities();

if (caps.features.discovery.rankedResults) {
  console.log('ML ranking available (Cloud Pro)');
} else {
  console.log('Using keyword search (OSS mode)');
}

if (!caps.features.analytics.realtime) {
  console.log('Realtime analytics requires Cloud Pro');
}
```

See [CAPABILITIES.md](../../docs/oss/CAPABILITIES.md) for the full capability schema.

## 🎯 When to Use This Demo

This demo is perfect for:
- Prototyping AI shopping assistants
- Testing LLM Gateway integration
- Local development
- Single-store scenarios

For production multi-tenant deployments, see the [SCM integration guide](../../docs/guides/scm-integration.mdx).

---

> *Lumebondé is a fictitious brand used for demonstration purposes only.*

## 📄 License

MIT

## 🔗 Related

- [Lumebondé Data Bible](/demo/docs/LUMEBONDE_DATA_BIBLE.md) - Complete data specification
- [LLM Gateway Documentation](../../docs/) - Full documentation
- [MCP Integration Guide](../../docs/guides/claude-mcp.mdx) - Claude Desktop setup

