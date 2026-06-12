# Infrastructure — AWS + Vercel Deployment (Cost-Optimized)

Pulse OS deployment: **NestJS backend on EC2 + Docker**, **Next.js frontend on Vercel**.

## Architecture

```
Browser
  ├── HTTPS ───────────────────────────► Vercel (Next.js frontend)
  └── HTTPS/WSS ──► EC2 t3.small
                      ├── nginx (SSL termination → :3002)
                      └── Docker: NestJS container
                            ├── RDS PostgreSQL 16 (private subnet)
                            └── ElastiCache Redis 7 (private subnet)
```

## Monthly Cost Estimate

| Service | Config | Cost |
|---------|--------|------|
| EC2 t3.small | 1 instance, public subnet | ~$15 |
| RDS db.t3.micro | Single AZ, 20 GB | ~$13 |
| ElastiCache cache.t4g.micro | Single node | ~$13 |
| Elastic IP | Free while attached | $0 |
| NAT Gateway | **Not needed** (EC2 in public subnet) | $0 |
| ALB | **Not needed** (nginx on EC2) | $0 |
| **Total** | | **~$41/month** |

> **Free Tier (first 12 months):** EC2 t3.micro + RDS db.t3.micro = ~$13/month total

---

## Phase Checklist

| Phase | What | Status |
|-------|------|--------|
| 1 | AWS Networking (VPC, subnets, security groups) | |
| 2 | RDS PostgreSQL | |
| 3 | ElastiCache Redis | |
| 4 | EC2 instance + Docker + nginx | |
| 5 | SSL cert + domain (Let's Encrypt + Route 53) | |
| 6 | DB migrations (Drizzle) | |
| 7 | Vercel frontend | |
| 8 | CI/CD (GitHub Actions → SSH deploy) | |

---

## Phase 1 — AWS Networking

### 1.1 Prerequisites

Install and configure the AWS CLI:

```powershell
winget install Amazon.AWSCLI
aws configure
# Enter: Access Key ID, Secret Access Key, region (e.g. ap-southeast-1), output format: json
```

### 1.2 Create VPC

**AWS Console → VPC → Create VPC → "VPC and more"**

| Field | Value |
|-------|-------|
| Name tag | `pulse-vpc` |
| IPv4 CIDR | `10.0.0.0/16` |
| Availability Zones | 2 |
| Public subnets | **1** (for EC2) |
| Private subnets | **2** (RDS + ElastiCache subnet groups require 2 AZs minimum) |
| NAT gateways | **None** |
| VPC Endpoints | **None** |

> EC2 in a public subnet has direct internet access — no NAT Gateway needed. This saves ~$32/month.

### 1.3 Security Groups

Create these 3 security groups inside `pulse-vpc`:

**`pulse-ec2-sg`** (EC2 instance — nginx + Docker):

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Inbound | HTTP | 80 | `0.0.0.0/0` |
| Inbound | HTTPS | 443 | `0.0.0.0/0` |
| Inbound | Custom TCP | 22 | **Your IP only** (check whatismyip.com) |
| Outbound | All traffic | All | `0.0.0.0/0` |

**`pulse-rds-sg`** (PostgreSQL):

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Inbound | Custom TCP | 5432 | `pulse-ec2-sg` (select by security group, not IP) |

**`pulse-redis-sg`** (ElastiCache):

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Inbound | Custom TCP | 6379 | `pulse-ec2-sg` (select by security group, not IP) |

---

## Phase 2 — RDS PostgreSQL

**RDS → Create database**

| Field | Value |
|-------|-------|
| Engine | PostgreSQL |
| Version | **PostgreSQL 16** (matches `postgres:16-alpine` in Docker — `-alpine` is just the Linux base, not the PG version) |
| Template | **Free tier** (disables Multi-AZ, forces t3.micro — saves ~$13/month vs Production template) |
| DB identifier | `pulse-postgres` |
| Username | `pulse` |
| Password | Generate strong password — **save it** |
| Instance class | `db.t3.micro` |
| Storage | 20 GB gp2 |
| VPC | `pulse-vpc` |
| Subnet group | Create new → select both **private** subnets |
| Security group | `pulse-rds-sg` |
| Public access | **No** |
| Database name | `pulse_v2` |
| Backup retention | 7 days |

> Save the endpoint — format: `pulse-postgres.xxxx.ap-southeast-1.rds.amazonaws.com`

---

## Phase 3 — ElastiCache Redis

**ElastiCache → Create → Redis OSS cache**

| Field | Value |
|-------|-------|
| Deployment option | **Node-based Cluster** |
| Creation method | **Cluster cache** |
| Cluster mode | **Disabled** (BullMQ uses Lua scripts — incompatible with cluster mode) |
| Cluster name | `pulse-redis` |
| Location | AWS |
| Multi-AZ | **Unchecked** |
| Auto-failover | **Unchecked** |
| Engine version | 7.1 |
| Port | 6379 |
| Node type | **`cache.t4g.micro`** (manually change from the preselected large — ~$13/month) |
| Number of replicas | **0** |
| Subnet group | Create new → select both **private** subnets → VPC: `pulse-vpc` |
| Security group | `pulse-redis-sg` |
| Encryption in transit | **Yes (TLS)** |
| Auth token | Generate strong password — **save it** |

> Save the endpoint — format: `pulse-redis.xxxx.cache.amazonaws.com:6379`
>
> `REDIS_URL` must use `rediss://` (double-s) because TLS is enabled.

---

## Phase 4 — EC2 Instance + Docker + nginx

### 4.1 Launch EC2 Instance

**EC2 → Launch Instance**

| Field | Value |
|-------|-------|
| Name | `pulse-server` |
| AMI | **Amazon Linux 2023** (latest) |
| Instance type | `t3.micro` (free tier) or `t3.small` (recommended for NestJS + agents) |
| Key pair | Create new → `pulse-key` → download `.pem` file — **save it** |
| VPC | `pulse-vpc` |
| Subnet | **public** subnet |
| Auto-assign public IP | **Enable** |
| Security group | `pulse-ec2-sg` |
| Storage | 20 GB gp3 |

### 4.2 Assign Elastic IP

**EC2 → Elastic IPs → Allocate → Associate** → select `pulse-server`

This gives the instance a fixed IP that survives reboots.

### 4.3 SSH into the Instance

```powershell
# Fix key permissions (Windows)
icacls "C:\path\to\pulse-key.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"

ssh -i "C:\path\to\pulse-key.pem" ec2-user@YOUR_ELASTIC_IP
```

### 4.4 Install Docker + nginx

```bash
# Update system
sudo dnf update -y

# Install Docker
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
newgrp docker

# Install nginx
sudo dnf install -y nginx
sudo systemctl enable nginx

# Install certbot (for Let's Encrypt SSL)
sudo dnf install -y python3-certbot-nginx
```

### 4.5 Create .env File on EC2

```bash
sudo mkdir -p /opt/pulse
sudo nano /opt/pulse/.env
```

Paste all environment variables (see Environment Variable Reference at the bottom).

```bash
# Secure the file
sudo chmod 600 /opt/pulse/.env
```

### 4.6 Run NestJS Docker Container

```bash
# Pull the image from ECR (after Phase 8 CI/CD is set up, this happens automatically)
# For first deploy, build locally and push, then pull here:
docker pull YOUR_ECR_URI/pulse-server:latest

docker run -d \
  --name pulse-server \
  --restart unless-stopped \
  --env-file /opt/pulse/.env \
  -p 3002:3002 \
  YOUR_ECR_URI/pulse-server:latest
```

### 4.7 Configure nginx

```bash
sudo nano /etc/nginx/conf.d/pulse.conf
```

Paste:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Phase 5 — SSL + Domain

### 5.1 Route 53 DNS Record

**Route 53 → Hosted zone → Create record**

| Field | Value |
|-------|-------|
| Name | `api` |
| Type | A |
| Value | Your **Elastic IP** address |
| TTL | 300 |

### 5.2 Let's Encrypt SSL (free)

SSH into EC2 and run:

```bash
sudo certbot --nginx -d api.yourdomain.com
# Follow prompts: enter email, agree to terms, choose redirect HTTP→HTTPS
```

Certbot auto-renews every 90 days. Verify auto-renewal:

```bash
sudo systemctl status certbot-renew.timer
```

Backend is now live at `https://api.yourdomain.com`

---

## Phase 6 — Run Database Migrations

SSH into EC2 and run migrations inside the container:

```bash
docker exec pulse-server npx drizzle-kit migrate
```

Or run as a one-off container:

```bash
docker run --rm \
  --env-file /opt/pulse/.env \
  YOUR_ECR_URI/pulse-server:latest \
  npx drizzle-kit migrate
```

---

## Phase 7 — Vercel Frontend

### 7.1 Connect Repository

1. [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the `pulse-eo` repo
3. Set **Root Directory** to `frontend`
4. Framework preset: Next.js (auto-detected)

### 7.2 Environment Variables

**Vercel → Project Settings → Environment Variables**

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |

### 7.3 Custom Domain

Vercel → Project → Domains → Add `app.yourdomain.com` → follow DNS instructions.

### 7.4 Update FRONTEND_URL on EC2

```bash
sudo nano /opt/pulse/.env
# Update FRONTEND_URL=https://app.yourdomain.com

docker restart pulse-server
```

---

## Phase 8 — CI/CD (GitHub Actions → SSH Deploy)

The workflow file lives at [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml).

On every push to `main` touching `server/`, it builds the Docker image, pushes to ECR, then SSHes into EC2 to pull and restart the container.

Update [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) to use SSH deploy instead of ECS:

```yaml
- name: Deploy to EC2
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ec2-user
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
      docker pull ${{ secrets.ECR_REGISTRY }}/pulse-server:latest
      docker stop pulse-server || true
      docker rm pulse-server || true
      docker run -d \
        --name pulse-server \
        --restart unless-stopped \
        --env-file /opt/pulse/.env \
        -p 3002:3002 \
        ${{ secrets.ECR_REGISTRY }}/pulse-server:latest
```

### Required GitHub Secrets

**GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | From IAM CI user |
| `AWS_SECRET_ACCESS_KEY` | From IAM CI user |
| `ECR_REGISTRY` | `123456789.dkr.ecr.ap-southeast-1.amazonaws.com` |
| `EC2_HOST` | Your Elastic IP |
| `EC2_SSH_KEY` | Contents of `pulse-key.pem` |

### IAM CI User (least-privilege)

Create a dedicated IAM user for GitHub Actions with only:
- `AmazonEC2ContainerRegistryPowerUser`

---

## Environment Variable Reference

All variables and where they live in production:

| Variable | Set In | Notes |
|----------|--------|-------|
| `DATABASE_URL` | `/opt/pulse/.env` on EC2 | `postgresql://pulse:PWD@rds-endpoint:5432/pulse_v2` |
| `REDIS_URL` | `/opt/pulse/.env` on EC2 | `rediss://:TOKEN@redis-endpoint:6379` (double-s = TLS) |
| `CLERK_SECRET_KEY` | `/opt/pulse/.env` on EC2 | Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | `/opt/pulse/.env` on EC2 | Clerk dashboard → Webhooks |
| `CLERK_DOMAIN` | `/opt/pulse/.env` on EC2 | |
| `OPENAI_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `OPENAI_MODEL` | `/opt/pulse/.env` on EC2 | `gpt-4o` |
| `ANTHROPIC_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `ANTHROPIC_DEFAULT_MODEL` | `/opt/pulse/.env` on EC2 | `claude-opus-4-6` |
| `MANAGED_AGENT_ENVIRONMENT_ID` | `/opt/pulse/.env` on EC2 | |
| `AHREFS_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `DATAFORSEO_LOGIN` | `/opt/pulse/.env` on EC2 | |
| `DATAFORSEO_PASSWORD` | `/opt/pulse/.env` on EC2 | |
| `FIRECRAWL_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `SERPER_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `PAGESPEED_API_KEY` | `/opt/pulse/.env` on EC2 | |
| `GSC_CLIENT_ID` | `/opt/pulse/.env` on EC2 | |
| `GSC_CLIENT_SECRET` | `/opt/pulse/.env` on EC2 | |
| `GSC_REDIRECT_URI` | `/opt/pulse/.env` on EC2 | |
| `GSC_ENCRYPTION_KEY` | `/opt/pulse/.env` on EC2 | |
| `STRIPE_SECRET_KEY` | `/opt/pulse/.env` on EC2 | Use `sk_live_` key |
| `STRIPE_WEBHOOK_SECRET` | `/opt/pulse/.env` on EC2 | |
| `STRIPE_PRICE_PRO` | `/opt/pulse/.env` on EC2 | |
| `STRIPE_PRICE_AGENCY` | `/opt/pulse/.env` on EC2 | |
| `STRIPE_PRICE_ENTERPRISE` | `/opt/pulse/.env` on EC2 | |
| `NODE_ENV` | `/opt/pulse/.env` on EC2 | `production` |
| `PORT` | `/opt/pulse/.env` on EC2 | `3002` |
| `FRONTEND_URL` | `/opt/pulse/.env` on EC2 | `https://app.yourdomain.com` |
| `PROMPT_SOURCE` | `/opt/pulse/.env` on EC2 | `local` |
| `LOG_LEVEL` | `/opt/pulse/.env` on EC2 | `info` |
| `NEXT_PUBLIC_API_URL` | Vercel env vars | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | Vercel env vars | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel env vars | Use `pk_live_` key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Vercel env vars | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Vercel env vars | `/sign-up` |
