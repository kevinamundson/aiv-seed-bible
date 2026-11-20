#!/usr/bin/env bash
# Copy Workers Static Assets metafiles into the Vite client output.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
dest="$root/standalone/dist/client"
if [[ ! -d "$dest" ]]; then
  echo "Missing $dest — run: pnpm build:client" >&2
  exit 1
fi
cp "$root/deploy/cloudflare/_redirects" "$dest/_redirects"
cp "$root/deploy/cloudflare/_headers" "$dest/_headers"
echo "Copied _redirects and _headers into $dest"
