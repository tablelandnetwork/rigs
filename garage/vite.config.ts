import { defineConfig } from "vite";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import svgr from "vite-plugin-svgr";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svgr(), react(), ViteEjsPlugin(), tsconfigPaths()],
  optimizeDeps: {
    exclude: ["@tableland/sqlparser"],
  },
});
