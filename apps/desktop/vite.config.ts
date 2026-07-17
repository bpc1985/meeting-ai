import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@meeting-ai/core": path.resolve(__dirname, "../../packages/core/src"),
      "@meeting-ai/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@meeting-ai/speech": path.resolve(__dirname, "../../packages/speech/src"),
      "@meeting-ai/llm": path.resolve(__dirname, "../../packages/llm/src"),
      "@meeting-ai/export": path.resolve(__dirname, "../../packages/export/src"),
    },
  },
  clearScreen: false,
  build: {
    rolldownOptions: {
      external: [
        "@tauri-apps/api",
        "@tauri-apps/api/core",
        "@tauri-apps/api/path",
        "@tauri-apps/plugin-fs",
        "@tauri-apps/plugin-shell",
        "@tauri-apps/plugin-dialog",
      ],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 5174 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
}));
