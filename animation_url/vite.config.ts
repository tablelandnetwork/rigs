import { resolve } from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import type { UserConfig } from "vite";

const config: UserConfig = {
  plugins: [sveltekit()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "public"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  optimizeDeps: {
    exclude: [
      "@tableland/sqlparser"
    ]
  }
};

export default config;
