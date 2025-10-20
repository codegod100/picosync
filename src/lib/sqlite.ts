import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const log = console.log;
const warn = console.warn;
const error = console.error;

type Sqlite3Module = Awaited<ReturnType<typeof sqlite3InitModule>>;
type SqliteDbHandle = InstanceType<Sqlite3Module["oo1"]["DB"]>;
type SqliteOpfsApi = {
  importDb: (filename: string, bytes: Uint8Array) => Promise<number>;
};
type SqliteValue = string | number | bigint | Uint8Array | null;

const dbFilename = "app.sqlite3";

let sqlite3Module: Sqlite3Module | null = null;
let dbHandle: SqliteDbHandle | null = null;
let initializePromise: Promise<void> | null = null;

const ensureDatabase = async (initialBytes?: Uint8Array | null) => {
  if (dbHandle) return;
  if (initializePromise) {
    await initializePromise;
    return;
  }

  initializePromise = (async () => {
    try {
      log("Loading SQLite module...");
      sqlite3Module = await sqlite3InitModule({
        print: log,
        printErr: error,
      });

      const opfsApi = (sqlite3Module as unknown as { opfs?: SqliteOpfsApi })
        .opfs;

      if (opfsApi && sqlite3Module.oo1?.OpfsDb) {
        if (initialBytes && initialBytes.byteLength > 0) {
          try {
            await opfsApi.importDb(dbFilename, initialBytes);
          } catch (importErr) {
            warn("Failed to import initial database into OPFS", importErr);
          }
        }
        dbHandle = new sqlite3Module.oo1.OpfsDb(dbFilename);
        log("Opened OPFS-backed SQLite database at", dbFilename);
      } else {
        warn("OPFS unavailable, using transient SQLite database");
        dbHandle = new sqlite3Module.oo1.DB(dbFilename, "ct");
        if (initialBytes && initialBytes.byteLength > 0) {
          warn(
            "Ignoring initial database bytes because persistent storage is unavailable",
          );
        }
      }
    } catch (err) {
      error("Failed to initialize SQLite", err);
      throw err;
    }
  })();

  try {
    await initializePromise;
  } finally {
    initializePromise = null;
  }
};

const getDbHandle = async () => {
  await ensureDatabase();
  if (!dbHandle) throw new Error("SQLite database handle is not available");
  return dbHandle;
};

const requireModule = () => {
  if (!sqlite3Module) throw new Error("SQLite module not yet loaded");
  return sqlite3Module;
};

export const initializeSQLite = async (initialBytes?: Uint8Array | null) => {
  await ensureDatabase(initialBytes);
};

export const createTable = async (tableName: string, columns: string) => {
  const db = await getDbHandle();
  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
  log("Executing SQL:", sql);
  db.exec(sql);
};

export const insertData = async (
  tableName: string,
  columns: string,
  values: string,
) => {
  const db = await getDbHandle();
  const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
  log("Executing SQL:", sql);
  db.exec(sql);
};

export const queryData = async (sql: string) => {
  const db = await getDbHandle();
  const resultRows: SqliteValue[][] = [];
  log("Executing SQL:", sql);
  db.exec({ sql, rowMode: "array", resultRows });
  return resultRows;
};

export const exportDatabase = async (): Promise<Uint8Array> => {
  const db = await getDbHandle();
  const module = requireModule();
  const pointer = (db as unknown as { pointer: number }).pointer;
  const bytes = module.capi.sqlite3_js_db_export(pointer);
  return new Uint8Array(bytes);
};

const runMigration = async (
  version: number,
  name: string,
  up: () => Promise<void>,
) => {
  const rows = await queryData(
    "SELECT MAX(version) FROM schema_migrations WHERE version = " + version,
  );
  const alreadyApplied = rows[0]?.[0] === version;
  if (alreadyApplied) return;

  log(`Running migration ${version}: ${name}`);
  await up();
  await insertData(
    "schema_migrations",
    "version, name",
    `${version}, '${name}'`,
  );
  log(`Migration ${version} applied`);
};

export const runMigrations = async () => {
  await createTable(
    "schema_migrations",
    "version INTEGER PRIMARY KEY, name TEXT, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  );

  const migrations: {
    version: number;
    name: string;
    up: () => Promise<void>;
  }[] = [
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
        await queryData(
          "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        );
      },
    },
  ];

  for (const migration of migrations) {
    try {
      await runMigration(migration.version, migration.name, migration.up);
    } catch (err) {
      error(`Migration ${migration.version} failed`, err);
      throw err;
    }
  }
};
