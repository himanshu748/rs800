#!/usr/bin/env bash
# Build the static Next.js export and publish it to AWS Amplify Hosting (manual deploy, no Git connection).
# Needs: aws CLI with credentials, node 22, apps/web/.env.production with NEXT_PUBLIC_API_URL.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
APP_NAME=rs800
BRANCH=main
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
ZIP="$ROOT/.build/web.zip"
export AWS_REGION="$REGION" AWS_PAGER=""

grep -q NEXT_PUBLIC_API_URL "$WEB/.env.production" 2>/dev/null || {
  echo "Set NEXT_PUBLIC_API_URL in apps/web/.env.production (the API_URL printed by deploy.sh)"; exit 1; }

echo "== Build"
(cd "$WEB" && npm run build >/dev/null)
mkdir -p "$ROOT/.build" && rm -f "$ZIP"
(cd "$WEB/out" && zip -q -r "$ZIP" .)

echo "== Amplify app"
APP_ID="$(aws amplify list-apps --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)"
if [ "$APP_ID" = "None" ]; then
  APP_ID="$(aws amplify create-app --name "$APP_NAME" --platform WEB --query app.appId --output text)"
fi
aws amplify get-branch --app-id "$APP_ID" --branch-name "$BRANCH" >/dev/null 2>&1 || \
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --stage PRODUCTION >/dev/null

echo "== Upload"
read -r JOB_ID UPLOAD_URL < <(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" \
  --query "[jobId, zipUploadUrl]" --output text)
curl -sS -f -X PUT -H "Content-Type: application/zip" --upload-file "$ZIP" "$UPLOAD_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" >/dev/null

for _ in $(seq 1 60); do
  STATUS="$(aws amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --query job.summary.status --output text)"
  [ "$STATUS" = "SUCCEED" ] && break
  [ "$STATUS" = "FAILED" ] && { echo "Amplify deployment failed"; exit 1; }
  sleep 5
done
echo "WEB_URL=https://$BRANCH.$APP_ID.amplifyapp.com"
