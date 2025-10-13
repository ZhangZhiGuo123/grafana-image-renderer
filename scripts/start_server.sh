#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONFIG:-default.json}"
HTTP_HOST="${HTTP_HOST:-0.0.0.0}"
HTTP_PORT="${HTTP_PORT:-8081}"
LOG_LEVEL="${LOG_LEVEL:-info}"
export HTTP_HOST HTTP_PORT LOG_LEVEL
node "$REPO_DIR/build/app.js" server --config="$REPO_DIR/$CONFIG"