# Deployment Guides

This guide covers deploying the Better Data LLM Gateway to various platforms.

## Table of Contents

- [Vercel](#vercel)
- [Railway](#railway)
- [Docker](#docker)
- [Self-Hosted](#self-hosted)

---

## Vercel

### Prerequisites

- Vercel account
- Node.js 18+ project

### Step 1: Create Vercel Project

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Initialize project
vercel
```

### Step 2: Configure Environment Variables

In your Vercel dashboard, add these environment variables:

```env
REDIS_URL=redis://your-redis-url
DATABASE_URL=postgresql://your-db-url  # Optional, for session persistence
PORT=3000
```

### Step 3: Create `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Step 4: Deploy

```bash
vercel --prod
```

### Step 5: Configure Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Add your custom domain
3. Update DNS records as instructed

---

## Railway

### Prerequisites

- Railway account
- GitHub repository

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### Step 2: Add Redis Service

1. Click "New" → "Database" → "Redis"
2. Railway will automatically provision a Redis instance
3. Copy the `REDIS_URL` from the service variables

### Step 3: Configure Environment Variables

In your Railway project settings, add:

```env
REDIS_URL=${{Redis.REDIS_URL}}
PORT=3000
NODE_ENV=production
```

### Step 4: Configure Build Settings

Railway will auto-detect Node.js. Ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "tsup",
    "start": "node dist/index.js"
  }
}
```

### Step 5: Deploy

Railway will automatically deploy on every push to your main branch.

### Step 6: Get Public URL

Railway provides a public URL automatically. You can also add a custom domain in project settings.

---

## Docker

### Step 1: Create Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install production dependencies only
RUN npm install -g pnpm && \
    pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3000
      - NODE_ENV=production
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### Step 3: Build and Run

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# View logs
docker-compose logs -f gateway
```

### Step 4: Deploy to Docker Hub / Container Registry

```bash
# Tag image
docker tag your-image-name:latest your-registry/llm-gateway:latest

# Push
docker push your-registry/llm-gateway:latest
```

---

## Self-Hosted

### Step 1: Install Dependencies

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm
```

### Step 2: Clone and Build

```bash
git clone https://github.com/betterdataco/llm-commerce-gateway.git
cd llm-commerce-gateway
pnpm install
pnpm build
```

### Step 3: Install Redis

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Start Redis
sudo systemctl start redis  # Linux
brew services start redis    # macOS
```

### Step 4: Configure Environment

Create `.env` file:

```env
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production
```

### Step 5: Run with PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start gateway
pm2 start dist/index.js --name llm-gateway

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 6: Configure Nginx (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 7: Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | - | Redis connection URL for session storage |
| `PORT` | No | `3000` | Port to run the gateway on |
| `NODE_ENV` | No | `development` | Environment mode |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `REGISTRY_URL` | No | `https://registry.betterdata.co` | Commerce Registry API URL (optional) |

---

## Health Checks

All deployment methods should configure health checks:

```bash
# Health check endpoint
curl http://localhost:3000/health

# Expected response
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

---

## Monitoring

### Recommended Tools

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry, Rollbar
- **Logging**: Logtail, Datadog
- **Metrics**: Prometheus, Grafana

### Example Prometheus Metrics

```typescript
// Add to your gateway
import { prometheus } from '@betterdata/commerce-gateway/observability';

// Metrics are automatically exposed at /metrics
```

---

## Troubleshooting

### Gateway won't start

1. Check Node.js version: `node --version` (should be 18+)
2. Check Redis connection: `redis-cli ping`
3. Check logs: `pm2 logs llm-gateway` or `docker-compose logs`

### High memory usage

1. Enable Redis persistence for sessions
2. Configure session TTL
3. Monitor with `pm2 monit` or Docker stats

### Connection errors

1. Verify firewall rules allow traffic on port 3000
2. Check reverse proxy configuration (Nginx/Apache)
3. Verify SSL certificates are valid

---

## Next Steps

- [API Documentation](./API.md)
- [Integration Tutorials](./INTEGRATION_TUTORIALS.md)
- [Protocol Specification](./PROTOCOL.md)

