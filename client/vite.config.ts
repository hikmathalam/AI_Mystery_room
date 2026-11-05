import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Keep dependency scanning inside this workspace. The automatic esbuild scan
  // can walk above the project root on Windows and be blocked by filesystem
  // sandboxing, which prevents Vite from serving the app at all.
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react-router-dom",
      "framer-motion",
      "axios",
      "zod",
      "zustand",
      "react-hook-form",
      "@xyflow/react",
      "lucide-react"
    ]
  },
  server: {
    port: 5173,
    fs: { allow: [workspaceRoot] },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
});
