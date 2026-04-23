import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      // This tells Vite to use your wrangler.jsonc configuration
      configPath: "./wrangler.jsonc",
    }),
  ],
});
