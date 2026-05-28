#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  deploy-staging.sh — build locally and push to staging server
#  Usage:  ./scripts/deploy-staging.sh [--api-only | --web-only]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
STAGING_HOST="ubuntu@65.0.41.55"
SSH_KEY="$HOME/Downloads/cadb-key.pem"
REMOTE_DIR="/home/ubuntu/CADB-staging"
STAGING_API_URL="http://65.0.41.55:4001"

WEB_ENV="apps/web/.env.local"
WEB_ENV_BAK="apps/web/.env.local.staging-deploy-bak"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
RSYNC="rsync -az --delete -e 'ssh -i $SSH_KEY -o StrictHostKeyChecking=no'"

# ── Flags ─────────────────────────────────────────────────────
DEPLOY_API=true
DEPLOY_WEB=true

for arg in "$@"; do
  case $arg in
    --api-only) DEPLOY_WEB=false ;;
    --web-only) DEPLOY_API=false ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────
green()  { echo -e "\033[0;32m✔  $*\033[0m"; }
blue()   { echo -e "\033[0;34m→  $*\033[0m"; }
red()    { echo -e "\033[0;31m✘  $*\033[0m"; }
header() { echo -e "\n\033[1;36m══  $*  ══\033[0m\n"; }

cleanup() {
  # Always restore local .env.local, even on error
  if [[ -f "$WEB_ENV_BAK" ]]; then
    mv "$WEB_ENV_BAK" "$WEB_ENV"
    green "Restored local .env.local"
  fi
}
trap cleanup EXIT

# ── Start ─────────────────────────────────────────────────────
cd "$(dirname "$0")/.."
header "Deploy to Staging  ·  $(date '+%Y-%m-%d %H:%M')"

# ── 1. API build ───────────────────────────────────────────────
if $DEPLOY_API; then
  header "1 / Building API (tsc)"
  blue "Compiling apps/api → dist/"
  npx tsc -p apps/api/tsconfig.json
  green "API compiled"

  header "2 / Syncing API dist/"
  rsync -az --delete -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    apps/api/dist/ $STAGING_HOST:$REMOTE_DIR/apps/api/dist/
  green "API dist synced"
else
  blue "Skipping API build (--web-only)"
fi

# ── 2. Web build ───────────────────────────────────────────────
if $DEPLOY_WEB; then
  header "$( $DEPLOY_API && echo '3' || echo '1' ) / Building Web (Next.js)"

  # Swap env to staging API URL
  blue "Setting NEXT_PUBLIC_API_URL=$STAGING_API_URL for build"
  cp "$WEB_ENV" "$WEB_ENV_BAK"
  echo "NEXT_PUBLIC_API_URL=$STAGING_API_URL" > "$WEB_ENV"

  blue "Running turbo build --force"
  npx turbo build --filter=@cadb/web --force
  green "Web built"

  # Restore immediately after build (trap will also do it, but be explicit)
  mv "$WEB_ENV_BAK" "$WEB_ENV"
  green "Restored local .env.local"

  header "$( $DEPLOY_API && echo '4' || echo '2' ) / Syncing Web .next/"
  rsync -az --delete -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    apps/web/.next/ $STAGING_HOST:$REMOTE_DIR/apps/web/.next/
  green "Web .next synced"
else
  blue "Skipping Web build (--api-only)"
fi

# ── 3. Restart PM2 ────────────────────────────────────────────
header "Restarting PM2 on staging"

if $DEPLOY_API && $DEPLOY_WEB; then
  $SSH $STAGING_HOST "pm2 restart cadb-staging-api cadb-staging-web"
elif $DEPLOY_API; then
  $SSH $STAGING_HOST "pm2 restart cadb-staging-api"
else
  $SSH $STAGING_HOST "pm2 restart cadb-staging-web"
fi

sleep 3
$SSH $STAGING_HOST "pm2 list" 2>&1 | grep -E "cadb-staging|name"
green "PM2 restarted"

# ── 4. Smoke test ─────────────────────────────────────────────
header "Smoke test"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://65.0.41.55:4001/health)
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://65.0.41.55:3002/)

if [[ "$API_STATUS" == "200" ]]; then
  green "API  →  http://65.0.41.55:4001  (HTTP $API_STATUS)"
else
  red   "API  →  http://65.0.41.55:4001  (HTTP $API_STATUS)"
fi

if [[ "$WEB_STATUS" == "200" ]]; then
  green "Web  →  http://65.0.41.55:3002  (HTTP $WEB_STATUS)"
else
  red   "Web  →  http://65.0.41.55:3002  (HTTP $WEB_STATUS)"
fi

header "Deploy complete 🚀"
