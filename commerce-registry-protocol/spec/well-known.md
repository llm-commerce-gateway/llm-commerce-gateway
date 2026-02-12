# .well-known Schema Specification

## Overview

The `.well-known/commerce-gateway.json` file enables gateway discovery without prior registry registration. This is a fallback mechanism for brands that haven't registered with the central registry.

## Location

```
https://{domain}/.well-known/commerce-gateway.json
```

## Schema

```json
{
  "version": "1.0",
  "brand": "Example Brand",
  "gateway": {
    "endpoint": "https://api.example.com/llm/v1",
    "protocol": "mcp",
    "capabilities": {
      "catalog_search": true,
      "pricing": "public",
      "inventory": "real_time",
      "checkout": false
    },
    "auth": {
      "type": "none"
    }
  },
  "gtins": {
    "prefixes": ["0012345", "0012346"]
  },
  "categories": ["beauty.makeup", "beauty.skincare"],
  "contact": "commerce@example.com"
}
```

## Field Definitions

### Required Fields

- `version`: Schema version (must be `"1.0"`)
- `brand`: Brand name
- `gateway.endpoint`: Gateway API URL
- `gateway.protocol`: Protocol type (`"mcp"`, `"rest"`, `"openapi"`, `"graphql"`)
- `gateway.capabilities.catalog_search`: Boolean
- `gateway.capabilities.pricing`: `"public"`, `"private"`, or `"none"`
- `gateway.capabilities.inventory`: `"real_time"`, `"cached"`, or `"none"`
- `gateway.capabilities.checkout`: Boolean

### Optional Fields

- `gateway.auth`: Authentication configuration
  - `type`: `"none"`, `"api_key"`, `"oauth2"`, or `"bearer"`
- `gtins.prefixes`: Array of GS1 company prefixes (6-9 digits)
- `categories`: Array of category paths (e.g., `"beauty.makeup"`)
- `contact`: Contact email for federation issues

## Validation

- All protocol values must be lowercase
- GTIN prefixes must be 6-9 digits
- Categories must be non-empty strings
- Contact must be a valid email format

## Discovery Process

1. Registry attempts to resolve brand name
2. If not found in registry, tries common domain variations
3. Fetches `/.well-known/commerce-gateway.json` from candidate domains
4. Validates schema
5. Returns with `match_type: "well_known"` and lower trust score

## Trust Score Impact

Gateways discovered via `.well-known` receive:
- Lower trust score (default: 50)
- `verified: false` status
- Warning message in response

To increase trust score, complete full registry registration and verification.

---

*See full schema validation in the implementation spec Appendix A.*

