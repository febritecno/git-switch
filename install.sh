#!/usr/bin/env bash
# Install gs (and its git-acc alias) into a bin directory.
#
# One command (no clone needed):
#   curl -fsSL https://raw.githubusercontent.com/febritecno/git-switch/main/install.sh | bash
# From a clone (symlinks to the cloned script):
#   ./install.sh
# Custom location:
#   PREFIX=/usr/local/bin ./install.sh
set -euo pipefail

REPO="febritecno/git-switch"
PREFIX="${PREFIX:-$HOME/.local/bin}"
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)/gs"

for dep in zsh node git ssh-keygen; do
  command -v "$dep" >/dev/null 2>&1 || { echo "Missing dependency: $dep" >&2; exit 1; }
done

mkdir -p "$PREFIX"

if [[ -f "$LOCAL" ]]; then
  chmod +x "$LOCAL"
  ln -sf "$LOCAL" "$PREFIX/gs"
  echo "Installed (symlink): $PREFIX/gs -> $LOCAL"
else
  command -v curl >/dev/null 2>&1 || { echo "Missing dependency: curl" >&2; exit 1; }
  rm -f "$PREFIX/gs"
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/gs" -o "$PREFIX/gs"
  chmod +x "$PREFIX/gs"
  echo "Installed: $PREFIX/gs"
fi
ln -sf "$PREFIX/gs" "$PREFIX/git-acc"
echo "Alias: $PREFIX/git-acc"

case ":$PATH:" in
  *":$PREFIX:"*) ;;
  *) echo "Note: $PREFIX is not in PATH. Add to your shell rc:"
     echo "  export PATH=\"$PREFIX:\$PATH\"" ;;
esac

echo "Run 'gs help' to get started."
