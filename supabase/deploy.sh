#!/bin/bash

# HackXplore Backend Deployment Script
# This script deploys all Supabase Edge Functions and runs database migrations

set -e

echo "🚀 Starting HackXplore Backend Deployment..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if user is logged in to Supabase
echo "🔐 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Please login to Supabase first:"
    echo "   supabase login"
    exit 1
fi

# Check environment variables
echo "🔧 Checking environment variables..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    source .env
else
    echo "⚠️  .env file not found. Please create one from .env.example"
fi

required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables: ${missing_vars[*]}"
    exit 1
fi

echo "✅ Environment variables validated"

# Database migrations
echo "📊 Running database migrations..."
echo "   Running migration 001: Initial schema..."
supabase db push supabase/migrations/001_initial_schema.sql

echo "   Running migration 002: RLS policies..."
supabase db push supabase/migrations/002_rls_policies.sql

echo "   Running migration 003: Platform data..."
supabase db push supabase/migrations/003_platform_data.sql

echo "✅ Database migrations completed"

# Deploy Edge Functions
echo "⚡ Deploying Supabase Edge Functions..."

functions=(
    "get-opportunities"
    "get-platform-stats"
    "scrape-platform"
    "scrape-all-platforms"
)

for func in "${functions[@]}"; do
    echo "   Deploying $func..."
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "   ✅ $func deployed successfully"
    else
        echo "   ❌ Failed to deploy $func"
        exit 1
    fi
done

echo "✅ All Edge Functions deployed successfully"

# Set environment variables for Edge Functions
echo "🔧 Setting Edge Function environment variables..."
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [ -n "$SCRAPING_USER_AGENT" ]; then
    supabase secrets set SCRAPING_USER_AGENT="$SCRAPING_USER_AGENT"
fi

if [ -n "$SCRAPING_CONCURRENCY" ]; then
    supabase secrets set SCRAPING_CONCURRENCY="$SCRAPING_CONCURRENCY"
fi

if [ -n "$SCRAPING_TIMEOUT" ]; then
    supabase secrets set SCRAPING_TIMEOUT="$SCRAPING_TIMEOUT"
fi

if [ -n "$SCRAPING_RATE_LIMIT" ]; then
    supabase secrets set SCRAPING_RATE_LIMIT="$SCRAPING_RATE_LIMIT"
fi

echo "✅ Environment variables configured"

# Test deployment
echo "🧪 Testing deployment..."

# Test get-opportunities function
echo "   Testing get-opportunities..."
response=$(curl -s -X GET "$SUPABASE_URL/functions/v1/get-opportunities?limit=1" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

if echo "$response" | grep -q "opportunities"; then
    echo "   ✅ get-opportunities is working"
else
    echo "   ❌ get-opportunities test failed"
    echo "   Response: $response"
fi

# Test get-platform-stats function
echo "   Testing get-platform-stats..."
response=$(curl -s -X GET "$SUPABASE_URL/functions/v1/get-platform-stats" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

if echo "$response" | grep -q "platforms"; then
    echo "   ✅ get-platform-stats is working"
else
    echo "   ❌ get-platform-stats test failed"
    echo "   Response: $response"
fi

echo "🎉 HackXplore Backend Deployment completed successfully!"
echo ""
echo "📚 Next steps:"
echo "   1. Update your frontend to use the new API endpoints"
echo "   2. Set up monitoring and alerting"
echo "   3. Configure scheduled scraping (cron job or Supabase scheduled functions)"
echo "   4. Test the scraping functionality for each platform"
echo ""
echo "📖 For detailed documentation, see BACKEND_README.md"