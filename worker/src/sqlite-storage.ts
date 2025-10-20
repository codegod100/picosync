import { DiskSyncApiTarget } from "../../shared/rpc";

export class SqliteStorage {
    private storage: DurableObjectStorage;

    constructor(state: DurableObjectState, _env: any) {
        this.storage = state.storage;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return new Response("ok", { status: 200 });
        }

        if (url.pathname === "/rpc") {
            return this.handleWebSocket(request);
        }

        return new Response("Not Found", { status: 404 });
    }

    private async handleWebSocket(request: Request): Promise<Response> {
        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader !== "websocket") {
            return new Response("Expected websocket", { status: 400 });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        server.accept();

        const service = new DurableObjectSyncService(this.storage);

        // Handle WebSocket messages manually
        server.addEventListener("message", async (event) => {
            try {
                const message = JSON.parse(event.data as string);
                let response: any;

                if (message.method === "fetchDatabase") {
                    const result = await service.fetchDatabase();
                    response = { id: message.id, result };
                } else if (message.method === "saveDatabase") {
                    await service.saveDatabase(message.params.bytes);
                    response = { id: message.id, result: null };
                } else {
                    response = { id: message.id, error: "Unknown method" };
                }

                server.send(JSON.stringify(response));
            } catch (error) {
                console.error("WebSocket message error:", error);
                server.send(
                    JSON.stringify({
                        id: (event.data as any)?.id,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown error",
                    }),
                );
            }
        });

        server.addEventListener("close", () => {
            console.log("WebSocket connection closed");
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
}

class DurableObjectSyncService extends DiskSyncApiTarget {
    constructor(private storage: DurableObjectStorage) {
        super();
    }

    async fetchDatabase(): Promise<string | null> {
        try {
            const bytes = await this.storage.get<ArrayBuffer>("database");
            if (!bytes) return null;
            const uint8 = new Uint8Array(bytes);
            const binaryString = String.fromCharCode(...uint8);
            return btoa(binaryString);
        } catch (err) {
            console.error("Failed to read database from durable object", err);
            throw err;
        }
    }

    async saveDatabase(base64: string): Promise<void> {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length).map((_, i) =>
                binaryString.charCodeAt(i),
            );
            await this.storage.put("database", bytes.buffer);
        } catch (err) {
            console.error("Failed to persist database to durable object", err);
            throw err;
        }
    }
}
