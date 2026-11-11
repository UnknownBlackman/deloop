import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Two pages from one server: the landing page (index.html, at /) and the dashboard (dashboard.html, at /dashboard).
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), dashboard: resolve(import.meta.dirname, "dashboard.html") },
    },
  },
  // Bind IPv4 explicitly: on Windows Vite otherwise listens on [::1] only and 127.0.0.1 is refused.
  server: { host: "127.0.0.1", port: 5173, strictPort: true, open: "/", proxy: { "/api": "http://127.0.0.1:8787" } },
});
