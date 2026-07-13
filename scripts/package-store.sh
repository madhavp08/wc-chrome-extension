#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f config.js ]]; then
  echo "Missing config.js. Copy config.example.js and fill production values first." >&2
  exit 1
fi

if grep -q 'DEV_MODE = true' config.js; then
  echo "Refuse to package: set DEV_MODE = false in config.js for store builds." >&2
  exit 1
fi

VERSION="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' manifest.json | head -1)"
VERSION="${VERSION:-0.0.0}"
OUT="dist/vardict-${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  popup.html popup.css popup.js \
  content.js background.js \
  config.js \
  icons

echo "Wrote $OUT"
unzip -l "$OUT"
