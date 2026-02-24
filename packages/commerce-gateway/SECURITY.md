# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of @betterdata/commerce-gateway seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do Not

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** disclose the vulnerability publicly until it has been addressed

### Please Do

1. **Email us** at security@betterdata.dev with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

2. **Response timeline**:
   - We will acknowledge your email within 48 hours
   - We will provide a detailed response within 7 days
   - We will work on a fix and keep you updated on progress

3. **Disclosure**:
   - We ask that you give us reasonable time to address the issue before public disclosure
   - We will credit you in our security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using @betterdata/commerce-gateway, follow these security best practices:

### API Keys and Secrets

- **Never commit API keys** to version control
- Use environment variables for all sensitive configuration
- Rotate API keys regularly
- Use different keys for development and production

```typescript
// ✅ Good - Use environment variables
const gateway = new LLMGateway({
  auth: {
    apiKeys: [process.env.API_KEY!],
    jwtSecret: process.env.JWT_SECRET!,
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
});

// ❌ Bad - Hardcoded secrets
const gateway = new LLMGateway({
  auth: {
    apiKeys: ['sk_live_abc123'],  // Never do this!
  },
});
```

### Rate Limiting

Always enable rate limiting in production:

```typescript
const gateway = new LLMGateway({
  backends: { products, cart, orders },
  rateLimits: {
    windowMs: 60000,       // 1 minute
    maxRequests: 100,      // 100 requests per minute
  },
});
```

### Authentication

Enable authentication for all production deployments:

```typescript
const gateway = new LLMGateway({
  backends: { products, cart, orders },
  auth: {
    apiKeys: [process.env.API_KEY!],
    jwtSecret: process.env.JWT_SECRET!,
    // Never set allowAnonymous: true in production
  },
});
```

### Input Validation

The gateway validates all inputs using Zod schemas, but you should also validate inputs in your backend implementations:

```typescript
class MyProductBackend implements ProductBackend {
  async searchProducts(query: string, filters?: ProductFilters) {
    // Validate and sanitize inputs
    if (!query || query.length > 200) {
      throw new ValidationError('Invalid query');
    }
    
    // Escape for SQL if needed
    const sanitizedQuery = this.sanitize(query);
    
    // ... rest of implementation
  }
}
```

### Secure Session Storage

Use Redis with TLS in production:

```typescript
const gateway = new LLMGateway({
  backends: { products, cart, orders },
  session: {
    redis: {
      url: process.env.REDIS_URL,  // Use TLS connection string
      token: process.env.REDIS_TOKEN,
    },
    ttl: 3600,  // 1 hour - don't make sessions too long
  },
});
```

### HTTPS Only

Always run the gateway behind HTTPS in production:

```typescript
// In production, use a reverse proxy (Nginx, Cloudflare) with HTTPS
// Never expose the gateway directly to the internet over HTTP
```

### CORS Configuration

Configure CORS carefully:

```typescript
const gateway = new LLMGateway({
  backends: { products, cart, orders },
  cors: {
    origins: [
      'https://yourdomain.com',  // Specific origins only
      // Never use '*' in production
    ],
  },
});
```

### Dependency Security

- Run `npm audit` regularly
- Keep dependencies up to date
- Use lock files (`package-lock.json`, `pnpm-lock.yaml`)
- Subscribe to security advisories for dependencies

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# For breaking changes
npm audit fix --force
```

### Error Handling

Don't leak sensitive information in error messages:

```typescript
// ✅ Good - Generic error message
catch (error) {
  logger.error('Database error', error);
  throw new BackendError('Failed to fetch products');
}

// ❌ Bad - Leaks database details
catch (error) {
  throw new Error(`Database error: ${error.message}`);
}
```

## Security Checklist for Production

- [ ] All API keys stored in environment variables
- [ ] Rate limiting enabled
- [ ] Authentication enabled (no anonymous access)
- [ ] HTTPS/TLS enabled
- [ ] CORS configured with specific origins
- [ ] Redis session storage with TLS
- [ ] Dependencies audited and up to date
- [ ] Error messages don't leak sensitive info
- [ ] Logs don't contain secrets
- [ ] Security headers configured (use Helmet.js or similar)

## Known Security Considerations

### MCP Server (Claude Desktop)

The MCP server runs locally via stdio and doesn't expose network ports. However:

- Ensure the MCP server process has minimal file system permissions
- Don't put sensitive database credentials in the Claude Desktop config
- Use read-only database credentials when possible

### OpenAI/Grok Adapters

When using direct API integrations:

- API keys are sent to OpenAI/Grok servers
- Ensure you trust the LLM providers with your data
- Consider using separate API keys per environment

### Backend Implementations

The gateway is only as secure as your backend implementations:

- Use parameterized queries to prevent SQL injection
- Validate and sanitize all user inputs
- Implement proper access controls
- Audit your backend code regularly

## Responsible Disclosure

We follow responsible disclosure practices and will:

- Acknowledge your report promptly
- Work to address the vulnerability quickly
- Credit you in our security advisory (if desired)
- Not take legal action against researchers who report vulnerabilities in good faith

Thank you for helping keep @betterdata/commerce-gateway and its users safe!

## Contact

- Security issues: security@betterdata.dev
- General questions: opensource@betterdata.dev
- GitHub Security Advisories: https://github.com/betterdataco/llm-commerce-gateway/security/advisories

