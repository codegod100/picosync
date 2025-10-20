import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";

const log = console.log;
const error = console.error;

let promiser: any;
let dbId: string;

const initializeSQLite = async () => {
  try {
    log("Loading and initializing SQLite3 module...");

    promiser = await new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => resolve(_promiser),
      });
    });

    log("Done initializing. Running demo...");

    const configResponse = await promiser("config-get", {});
    log("Running SQLite3 version", configResponse.result.version.libVersion);

    const openResponse = await promiser("open", {
      filename: "file:mydb.sqlite3?vfs=opfs",
    });
    dbId = openResponse.dbId;
    log(
      "OPFS is available, created persisted database at",
      openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, "$1"),
    );
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    error(err.name, err.message);
  }
};

export const getPromiser = () => promiser;
export const getDbId = () => dbId;

export const createTable = async (tableName: string, columns: string) => {
  if (!promiser || !dbId) await initializeSQLite();
  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
  console.log("Executing SQL:", sql);
  const response = await promiser("exec", { dbId, sql });
  return response;
};

export const insertData = async (
  tableName: string,
  columns: string,
  values: string,
) => {
  if (!promiser || !dbId) await initializeSQLite();
  const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
  console.log("Executing SQL:", sql);
  const response = await promiser("exec", { dbId, sql });
  return response;
};

export const queryData = async (sql: string) => {
  if (!promiser || !dbId) await initializeSQLite();
  console.log("Executing SQL:", sql);
  const response = await promiser("exec", {
    dbId,
    sql,
    returnValue: "resultRows",
  });
  return response.result.resultRows;
};

initializeSQLite();
