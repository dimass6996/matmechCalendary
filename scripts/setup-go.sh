#!/usr/bin/env bash
set -e

OUTPUT="${1:-syncstudy-server}"
VERSION="1.24.2"

# 1. Найти или скачать Go
if ! command -v go &>/dev/null; then
  TOOLS_DIR="$(cd "$(dirname "$0")/.." && pwd)/.tools"
  GO_DIR="$TOOLS_DIR/go"
  GO_BIN="$GO_DIR/bin/go"

  if [ ! -x "$GO_BIN" ]; then
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$ARCH" in
      x86_64)  ARCH="amd64" ;;
      aarch64|arm64) ARCH="arm64" ;;
    esac

    TARBALL="go$VERSION.$OS-$ARCH.tar.gz"
    URL="https://go.dev/dl/$TARBALL"

    echo "Go not found. Downloading $URL ..."
    mkdir -p "$TOOLS_DIR"
    curl -#L "$URL" -o "$TOOLS_DIR/$TARBALL"
    rm -rf "$GO_DIR"
    tar -C "$TOOLS_DIR" -xzf "$TOOLS_DIR/$TARBALL"
    rm "$TOOLS_DIR/$TARBALL"
  fi

  export PATH="$GO_DIR/bin:$PATH"
fi

# 2. Собрать бэкенд
cd "$(dirname "$0")/../backend"
go build -buildvcs=false -o "$OUTPUT" ./cmd/server
echo "Backend built: backend/$OUTPUT"
