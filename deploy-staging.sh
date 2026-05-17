#!/bin/bash
# Deploy to staging on EC2.
# Run from your Mac: ./deploy-staging.sh

set -e

EC2_USER="ubuntu"
EC2_HOST="65.0.41.55"
EC2_KEY="$HOME/Downloads/cadb-key.pem"
EC2_PATH="/home/ubuntu/CADB-staging"
STAGING_API_URL="http://65.0.41.55:4001"
STAGING_DB_URL="postgresql://cadbuser:Cadb%402026%23Secure@localhost:5432/cadb_staging"

echo "▸ Building API..."
pnpm --filter @cadb/api exec tsc

echo "▸ Building Web (staging)..."
NEXT_PUBLIC_API_URL=$STAGING_API_URL \
NEXT_PUBLIC_APP_URL="http://65.0.41.55:3002" \
  pnpm --filter @cadb/web exec next build

echo "▸ Rsyncing API dist..."
rsync -az --delete \
  -e "ssh -i $EC2_KEY" \
  apps/api/dist/ \
  $EC2_USER@$EC2_HOST:$EC2_PATH/apps/api/dist/

echo "▸ Rsyncing Prisma schema and migrations..."
rsync -az \
  -e "ssh -i $EC2_KEY" \
  packages/db/prisma/ \
  $EC2_USER@$EC2_HOST:$EC2_PATH/packages/db/prisma/

echo "▸ Rsyncing Web .next..."
rsync -az --delete \
  -e "ssh -i $EC2_KEY" \
  apps/web/.next/ \
  $EC2_USER@$EC2_HOST:$EC2_PATH/apps/web/.next/

echo "▸ Rsyncing PM2 ecosystem..."
rsync -az \
  -e "ssh -i $EC2_KEY" \
  ecosystem.staging.config.cjs \
  $EC2_USER@$EC2_HOST:$EC2_PATH/

echo "▸ Running migrations and restarting staging..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST << EOF
  set -e
  cd $EC2_PATH
  DATABASE_URL='$STAGING_DB_URL' \
    packages/db/node_modules/.bin/prisma migrate deploy \
    --schema packages/db/prisma/schema.prisma
  DATABASE_URL='$STAGING_DB_URL' \
    packages/db/node_modules/.bin/prisma generate \
    --schema packages/db/prisma/schema.prisma
  pm2 restart cadb-staging-api cadb-staging-web 2>/dev/null \
    || pm2 start ecosystem.staging.config.cjs
  pm2 save
EOF

echo ""
echo "✓ Staging deployed → http://65.0.41.55:3002"
