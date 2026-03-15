# MikoPoker — Production Deployment Guide

## Prerequisites

- **Server**: AWS EC2 (or any Linux host) with Ubuntu 22.04+
- **User**: `miko` (non-root, with sudo access)
- **Software**: Node.js 20+, npm, nginx, git
- **Domain**: DNS pointed to the server (e.g., `poker.yourdomain.com`)

## 1. Server Setup

```bash
# Install Node.js 20 (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install nginx
sudo apt-get install -y nginx

# Install serve globally (static file server)
sudo npm install -g serve

# Create the miko user (if not exists)
sudo useradd -m -s /bin/bash miko
sudo usermod -aG sudo miko
```

## 2. Clone and Build

```bash
# Switch to miko user
sudo su - miko

# Clone the repository
git clone <your-repo-url> /home/miko/miko-poker
cd /home/miko/miko-poker

# Install dependencies
npm install

# Build the engine and UI (output goes to public/)
npm run build
```

The production build obfuscates all JavaScript. The deployable files are in `public/`.

## 3. Install the Systemd Service

```bash
cd /home/miko/miko-poker
bash deploy/install.sh
```

This copies `deploy/mikopoker.service` to `/etc/systemd/system/`, enables it to start on boot, and registers it with systemd. The service runs `npx serve -l 9555 -s` as the `miko` user, serving the static `public/` directory on port 9555.

## 4. Configure Nginx

```bash
# Edit the domain in the config file first
nano deploy/nginx.conf
# Change: server_name poker.yourdomain.com;

# Copy to nginx sites
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mikopoker
sudo ln -s /etc/nginx/sites-available/mikopoker /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

Nginx proxies requests from port 80 to the local serve instance on port 9555. Static assets under `/assets/` are cached for 1 year (safe because Vite hashes filenames).

### HTTPS (Recommended)

```bash
# Install certbot for Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx

# Get and install certificate
sudo certbot --nginx -d poker.yourdomain.com
```

Certbot will automatically update your nginx config to redirect HTTP → HTTPS.

## 5. Start the Service

```bash
bash deploy/start.sh
```

Verify it's running:

```bash
bash deploy/status.sh
```

Visit `http://poker.yourdomain.com` (or `https://` if certbot is set up).

## Management Scripts

All scripts are in the `deploy/` directory:

| Script | Description |
|--------|-------------|
| `bash deploy/start.sh` | Start the service |
| `bash deploy/stop.sh` | Stop the service |
| `bash deploy/restart.sh` | Restart and show status |
| `bash deploy/status.sh` | Show status and last 20 log lines |
| `bash deploy/deploy.sh` | Full deploy: build + restart |

## Deploying Updates

```bash
cd /home/miko/miko-poker
git pull
bash deploy/deploy.sh
```

This rebuilds the engine and UI with obfuscation, copies output to `public/`, and restarts the service. Zero-downtime is near-instant since `serve` picks up the new files on restart.

## Logs

```bash
# View live logs
sudo journalctl -u mikopoker -f

# View last 50 lines
sudo journalctl -u mikopoker -n 50 --no-pager
```

## Ports

| Port | Service | Access |
|------|---------|--------|
| 9555 | serve (static files) | localhost only (proxied by nginx) |
| 80 | nginx (HTTP) | public |
| 443 | nginx (HTTPS) | public (after certbot) |

## Troubleshooting

**Service won't start:**
```bash
sudo journalctl -u mikopoker -n 30 --no-pager
# Check if serve is installed: which serve || sudo npm install -g serve
# Check if public/ exists: ls /home/miko/miko-poker/public/
```

**502 Bad Gateway from nginx:**
```bash
# Check if the service is running
bash deploy/status.sh
# Check if port 9555 is listening
ss -tlnp | grep 9555
```

**Build fails:**
```bash
# Make sure engine builds first
npm run build:engine
# Then UI
npm run build:ui
```

**Permission issues:**
```bash
# Ensure miko owns the project directory
sudo chown -R miko:miko /home/miko/miko-poker
```
