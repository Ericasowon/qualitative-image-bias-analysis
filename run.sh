#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR/app"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. See README.md."
  exit 1
fi

if ! python3 -c "import openpyxl" >/dev/null 2>&1; then
  echo "Install dependencies first: python3 -m pip install -r \"$ROOT_DIR/requirements.txt\""
  exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  ( sleep 1; xdg-open "http://127.0.0.1:8773" >/dev/null 2>&1 ) &
fi

exec python3 server.py
