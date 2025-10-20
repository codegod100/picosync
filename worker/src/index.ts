import { SqliteStorage } from "./sqlite-storage";
import type { Env } from "./types";

export { SqliteStorage };

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/rpc") {
            // Route to the appropriate durable object
            const id = env.SQLITE_STORAGE.idFromName("default");
            const stub = env.SQLITE_STORAGE.get(id);
            return stub.fetch(request);
        }

        // Serve static assets
        return env.ASSETS.fetch(request);
    },
};
