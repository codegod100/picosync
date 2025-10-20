import { RpcTarget } from 'capnweb'

export interface DiskSyncApi {
  fetchDatabase(): Promise<Uint8Array | null>
  saveDatabase(bytes: Uint8Array): Promise<void>
}

export abstract class DiskSyncApiTarget
  extends RpcTarget
  implements DiskSyncApi
{
  abstract fetchDatabase(): Promise<Uint8Array | null>
  abstract saveDatabase(bytes: Uint8Array): Promise<void>
}
