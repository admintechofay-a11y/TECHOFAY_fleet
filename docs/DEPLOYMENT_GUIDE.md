# Production Deployment, Operations & Handover Guide
**Platform:** Technofay MERN Fleet & Transport Platform  
**Target Milestone:** SOW #24 & Phase 9 Hardening  
**Version:** 1.0.0 Production Release

---

## 1. System Requirements & Architecture

The platform runs as a high-availability, containerized or process-managed monorepo:
- **Runtime:** Node.js v22.x LTS or v24.x
- **Database:** MongoDB Community or Enterprise v7.0+ (Replica Set recommended for atomic transactions)
- **Cache & Queue:** Redis v7.x
- **Frontend Server:** Static files served via Nginx or Express public static mount
- **Reverse Proxy:** Nginx or Cloudflare with TLS 1.3 encryption

```mermaid
graph TD
    User([Transport Operator / Client]) -->|HTTPS:443| Nginx[Nginx Reverse Proxy / Cloudflare]
    Nginx -->|Static Assets| ViteDist[/app/apps/web/dist]
    Nginx -->|Reverse Proxy:5000| NodeCluster[Node.js Express Cluster / PM2]
    NodeCluster -->|Mongoose Pool| MongoDB[(MongoDB 7.0 Multi-Tenant)]
    NodeCluster -->|BullMQ Redis| Redis[(Redis 7.2 Message Queue)]
    NodeCluster -->|Storage Volume| UploadsDir[(Local / S3 Document Vault)]
```

---

## 2. Environment Variables Checklist

Create a production `.env` file in the project root:

```bash
# Server & Environment
PORT=5000
NODE_ENV=production
CLIENT_URL=https://transport.technofay.com

# Database Connection
MONGODB_URI=mongodb://admin:STRONG_PASSWORD@127.0.0.1:27017/fleet_transport_prod?authSource=admin
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=REDIS_STRONG_PASSWORD

# Cryptographic Secrets (Generate with `openssl rand -hex 64`)
JWT_ACCESS_SECRET=c8f5...71a2
JWT_REFRESH_SECRET=b4d1...89e3
COOKIE_SECRET=92e0...33f1

# Storage
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads

# WhatsApp Messaging Integration (Optional Production Credentials)
WHATSAPP_PROVIDER=INTERAKT
WHATSAPP_API_KEY=YOUR_INTERAKT_OR_TWILIO_KEY
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_ID
WHATSAPP_WEBHOOK_SECRET=YOUR_HMAC_SECRET
```

---

## 3. Production Deployment Workflows

### Option A: Containerized Deployment via Docker Compose (Recommended)

1. **Clone repository and configure environment**:
   ```bash
   git clone <repo-url> /opt/technofay-fleet
   cd /opt/technofay-fleet
   cp .env.example .env
   # Edit .env with production passwords
   ```

2. **Build and launch container cluster**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify health probes**:
   ```bash
   curl -I http://localhost:5000/api/v1/health
   # Returns HTTP 200 OK
   ```

---

### Option B: Bare Metal / Linux VM Deployment via PM2

1. **Install Node.js 22 LTS, PM2, and dependencies**:
   ```bash
   npm install -g pm2
   npm ci
   npm run build:web
   ```

2. **Start the production cluster**:
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

3. **Monitor running processes**:
   ```bash
   pm2 status
   pm2 logs technofay-fleet-api
   ```

---

## 4. Initial Super Administrator Provisioning

The system automatically initializes default organizations and the 8 statutory RBAC roles on startup. To provision the initial Super Administrator account, run:

```bash
node apps/api/src/server.js
```
The server checks for existing users. If none exist, it creates the Super Administrator and outputs the credentials to the secure deployment log.

---

## 5. Nginx Reverse Proxy Configuration

Place the following configuration in `/etc/nginx/sites-available/transport.technofay.com`:

```nginx
server {
    listen 80;
    server_name transport.technofay.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name transport.technofay.com;

    ssl_certificate /etc/letsencrypt/live/transport.technofay.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/transport.technofay.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Static Web Bundle
    location / {
        root /opt/technofay-fleet/apps/web/dist;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # API Endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Public Robots & Sitemap Passthrough
    location = /robots.txt {
        proxy_pass http://127.0.0.1:5000/robots.txt;
    }
    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:5000/sitemap.xml;
    }
}
```

---

## 6. Database Disaster Recovery & Maintenance

Automated database maintenance is managed via `scripts/db-backup-restore.js`:

```bash
# 1. Verify connection and collection integrity
node scripts/db-backup-restore.js --verify

# 2. Perform automated full archive backup
node scripts/db-backup-restore.js --backup
```
Archived snapshots are stored in `./backups/` with ISO timestamps.

---

## 7. Rollback Runbook

If an emergency rollback is required:
1. Revert git checkout to previous release tag:
   ```bash
   git checkout tags/v1.0.0-phase8
   ```
2. Rebuild frontend bundle:
   ```bash
   npm run build:web
   ```
3. Restart PM2 cluster:
   ```bash
   pm2 reload technofay-fleet-api
   ```
4. Verify database schema compatibility with `node scripts/db-backup-restore.js --verify`.
