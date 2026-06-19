# Infrastructure — Production Reference

Pulse OS (Rank Organiq) is **live in production**. This document is the operational reference for the running infrastructure and deployment processes. Local dev setup is at the bottom.

---

## Production URLs

| Surface | URL |
|---------|-----|
| Frontend (Vercel) | https://app.rankorganiq.com |
| Backend API (EC2) | https://api.rankorganiq.com |
| Swagger Docs | https://api.rankorganiq.com/docs |

---

## Architecture

```
Browser
  ├── HTTPS ──────────────────────────────► Vercel (Next.js)
  │                                          app.rankorganiq.com
  │
  └── HTTPS / WSS ──► nginx (EC2 t3.small)
                        api.rankorganiq.com
                        SSL termination → :3002
                              │
                              ▼
                        Docker: organiq-server
                        (NestJS 10, port 3002)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
             RDS PostgreSQL 16    ElastiCache Redis 7
             pulse-postgres        pulse-redis
             (private subnet)     (private subnet, TLS)
```

---

## AWS Resources

| Resource | Name | Region |
|----------|------|--------|
| EC2 instance type | `t3.small` | `ap-southeast-1` |
| Elastic IP | Fixed IP → `api.rankorganiq.com` | `ap-southeast-1` |
| RDS | `pulse-postgres` (PostgreSQL 16, db.t3.micro) | `ap-southeast-1` |
| ElastiCache | `pulse-redis` (Redis 7, cache.t4g.micro, TLS) | `ap-southeast-1` |
| ECR repository | `organiq-server-prod` | `ap-southeast-1` |
| VPC | `pulse-vpc` | `ap-southeast-1` |

---

## Deployment

### Frontend — Vercel (automatic)

Every push to `main` triggers a Vercel build and deploy automatically.

- **Repository**: `wearefast/organiq-v2`
- **Root directory**: `frontend/`
- **Framework**: Next.js (auto-detected)
- **Domain**: `app.rankorganiq.com`
- **No manual action required** — push to `main` → Vercel deploys

### Backend — GitHub Actions → EC2 (automatic)

Defined in [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml).

**Trigger:** Push to `main` that touches `server/**`, `tsconfig.base.json`, or `.github/workflows/deploy.yml`.

**Pipeline:**

```
git push origin main  (server/* changes)
        │
        ▼
GitHub Actions (ubuntu-latest)
  1. Checkout
  2. Configure AWS credentials (IAM CI user)
  3. Login to ECR ap-southeast-1
  4. docker build (server/Dockerfile, multi-stage Node 20-alpine)
  5. Push → ECR organiq-server-prod:latest + :<git-sha>
        │
        ▼  SSH via appleboy/ssh-action
EC2 (ec2-user @ api.rankorganiq.com)
  6. ECR login on EC2
  7. docker pull organiq-server-prod:latest  ← pre-pull while old container runs
  8. Run migrations (one-off container --env-file /opt/organiq/.env)
  9. docker stop organiq-server && docker rm organiq-server
  10. docker run -d organiq-server (hot-swap, ~1-2s downtime)
```

**Important behaviours:**
- Migrations run **before** the new container starts — schema-first safe rollout
- Pre-pull keeps downtime to ~1-2 seconds during hot-swap
- Container runs with `--restart unless-stopped` — survives reboots

### Required GitHub Secrets

**GitHub → Settings → Secrets and variables → Actions**

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM CI user (ECR push only) |
| `AWS_SECRET_ACCESS_KEY` | IAM CI user secret |
| `ECR_REGISTRY` | `<account-id>.dkr.ecr.ap-southeast-1.amazonaws.com` |
| `EC2_HOST` | EC2 Elastic IP (resolves to `api.rankorganiq.com`) |
| `EC2_SSH_KEY` | Contents of EC2 `.pem` key pair |

---

## EC2 Operations

### SSH Access

```bash
ssh -i "pulse-key.pem" ec2-user@api.rankorganiq.com
```

### Container Management

```bash
# Check running container
docker ps

# Live logs
docker logs organiq-server --tail 100 -f

# Restart (after .env change)
docker restart organiq-server

# Force redeploy from latest ECR image
docker pull <ECR_REGISTRY>/organiq-server-prod:latest
docker stop organiq-server && docker rm organiq-server
docker run -d \
  --name organiq-server \
  --restart unless-stopped \
  --env-file /opt/organiq/.env \
  -p 3002:3002 \
  <ECR_REGISTRY>/organiq-server-prod:latest
```

