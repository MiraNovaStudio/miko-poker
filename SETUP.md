# MikoPoker — Production Deployment Guide

## Prerequisites

- **Build machine**: Node.js 20+, npm, `dpkg-deb` (any Linux/WSL)
- **Server**: Ubuntu 22.04+ / Debian 12+ with Node.js 20+ installed
- **Domain**: DNS pointed to the server (e.g., `poker.yourdomain.com`)

## 1. Build the Debian Package

On your dev machine:

```bash
bash deploy/build-dpkg.sh
```

This runs the production build (engine + UI with obfuscation), bundles the `serve` static file server, and produces `deploy/mikopoker_<version>_all.deb`.

## 2. Transfer to Server

```bash
scp deploy/mikopoker_*.deb user@server:/tmp/
```

## 3. Install the Package

On the server (requires sudo):

```bash
sudo dpkg -i /tmp/mikopoker_*.deb
```

The package automatically:
- Creates the `miko` user (if not exists)
- Installs the app to `/home/miko/miko-poker/`
- Bundles the `serve` static file server (no internet needed)
- Installs the systemd service (`mikopoker`) and enables it
- Installs the nginx config to `/etc/nginx/sites-available/mikopoker`

## 4. Configure Nginx

```bash
# Edit the domain in the config
sudo nano /etc/nginx/sites-available/mikopoker
# Change: server_name poker.yourdomain.com;

# Enable the site
sudo ln -sf /etc/nginx/sites-available/mikopoker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS (Recommended)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d poker.yourdomain.com
```

## 5. Start the Service

```bash
sudo systemctl start mikopoker
```

Verify it's running:

```bash
sudo systemctl status mikopoker
```

Visit `http://poker.yourdomain.com` (or `https://` if certbot is set up).

## Deploying Updates

On your dev machine:

```bash
# Pull latest code, build new package
git pull
bash deploy/build-dpkg.sh

# Transfer and install
scp deploy/mikopoker_*.deb user@server:/tmp/
ssh user@server 'sudo dpkg -i /tmp/mikopoker_*.deb && sudo systemctl restart mikopoker'
```

The package preserves admin-edited config files (nginx, systemd service) during upgrades.

## Uninstalling

```bash
sudo dpkg -r mikopoker
```

This stops the service and removes the app files. The `miko` user and `/home/miko` are NOT removed. To remove them: `sudo userdel -r miko`.

## Management

| Command | Description |
|---------|-------------|
| `sudo systemctl start mikopoker` | Start the service |
| `sudo systemctl stop mikopoker` | Stop the service |
| `sudo systemctl restart mikopoker` | Restart the service |
| `sudo systemctl status mikopoker` | Show status |

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
# Check if Node.js is installed: node --version
# Check if public/ exists: ls /home/miko/miko-poker/public/
```

**502 Bad Gateway from nginx:**
```bash
sudo systemctl status mikopoker
ss -tlnp | grep 9555
```

**Package install fails with missing dependencies:**
```bash
# Install Node.js if not present
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Retry
sudo dpkg -i /tmp/mikopoker_*.deb
```
