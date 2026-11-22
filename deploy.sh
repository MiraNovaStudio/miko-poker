#!/bin/bash
# ============================================
# Miranova Studio - Website Deploy Script
# ============================================
#
#echo "⚠️  Deploy temporarily disabled — exiting safely."
#exit 0


# Default values
INVALIDATE_CACHE=false
DISTRIBUTION_ID="E12LD2E0WCQDYC"
SIZE_ONLY="--size-only"

usage() {
      echo "Usage: $0 [-i]"
      echo "  -i    Invalidate CloudFront cache after deployment"
}


# Parse command line arguments
while getopts "ihf" opt; do
  case $opt in
    i)
      INVALIDATE_CACHE=true
      ;;
    h)
      usage
      exit 0
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      usage
      ;;
  esac
done

echo "🚀 Deploying Miranova Studios site to S3..."

# Run the deploy command and capture exit status
aws s3 sync ./public/ s3://mikopoker.miranova.studio --delete 
status=$?

if [ $status -ne 0 ]; then
  echo "❌ Deployment failed!"
  echo "Error code: $status"
  echo "Hint: Check your AWS credentials or bucket permissions."
  exit $status
else
  echo "✅ Deployment complete!"
  
  # Invalidate CloudFront cache if requested
  if [ "$INVALIDATE_CACHE" = true ]; then
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*"
    
    if [ $? -eq 0 ]; then
      echo "✅ CloudFront cache invalidation initiated!"
    else
      echo "⚠️  CloudFront cache invalidation failed, but deployment was successful."
    fi
  fi
fi

#python testit.py
