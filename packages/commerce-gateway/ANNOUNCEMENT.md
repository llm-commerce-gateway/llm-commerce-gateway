# Release Announcement Template

## Subject: Announcing @betterdata/llm-gateway v1.0.0 - Universal LLM Gateway for Conversational Commerce

---

## 🎉 We're excited to announce the open-source release of @betterdata/llm-gateway!

**@betterdata/llm-gateway** is a universal abstraction layer that enables any e-commerce platform to integrate with multiple AI assistants (Claude, ChatGPT, Grok) through a single, unified API.

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
npm install @betterdata/llm-gateway
```

```typescript
import { LLMGateway } from '@betterdata/llm-gateway';

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

- **npm**: https://www.npmjs.com/package/@betterdata/llm-gateway
- **GitHub**: https://github.com/betterdata/llm-gateway
- **Documentation**: https://github.com/betterdata/llm-gateway/tree/main/docs
- **Deploy**: [Vercel](https://vercel.com/new/clone?repository-url=https://github.com/betterdata/llm-gateway) | [Railway](https://railway.app/new/template?template=https://github.com/betterdata/llm-gateway)

### 📚 Documentation

- [API Reference](https://github.com/betterdata/llm-gateway/blob/main/docs/API.md)
- [Integration Tutorials](https://github.com/betterdata/llm-gateway/blob/main/docs/INTEGRATION_TUTORIALS.md)
- [Deployment Guides](https://github.com/betterdata/llm-gateway/blob/main/docs/DEPLOYMENT.md)
- [Protocol Specification](https://github.com/betterdata/llm-gateway/blob/main/docs/PROTOCOL.md)

### 🎯 Use Cases

- **E-commerce Platforms**: Connect your store to Claude, ChatGPT, and Grok
- **Marketplace Operators**: Build multi-vendor AI shopping experiences
- **Developers**: Build custom commerce backends with clean interfaces
- **Enterprises**: Standardize AI integrations across multiple brands

### 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](https://github.com/betterdata/llm-gateway/blob/main/CONTRIBUTING.md).

### 📄 License

MIT - Use it freely in your projects!

---

**Built with ❤️ by [Better Data](https://betterdata.com)**

---

## Social Media Posts

### Twitter/X

🚀 Announcing @betterdata/llm-gateway v1.0.0 - Universal LLM Gateway for Conversational Commerce!

Connect your e-commerce platform to Claude, ChatGPT, and Grok with a single API. Open source, MIT licensed.

🔗 npm: https://www.npmjs.com/package/@betterdata/llm-gateway
📚 Docs: https://github.com/betterdata/llm-gateway

#AI #Ecommerce #OpenSource #LLM

### LinkedIn

We're excited to open-source @betterdata/llm-gateway, a universal abstraction layer that enables any e-commerce platform to integrate with multiple AI assistants through a single, unified API.

Key benefits:
✅ Works with Claude (MCP), OpenAI (Functions), and Grok
✅ Production-ready with rate limiting, auth, and logging
✅ Clean, pluggable backend interfaces
✅ Multi-vendor marketplace support

Perfect for e-commerce platforms, marketplace operators, and developers building AI-powered shopping experiences.

Try it today: https://www.npmjs.com/package/@betterdata/llm-gateway

### Reddit (r/node, r/javascript, r/ecommerce)

**Title**: Announcing @betterdata/llm-gateway - Universal LLM Gateway for Conversational Commerce (Open Source)

**Body**:

Hey r/node! We just open-sourced our LLM Gateway that we've been using in production for the past year.

**What it does:**
Enables any e-commerce platform to integrate with Claude, ChatGPT, and Grok through a single API. No more building separate integrations for each LLM.

**Key features:**
- Universal tool format (define once, use everywhere)
- Pluggable backends (products, cart, orders)
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
- npm: https://www.npmjs.com/package/@betterdata/llm-gateway
- GitHub: https://github.com/betterdata/llm-gateway
- Docs: https://github.com/betterdata/llm-gateway/tree/main/docs

Would love feedback from the community!

---

## Hacker News

**Title**: Show HN: @betterdata/llm-gateway – Universal LLM Gateway for E-commerce (Open Source)

**Body**:

We've open-sourced our LLM Gateway that we've been using in production. It enables any e-commerce platform to integrate with Claude, ChatGPT, and Grok through a single API.

**The Problem:**
Every e-commerce platform needs to integrate with multiple AI assistants, but each has different APIs, authentication, and tool-calling formats. Building these integrations from scratch is time-consuming.

**The Solution:**
A universal abstraction layer that:
- Defines tools once, works everywhere
- Provides clean interfaces for products, cart, and orders
- Handles session management across platforms
- Includes production features (rate limiting, auth, logging)

**Tech:**
- TypeScript, Hono, Redis
- Full type safety
- MIT licensed

**Links:**
- npm: https://www.npmjs.com/package/@betterdata/llm-gateway
- GitHub: https://github.com/betterdata/llm-gateway
- Docs: https://github.com/betterdata/llm-gateway/tree/main/docs

Would love feedback!

