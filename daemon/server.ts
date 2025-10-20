/// <reference types="node" />

import { createServer } from 'node:http'
import { rename, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DiskSyncApiTarget } from '../shared/rpc.ts'
import { newWebSocketRpcSession } from 'capnweb'
import { WebSocketServer } from 'ws'

const databaseFileUrl = new URL('../data/app.sqlite3', import.meta.url)
const databaseFilePath = fileURLToPath(databaseFileUrl)
const databaseDirPath = dirname(databaseFilePath)

class DiskSyncService extends DiskSyncApiTarget {
  async fetchDatabase(): Promise<Uint8Array | null> {
    try {
      const bytes = await readFile(databaseFilePath)
      return new Uint8Array(bytes)
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'ENOENT') return null
      console.error('Failed to read database from disk', err)
      throw err
    }
  }

  async saveDatabase(bytes: Uint8Array): Promise<void> {
    try {
      await mkdir(databaseDirPath, { recursive: true })
      const tempPath = `${databaseFilePath}.tmp`
      await writeFile(tempPath, bytes)
      await rename(tempPath, databaseFilePath)
    } catch (err) {
      console.error('Failed to persist database to disk', err)
      throw err
    }
  }
}

const port = Number.parseInt(process.env.SQLITE_DAEMON_PORT ?? '8787', 10)

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }

  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('Not Found')
})

const service = new DiskSyncService()

const wsServer = new WebSocketServer({ server: httpServer, path: '/rpc' })
wsServer.on('connection', ws => {
  newWebSocketRpcSession(ws as any, service)
})

httpServer.listen(port, () => {
  console.log(`SQLite daemon listening on port ${port}`)
})
