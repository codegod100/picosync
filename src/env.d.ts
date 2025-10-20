/// <reference types='@rsbuild/core/types' />
/// <reference types='svelte' />

declare module "*.svelte" {
  import type { ComponentType } from "svelte";
  const component: ComponentType;
  export default component;
}

declare module "@sqlite.org/sqlite-wasm" {
  export const sqlite3Worker1Promiser: (config?: unknown) => unknown;
}
