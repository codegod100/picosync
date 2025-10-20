export interface Env {
    SQLITE_STORAGE: DurableObjectNamespace<SqliteStorage>;
    ASSETS: Fetcher;
}

export interface SqliteStorage {
    fetch(request: Request): Promise<Response>;
}
