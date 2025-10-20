import { newWebSocketRpcSession, type RpcStub } from 'capnweb'

import type { DiskSyncApi } from '../../shared/rpc.ts'
import { exportDatabase, initializeSQLite } from './sqlite.ts'

type SyncStub = RpcStub<DiskSyncApi>

let daemonStub: SyncStub | null = null
let connectPromise: Promise<SyncStub> | null = null
let syncPromise: Promise<void> | null = null
let hasSynced = false

const getDaemonUrl = () => {
  const env = (import.meta as { env?: Record<string, unknown> }).env
  const candidate = env?.VITE_SQLITE_DAEMON_URL
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return 'ws://localhost:8787/rpc'
}

const getDaemonStub = async (): Promise<SyncStub> => {
  if (daemonStub) return daemonStub
  if (connectPromise) return connectPromise

  connectPromise = Promise.resolve(
    newWebSocketRpcSession<DiskSyncApi>(getDaemonUrl()),
  )

  try {
    daemonStub = await connectPromise
    return daemonStub
  } finally {
    connectPromise = null
  }
}

export const syncDatabaseFromDisk = async () => {
  if (hasSynced) return
  if (syncPromise) {
    await syncPromise
    return
  }

  syncPromise = (async () => {
    const stub = await getDaemonStub()
    const bytes = await stub.fetchDatabase()
    await initializeSQLite(bytes ?? null)
    hasSynced = true
  })()

  try {
    await syncPromise
  } finally {
    syncPromise = null
  }
}

export const persistDatabaseToDisk = async () => {
  await syncDatabaseFromDisk()
  const stub = await getDaemonStub()
  const bytes = await exportDatabase()
  await stub.saveDatabase(bytes)
}
