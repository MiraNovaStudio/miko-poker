#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -x "$PROJECT_ROOT/node_modules/.bin/tsc" && ! -f "$PROJECT_ROOT/node_modules/.bin/tsc.cmd" ]]; then
  echo "ERROR: TypeScript is not installed. From the repo root, run: npm install"
  exit 1
fi

echo "=== Building MikoPoker ==="

# Step 1: Build engine
echo "[1/3] Building engine..."
cd "$PROJECT_ROOT/engine"
npm run build
echo "  Engine built."

# Verify engine dist exists
if [ ! -f "$PROJECT_ROOT/engine/dist/index.js" ]; then
  echo "ERROR: engine/dist/index.js not found. Engine build may have failed."
  exit 1
fi

# Step 2: Build miko-ui
echo "[2/3] Building miko-ui..."
cd "$PROJECT_ROOT/miko-ui"
npm run build
echo "  UI built."

# Step 3: Copy the UI build to public/
echo "[3/3] Copying build to public/..."
rm -rf "$PROJECT_ROOT/public"
cp -r "$PROJECT_ROOT/miko-ui/dist" "$PROJECT_ROOT/public"
echo "  Copied to $PROJECT_ROOT/public/"

echo ""
echo "=== Build complete ==="
echo "Serve with: npx serve public -l 9001"
