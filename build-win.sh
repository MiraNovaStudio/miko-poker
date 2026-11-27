#!/usr/bin/env bash
# Build the production UI with relative asset paths, then package a Windows installer.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Git Bash ships a link.exe that hides the Visual Studio linker.
# Load the C++ build environment so cargo can link the Windows shell.
load_msvc() {
  local vswhere="/c/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe"
  if [[ ! -f "$vswhere" ]]; then
    echo "ERROR: Visual Studio was not found. Install the Desktop development with C++ workload."
    exit 1
  fi
  local install
  install="$("$vswhere" -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | tr -d '\r')"
  if [[ -z "$install" ]]; then
    echo "ERROR: Visual Studio C++ tools were not found. Install the Desktop development with C++ workload."
    exit 1
  fi

  local bat dump
  bat="$(mktemp --suffix .bat)"
  dump="$(mktemp)"
  printf '@echo off\r\ncall "%s\\VC\\Auxiliary\\Build\\vcvars64.bat" >nul\r\nset\r\n' "$install" > "$bat"
  cmd //c "$(cygpath -w "$bat")" > "$dump"

  local win_path
  win_path="$(grep '^PATH=' "$dump" | head -1 | cut -d= -f2- | tr -d '\r')"
  export PATH="$(cygpath -p "$win_path")"
  export LIB="$(grep '^LIB=' "$dump" | head -1 | cut -d= -f2- | tr -d '\r')"
  export INCLUDE="$(grep '^INCLUDE=' "$dump" | head -1 | cut -d= -f2- | tr -d '\r')"
  export LIBPATH="$(grep '^LIBPATH=' "$dump" | head -1 | cut -d= -f2- | tr -d '\r')"
  rm -f "$bat" "$dump"
}

export MIKO_DESKTOP=1
bash "$PROJECT_ROOT/build.sh"

echo ""
echo "=== Packaging Windows installer ==="
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) load_msvc ;;
esac
cd "$PROJECT_ROOT/desktop"
npm exec -- tauri build

echo ""
echo "=== Installer complete ==="
echo "Setup exe: desktop/src-tauri/target/release/bundle/nsis/"
