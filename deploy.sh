#!/bin/sh
# One-command deploy: refresh the data + share image, then publish everything
# to GitHub Pages via the Contents API (no git needed; works with a public_repo token).
set -e
cd "$(dirname "$0")"
node scripts/fetch-data.mjs
python3 scripts/make_og.py
python3 scripts/gh.py upload lor4irdrop taskmarket-visualizer .
echo "Deployed. Live at https://lor4irdrop.github.io/taskmarket-visualizer/"
