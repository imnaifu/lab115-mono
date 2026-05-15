import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://converter.lab115.com",
  // SSG: every page is pre-rendered to static HTML at build time. The output
  // directory is `dist/`, served as-is by nginx — same deploy story as before.
  output: "static",
  integrations: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
