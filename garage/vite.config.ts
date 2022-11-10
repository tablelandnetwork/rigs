import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "ethereum/deployments": resolve(
        __dirname,
        "..",
        "ethereum",
        "deployments.ts"
      ),
    },
  },
});
