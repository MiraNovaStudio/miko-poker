#!/usr/bin/env bash
# Sync ./public to S3, and optionally invalidate CloudFront.
#
# This script ships with no bucket or distribution id. Set them in
# deploy.env (see deploy.env.example) or in the environment. If you
# run it from a terminal and a required value is missing, it asks.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/deploy.env"
  set +a
fi

INVALIDATE_CACHE=false

usage() {
  cat <<EOF
Usage: $0 [-i]

Sync ./public to the S3 bucket in S3_BUCKET.

  -i    Invalidate CloudFront (requires CLOUDFRONT_DISTRIBUTION_ID)
  -h    Show this help

Copy deploy.env.example to deploy.env and set your values,
or export them before running. deploy.env is gitignored.
EOF
}

while getopts "ih" opt; do
  case "$opt" in
    i) INVALIDATE_CACHE=true ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

# Ask on a terminal. Leave the variable empty when there is no terminal,
# so the caller gets the setup message instead of a hung prompt.
ask() {
  local var_name="$1"
  local prompt="$2"
  local current="${!var_name:-}"
  if [[ -n "$current" ]]; then
    return 0
  fi
  if [[ -t 0 ]]; then
    local value=""
    read -r -p "$prompt" value
    printf -v "$var_name" '%s' "$value"
  fi
}

ask S3_BUCKET "Your S3 bucket (s3://your-bucket-name): "
if [[ -z "${S3_BUCKET:-}" ]]; then
  echo "S3 bucket is not set."
  echo "Copy deploy.env.example to deploy.env and set S3_BUCKET,"
  echo "or export S3_BUCKET=s3://your-bucket-name"
  exit 1
fi

if [[ "$S3_BUCKET" != s3://* ]]; then
  S3_BUCKET="s3://${S3_BUCKET}"
fi

if [[ ! -d "$ROOT/public" ]]; then
  echo "public/ is missing. Run npm run build first."
  exit 1
fi

echo "Deploying ./public to ${S3_BUCKET}..."
aws s3 sync ./public/ "${S3_BUCKET}" --delete

if [[ "$INVALIDATE_CACHE" == true ]]; then
  ask CLOUDFRONT_DISTRIBUTION_ID "CloudFront distribution ID: "
  if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
    echo "CloudFront distribution ID is not set."
    echo "Set CLOUDFRONT_DISTRIBUTION_ID in deploy.env or the environment,"
    echo "or rerun without -i."
    exit 1
  fi
  echo "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*"
fi

echo "Deployment complete."
