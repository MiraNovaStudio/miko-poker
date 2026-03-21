# MikoPoker — Production Deployment Guide

## Prerequisites

- **Server**: AWS EC2 (or any Linux host) with Ubuntu 22.04+
- **User**: `miko` (non-root, no sudo required)
- **Software**: Node.js 20+, npm, git
- **Domain**: DNS pointed to the server (e.g., `poker.yourdomain.com`)

> **Note**: Nginx, systemd service installation, and certbot require root/sudo access. These are one-time tasks that should be performed by a server admin before handing off to the `miko` user.

## 1. Admin Setup (requires sudo — one-time)

An administrator should perform these steps once:

```bash
# Create the miko user (if not exists)
sudo useradd -m -s /bin/bash miko

# Install nginx
sudo apt-get install -y nginx

# Install certbot for HTTPS (optional)
sudo apt-get install -y certbot python3-certbot-nginx

# Copy the systemd service file
sudo cp deploy/mikopoker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mikopoker

# Copy nginx config (edit domain first)
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mikopoker
sudo ln -s /etc/nginx/sites-available/mikopoker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Set up HTTPS (optional)
sudo certbot --nginx -d poker.yourdomain.com

# Ensure miko owns the project directory
sudo chown -R miko:miko /home/miko/miko-poker
```

## 2. Node.js Setup (as miko user — no sudo)

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# Install Node.js 20
nvm install 20
nvm use 20
```

## 3. Clone and Build

```bash
cd ~
git clone <your-repo-url> miko-poker
cd miko-poker

# Install dependencies
npm install

# Build the engine and UI (output goes to public/)
npm run build
```

The production build obfuscates all JavaScript. The deployable files are in `public/`.

## 4. Start the Service

The systemd service (installed by the admin) runs `npx serve -l 9555 -s` as the `miko` user, serving the static `public/` directory on port 9555.

```bash
bash deploy/start.sh
```

Verify it's running:

```bash
bash deploy/status.sh
```

Visit `http://poker.yourdomain.com` (or `https://` if certbot is set up).

## Deploying Updates

```bash
cd ~/miko-poker
git pull
bash deploy/deploy.sh
```

This rebuilds the engine and UI with obfuscation, copies output to `public/`, and restarts the service.

## Management Scripts

All scripts are in the `deploy/` directory and do not require sudo:

| Script | Description |
|--------|-------------|
| `bash deploy/start.sh` | Start the service |
| `bash deploy/stop.sh` | Stop the service |
| `bash deploy/restart.sh` | Restart and show status |
| `bash deploy/status.sh` | Show status and last 20 log lines |
| `bash deploy/deploy.sh` | Full deploy: build + restart |

## Logs

```bash
# View live logs
journalctl --user -u mikopoker -f

# View last 50 lines
journalctl --user -u mikopoker -n 50 --no-pager
```

> If the service is managed system-wide (not as a user service), logs require `sudo journalctl -u mikopoker`. Ask your admin to grant access if needed.

## Ports

| Port | Service | Access |
|------|---------|--------|
| 9555 | serve (static files) | localhost only (proxied by nginx) |
| 80 | nginx (HTTP) | public |
| 443 | nginx (HTTPS) | public (after certbot) |

## Troubleshooting

**Service won't start:**
```bash
bash deploy/status.sh
# Check if serve is available: npx serve --version
# Check if public/ exists: ls ~/miko-poker/public/
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

**Node.js not found after login:**
```bash
# Ensure nvm is loaded
source ~/.bashrc
nvm use 20
```
