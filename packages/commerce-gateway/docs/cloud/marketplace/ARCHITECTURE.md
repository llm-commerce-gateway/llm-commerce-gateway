# Marketplace Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI Platforms                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Claude    │  │   ChatGPT   │  │    Grok     │  │   Gemini    │ │
│  │   (MCP)     │  │  (OpenAI)   │  │   (xAI)     │  │  (Google)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       LLM Gateway                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Tool Handlers                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │   │
│  │  │ search_     │ │ add_to_     │ │ view_cart/remove_from_  │ │   │
│  │  │ products    │ │ cart        │ │ cart                    │ │   │
│  │  └──────┬──────┘ └──────┬──────┘ └────────────┬────────────┘ │   │
│  └─────────┼───────────────┼─────────────────────┼──────────────┘   │
│            │               │                     │                   │
│            ▼               ▼                     ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Core Services                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │   │
│  │  │ Search      │ │ Cart        │ │ Analytics               │ │   │
│  │  │ Service     │ │ Handler     │ │ Service                 │ │   │
│  │  └──────┬──────┘ └──────┬──────┘ └────────────┬────────────┘ │   │
│  └─────────┼───────────────┼─────────────────────┼──────────────┘   │
└────────────┼───────────────┼─────────────────────┼──────────────────┘
             │               │                     │
             └───────────────┴─────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Database Layer                                │
│  ┌──────────────────────┐ ┌──────────────────────────────────────┐  │
│  │     MySQL DB         │ │              Prisma ORM              │  │
│  │  ┌────────────────┐  │ │                                      │  │
│  │  │ ProductMaster  │  │ │  • Type-safe queries                 │  │
│  │  │ ProductListing │  │ │  • Migrations                        │  │
│  │  │ VendorProfile  │  │ │  • Connection pooling                │  │
│  │  │ SearchIndex    │  │ │                                      │  │
│  │  │ CartItem       │  │ │                                      │  │
│  │  └────────────────┘  │ │                                      │  │
│  └──────────────────────┘ └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
             ▲               ▲
             │               │
┌────────────┴───────────────┴────────────────────────────────────────┐
│                     Vendor Integrations                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Shopify    │  │   Square    │  │ WooCommerce │                  │
│  │  Webhooks   │  │  Webhooks   │  │   Webhooks  │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                        ProductMaster                             │
│  • Canonical product record                                      │
│  • GTIN/UPC identifier                                          │
│  • Brand + product name                                          │
│  • Shared across all vendors                                     │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ 1:N
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ProductListing                             │
│  • Vendor-specific offering                                      │
│  • Price, inventory, location                                    │
│  • Authentication status (Signal Tag)                            │
│  • Shipping options                                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ 1:1
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MarketplaceSearchIndex                         │
│  • Denormalized for fast search                                  │
│  • FULLTEXT index on searchText                                  │
│  • SPATIAL index for location                                    │
│  • Ranking signals (sales, views)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
Organization ─────────────┬──────────────────────────┐
     │                    │                          │
     │ 1:1                │ 1:N                      │
     ▼                    ▼                          │
VendorProfile      ProductListing ◄───────┐         │
                         │                 │         │
                         │ N:1             │ N:1     │
                         ▼                 │         │
                   ProductMaster           │         │
                         │                 │         │
                         │ 1:N             │         │
                         ▼                 │         │
                   ProductVariant          │         │
                         │                 │         │
                         │                 │         │
Cart ─────────────────── CartItem ─────────┘         │
  │                                                  │
  └──────────────────────────────────────────────────┘
                    (via Session)
```

## Search Flow

```
User Query: "Nike Air Max 97 silver"
                │
                ▼
