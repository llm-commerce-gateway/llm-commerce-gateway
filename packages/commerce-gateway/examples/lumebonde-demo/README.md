# Lumebondé Demo

> Full-featured luxury retail demo with multi-location inventory, recommendations, and analytics.
> *Lumebondé is a fictitious brand used for demonstration purposes only.*

This comprehensive example showcases all the capabilities of `@betterdata/commerce-gateway` for a luxury accessories brand.

## Features

- ✅ 8-product luxury catalog (watches, bags, accessories)
- ✅ Multi-location inventory (NYC, LA, Miami + Online)
- ✅ Personalized recommendations (similar, complementary, bundle)
- ✅ Store pickup options
- ✅ Link generation with Dub.co
- ✅ Analytics tracking
- ✅ Claude MCP + OpenAI servers
- ✅ Sophisticated shopping assistant personality

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file:

```env
# Redis (optional but recommended)
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=

# OpenAI (for ChatGPT server)
OPENAI_API_KEY=sk-...

# Dub.co Link Generation (optional)
DUB_API_KEY=dub_...
DUB_DOMAIN=luxe.link

# Server
PORT=3001
```

### 3. Start the Servers

**For Claude (MCP):**
```bash
npm run mcp
```

**For ChatGPT (HTTP):**
```bash
npm start
```

## Product Catalog

| Product | Category | Price | Locations |
|---------|----------|-------|-----------|
| Signature Watch | Watches | $2,499 | All |
| Heritage Briefcase | Bags | $895 | All |
| Cashmere Scarf | Accessories | $295 | All |
| Sterling Cufflinks | Accessories | $245 | All |
| Premium Sunglasses | Eyewear | $450 | All |
| Italian Belt | Accessories | $195 | All |
| Pocket Square Set | Accessories | $175 | All |
| Card Holder | Accessories | $145 | All |

## Store Locations

| Location | Pickup | Ship From |
|----------|--------|-----------|
| New York Flagship | ✅ | ✅ |
| Los Angeles | ✅ | ✅ |
| Miami Boutique | ✅ | ❌ |
| Online Warehouse | ❌ | ✅ |

## Example Conversations

### Product Discovery

> **User:** "I'm looking for a gift for someone who travels a lot"
> 
> **Lumebondé:** "For frequent travelers, I'd recommend our **Heritage Leather Briefcase** ($895) - it's crafted from full-grain Italian leather with a lifetime warranty. It's perfect for both business meetings and weekend trips.
>
> We also have our **Premium Sunglasses** ($450) with Carl Zeiss lenses - they come with a premium leather case that's perfect for travel.
>
> What's your budget? I can tailor my recommendations."

### Inventory Check

> **User:** "Do you have the Signature Watch in navy at your Miami store?"
>
> **Lumebondé:** "I've checked our Miami Boutique inventory:
>
> ❌ **Navy Blue Dial** - Currently out of stock at Miami
>
> But good news! We have 2 available at our **Online Warehouse** and 2 at our **New York Flagship**. I can:
> 
> 1. Ship from online (arrives in 5-7 days)
> 2. Ship from NYC (arrives in 3-4 days)
> 3. Transfer to Miami for pickup (ready in 2-3 days)
>
> Which would work best for you?"

### Personalized Recommendations

> **User:** "I just bought the Heritage Briefcase. What else would you recommend?"
>
> **Lumebondé:** "Excellent choice! To complement your Heritage Briefcase, I'd suggest:
>
> **Completes Your Look:**
> - **Card Holder** ($145) - Same pebbled leather aesthetic
> - **Italian Belt** ($195) - Matches beautifully with the cognac briefcase
>
> **Bundle & Save:**
> Add the Card Holder to your order for a coordinated set. Both items feature our signature hand-finished details.
>
> Would you like me to add either to your cart?"

## Project Structure

```
lumebonde-demo/
├── backend/
│   └── LumebondeBackend.ts    # Full backend implementation
├── data/
│   ├── products.json         # 8-product catalog
│   └── inventory.json        # Multi-location inventory
├── mcp-server.ts             # Claude MCP server
├── openai-server.ts          # ChatGPT HTTP server
├── package.json
└── README.md
```

## Customization

### Adding Products

Edit `data/products.json`:

```json
{
  "id": "lb-new",
  "name": "New Product",
  "variants": [
    {
      "id": "lb-new-v1",
      "name": "Variant Name",
      "sku": "LB-NEW-V1",
      "price": 299.00,
      "inventory": {
        "nyc": 5,
        "la": 3,
        "miami": 2,
        "online": 10
      }
    }
  ]
}
```

### Adding Locations

Edit `data/inventory.json`:

```json
{
  "locations": [
    {
      "id": "chicago",
      "name": "Chicago Store",
      "isPickupEnabled": true,
      "isShipFromEnabled": true
    }
  ]
}
```

### Custom Recommendations

Modify `LumebondeBackend.ts` to add custom recommendation logic:

```typescript
// Add category complements
const complementMap: Record<string, string[]> = {
  'Watches': ['Accessories', 'Bags'],
  'Bags': ['Accessories', 'Eyewear'],
  // Add your mappings
};
```

## Deployment

### Vercel (OpenAI Server)

```bash
vercel deploy
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["node", "dist/openai-server.js"]
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "lumebonde": {
      "command": "node",
      "args": ["/path/to/lumebonde-demo/dist/mcp-server.js"],
      "env": {
        "DUB_API_KEY": "optional-for-links",
        "REDIS_URL": "optional-for-analytics"
      }
    }
  }
}
```

---

> *Lumebondé is a fictitious brand used for demonstration purposes only.*

## License

MIT

