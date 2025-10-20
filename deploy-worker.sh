#!/bin/bash

echo "🚀 Deploying SQLite Sync Cloudflare Worker..."

cd worker

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing worker dependencies..."
    npm install
fi

# Build and deploy
echo "🔨 Building worker..."
npm run build

echo "☁️ Deploying to Cloudflare..."
npm run deploy

echo "✅ Worker deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update your VITE_SQLITE_DAEMON_URL environment variable"
echo "2. Replace 'ws://localhost:8787/rpc' with 'wss://your-worker.your-subdomain.workers.dev/rpc'"
echo "3. Test the connection with your Svelte app"