┌─────────────────────────────────────┐
│  1. Parse Query                      │
│  • Extract brand: "Nike"            │
│  • Extract product: "Air Max 97"    │
│  • Extract attributes: "silver"     │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  2. MySQL FULLTEXT Search           │
│  MATCH(searchText) AGAINST(?)       │
│  WITH filters (inStock, active)     │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  3. Location Calculation            │
│  ST_Distance_Sphere(location, ?)    │
│  Convert to miles                   │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  4. Group by ProductMaster          │
│  Collect all listings per product   │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  5. Rank Listings                    │
│  • +20 for authentication           │
│  • +30 for distance <10mi           │
│  • +15 for rating ≥4.5              │
│  • +10 for competitive price        │
│  • +10 for free shipping            │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  6. Format for LLM                   │
│  Human-readable markdown            │
│  Include listing IDs for cart       │
└─────────────────────────────────────┘
```

## Cart Flow

```
LLM: "Add listing-abc to cart"
                │
                ▼
┌─────────────────────────────────────┐
│  1. Validate Listing                 │
│  • Exists?                           │
│  • Active?                           │
│  • In stock?                         │
│  • Quantity available?               │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  2. Get/Create Cart                  │
│  • Find by sessionId                 │
│  • Create if not exists              │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  3. Check Existing                   │
│  • Same listing in cart?             │
│  • Update quantity if exists         │
│  • Create new item if not            │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  4. Store Attribution                │
│  addedVia: {                         │
│    llmProvider: "anthropic",        │
│    timestamp: "...",                 │
│    searchQuery: "Nike Air Max",     │
│    searchRank: 1                     │
│  }                                   │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  5. Return Cart State                │
│  • Items grouped by vendor           │
│  • Subtotals per vendor              │
│  • Total                             │
│  • Multi-vendor notice               │
└─────────────────────────────────────┘
```

## Vendor Sync Flow

```
Shopify Webhook: products/update
                │
                ▼
┌─────────────────────────────────────┐
│  1. Verify Signature                 │
│  HMAC-SHA256(body, secret)          │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  2. Find Vendor                      │
│  Integration by shopDomain          │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  3. Find Listing                     │
│  By vendorSku or shopifyVariantId   │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  4. Update Listing                   │
│  • Price                             │
│  • Inventory                         │
│  • Description                       │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  5. Update Search Index              │
│  Refresh denormalized data          │
└─────────────────────────────────────┘
```

## Analytics Flow

```
Cart Event
    │
    ▼
┌─────────────────────────────────────┐
│  CartItem.addedVia = {              │
│    llmProvider: "anthropic",        │
│    timestamp: "...",                │
│    searchQuery: "Nike sneakers",   │
│    searchRank: 1                    │
│  }                                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Analytics Aggregation               │
│                                      │
│  SELECT llmProvider,                │
│         COUNT(*) as events,         │
│         SUM(price) as revenue       │
│  FROM cart_items                    │
│  WHERE vendorOrgId = ?              │
│  GROUP BY llmProvider               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Dashboard Display                   │
│                                      │
│  Claude:   45 events | $6,750       │
│  ChatGPT:  32 events | $4,200       │
│  Grok:     12 events | $1,500       │
└─────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **LLM Protocol** | MCP | Claude Desktop integration |
| | OpenAI Functions | ChatGPT integration |
| | Grok Tools | X/Grok integration |
| **Gateway** | TypeScript | Core business logic |
| | Zod | Input validation |
| | Hono | HTTP framework (optional) |
| **Database** | MySQL | Primary data store |
| | Prisma | ORM, migrations |
| **Search** | MySQL FULLTEXT | Text search |
| | MySQL SPATIAL | Location search |
| **Integrations** | Shopify Admin API | Product sync |
| | Square Catalog API | Product sync |
| **Testing** | Vitest | Unit/E2E tests |

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Production                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Load Balancer                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│              ┌─────────────┴─────────────┐                     │
│              ▼                           ▼                      │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │   API Server 1      │    │   API Server 2      │            │
│  │   (Gateway)         │    │   (Gateway)         │            │
│  └─────────────────────┘    └─────────────────────┘            │
│              │                           │                      │
│              └─────────────┬─────────────┘                     │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MySQL (PlanetScale)                         │   │
│  │              Read replicas for search                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

