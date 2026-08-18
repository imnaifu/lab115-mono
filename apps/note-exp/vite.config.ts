import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { cpSync } from "fs";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        background: resolve(__dirname, "src/background/background.ts"),
        content: resolve(__dirname, "src/content/content.ts"),
        injected: resolve(__dirname, "src/content/injected.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // All entry scripts go to root for Chrome extension compatibility
          if (chunkInfo.name === "background") {
            return "background.js";
          }
          if (chunkInfo.name === "content") {
            return "content.js";
          }
          if (chunkInfo.name === "injected") {
            return "injected.js";
          }
          // Popup script goes to root (popup.html is also at root)
          return "popup.js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // Ensure popup.html goes to root of dist
          if (assetInfo.name && assetInfo.name.endsWith("popup.html")) {
            return "popup.html";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Disable code splitting for extension scripts
    cssCodeSplit: false,
  },
  plugins: [
    // React only powers the popup UI; the content/injected/background entries
    // are plain TS and are unaffected by this plugin.
    react(),
    {
      name: "copy-manifest",
      closeBundle() {
        // Copy manifest.json
        copyFileSync("manifest.json", "dist/manifest.json");
        // Copy icons directory if it exists
        if (existsSync("icons")) {
          if (!existsSync("dist/icons")) {
            mkdirSync("dist/icons", { recursive: true });
          }
          cpSync("icons", "dist/icons", { recursive: true });
        }
        // Copy _locales so __MSG_*__ placeholders in manifest.json resolve;
        // Chrome rejects the package if default_locale is set but _locales is missing
        if (existsSync("_locales")) {
          cpSync("_locales", "dist/_locales", { recursive: true });
        }
        // Move popup.html from nested location to root if it exists
        const nestedHtml = "dist/src/popup/popup.html";
        const rootHtml = "dist/popup.html";
        if (existsSync(nestedHtml)) {
          copyFileSync(nestedHtml, rootHtml);
          // Clean up nested directory structure
          try {
            rmSync("dist/src", { recursive: true, force: true });
          } catch (e) {
            // Ignore errors if directory doesn't exist or can't be removed
          }
        }
      },
    },
  ],
});
