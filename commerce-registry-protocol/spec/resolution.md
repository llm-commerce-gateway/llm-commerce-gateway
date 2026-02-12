# Resolution Protocol Specification

## Overview

The resolution protocol defines how brand names and GTINs (Global Trade Item Numbers) are resolved to their authoritative commerce gateway endpoints.

## Brand Resolution

### Endpoint

```
GET /api/resolve/brand?q={brand_name}
```

### Algorithm

1. **Exact Alias Match**: Check normalized brand aliases
2. **Fuzzy Match**: Use Levenshtein distance (threshold: 0.85)
3. **Well-Known Discovery**: Fallback to `.well-known/commerce-gateway.json`

### Response Format

```json
{
  "found": true,
  "confidence": 0.98,
  "match_type": "exact" | "fuzzy" | "well_known",
  "brand": "Nike",
  "slug": "nike",
  "gateway": {
    "endpoint": "https://commerce.nike.com/llm/v1",
    "protocol": "mcp",
    "capabilities": {
      "catalog_search": true,
      "pricing": "public",
      "inventory": "real_time",
      "checkout": false
    }
  },
  "verification": {
    "domain_verified": true,
    "brand_verified": true
  },
  "trust_score": 95,
  "categories": ["apparel.athletic", "footwear.athletic"]
}
```

## GTIN Resolution

### Endpoint

```
GET /api/resolve/gtin/{gtin}
```

### Algorithm

1. **Direct Mapping**: Check exact GTIN mapping
2. **Prefix Range**: Lookup GS1 prefix ranges (6-9 digits)
3. **Reseller Discovery**: Find resellers with same GTIN

### Response Format

```json
{
  "found": true,
  "gtin": "00012345678901",
  "product_name": "Nike Air Max 90",
  "matched_by": "direct" | "prefix_range",
  "authoritative_source": {
    "brand": "Nike",
    "slug": "nike",
    "gateway": {
      "endpoint": "https://commerce.nike.com/llm/v1",
      "protocol": "mcp"
    },
    "verified": true
  },
  "resellers": [
    {
      "retailer": "Foot Locker",
      "slug": "foot-locker",
      "gateway": {
        "endpoint": "https://commerce.footlocker.com/llm/v1"
      }
    }
  ]
}
```

## Category Resolution

### Endpoint

```
GET /api/resolve/category/{path}?limit=20&offset=0
```

### Response Format

```json
{
  "category": "beauty.makeup.lipstick",
  "name": "Lipstick",
  "gateways": [
    {
      "brand": "LUXE BOND",
      "slug": "luxe-bond",
      "gateway": {
        "endpoint": "https://api.luxebond.com/llm/v1",
        "protocol": "mcp"
      },
      "trust_score": 92
    }
  ],
  "total": 15
}
```

## Error Codes

- `BRAND_NOT_FOUND` (200): Brand not found (not an error)
- `GTIN_INVALID` (400): Invalid GTIN format
- `RATE_LIMITED` (429): Rate limit exceeded

---

*See full API specification in the main implementation spec.*

