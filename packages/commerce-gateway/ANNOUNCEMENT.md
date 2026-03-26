# Release Announcement Template

## Subject: Announcing @betterdata/commerce-gateway v1.0.0 - Universal LLM Gateway for Conversational Commerce

---

## 🎉 We're excited to announce the open-source release of the LLM Commerce Gateway!

The **LLM Commerce Gateway** is a universal abstraction layer that enables any e-commerce platform to integrate with multiple AI assistants (Claude, ChatGPT, Grok) through a single, unified API. Start with OSS—upgrade to Cloud when you need advanced features.

### 📦 Packages (5 total)

| Package | Description |
|---------|-------------|
| `@betterdata/commerce-gateway` | Core gateway runtime |
| `@betterdata/commerce-gateway-connectors` | Shopify, BigCommerce, WooCommerce connectors |
| `@betterdata/commerce-gateway-mcp` | MCP server for gateway operations |
| `@betterdata/registry-mcp` | MCP server for registry resolution |
| `commerce-registry-protocol` | Open protocol specification (MIT) |

### 🚀 Key Features

- **Universal Tool Format**: Define tools once, use everywhere
- **Pluggable Backends**: Clean interfaces for products, cart, and orders
- **Multi-LLM Support**: Works with Claude (MCP), OpenAI (Functions), and Grok (Tools)
- **Session Management**: Redis-based sessions with cross-platform transfer
- **Production Ready**: Rate limiting, auth, and logging built-in
- **Commerce Gateway Protocol**: Standardized API for gateway discovery and trust scoring
- **Federation Hub**: Multi-vendor marketplace support

### 📦 Quick Start

```bash
npm install @betterdata/commerce-gateway
```

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';

const gateway = new LLMGateway({
  backends: {
    products: myProductBackend,
    cart: myCartBackend,
    orders: myOrderBackend,
  },
});

