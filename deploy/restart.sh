#!/usr/bin/env bash
set -euo pipefail

echo "Restarting MikoPoker service..."
sudo systemctl restart mikopoker
sudo systemctl status mikopoker --no-pager
echo "MikoPoker restarted on port 9555"
