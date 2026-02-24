# Gateway Protocol Compliance

This document describes the protocol compliance of the @betterdata/commerce-gateway implementation.

## Overview

The gateway implements the Commerce Gateway Protocol as specified in `commerce-gateway-implementation-spec.md` Section 6.

## Required Endpoints

All endpoints are available at the base path (default: `/api`).

### GET /health

Health check endpoint for registry monitoring.

**Response:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.0.0",
  "timestamp": "2025-01-07T10:30:00Z"
}
```

**Status Codes:**
- `200`: Healthy
- `503`: Unhealthy

### POST /search

Product search endpoint.

**Request:**
```json
{
  "query": "running shoes",
  "filters": {
    "category": "footwear",
    "priceMin": 50,
    "priceMax": 200
  },
  "limit": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "products": [
    {
      "id": "prod-123",
      "gtin": "012345678901",
      "sku": "SKU-123",
      "name": "Running Shoes",
      "brand": "Nike",
      "description": "...",
      "category": ["footwear", "athletic"],
      "images": [...],
      "price": {...},
      "availability": {...}
    }
  ],
  "total": 25,
  "facets": {...}
}
```

### GET /product/{id}

Get single product by ID.

**Response:**
```json
{
  "id": "prod-123",
  "gtin": "012345678901",
  "name": "Running Shoes",
  ...
}
```

**Status Codes:**
- `200`: Product found
- `404`: Product not found

### GET /product/gtin/{gtin}

Get product by GTIN (UPC/EAN).

**Path Parameters:**
- `gtin`: 8, 12, 13, or 14 digit barcode

**Response:**
```json
{
  "id": "prod-123",
  "gtin": "012345678901",
  "name": "Running Shoes",
  ...
}
```

**Status Codes:**
- `200`: Product found
- `400`: Invalid GTIN format
- `404`: Product not found

### POST /pricing

Get pricing for products.

**Request:**
```json
{
  "product_ids": ["prod-123", "prod-456"],
  "gtins": ["012345678901"]
}
```

**Response:**
```json
{
  "prices": [
    {
      "product_id": "prod-123",
      "amount": 99.99,
      "currency": "USD",
      "formatted": "$99.99",
      "sale": false
    }
  ]
}
```

### POST /availability

Check inventory availability.

**Request:**
```json
{
  "product_ids": ["prod-123"],
  "gtins": ["012345678901"],
  "location": "warehouse-1"
}
```

**Response:**
```json
{
  "availability": [
    {
      "product_id": "prod-123",
      "in_stock": true,
      "quantity": 50,
      "location": "warehouse-1",
      "shipping_estimate": "2-3 business days"
    }
  ]
}
```

## Data Models

All endpoints return data in the format specified in Section 6.2 of the spec:

- **Product**: Includes id, gtin, sku, name, brand, description, category, images, attributes, price, availability, url
- **PriceInfo**: Includes amount, currency, formatted, original_amount, sale, valid_until
- **AvailabilityInfo**: Includes in_stock, quantity, location, restock_date, shipping_estimate

## Protocol Binding

The gateway supports both:
1. **REST API**: Direct HTTP endpoints (as described above)
2. **MCP Protocol**: Via MCP server for Claude Desktop integration

## Compliance Checklist

- ✅ `/health` endpoint with status, version, timestamp
- ✅ `/search` POST endpoint with query, filters, pagination
- ✅ `/product/{id}` GET endpoint
- ✅ `/product/gtin/{gtin}` GET endpoint
- ✅ `/pricing` POST endpoint
- ✅ `/availability` POST endpoint
- ✅ Standardized response formats matching spec
- ✅ Error handling with appropriate status codes
- ✅ GTIN format validation

## Testing

Test the endpoints using curl:

```bash
# Health check
curl http://localhost:3000/api/health

# Search products
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "shoes", "limit": 10}'

# Get product by ID
curl http://localhost:3000/api/product/prod-123

# Get product by GTIN
curl http://localhost:3000/api/product/gtin/012345678901

# Get pricing
curl -X POST http://localhost:3000/api/pricing \
  -H "Content-Type: application/json" \
  -d '{"product_ids": ["prod-123"]}'

# Check availability
curl -X POST http://localhost:3000/api/availability \
  -H "Content-Type: application/json" \
  -d '{"product_ids": ["prod-123"]}'
```

