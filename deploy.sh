#!/bin/sh
# One-command deploy: push main to GitHub; Pages deploys via the deploy-pages workflow.
set -e
cd "$(dirname "$0")"
git push origin main
echo "Deployed. Live at https://lor4irdrop.github.io/taskmarket-visualizer/ once the Pages workflow finishes."
