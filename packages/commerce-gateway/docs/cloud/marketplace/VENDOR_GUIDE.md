# Vendor Integration Guide

## Welcome to Better Data Marketplace

This guide walks you through setting up your store on the Better Data Marketplace, where your products become searchable through Claude, ChatGPT, and Grok.

## Prerequisites

Before you begin, ensure you have:

- [ ] Active e-commerce platform (Shopify, Square, or WooCommerce)
- [ ] Admin access to your platform
- [ ] Product catalog with at least 1 product
- [ ] ~10 minutes for setup

## Getting Started

### Step 1: Create Your Better Data Account

All onboarding starts at:

👉 **https://betterdata.co/signup**

Choose **"Marketplace Vendor"** as your starting path.

You will:
- Create a Better Data account
- Create or join an Organization
- Start Marketplace setup immediately

**Note:** Marketplace vendors, partners, and SCM customers all use the same Better Data account. You can upgrade capabilities at any time — no re-import required.

### Step 2: Set Up Vendor Profile

Your vendor profile appears in search results. Make it compelling:

```
Display Name: Sneaker Paradise
Tagline: Premium authenticated sneakers since 2015
Description: We specialize in verified authentic sneakers...
```

**Key Profile Elements:**

| Element | Impact | Recommendation |
|---------|--------|----------------|
| Display Name | High | Clear, memorable brand name |
| Tagline | Medium | Unique value proposition |
| Description | Medium | Build trust, explain expertise |
| Logo | High | Professional, recognizable |
| Return Policy | Medium | Clear, customer-friendly |
| Shipping Policy | High | Fast shipping = higher ranking |

### Step 3: Connect Your Platform

#### Shopify

1. Go to **Settings → Connect Store**
2. Click **Shopify**
3. Enter your Shopify store URL (e.g., `mystore.myshopify.com`)
4. Click **Authorize**
5. Approve the app permissions in Shopify

#### Square

1. Go to **Settings → Connect Store**
2. Click **Square**
3. Sign in to your Square account
4. Authorize Better Data access

#### WooCommerce

1. Go to **Settings → Connect Store**
2. Click **WooCommerce**
3. Enter your WordPress site URL
4. Generate REST API keys in WooCommerce
5. Enter Consumer Key and Secret

### Step 4: Import Products

Once connected, your products will be automatically imported:

1. **Fetching** - Pulling products from your platform
2. **Matching** - Linking to canonical ProductMaster records
3. **Creating** - Generating marketplace listings
4. **Indexing** - Adding to search index

**Import Results:**

- **Matched**: Product linked to existing catalog entry (e.g., via GTIN/UPC)
- **New**: New product created in catalog
- **Skipped**: Product couldn't be processed (see errors)

### Step 5: (Optional) Merchant Verification & Signal Tags

Marketplace vendors can optionally verify their merchant identity to improve trust and ranking.

**Benefits of Verification:**
- Trusted Merchant badge
- Improved ranking
- Eligibility for advanced federation tools

**Signal Tag Authentication**

Signal Tags provide unit-level authenticity verification:
- +20 ranking points per product
- Trust badge in AI search results
- Higher conversion rates

**Note:** Merchant verification improves trust/ranking and is managed under Merchant Settings (`/my-merchant/setup`).

## Optimizing Your Listings

### Ranking Factors

Your listings are ranked by:

| Factor | Points | How to Improve |
|--------|--------|----------------|
| Authentication | +20 | Add Signal Tags |
| Distance | +30 | Add warehouse locations |
| Vendor Rating | +15 | Great customer service |
| Price | +10 | Competitive pricing |
| Shipping | +10 | Free/fast shipping |

### Best Practices

#### Pricing

```
✅ DO: Price competitively (within 10% of competitors)
❌ DON'T: Price 20%+ above market
```

#### Inventory

```
✅ DO: Keep inventory accurate and in-stock
❌ DON'T: Let listings show "out of stock"
```

#### Shipping

```
✅ DO: Offer free shipping threshold
✅ DO: Provide fast shipping options
❌ DON'T: Only offer slow/expensive shipping
```

#### Customer Service

```
✅ DO: Respond to inquiries within 24 hours
✅ DO: Resolve issues quickly
❌ DON'T: Ignore negative reviews
```

## Monitoring Performance

### Analytics Dashboard

Your dashboard shows:

- **Search Appearances**: How often you appear in results
- **Cart Adds**: Products added to carts
- **Conversion Rate**: Appearances → Cart adds
- **Revenue**: Total marketplace revenue
- **Avg Rank**: Your typical position in results

### LLM Attribution

Track which AI platforms drive your sales:

```
Claude (Anthropic):  45 cart adds  |  $6,750 revenue  |  50.5%
ChatGPT (OpenAI):    32 cart adds  |  $4,200 revenue  |  36.0%
Grok (xAI):          12 cart adds  |  $1,500 revenue  |  13.5%
```

### Competitive Insights

See how you compare to competitors:

```
Your Store:     Avg Price: $125  |  Rating: 4.8  |  Auth: 80%
Competitor A:   Avg Price: $130  |  Rating: 4.7  |  Auth: 100%
Competitor B:   Avg Price: $115  |  Rating: 4.5  |  Auth: 60%
```

## Marketplace Tiers

| Tier | Price | Features |
|------|-------|----------|
| **FREE** | $0/mo | Self-hosted gateway, basic listing |
| **HOSTED** | $19/mo | Managed hosting, analytics |
| **SCM_STARTER** | $99/mo | Priority ranking, advanced analytics |
| **SCM_PRO** | $499/mo | Featured placement, API access |
| **SCM_ENTERPRISE** | $999/mo | White-label, dedicated support |

## Webhook Events

Keep your listings in sync with automatic updates:

### Shopify Events

- `products/update` - Price, description changes
- `products/delete` - Listing deactivation
- `inventory_levels/update` - Stock changes

### Square Events

- `catalog.version.updated` - Product changes
- `inventory.count.updated` - Stock changes

## Troubleshooting

### Products Not Appearing

1. Check import status in dashboard
2. Verify products are active in your platform
3. Ensure products have required fields (name, price)
4. Check for import errors

### Low Ranking

1. Enable Signal Tag authentication (+20 points)
2. Review pricing vs competitors
3. Add shipping options
4. Improve vendor rating

### Inventory Sync Issues

1. Verify webhook configuration
2. Check platform API permissions
3. Manual sync from dashboard
4. Contact support if issues persist

## Support

- **Documentation**: `docs.betterdata.dev`
- **Email**: `support@betterdata.dev`
- **Status**: `status.betterdata.dev`

## FAQ

**Q: How long until my products appear in search?**
A: Products are indexed within 5 minutes of successful import.

**Q: Can I list products not in the catalog?**
A: Yes, new ProductMaster records are created automatically.

**Q: How is my vendor rating calculated?**
A: Average of customer reviews (1-5 stars) from orders.

**Q: What if my GTIN doesn't match?**
A: Products are matched by name if GTIN fails. Manual review available.

**Q: Can I exclude products from marketplace?**
A: Yes, mark listings as inactive in your dashboard.

