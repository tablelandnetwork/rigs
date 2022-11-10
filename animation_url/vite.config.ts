import { resolve } from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import type { UserConfig } from "vite";

const config: UserConfig = {
  plugins: [sveltekit()],
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
};

export default config;
