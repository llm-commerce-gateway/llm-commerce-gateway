# API Reference

## Search Service

### `searchProducts(query)`

Search for products across vendor listings with optional runtime scoping.

```typescript
import { searchProducts } from '@betterdata/llm-gateway';

// Global search (all vendors)
const results = await searchProducts({
  text: 'Nike Air Max 97',
  scope: { type: 'global' },
  userLocation: { lat: 40.7128, lng: -74.0060 },
  filters: {
    brand: 'Nike',
    priceMin: 100,
    priceMax: 200,
    authenticatedOnly: true,
    inStockOnly: true,
  },
  sortBy: 'relevance',
  limit: 20,
});

// Scoped search (single Shopify store)
const storeResults = await searchProducts({
  text: 'Nike Air Max 97',
  scope: {
    type: 'shopify_store',
    domain: 'mybrand.myshopify.com',
  },
});

// Scoped search (single Square merchant)
const merchantResults = await searchProducts({
  text: 'running shoes',
  scope: {
    type: 'square_merchant',
    merchantId: 'sq_merchant_123',
  },
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Search query |
| `scope` | SearchScope | No | Runtime scope (default: global) |
| `scope.type` | string | Yes | `global`, `shopify_store`, `square_merchant`, `vendor`, `platform` |
| `scope.domain` | string | No | Shopify store domain (for `shopify_store`) |
| `scope.merchantId` | string | No | Square merchant ID (for `square_merchant`) |
| `scope.vendorId` | string | No | Vendor org ID (for `vendor`) |
| `scope.platform` | string | No | Platform name (for `platform`) |
| `userLocation` | object | No | User's location for distance ranking |
| `userLocation.lat` | number | No | Latitude |
| `userLocation.lng` | number | No | Longitude |
| `filters.brand` | string | No | Filter by brand name |
| `filters.category` | string | No | Filter by category |
| `filters.priceMin` | number | No | Minimum price |
| `filters.priceMax` | number | No | Maximum price |
| `filters.authenticatedOnly` | boolean | No | Only Signal Tag verified |
| `filters.inStockOnly` | boolean | No | Only in-stock items (default: true) |
| `sortBy` | string | No | Sort order: `relevance`, `price_low`, `price_high`, `distance` |
| `limit` | number | No | Max results (default: 20) |

**Scope Types:**

| Scope Type | Description | Required Parameters |
|------------|-------------|---------------------|
| `global` | Search all vendors in marketplace | None |
| `shopify_store` | Search single Shopify store | `domain` |
| `square_merchant` | Search single Square merchant | `merchantId` |
| `vendor` | Search all platforms for one vendor | `vendorId` |
| `platform` | Search all vendors on one platform | `platform` |

**Returns:** `SearchResult[]`

```typescript
interface SearchResult {
  product: {
    id: string;
    brand: string;
    name: string;
    description: string;
    gtin?: string;
    images?: string[];
  };
  listings: RankedListing[];
  totalVendors: number;
  relevanceScore: number;
}

interface RankedListing {
  id: string;
  vendorOrgId: string;
  vendorName: string;
  vendorRating?: number;
  
  // Platform identifiers (for runtime scoping)
  platform?: string;           // 'shopify', 'square', 'woocommerce', 'google_merchant'
  merchantId?: string;         // Platform-specific merchant ID
  platformProductId?: string;  // Platform-specific product ID
  platformVariantId?: string;  // Platform-specific variant ID
  
  price: number;
  currency: string;
  authenticated: boolean;
  signalTagId?: string;
  inStock: boolean;
  availableQuantity?: number;
  distance?: number;
  shippingOptions: ShippingOption[];
  pickupAvailable: boolean;
  rankScore: number;
  rankFactors: {
    distance: number;
    authentication: number;
    price: number;
    vendorRating: number;
    shipping: number;
    total: number;
  };
}
```

---

## Product Matcher

### `matchOrCreateProduct(vendorOrgId, product, prisma)`

Match a vendor product to canonical ProductMaster.

```typescript
import { matchOrCreateProduct } from '@betterdata/llm-gateway';

const result = await matchOrCreateProduct('vendor-123', {
  gtin: '883419029844',
  vendorSku: 'SKU-001',
  brand: 'Nike',
  name: 'Air Max 97 OG Silver Bullet',
  price: 140.00,
  inStock: true,
}, prisma);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vendorOrgId` | string | Yes | Vendor's organization ID |
| `product` | VendorProductInput | Yes | Product data |
| `prisma` | PrismaClient | Yes | Prisma client instance |

**VendorProductInput:**

```typescript
interface VendorProductInput {
  gtin?: string;
  vendorSku: string;
  brand?: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  availableQuantity?: number;
  locationData?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number;
    lng?: number;
  };
  shippingOptions?: ShippingOption[];
  images?: string[];
  metadata?: any;
}
```

**Returns:** `MatchResult`

```typescript
interface MatchResult {
  productMaster: ProductMaster;
  isNewProduct: boolean;
  matchConfidence: number; // 0-1
  matchMethod: 'gtin' | 'brand_name_fuzzy' | 'manual' | 'new';
}
```

---

## Cart Handler

### `createCartHandler(prisma)`

Create a cart handler instance.

```typescript
import { createCartHandler } from '@betterdata/llm-gateway';

