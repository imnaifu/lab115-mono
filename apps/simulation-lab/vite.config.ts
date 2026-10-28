import { createReadStream, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { cacheManifest, voiceCacheDir } from "./src/voice/cache.ts";

/**
 * Dev-only, read-only access to generated narration clips so the preview can play real audio:
 *   /__simlab/voice/manifest.json  → { key: duration }
 *   /__simlab/voice/<key>.wav      → the clip
 * Keys are hex hashes, so the route cannot reach files outside the cache folder.
 */
function voiceCachePlugin(): Plugin {
  const cacheDir = voiceCacheDir(import.meta.dirname);
  return {
    name: "simlab-voice-cache",
    configureServer(server) {
      server.middlewares.use("/__simlab/voice", (request, response, next) => {
        const path = (request.url ?? "").split("?")[0];
        if (path === "/manifest.json") {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify(cacheManifest(cacheDir)));
          return;
        }
        const match = path.match(/^\/([0-9a-f]{20,40})\.wav$/);
        const file = match ? join(cacheDir, `${match[1]}.wav`) : null;
        if (!file || !existsSync(file)) return next();
        response.setHeader("Content-Type", "audio/wav");
        createReadStream(file).pipe(response);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), voiceCachePlugin()],
  build: {
    rollupOptions: {
      // Two pages share one renderer: the interactive preview and the bare page the exporter drives.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        render: resolve(import.meta.dirname, "render.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
