import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";

const log = console.log;
const warn = console.warn;
const reportError = console.error;

type WorkerPromiser = (
  type: string,
  args?: Record<string, unknown>,
) => Promise<{
  type: string;
  messageId: string;
  result?: Record<string, unknown>;
}>;

type SqliteValue = string | number | bigint | Uint8Array | null;

let promiser: WorkerPromiser | null = null;
let dbId: number | undefined;
let initialized = false;
let initializePromise: Promise<void> | null = null;

const dbFilename = "app.sqlite3";

const normalizeError = (err: unknown): Error => {
  if (err instanceof Error) return err;

  if (typeof err === "object" && err && "result" in err) {
    const message = (err as { result?: { message?: string } }).result?.message;
    if (typeof message === "string") return new Error(message);
  }

  if (typeof err === "string") return new Error(err);
  return new Error("Unknown SQLite error");
};

const ensurePromiser = async () => {
  if (promiser) return promiser;

  return new Promise<WorkerPromiser>((resolve, reject) => {
    try {
      const promiserFactory = sqlite3Worker1Promiser({
        onready: (instance: WorkerPromiser) => {
          promiser = instance;
          resolve(instance);
        },
        onerror: (err: unknown) => reject(normalizeError(err)),
      }) as WorkerPromiser;

      // Some implementations return the factory synchronously
      if (promiserFactory && !promiser) {
        promiser = promiserFactory;
      }
    } catch (err) {
      reject(normalizeError(err));
    }
  });
};

const canUseOpfs = () =>
  typeof navigator !== "undefined" &&
  !!(navigator.storage && "getDirectory" in navigator.storage) &&
  typeof SharedArrayBuffer !== "undefined";

const writeDatabaseToOpfs = async (bytes: Uint8Array) => {
  if (!canUseOpfs()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(dbFilename, { create: true });
    const writable = await fileHandle.createWritable();
    const chunk = bytes.slice();
    await writable.write(chunk);
    await writable.close();
    log("Seeded OPFS database from disk source");
  } catch (err) {
    warn("Failed writing database bytes to OPFS", err);
  }
};

const tryOpenDatabase = async (promiserInstance: WorkerPromiser) => {
  const candidates = [
    `file:${dbFilename}?vfs=opfs`,
    `file:${dbFilename}?vfs=kvvfs`,
    ":memory:",
  ];

  for (const filename of candidates) {
    try {
      const response = await promiserInstance("open", { filename });
      dbId = (response.result?.dbId as number | undefined) ?? undefined;
      const resolvedFilename = response.result?.filename as string | undefined;
      const vfs = response.result?.vfs as string | undefined;
      const persisted = response.result?.persistent === true;
      log("Opened SQLite database", {
        filename: resolvedFilename ?? filename,
        vfs,
        persisted,
      });
      return;
    } catch (err) {
      warn(
        "Failed to open database with filename",
        filename,
        normalizeError(err).message,
      );
    }
  }

  throw new Error("Unable to open SQLite database with any supported VFS");
};

const initializeDatabase = async (initialBytes?: Uint8Array | null) => {
  if (initialized) return;
  if (initializePromise) {
    await initializePromise;
    return;
  }

  initializePromise = (async () => {
    const instance = await ensurePromiser();

    log("Loading SQLite worker configuration");
    await instance("config-get", {});

    if (initialBytes && initialBytes.byteLength > 0 && canUseOpfs()) {
      await writeDatabaseToOpfs(initialBytes);
    } else if (initialBytes && initialBytes.byteLength > 0) {
      warn("Cannot seed database bytes because OPFS is unavailable");
    }

    await tryOpenDatabase(instance);
    initialized = true;
  })();

  try {
    await initializePromise;
  } catch (err) {
    initialized = false;
    throw normalizeError(err);
  } finally {
    initializePromise = null;
  }
};

const requireDbId = () => {
  if (typeof dbId === "undefined")
    throw new Error("SQLite database is not initialized");
  return dbId;
};

const exec = async (sql: string, options?: Record<string, unknown>) => {
  const instance = await ensurePromiser();
  const currentDbId = requireDbId();
  const response = await instance("exec", {
    dbId: currentDbId,
    sql,
    ...options,
  });
  return response.result ?? {};
};

export const initializeSQLite = async (initialBytes?: Uint8Array | null) => {
  await initializeDatabase(initialBytes ?? undefined);
};

export const createTable = async (tableName: string, columns: string) => {
  await initializeDatabase();
  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
  await exec(sql);
};

export const insertData = async (
  tableName: string,
  columns: string,
  values: string,
) => {
  await initializeDatabase();
  const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
  await exec(sql);
};

export const queryData = async (sql: string) => {
  await initializeDatabase();
  const response = await exec(sql, {
    rowMode: "array",
    resultRows: [] as SqliteValue[][],
  });
  const rows = Array.isArray(response.resultRows)
    ? (response.resultRows as SqliteValue[][])
    : [];
  return rows;
};

export const exportDatabase = async (): Promise<Uint8Array> => {
  const instance = await ensurePromiser();
  const currentDbId = requireDbId();
  const response = await instance("export", { dbId: currentDbId });
  const bytes = response.result?.byteArray;
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  throw new Error("Failed to export database bytes");
};

type Migration = {
  version: number;
  name: string;
  up: () => Promise<void>;
};

const runMigration = async (migration: Migration) => {
  const result = await queryData(
    `SELECT 1 FROM schema_migrations WHERE version = ${migration.version} LIMIT 1`,
  );
  if (result.length > 0) return;

  await migration.up();
  await insertData(
    "schema_migrations",
    "version, name",
    `${migration.version}, '${migration.name}'`,
  );
};

export const runMigrations = async () => {
  await createTable(
    "schema_migrations",
    "version INTEGER PRIMARY KEY, name TEXT, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  );

  const migrations: Migration[] = [
    {
      version: 1,
      name: "create_users_table",
      up: async () => {
        await createTable(
          "users",
          "id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT",
        );
      },
    },
    {
      version: 2,
      name: "add_user_created_at",
      up: async () => {
        await exec(
          "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        );
      },
    },
  ];

  for (const migration of migrations) {
    try {
      await runMigration(migration);
    } catch (err) {
      reportError("Migration failed", migration.version, migration.name, err);
      throw normalizeError(err);
    }
  }
};
