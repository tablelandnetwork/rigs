import { defineConfig } from "vite";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import svgr from "vite-plugin-svgr";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svgr(), react(), ViteEjsPlugin()],
  optimizeDeps: {
    exclude: ["@tableland/sqlparser"],
  },
});
