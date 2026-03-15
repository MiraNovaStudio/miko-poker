#!/usr/bin/env bash
# Run this once on the server to set up the systemd service.
# Must be run as root or with sudo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/mikopoker.service"

if [ ! -f "$SERVICE_FILE" ]; then
  echo "ERROR: mikopoker.service not found in $SCRIPT_DIR"
  exit 1
fi

echo "Installing MikoPoker systemd service..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/mikopoker.service
sudo systemctl daemon-reload
sudo systemctl enable mikopoker

echo "Service installed and enabled."
echo ""
echo "Next steps:"
echo "  1. Build the project:  npm run build"
echo "  2. Start the service:  bash deploy/start.sh"
echo "  3. Configure nginx:    see deploy/nginx.conf"
