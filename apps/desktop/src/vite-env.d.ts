/// <reference types="vite/client" />
declare module "*.css" {}

declare module "@tauri-apps/api/core" {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}
declare module "@tauri-apps/api/path" {
  export function appCacheDir(): Promise<string>;
  export function join(...parts: string[]): Promise<string>;
}
declare module "@tauri-apps/plugin-fs" {
  export function readFile(path: string): Promise<Uint8Array>;
  export function writeFile(path: string, data: Uint8Array): Promise<void>;
  export function stat(path: string): Promise<{ size: number }>;
}
declare module "@tauri-apps/plugin-dialog" {
  export function save(options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>;
}
declare module "@tauri-apps/plugin-shell" {
  export function open(path: string): Promise<void>;
}
