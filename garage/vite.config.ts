import { defineConfig } from "vite";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ViteEjsPlugin()],
  optimizeDeps: {
    exclude: ["@tableland/sqlparser"],
  },
});
