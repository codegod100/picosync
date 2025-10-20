# SQLite Sync Cloudflare Worker

This Cloudflare Worker replaces the Node.js daemon server with a serverless solution using Durable Objects for persistent storage.

## Setup

1. Install dependencies:
```bash
cd worker
npm install
```

2. Configure Wrangler (if not already done):
```bash
npx wrangler login
```

3. Deploy the worker:
```bash
npm run deploy
```

## Development

Run locally with Wrangler:
```bash
npm run dev
```

## Configuration

Update your frontend environment variable to point to the deployed worker:
```
VITE_SQLITE_DAEMON_URL=wss://your-worker.your-subdomain.workers.dev/rpc
```

## Features

- **Durable Objects**: Persistent storage that survives worker restarts
- **Global Distribution**: Automatically deployed to Cloudflare's edge network
- **WebSocket Support**: Same RPC interface as the original daemon
- **Serverless**: No server management required

## Architecture

- **SqliteStorage**: Durable Object class that handles database persistence
- **DurableObjectSyncService**: Implements the same RPC interface as the original daemon
- **WebSocket RPC**: Uses capnweb for the same protocol as before

The database is stored as binary data in the Durable Object's storage, providing persistence and consistency.