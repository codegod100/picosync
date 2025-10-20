import type { DiskSyncApi } from "../../shared/rpc.ts";

type SyncStub = {
    fetchDatabase(): Promise<Uint8Array | null>;
    saveDatabase(bytes: Uint8Array): Promise<void>;
};

let requestId = 0;

const getDaemonUrl = () => {
    const env = (import.meta as { env?: Record<string, unknown> }).env;
    const candidate = env?.VITE_SQLITE_DAEMON_URL;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
    return "ws://localhost:8787/rpc"; // Cloudflare Worker dev server
};

const call = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
        const id = ++requestId;
        const ws = new WebSocket(getDaemonUrl());

        ws.onopen = () => {
            ws.send(JSON.stringify({ method, id, params }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.id === id) {
                    if (message.error) {
                        reject(new Error(message.error));
                    } else {
                        resolve(message.result);
                    }
                    ws.close();
                }
            } catch (err) {
                reject(err);
                ws.close();
            }
        };

        ws.onerror = (error) => {
            reject(new Error("WebSocket error"));
            ws.close();
        };

        ws.onclose = () => {
            // Connection closed, but promise already resolved/rejected
        };
    });
};

export const getDaemonStub = async (): Promise<SyncStub> => {
    return {
        fetchDatabase: async (): Promise<Uint8Array | null> => {
            const result = await call("fetchDatabase");
            if (!result) return null;
            const binaryString = atob(result);
            return new Uint8Array(binaryString.length).map((_, i) =>
                binaryString.charCodeAt(i),
            );
        },
        saveDatabase: async (bytes: Uint8Array): Promise<void> => {
            const binaryString = String.fromCharCode(...bytes);
            const base64 = btoa(binaryString);
            await call("saveDatabase", { bytes: base64 });
        },
    };
};

export const syncDatabaseFromDisk = async () => {
    try {
        const stub = await getDaemonStub();
        const bytes = await stub.fetchDatabase();
        await initializeSQLite(bytes ?? null);
    } catch (err) {
        console.warn("Sync failed, initializing empty database:", err);
        await initializeSQLite(null);
    }
};

export const persistDatabaseToDisk = async () => {
    try {
        const stub = await getDaemonStub();
        const bytes = await exportDatabase();
        await stub.saveDatabase(bytes);
    } catch (err) {
        console.warn(
            "Failed to persist to daemon, data saved locally only:",
            err,
        );
        throw err;
    }
};

// Note: Need to import initializeSQLite and exportDatabase from sqlite.ts
// Assuming they are available
import { exportDatabase, initializeSQLite } from "./sqlite.ts";
