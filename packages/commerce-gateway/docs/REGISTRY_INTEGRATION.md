# LLM Gateway OSS + Commerce Registry Protocol Integration

This document explains how the LLM Gateway OSS works with the Commerce Registry Protocol.

---

## Overview

The **LLM Gateway OSS** (`@betterdata/llm-gateway`) is an open-source gateway implementation that can work **standalone** or **integrated** with the Commerce Registry Protocol. The registry provides:

- **Brand Resolution**: Find gateways by brand name
- **GTIN Resolution**: Find authoritative sources for products
- **Discovery**: Centralized directory of registered gateways
- **Trust Scores**: Verified gateway reliability metrics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM (Claude, GPT, etc.)                    │
│                                                               │
│  User: "@shop Nike"                                           │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ MCP Tool Call: shop()
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM Gateway OSS (@betterdata/llm-gateway)        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  @shop Query Parser                                  │    │
│  │  parseShopQuery("@shop Nike")                        │    │
│  │  → { type: "brand", brand: "Nike" }                 │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Registry Client (Optional)                           │    │
│  │  registry.resolveBrand("Nike")                       │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│                     │ HTTP Request                            │
│                     ▼                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      │ GET /api/resolve/brand?q=Nike
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Commerce Registry (registry.betterdata.co)          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Resolution Service                                  │    │
│  │  - Brand Index                                       │    │
│  │  - GTIN Index                                        │    │
│  │  - Trust Scores                                      │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                        │
│                     │ Response                                │
│                     ▼                                        │
│  {                                                           │
│    "found": true,                                            │
│    "brand": "Nike",                                          │
│    "gateway": {                                              │
│      "endpoint": "https://commerce.nike.com/llm/v1",        │
│      "protocol": "mcp"                                       │
│    },                                                         │
│    "trust_score": 95                                         │
│  }                                                           │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ Gateway Endpoint
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Brand's Gateway (Self-hosted or Hosted)         │
│                                                              │
│  POST /llm/v1/search                                         │
│  { "query": "browse catalog" }                              │
│                                                              │
│  → Returns product catalog                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Registry Client (`@betterdata/llm-gateway/registry`)

The gateway includes a **Registry Client** that implements the Commerce Registry Protocol:

```typescript
import { createRegistryClient } from '@betterdata/llm-gateway/registry';

// Create client (defaults to registry.betterdata.co)
const registry = createRegistryClient({
  baseUrl: 'https://registry.betterdata.co', // Optional
  timeout: 10000, // Optional
});

// Resolve brand
const resolution = await registry.resolveBrand('Nike');
if (resolution.found) {
  console.log(resolution.gateway.endpoint); // https://commerce.nike.com/llm/v1
}

// Resolve GTIN
const gtinResolution = await registry.resolveGTIN('0012345678901');
if (gtinResolution.found) {
  console.log(gtinResolution.authoritative_source.brand); // "Nike"
}
```

**Location**: `packages/llm-gateway/src/registry/client.ts`

### 2. @shop Query Parser

The gateway parses `@shop` queries to extract brand, product query, or GTIN:

```typescript
import { parseShopQuery } from '@betterdata/llm-gateway/registry';

const parsed = parseShopQuery('@shop Nike Air Max');
// { type: 'brand', brand: 'Nike', productQuery: 'Air Max' }

const parsed2 = parseShopQuery('@shop 0012345678901');
// { type: 'gtin', gtin: '0012345678901' }
```

**Location**: `packages/llm-gateway/src/registry/shop-parser.ts`

### 3. MCP Tool Integration

The gateway exposes an `@shop` tool via MCP that uses the registry:

```typescript
// In packages/llm-gateway/src/mcp/tools/index.ts

async function shopHandler(input, context) {
  // Get registry client
  const registryClient = context.registryClient ?? createRegistryClient();
  
  // Parse query
  const parsed = parseShopQuery(input.query);
  
  // Resolve via registry
  let resolution;
  if (parsed.type === 'gtin') {
    resolution = await registryClient.resolveGTIN(parsed.gtin);
  } else {
    resolution = await registryClient.resolveBrand(parsed.brand);
    
    // Fallback to .well-known discovery if not found
    if (!resolution.found) {
      const wellKnown = await registryClient.tryWellKnownDiscovery(parsed.brand);
      if (wellKnown) {
        resolution = wellKnown;
      }
    }
  }
  
  // Call resolved gateway...
}
```

**Location**: `packages/llm-gateway/src/mcp/tools/index.ts`

---

## How It Works: Step-by-Step

### Example: "@shop Nike"

1. **User sends query**: `"@shop Nike"`

2. **LLM recognizes trigger**: The LLM sees `@shop` and invokes the `shop` tool

3. **Gateway parses query**:
   ```typescript
   parseShopQuery("@shop Nike")
   // → { type: "brand", brand: "Nike" }
   ```

4. **Gateway calls registry**:
   ```typescript
   await registry.resolveBrand("Nike")
   // → GET https://registry.betterdata.co/api/resolve/brand?q=Nike
   ```

5. **Registry responds**:
   ```json
   {
     "found": true,
     "brand": "Nike",
     "gateway": {
       "endpoint": "https://commerce.nike.com/llm/v1",
       "protocol": "mcp",
       "capabilities": {
         "catalog_search": true,
         "pricing": "public",
         "inventory": "real_time"
       }
     },
     "trust_score": 95
   }
   ```