### Updating Environment Variables

```bash
sudo nano /opt/organiq/.env
docker restart organiq-server
```

### Running Migrations Manually

```bash
docker run --rm \
  --env-file /opt/organiq/.env \
  <ECR_REGISTRY>/organiq-server-prod:latest \
  npx drizzle-kit migrate
```

### nginx

Config: `/etc/nginx/conf.d/organiq.conf`

```bash
sudo nginx -t                          # validate config
sudo systemctl reload nginx            # reload (no downtime)
sudo tail -f /var/log/nginx/error.log  # error log
```

The nginx config proxies all traffic to `localhost:3002` with WebSocket upgrade headers.
On 502/503/504, nginx returns a CORS-safe JSON response instead of a bare error page.

### SSL (Let's Encrypt — auto-renewal)

```bash
sudo systemctl status certbot-renew.timer  # check renewal timer
sudo certbot renew --dry-run               # test renewal
```

---

## Security Groups

| Group | Inbound Rules |
|-------|--------------|
| `pulse-ec2-sg` | HTTP :80 + HTTPS :443 from `0.0.0.0/0`; SSH :22 from admin IP only |
| `pulse-rds-sg` | TCP :5432 from `pulse-ec2-sg` only |
| `pulse-redis-sg` | TCP :6379 from `pulse-ec2-sg` only |

RDS and ElastiCache are in private subnets with no public access.

---

## Monthly Cost

| Service | Config | Cost |
|---------|--------|------|
| EC2 t3.small | 1 instance | ~$15/mo |
| RDS db.t3.micro | PostgreSQL 16, single AZ, 20 GB | ~$13/mo |
| ElastiCache cache.t4g.micro | Redis 7, single node, TLS | ~$13/mo |
| Elastic IP | Attached | $0 |
| ECR | Image storage | ~$1/mo |
| **Total** | | **~$42/month** |

---

## Environment Variable Reference

### Backend (EC2 at `/opt/organiq/.env`, mode 600)

| Variable | Value / Description |
|----------|---------------------|
| `DATABASE_URL` | `postgresql://pulse:PWD@<rds-endpoint>:5432/pulse_v2` |
| `REDIS_URL` | `rediss://:TOKEN@<elasticache-endpoint>:6379` (`rediss://` = TLS) |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `CLERK_WEBHOOK_SECRET` | Svix webhook signing secret |
| `CLERK_DOMAIN` | Custom Clerk domain |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_DEFAULT_MODEL` | `claude-opus-4-6` |
| `OPENAI_API_KEY` | OpenAI API key |
| `AHREFS_API_KEY` | Ahrefs v3 API key |
| `DATAFORSEO_LOGIN` | DataForSEO login |
| `DATAFORSEO_PASSWORD` | DataForSEO password |
| `FIRECRAWL_API_KEY` | Firecrawl API key |
| `SERPER_API_KEY` | Serper.dev API key |
| `PAGESPEED_API_KEY` | Google PageSpeed/CrUX API key |
| `GSC_CLIENT_ID` | Google OAuth client ID |
| `GSC_CLIENT_SECRET` | Google OAuth client secret |
| `GSC_REDIRECT_URI` | `https://api.rankorganiq.com/projects/:id/gsc/callback` |
| `GSC_ENCRYPTION_KEY` | 32-byte hex key (AES-256-GCM) |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO` | Stripe Price ID — Pro plan |
| `STRIPE_PRICE_AGENCY` | Stripe Price ID — Agency plan |
| `STRIPE_PRICE_ENTERPRISE` | Stripe Price ID — Enterprise plan |
| `NODE_ENV` | `production` |
| `PORT` | `3002` |
| `FRONTEND_URL` | `https://app.rankorganiq.com` |
| `PROMPT_SOURCE` | `local` |
| `LOG_LEVEL` | `info` |

### Frontend (Vercel Environment Variables)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.rankorganiq.com` |
| `NEXT_PUBLIC_WS_URL` | `https://api.rankorganiq.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/workspaces` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/workspaces` |

---

## Local Development

Local dev uses Docker Compose for Postgres and Redis. **Never used in production.**

```bash
# Start Postgres + Redis
npm run infra:up

# Push schema / run migrations
npm run db:push

# Seed
npm run db:seed

# Start dev servers (both concurrently)
npm run dev
```

| Local Service | URL |
|---------------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3002 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6379 |
| Drizzle Studio | `npm run db:studio` |
