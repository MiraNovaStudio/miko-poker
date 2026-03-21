#!/usr/bin/env bash
# build-dpkg.sh — Build a .deb package for MikoPoker.
#
# The package will:
#   - Create the 'miko' user (if not exists)
#   - Install the app to /home/miko/miko-poker
#   - Install the systemd service file
#   - Install the nginx config snippet
#
# Usage: bash deploy/build-dpkg.sh
# Output: deploy/mikopoker_<version>_all.deb

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read version from package.json
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
PKG_NAME="mikopoker"
PKG_DIR="$SCRIPT_DIR/${PKG_NAME}_${VERSION}_all"

echo "=== Building MikoPoker v${VERSION} .deb package ==="

# ── Step 1: Production build ──────────────────────────────────────
echo "[1/4] Running production build..."
cd "$PROJECT_ROOT"
npm run build

if [ ! -f "$PROJECT_ROOT/public/index.html" ]; then
  echo "ERROR: Build failed — public/index.html not found."
  exit 1
fi

# ── Step 2: Create package directory structure ────────────────────
echo "[2/4] Creating package structure..."
rm -rf "$PKG_DIR"

# App files → /home/miko/miko-poker
APP_DIR="$PKG_DIR/home/miko/miko-poker"
mkdir -p "$APP_DIR/public"
mkdir -p "$APP_DIR/deploy"

# Copy built output
cp -r "$PROJECT_ROOT/public/"* "$APP_DIR/public/"

# Copy deploy scripts (useful post-install)
cp "$SCRIPT_DIR/start.sh" "$APP_DIR/deploy/"
cp "$SCRIPT_DIR/stop.sh" "$APP_DIR/deploy/"
cp "$SCRIPT_DIR/restart.sh" "$APP_DIR/deploy/"
cp "$SCRIPT_DIR/status.sh" "$APP_DIR/deploy/"
cp "$SCRIPT_DIR/deploy.sh" "$APP_DIR/deploy/"
cp "$SCRIPT_DIR/nginx.conf" "$APP_DIR/deploy/"

# Systemd service → /etc/systemd/system/
mkdir -p "$PKG_DIR/etc/systemd/system"
cp "$SCRIPT_DIR/mikopoker.service" "$PKG_DIR/etc/systemd/system/"

# Nginx config → /etc/nginx/sites-available/
mkdir -p "$PKG_DIR/etc/nginx/sites-available"
cp "$SCRIPT_DIR/nginx.conf" "$PKG_DIR/etc/nginx/sites-available/mikopoker"

# ── Step 3: DEBIAN control files ──────────────────────────────────
echo "[3/4] Writing DEBIAN control files..."
mkdir -p "$PKG_DIR/DEBIAN"

cat > "$PKG_DIR/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: games
Priority: optional
Architecture: all
Depends: nodejs (>= 18)
Recommends: nginx
Maintainer: MiraNova Studios
Description: MikoPoker — Texas Hold'em poker game
 A single-player Texas Hold'em poker game with AI opponents,
 procedural avatars, and a PixiJS browser UI.
 Installs to /home/miko/miko-poker and runs on port 9555.
EOF

# conffiles — protect admin-edited config files during upgrades
cat > "$PKG_DIR/DEBIAN/conffiles" << EOF
/etc/nginx/sites-available/mikopoker
/etc/systemd/system/mikopoker.service
EOF

# Bundle 'serve' into the package so no internet is needed on target
echo "    Bundling 'serve' static file server..."
mkdir -p "$APP_DIR/node_modules"
(cd "$APP_DIR" && npm install --no-save serve 2>/dev/null)

# postinst — runs after package is installed
cat > "$PKG_DIR/DEBIAN/postinst" << 'POSTINST'
#!/usr/bin/env bash
set -e

# Create miko user if it doesn't exist
if ! id -u miko &>/dev/null; then
  echo "Creating 'miko' user..."
  useradd -m -s /bin/bash miko
  echo "User 'miko' created with home directory /home/miko"
fi

# Ensure miko owns the app directory
chown -R miko:miko /home/miko/miko-poker

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable mikopoker

echo ""
echo "================================================"
echo "  MikoPoker installed to /home/miko/miko-poker"
echo "================================================"
echo ""
echo "  Next steps:"
echo "    1. Start the service:"
echo "       sudo systemctl start mikopoker"
echo ""
echo "    2. Enable nginx proxy (optional):"
echo "       sudo ln -sf /etc/nginx/sites-available/mikopoker /etc/nginx/sites-enabled/"
echo "       # Edit server_name in /etc/nginx/sites-available/mikopoker"
echo "       sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "    3. Check status:"
echo "       sudo systemctl status mikopoker"
echo ""
echo "  The app will be served on port 9555."
echo "  Management scripts: /home/miko/miko-poker/deploy/"
echo ""
POSTINST
chmod 755 "$PKG_DIR/DEBIAN/postinst"

# prerm — runs before package is removed
cat > "$PKG_DIR/DEBIAN/prerm" << 'PRERM'
#!/usr/bin/env bash
set -e

echo "Stopping MikoPoker service..."
systemctl stop mikopoker 2>/dev/null || true
systemctl disable mikopoker 2>/dev/null || true

# Remove nginx symlink if it exists
rm -f /etc/nginx/sites-enabled/mikopoker
PRERM
chmod 755 "$PKG_DIR/DEBIAN/prerm"

# postrm — runs after package is removed
cat > "$PKG_DIR/DEBIAN/postrm" << 'POSTRM'
#!/usr/bin/env bash
set -e

systemctl daemon-reload

echo ""
echo "MikoPoker has been removed."
echo "The 'miko' user and /home/miko were NOT removed."
echo "To remove them: sudo userdel -r miko"
echo ""
POSTRM
chmod 755 "$PKG_DIR/DEBIAN/postrm"

# ── Step 4: Build the .deb ────────────────────────────────────────
echo "[4/4] Building .deb package..."
DEB_FILE="$SCRIPT_DIR/${PKG_NAME}_${VERSION}_all.deb"
dpkg-deb --build "$PKG_DIR" "$DEB_FILE" 2>/dev/null || {
  # dpkg-deb may not be available on Windows/macOS — try fakeroot
  echo "dpkg-deb not found locally. Package structure ready at:"
  echo "  $PKG_DIR"
  echo ""
  echo "To build the .deb on a Linux machine, run:"
  echo "  dpkg-deb --build $(basename "$PKG_DIR") $(basename "$DEB_FILE")"
  exit 0
}

# Clean up build directory
rm -rf "$PKG_DIR"

echo ""
echo "=== Package built ==="
echo "  $DEB_FILE"
echo ""
echo "Install on the server with:"
echo "  sudo dpkg -i $(basename "$DEB_FILE")"
echo ""
