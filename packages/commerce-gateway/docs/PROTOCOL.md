# Commerce Gateway Protocol Specification

**Version**: 1.0.0  
**Last Updated**: 2024-01-01  
**Status**: Stable

This document specifies the standard protocol that all Commerce Gateways must implement to be compatible with the Commerce Gateway Registry and LLM integrations.

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Required Endpoints](#required-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Versioning](#versioning)

---

## Overview

The Commerce Gateway Protocol defines a standard REST API that enables:

- **LLM Integration**: AI assistants can search products, check inventory, and create orders
- **Registry Discovery**: Gateways can be discovered and resolved via brand names or GTINs
- **Trust Scoring**: Health monitoring and trust metrics
- **Multi-Vendor Support**: Aggregation across multiple gateways

---

## Base URL

All endpoints are relative to the gateway's base URL:

```
https://gateway.example.com
```

Or for hosted gateways:

```
https://gateway.betterdata.co/{tenant-id}
```

---

## Authentication

Gateways may implement authentication, but it's optional for public catalogs.

### Supported Methods

1. **None** - Public access (default)
2. **API Key** - Bearer token in `Authorization` header
3. **OAuth 2.0** - Standard OAuth flow

### Example: API Key

```http
GET /health HTTP/1.1
Host: gateway.example.com
Authorization: Bearer your-api-key-here
```

---

## Required Endpoints

### 1. Health Check

**Endpoint**: `GET /health`

**Description**: Returns gateway health status for monitoring.

**Request**:
```http
GET /health HTTP/1.1
Host: gateway.example.com
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

**Response** (503 Service Unavailable):
```json
{
  "status": "degraded",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "Service experiencing issues"
}
```

---

### 2. Product Search

**Endpoint**: `POST /search`

**Description**: Search products using natural language or structured query.

**Request**:
```http
POST /search HTTP/1.1
Host: gateway.example.com
Content-Type: application/json

{
  "query": "red running shoes",
  "filters": {
    "category": "footwear",
    "priceMin": 50,
    "priceMax": 200,
    "inStock": true
  },
  "limit": 20,
  "offset": 0
}
```

**Response** (200 OK):
```json
{
  "products": [
    {
      "id": "prod_123",
      "name": "Nike Air Max 90",
      "slug": "nike-air-max-90",
      "description": "Classic running shoe...",
      "price": {
        "amount": 120.00,
        "currency": "USD",
        "compareAtPrice": 150.00
      },
      "images": [
        {
          "url": "https://example.com/image.jpg",
          "alt": "Nike Air Max 90"
        }
      ],
      "category": "footwear.running",
      "tags": ["running", "athletic"],
      "variants": [
        {
          "id": "var_123",
          "name": "Size 10",
          "sku": "NIKE-AM90-10",
          "price": {
            "amount": 120.00,
            "currency": "USD"
          },
          "availability": {
            "inStock": true,
            "quantity": 5
          }
        }
      ],
      "availability": {
        "inStock": true,
        "quantity": 5
      }
    }
  ],
  "total": 42,
  "hasMore": true,
  "facets": {
    "categories": [
      { "name": "footwear", "count": 25 },
      { "name": "apparel", "count": 17 }
    ],
    "priceRanges": [
      { "min": 0, "max": 50, "count": 10 },
      { "min": 50, "max": 100, "count": 20 }
    ]
  }
}
```

---

### 3. Get Product by ID

**Endpoint**: `GET /product/{id}`

**Description**: Get detailed information about a specific product.

**Request**:
```http
GET /product/prod_123 HTTP/1.1
Host: gateway.example.com
```

**Response** (200 OK):
```json
{
  "id": "prod_123",
  "name": "Nike Air Max 90",
  "slug": "nike-air-max-90",
  "description": "Classic running shoe...",
  "price": {
    "amount": 120.00,
    "currency": "USD"
  },
  "images": [...],
  "category": "footwear.running",
  "tags": ["running", "athletic"],
  "variants": [...],
  "availability": {
    "inStock": true,
    "quantity": 5
  }
}
```

**Response** (404 Not Found):
```json
{
  "error": "Product not found",
  "code": "PRODUCT_NOT_FOUND"
}
```

---

### 4. Get Product by GTIN

**Endpoint**: `GET /product/gtin/{gtin}`

**Description**: Get product by Global Trade Item Number (UPC/EAN).

**Request**:
```http
GET /product/gtin/0012345678901 HTTP/1.1
Host: gateway.example.com
```

**Response**: Same format as `GET /product/{id}`

**GTIN Formats Supported**:
- 8 digits (EAN-8)
- 12 digits (UPC-A)
- 13 digits (EAN-13)
- 14 digits (GTIN-14)

---

### 5. Get Pricing

**Endpoint**: `POST /pricing`

**Description**: Get pricing for multiple products at once.

**Request**:
```http
POST /pricing HTTP/1.1
Host: gateway.example.com
Content-Type: application/json

{
  "product_ids": ["prod_123", "prod_456"],
  "gtins": ["0012345678901"]
}
```

**Response** (200 OK):
```json
{
  "prices": [
    {
      "product_id": "prod_123",
      "price": {
        "amount": 120.00,
        "currency": "USD",
        "compareAtPrice": 150.00
      }
    },
    {
      "gtin": "0012345678901",
      "price": {
        "amount": 99.99,
        "currency": "USD"
      }
    }
  ]
}
```

---

### 6. Check Availability

**Endpoint**: `POST /availability`

**Description**: Check inventory availability for products.

**Request**:
```http
POST /availability HTTP/1.1
Host: gateway.example.com
Content-Type: application/json

{
  "product_ids": ["prod_123"],
  "gtins": ["0012345678901"],
  "location": "US"  // Optional
}
```

**Response** (200 OK):
```json
{
  "availability": [
    {
      "product_id": "prod_123",
      "inStock": true,
      "quantity": 5,
      "locations": [
        {
          "locationId": "warehouse_1",
          "locationName": "Main Warehouse",
          "quantity": 3,
          "leadTimeDays": 2
        }
      ]
    }
  ]
}
```

---

## Data Models

### Product

```typescript
interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
    compareAtPrice?: number;
  };
  images?: Array<{
    url: string;
    alt?: string;
  }>;
  category?: string;
  tags?: string[];
  variants?: ProductVariant[];
  attributes?: Record<string, string | string[]>;
  availability?: {
    inStock: boolean;
    quantity?: number;
    leadTime?: string;
  };
}
```

### ProductVariant

```typescript
interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price?: {
    amount: number;
    currency: string;
  };
  attributes?: Record<string, string>;
  availability?: {
    inStock: boolean;
    quantity?: number;
  };
}
```

### PriceInfo

```typescript
interface PriceInfo {
  amount: number;
  currency: string;
  compareAtPrice?: number;
}
```

### AvailabilityInfo

```typescript
interface AvailabilityInfo {
  inStock: boolean;
  quantity?: number;
  locations?: Array<{
    locationId: string;
    locationName: string;
    quantity: number;
    leadTimeDays?: number;
  }>;
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional context
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist |
| `INVALID_GTIN` | 400 | GTIN format is invalid |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

Gateways should implement rate limiting to prevent abuse.

### Recommended Limits

- **Public**: 100 requests/minute per IP
- **Authenticated**: 1000 requests/minute per API key
- **Enterprise**: Custom limits

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
Retry-After: 60

{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## Versioning

The protocol version is specified in the `X-API-Version` header:

```http
X-API-Version: 1.0.0
```

### Versioning Strategy

- **Major** (1.x.x): Breaking changes
- **Minor** (x.1.x): New features, backward compatible
- **Patch** (x.x.1): Bug fixes

### Deprecation

Deprecated features will be announced 6 months in advance:

```http
X-API-Deprecation: 2024-07-01
X-API-Sunset: 2024-12-31
```

---

## Compliance Checklist

To be compliant with the Commerce Gateway Protocol, your gateway must:

- [ ] Implement `/health` endpoint
- [ ] Implement `/search` endpoint
- [ ] Implement `/product/{id}` endpoint
- [ ] Implement `/product/gtin/{gtin}` endpoint
- [ ] Implement `/pricing` endpoint
- [ ] Implement `/availability` endpoint
- [ ] Return data in the specified format
- [ ] Handle errors consistently
- [ ] Support rate limiting
- [ ] Include version headers

---

## Testing Your Gateway

Use the protocol compliance test suite:

```bash
npm install -g @betterdata/gateway-tester
gateway-tester https://your-gateway.com
```

---

## References

- [API Documentation](./API.md)
- [Integration Tutorials](./INTEGRATION_TUTORIALS.md)
- [Deployment Guides](./DEPLOYMENT.md)

