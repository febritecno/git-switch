#!/usr/bin/env bash
# Install gs (and its git-acc alias) by symlinking into a bin directory.
# usage: ./install.sh            # installs to ~/.local/bin
#        PREFIX=/usr/local/bin ./install.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/gs"
PREFIX="${PREFIX:-$HOME/.local/bin}"

for dep in zsh node git ssh-keygen; do
  command -v "$dep" >/dev/null 2>&1 || { echo "Missing dependency: $dep" >&2; exit 1; }
done
[[ -f "$SRC" ]] || { echo "gs script not found at $SRC" >&2; exit 1; }

chmod +x "$SRC"
mkdir -p "$PREFIX"
ln -sf "$SRC" "$PREFIX/gs"
ln -sf "$SRC" "$PREFIX/git-acc"
echo "Installed: $PREFIX/gs, $PREFIX/git-acc -> $SRC"

case ":$PATH:" in
  *":$PREFIX:"*) ;;
  *) echo "Note: $PREFIX is not in PATH. Add to your shell rc:"
     echo "  export PATH=\"$PREFIX:\$PATH\"" ;;
esac

echo "Run 'gs help' to get started."
