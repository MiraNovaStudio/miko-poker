#!/usr/bin/env bash
set -euo pipefail

echo "Starting MikoPoker service..."
sudo systemctl start mikopoker
sudo systemctl status mikopoker --no-pager
echo "MikoPoker is running on port 9555"
