#!/usr/bin/env bash
set -euo pipefail

echo "Stopping MikoPoker service..."
sudo systemctl stop mikopoker
echo "MikoPoker stopped."
