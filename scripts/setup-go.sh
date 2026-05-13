#!/usr/bin/env bash
set -e

if command -v go &>/dev/null; then
  exit 0
fi

TOOLS_DIR="$(cd "$(dirname "$0")/.." && pwd)/.tools"
GO_DIR="$TOOLS_DIR/go"
GO_BIN="$GO_DIR/bin/go"

if [ -x "$GO_BIN" ]; then
  export PATH="$GO_DIR/bin:$PATH"
  exit 0
fi

ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
esac

VERSION="1.24.2"
TARBALL="go$VERSION.$OS-$ARCH.tar.gz"
URL="https://go.dev/dl/$TARBALL"

echo "Go not found. Downloading $URL ..."
mkdir -p "$TOOLS_DIR"
curl -#L "$URL" -o "$TOOLS_DIR/$TARBALL"
rm -rf "$GO_DIR"
tar -C "$TOOLS_DIR" -xzf "$TOOLS_DIR/$TARBALL"
rm "$TOOLS_DIR/$TARBALL"

export PATH="$GO_DIR/bin:$PATH"
echo "Go installed locally at $GO_DIR"
