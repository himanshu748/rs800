#!/usr/bin/env bash
# Idempotent deploy of the ₹800 API: DynamoDB table, IAM role, Lambda (zip via S3), API Gateway HTTP API.
# Needs: aws CLI with credentials, python3.12. Optional env: AWS_REGION, ALLOWED_ORIGINS, BEDROCK_MODEL_ID.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
NAME=rs800
TABLE=rs800-plans
ROLE=rs800-api-role
FN=rs800-api
ORIGINS="${ALLOWED_ORIGINS:-https://main.d231iqub8spohk.amplifyapp.com,http://localhost:3000}"
MODEL="${BEDROCK_MODEL_ID:-us.anthropic.claude-haiku-4-5-20251001-v1:0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/.build"
ACCT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="rs800-artifacts-$ACCT-$REGION"
export AWS_REGION="$REGION" AWS_PAGER=""

echo "== DynamoDB"
if ! aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  aws dynamodb create-table --table-name "$TABLE" --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE"
  aws dynamodb update-time-to-live --table-name "$TABLE" \
    --time-to-live-specification Enabled=true,AttributeName=expiresAt >/dev/null
fi
TABLE_ARN="$(aws dynamodb describe-table --table-name "$TABLE" --query Table.TableArn --output text)"

echo "== IAM role"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  NEW_ROLE=1
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name rs800-data --policy-document "$(cat <<EOF
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem"],"Resource":"$TABLE_ARN"},
 {"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:Converse"],
  "Resource":["arn:aws:bedrock:*::foundation-model/*","arn:aws:bedrock:*:$ACCT:inference-profile/*"]}]}
EOF
)"
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"
[ -n "${NEW_ROLE:-}" ] && sleep 10

echo "== Package"
rm -rf "$BUILD" && mkdir -p "$BUILD/pkg"
python3.12 -m pip install -q -r "$ROOT/services/api/requirements-lambda.txt" -t "$BUILD/pkg" \
  --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 --implementation cp --python-version 3.12 --only-binary=:all:
cp -R "$ROOT/services/api/app" "$BUILD/pkg/app"
find "$BUILD/pkg" -name "__pycache__" -type d -prune -exec rm -rf {} +
find "$BUILD/pkg" -type d -name tests -prune -exec rm -rf {} +
echo "unzipped: $(du -sh "$BUILD/pkg" | cut -f1)"
(cd "$BUILD/pkg" && zip -q -r -9 "$BUILD/api.zip" .)
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || aws s3 mb "s3://$BUCKET" >/dev/null
aws s3 cp --only-show-errors "$BUILD/api.zip" "s3://$BUCKET/api.zip"

echo "== Lambda"
ENV="{\"Variables\":{\"PLANS_TABLE\":\"$TABLE\",\"ALLOWED_ORIGINS\":\"$ORIGINS\",\"BEDROCK_MODEL_ID\":\"$MODEL\"}}"
if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --s3-bucket "$BUCKET" --s3-key api.zip >/dev/null
  aws lambda wait function-updated --function-name "$FN"
  aws lambda update-function-configuration --function-name "$FN" --environment "$ENV" >/dev/null
else
  aws lambda create-function --function-name "$FN" --runtime python3.12 --architectures x86_64 \
    --handler app.main.handler --role "$ROLE_ARN" --code "S3Bucket=$BUCKET,S3Key=api.zip" \
    --memory-size 1024 --timeout 20 --environment "$ENV" >/dev/null
fi
aws lambda wait function-updated --function-name "$FN"
aws logs put-retention-policy --log-group-name "/aws/lambda/$FN" --retention-in-days 14 2>/dev/null || true
FN_ARN="$(aws lambda get-function --function-name "$FN" --query Configuration.FunctionArn --output text)"

echo "== API Gateway"
API_ID="$(aws apigatewayv2 get-apis --query "Items[?Name=='$NAME'].ApiId | [0]" --output text)"
if [ "$API_ID" = "None" ]; then
  API_ID="$(aws apigatewayv2 create-api --name "$NAME" --protocol-type HTTP --target "$FN_ARN" --query ApiId --output text)"
  aws lambda add-permission --function-name "$FN" --statement-id apigw-invoke --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:$ACCT:$API_ID/*" >/dev/null
fi
aws apigatewayv2 update-stage --api-id "$API_ID" --stage-name '$default' \
  --default-route-settings ThrottlingBurstLimit=20,ThrottlingRateLimit=10 >/dev/null
URL="$(aws apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text)"
echo "API_URL=$URL"
curl -s "$URL/api/v1/health"; echo