await gateway.start(3000);
```

### 🔗 Links

- **npm**: https://www.npmjs.com/package/@betterdata/commerce-gateway
- **GitHub**: https://github.com/betterdataco/llm-commerce-gateway
- **Documentation**: https://github.com/betterdataco/llm-commerce-gateway/tree/main/packages/commerce-gateway/docs
- **Deploy**: [Vercel](https://vercel.com/new/clone?repository-url=https://github.com/betterdataco/llm-commerce-gateway) | [Railway](https://railway.app/new/template?template=https://github.com/betterdataco/llm-commerce-gateway)

### 📚 Documentation

- [API Reference](https://github.com/betterdataco/llm-commerce-gateway/blob/main/packages/commerce-gateway/docs/API.md)
- [Integration Tutorials](https://github.com/betterdataco/llm-commerce-gateway/blob/main/packages/commerce-gateway/docs/INTEGRATION_TUTORIALS.md)
- [Deployment Guides](https://github.com/betterdataco/llm-commerce-gateway/blob/main/packages/commerce-gateway/docs/DEPLOYMENT.md)
- [Protocol Specification](https://github.com/betterdataco/llm-commerce-gateway/blob/main/packages/commerce-gateway/docs/PROTOCOL.md)

### 🎯 Use Cases

- **E-commerce Platforms**: Connect your store to Claude, ChatGPT, and Grok
- **Marketplace Operators**: Build multi-vendor AI shopping experiences
- **Developers**: Build custom commerce backends with clean interfaces
- **Enterprises**: Standardize AI integrations across multiple brands

### 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](https://github.com/betterdataco/llm-commerce-gateway/blob/main/CONTRIBUTING.md).

### 📄 License

Apache-2.0 for gateway runtime packages, MIT for `commerce-registry-protocol`.

---

**Built with ❤️ by [Better Data](https://betterdata.co)**

---

## Social Media Posts

### Blog Post

Use the main content above (Subject through License) as the blog body. Add a short intro: "Today we're releasing the LLM Commerce Gateway as open source—5 packages that let you connect any storefront to Claude, ChatGPT, and Grok with a single API. Start with OSS, upgrade to Cloud when you need more."

### Twitter/X

🚀 Announcing @betterdata/commerce-gateway v1.0.0 - Universal LLM Gateway for Conversational Commerce!

Connect your e-commerce platform to Claude, ChatGPT, and Grok with a single API. Gateway runtime packages are Apache-2.0, and the protocol spec is MIT.

🔗 npm: https://www.npmjs.com/package/@betterdata/commerce-gateway
📚 Docs: https://github.com/betterdataco/llm-commerce-gateway

#AI #Ecommerce #OpenSource #LLM

### LinkedIn

We're excited to open-source the LLM Commerce Gateway—5 packages that enable any e-commerce platform to integrate with multiple AI assistants through a single, unified API.

Key benefits:
✅ Works with Claude (MCP), OpenAI (Functions), and Grok
✅ Production-ready with rate limiting, auth, and logging
✅ Clean, pluggable backend interfaces
✅ Multi-vendor marketplace support
✅ Connectors for Shopify, BigCommerce, WooCommerce

Perfect for e-commerce platforms, marketplace operators, and developers building AI-powered shopping experiences. Start with OSS, upgrade to Cloud when you need advanced features.

Try it today: https://www.npmjs.com/package/@betterdata/commerce-gateway

### Reddit (r/node, r/javascript, r/ecommerce)

**Title**: Announcing @betterdata/commerce-gateway - Universal LLM Gateway for Conversational Commerce (Open Source)

**Body**:

Hey r/node! We just open-sourced our LLM Commerce Gateway—5 packages we've been using in production.

**What it does:**
Enables any e-commerce platform to integrate with Claude, ChatGPT, and Grok through a single API. No more building separate integrations for each LLM.

**Key features:**
- Universal tool format (define once, use everywhere)
- Pluggable backends (products, cart, orders)
- Connectors for Shopify, BigCommerce, WooCommerce
- Session management with Redis
- Production-ready (rate limiting, auth, logging)
- Multi-vendor marketplace support

**Why we built it:**
Every e-commerce platform needs to integrate with multiple AI assistants, but each has different APIs, authentication, and tool-calling formats. This abstracts all that complexity.

**Tech stack:**
- TypeScript
- Hono (lightweight web framework)
- Redis for sessions
- Full TypeScript types

**Links:**
- npm: https://www.npmjs.com/package/@betterdata/commerce-gateway
- GitHub: https://github.com/betterdataco/llm-commerce-gateway
- Docs: https://github.com/betterdataco/llm-commerce-gateway/tree/main/packages/commerce-gateway/docs

Would love feedback from the community!

---

## Hacker News

**Title**: Show HN: @betterdata/commerce-gateway – Universal LLM Gateway for E-commerce (Open Source)

**Body**:

We've open-sourced our LLM Commerce Gateway—5 packages we've been using in production. Enables any e-commerce platform to integrate with Claude, ChatGPT, and Grok through a single API.

**The Problem:**
Every e-commerce platform needs to integrate with multiple AI assistants, but each has different APIs, authentication, and tool-calling formats. Building these integrations from scratch is time-consuming.

**The Solution:**
A universal abstraction layer that:
- Defines tools once, works everywhere
- Provides clean interfaces for products, cart, and orders
- Includes connectors for Shopify, BigCommerce, WooCommerce
- Handles session management across platforms
- Includes production features (rate limiting, auth, logging)

**Tech:**
- TypeScript, Hono, Redis
- Full type safety
- Apache-2.0 gateway runtime packages + MIT protocol spec

**Links:**
- npm: https://www.npmjs.com/package/@betterdata/commerce-gateway
- GitHub: https://github.com/betterdataco/llm-commerce-gateway
- Docs: https://github.com/betterdataco/llm-commerce-gateway/tree/main/packages/commerce-gateway/docs

Would love feedback!

