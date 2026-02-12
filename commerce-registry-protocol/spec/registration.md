# Registration Protocol Specification

## Overview

The registration protocol defines how commerce gateways register with the registry and verify domain ownership.

## Registration Process

### Step 1: Register Gateway

**Endpoint**: `POST /api/gateways`

**Request**:
```json
{
  "brand_name": "LUXE BOND",
  "domain": "luxebond.com",
  "endpoint": "https://api.luxebond.com/llm/v1",
  "protocol": "mcp",
  "capabilities": {
    "catalog_search": true,
    "pricing": "public",
    "inventory": "real_time",
    "checkout": false
  },
  "auth": {
    "type": "none"
  },
  "aliases": ["luxe bond", "luxebond"],
  "categories": ["beauty.makeup.lipstick", "beauty.skincare"]
}
```

**Response**:
```json
{
  "id": "gw_abc123",
  "slug": "luxe-bond",
  "status": "pending",
  "verification": {
    "dns_txt": {
      "record": "_commerce-gateway.luxebond.com",
      "value": "bd-verify-abc123-1704067200"
    },
    "well_known": {
      "url": "https://luxebond.com/.well-known/commerce-gateway-verify.json",
      "content": {
        "token": "bd-verify-abc123-1704067200"
      }
    }
  },
  "message": "Gateway registered. Complete domain verification to activate."
}
```

### Step 2: Verify Domain Ownership

**Endpoint**: `POST /api/gateways/{id}/verify`

**Verification Methods**:

1. **DNS TXT Record**: Add `_commerce-gateway.{domain}` TXT record
2. **Well-Known File**: Place token at `/.well-known/commerce-gateway-verify.json`

**Response**:
```json
{
  "verified": true,
  "method": "dns_txt",
  "status": "active",
  "message": "Your gateway is now live and discoverable."
}
```

## GTIN Claiming

### Endpoint

`POST /api/gateways/{id}/gtins`

**Request**:
```json
{
  "gs1_prefix": {
    "prefix": "0012345",
    "proof": "gs1_certificate",
    "proof_url": "https://example.com/gs1-cert.pdf"
  },
  "gtins": [
    {
      "gtin": "012345678901",
      "product_name": "Product A",
      "role": "manufacturer"
    }
  ]
}
```

**Response**:
```json
{
  "claimed": [
    {
      "type": "prefix",
      "prefix": "0012345",
      "verified": true
    },
    {
      "type": "gtin",
      "gtin": "012345678901",
      "role": "manufacturer"
    }
  ],
  "conflicts": []
}
```

## Error Codes

- `DOMAIN_ALREADY_REGISTERED` (409): Domain already claimed
- `VERIFICATION_FAILED` (200): Verification not passed (not an error)
- `GTIN_CONFLICT` (200): GTIN already claimed (not an error)
- `UNAUTHORIZED` (401): Invalid or missing auth token
- `FORBIDDEN` (403): Not authorized for this resource

---

*See full API specification in the main implementation spec.*

