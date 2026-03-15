#!/usr/bin/env bash
# Full deploy: build + restart service.
# Run from the project root as the miko user.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Building MikoPoker ==="
npm run build

echo ""
echo "=== Restarting service ==="
sudo systemctl restart mikopoker
sudo systemctl status mikopoker --no-pager

echo ""
echo "=== Deploy complete ==="
echo "Site is live on port 9555 (proxied by nginx)"