6. **Gateway calls Nike's endpoint**:
   ```typescript
   // Create gateway client
   const nikeGateway = createGatewayClient({
     endpoint: "https://commerce.nike.com/llm/v1",
     protocol: "mcp"
   });
   
   // Call gateway
   const products = await nikeGateway.search("browse catalog");
   ```

7. **Results returned to LLM**: Product catalog data

---

## Fallback: .well-known Discovery

If a brand is **not registered** in the registry, the gateway can fall back to `.well-known` discovery:

```typescript
// Try registry first
let resolution = await registry.resolveBrand("NewBrand");

// If not found, try .well-known
if (!resolution.found) {
  resolution = await registry.tryWellKnownDiscovery("NewBrand");
  // Checks: https://newbrand.com/.well-known/commerce-gateway.json
  //         https://www.newbrand.com/.well-known/commerce-gateway.json
  //         etc.
}
```

This allows brands to participate **without registering** in the central registry.

**Location**: `packages/llm-gateway/src/registry/client.ts` (line 173)

---

## Protocol Compliance

The LLM Gateway OSS implements the **Commerce Registry Protocol** specification:

### ✅ Resolution API

- `GET /api/resolve/brand?q={brand}` - Brand resolution
- `GET /api/resolve/gtin/{gtin}` - GTIN resolution
- `GET /api/resolve/category/{path}` - Category resolution

**Implementation**: `packages/llm-gateway/src/registry/client.ts`

### ✅ .well-known Schema

- Validates `.well-known/commerce-gateway.json` format
- Extracts gateway endpoint and capabilities

**Implementation**: `packages/llm-gateway/src/registry/well-known-schema.ts`

### ✅ Query Parsing

- Parses `@shop {brand}`, `@shop {brand} {query}`, `@shop {gtin}`

**Implementation**: `packages/llm-gateway/src/registry/shop-parser.ts`

---

## Standalone Mode

The gateway can work **without the registry**:

1. **Direct Gateway URLs**: Configure gateways directly
2. **.well-known Discovery**: Use `.well-known` endpoints
3. **Custom Resolution**: Implement your own resolution logic

```typescript
// Use gateway without registry
const gateway = createLLMGateway({
  // No registry client needed
  gateways: [
    {
      brand: "Nike",
      endpoint: "https://commerce.nike.com/llm/v1",
      protocol: "mcp"
    }
  ]
});
```

---

## Configuration

### With Registry (Recommended)

```typescript
import { createLLMGateway } from '@betterdata/llm-gateway';
import { createRegistryClient } from '@betterdata/llm-gateway/registry';

const registry = createRegistryClient({
  baseUrl: 'https://registry.betterdata.co', // Optional
});

const gateway = createLLMGateway({
  registryClient: registry, // Enable @shop support
});
```

### Without Registry

```typescript
const gateway = createLLMGateway({
  // No registry client = no @shop support
  // But can still use direct gateway calls
});
```

---

## Protocol Specification

The **Commerce Registry Protocol** is an **open specification** (MIT License):

- **Location**: `commerce-registry-protocol/`
- **Specs**:
  - `spec/resolution.md` - Resolution API
  - `spec/registration.md` - Registration API
  - `spec/well-known.md` - .well-known schema

The LLM Gateway OSS implements this protocol, allowing it to work with:
- ✅ Better Data's registry (`registry.betterdata.co`)
- ✅ Self-hosted registries
- ✅ Other registry implementations

---

## Benefits

### For Brands

1. **Self-Host**: Run your own gateway (OSS)
2. **Register**: Get discovered via central registry
3. **Trust**: Build trust score through verification
4. **Fallback**: Still discoverable via `.well-known` if not registered

### For Developers

1. **Open Source**: Full control over gateway implementation
2. **Protocol Compliant**: Works with any registry
3. **Flexible**: Can work standalone or with registry
4. **Extensible**: Easy to add custom resolution logic

---

## Example: Full Flow

```typescript
import { createLLMGateway } from '@betterdata/llm-gateway';
import { createRegistryClient } from '@betterdata/llm-gateway/registry';

// 1. Create registry client
const registry = createRegistryClient({
  baseUrl: 'https://registry.betterdata.co',
});

// 2. Create gateway with registry support
const gateway = createLLMGateway({
  registryClient: registry,
});

// 3. User query: "@shop Nike running shoes"
// 4. Gateway parses: { type: 'brand', brand: 'Nike', productQuery: 'running shoes' }
// 5. Gateway resolves via registry: GET /api/resolve/brand?q=Nike
// 6. Registry returns: { gateway: { endpoint: 'https://commerce.nike.com/llm/v1' } }
// 7. Gateway calls Nike: POST /llm/v1/search { query: 'running shoes' }
// 8. Nike returns: { products: [...] }
// 9. Gateway returns results to LLM
```

---

## Related Files

- **Registry Client**: `packages/llm-gateway/src/registry/client.ts`
- **Query Parser**: `packages/llm-gateway/src/registry/shop-parser.ts`
- **.well-known Schema**: `packages/llm-gateway/src/registry/well-known-schema.ts`
- **MCP Integration**: `packages/llm-gateway/src/mcp/tools/index.ts`
- **Protocol Spec**: `commerce-registry-protocol/spec/`

---

*Last Updated: 2025-01-07*

