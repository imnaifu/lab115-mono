import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, cpSync, existsSync, rmSync } from "node:fs";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/sidepanel/sidepanel.html"),
        background: resolve(__dirname, "src/background/background.ts"),
      },
      output: {
        // The manifest names these files, so they need fixed names at the root.
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "sidepanel.js"),
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    react(),
    {
      name: "extension-files",
      closeBundle() {
        copyFileSync("manifest.json", "dist/manifest.json");
        cpSync("icons", "dist/icons", { recursive: true });
        // Chrome rejects a package that sets default_locale without _locales.
        cpSync("_locales", "dist/_locales", { recursive: true });
        // Vite keeps the HTML at its source path; the manifest expects it at the root.
        // Its script and style URLs are root-absolute (`/sidepanel.js`), which inside an
        // extension resolve against the extension root, so moving it is safe.
        const nested = "dist/src/sidepanel/sidepanel.html";
        if (existsSync(nested)) {
          copyFileSync(nested, "dist/sidepanel.html");
          rmSync("dist/src", { recursive: true, force: true });
        }
      },
    },
  ],
});