const cartHandler = createCartHandler(prisma);
```

### `cartHandler.addToCart(params, context)`

Add item to cart.

```typescript
const result = await cartHandler.addToCart(
  { listingId: 'listing-abc', quantity: 1 },
  {
    sessionId: 'session-123',
    llmProvider: 'anthropic',
    timestamp: new Date(),
    lastSearchQuery: 'Nike sneakers',
    lastListingRank: 1,
  }
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `params.listingId` | string | Yes | ProductListing ID |
| `params.quantity` | number | No | Quantity (default: 1) |
| `context.sessionId` | string | Yes | User session ID |
| `context.llmProvider` | string | Yes | LLM provider |
| `context.timestamp` | Date | Yes | Request timestamp |
| `context.lastSearchQuery` | string | No | Search query for attribution |
| `context.lastListingRank` | number | No | Rank position for attribution |

**Returns:** `CartResponse`

```typescript
interface CartResponse {
  type: 'cart_updated' | 'cart_contents' | 'cart_empty' | 'error';
  content: string; // LLM-friendly message
  data?: Cart;
  error?: string;
}

interface Cart {
  cartId: string;
  sessionId: string;
  items: CartItem[];
  totalItems: number;
  totalValue: number;
  vendorCount: number;
  itemsByVendor: VendorCart[];
}
```

### `cartHandler.viewCart(params, context)`

View cart contents.

```typescript
const result = await cartHandler.viewCart({}, {
  sessionId: 'session-123',
  llmProvider: 'anthropic',
  timestamp: new Date(),
});
```

### `cartHandler.removeFromCart(params, context)`

Remove item from cart.

```typescript
const result = await cartHandler.removeFromCart(
  { cartItemId: 'cart-item-xyz' },
  context
);
```

---

## Analytics Service

### `createAnalyticsService(prisma)`

Create an analytics service instance.

```typescript
import { createAnalyticsService } from '@betterdata/llm-gateway';

const analytics = createAnalyticsService(prisma);
```

### `analytics.getOverview(vendorOrgId, period)`

Get overview stats.

```typescript
const overview = await analytics.getOverview('vendor-123', '30d');
```

**Returns:** `OverviewResponse`

```typescript
interface OverviewResponse {
  period: '7d' | '30d' | '90d' | '365d';
  stats: {
    searchAppearances: number;
    cartAdds: number;
    conversionRate: number;
    orders: number;
    revenue: number;
    avgRank: number;
  };
}
```

### `analytics.getAttribution(vendorOrgId, period)`

Get LLM attribution breakdown.

```typescript
const attribution = await analytics.getAttribution('vendor-123', '30d');
```

**Returns:** `AttributionResponse`

```typescript
interface AttributionResponse {
  period: AnalyticsPeriod;
  totalEvents: number;
  totalRevenue: number;
  byProvider: ProviderAttribution[];
}

interface ProviderAttribution {
  provider: 'anthropic' | 'openai' | 'grok' | 'google' | 'unknown';
  events: number;
  revenue: number;
  percentage: number;
}
```

### `analytics.getCompetitiveInsights(vendorOrgId)`

Get competitive analysis.

```typescript
const competitive = await analytics.getCompetitiveInsights('vendor-123');
```

**Returns:** `CompetitiveResponse`

```typescript
interface CompetitiveResponse {
  myStats: {
    avgPrice: number;
    avgRating: number;
    authenticatedPercentage: number;
  };
  competitors: Competitor[];
  insights: {
    pricePosition: 'lower' | 'average' | 'higher';
    ratingPosition: 'lower' | 'average' | 'higher';
  };
}
```

### `analytics.getRecommendations(vendorOrgId)`

Get improvement recommendations.

```typescript
const recommendations = await analytics.getRecommendations('vendor-123');
```

**Returns:** `RecommendationsResponse`

```typescript
interface RecommendationsResponse {
  recommendations: Recommendation[];
  totalPotentialBoost: number;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'authentication' | 'pricing' | 'reputation' | 'inventory' | 'shipping' | 'content';
  title: string;
  description: string;
  impact: string;
  potentialRankBoost: number;
  action: {
    label: string;
    url: string;
  };
}
```

---

## Ranking Service

### `rankListings(searchResults, query)`

Rank listings by multiple factors.

```typescript
import { rankListings } from '@betterdata/llm-gateway';

const ranked = rankListings(rawSearchResults, {
  text: 'Nike Air Max',
  userLocation: { lat: 40.7128, lng: -74.0060 },
});
```

### `calculateDistance(point1, point2)`

Calculate distance between two coordinates.

```typescript
import { calculateDistance } from '@betterdata/llm-gateway';

const miles = calculateDistance(
  { lat: 40.7128, lng: -74.0060 }, // NYC
  { lat: 34.0522, lng: -118.2437 } // LA
);
// Returns: ~2451 miles
```

---

## Tool Definitions

### MCP Tools

```typescript
import {
  marketplaceSearchToolDefinition,
  addToCartToolDefinition,
  viewCartToolDefinition,
  removeFromCartToolDefinition,
} from '@betterdata/llm-gateway';
```

Each tool definition includes:
- `name`: Tool identifier
- `description`: LLM-readable description
- `parameters`: JSON Schema for inputs

---

## Error Classes

```typescript
import {
  GatewayError,
  ValidationError,
  BackendError,
  ToolNotFoundError,
  SessionNotFoundError,
  CartNotFoundError,
} from '@betterdata/llm-gateway';
```

| Error | Status | When |
|-------|--------|------|
| `ValidationError` | 400 | Invalid input data |
| `SessionNotFoundError` | 404 | Session doesn't exist |
| `CartNotFoundError` | 404 | Cart doesn't exist |
| `ToolNotFoundError` | 404 | Unknown tool name |
| `BackendError` | 500 | Database/service failure |
| `GatewayError` | 500 | General gateway error |

