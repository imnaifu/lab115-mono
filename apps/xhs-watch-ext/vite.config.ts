import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";

export default defineConfig({
  // 相对路径：扩展页面是以 chrome-extension://<id>/ 为根加载的，绝对路径 /popup.js
  // 在打包成 zip 后同样能用，但相对路径对「直接加载已解压扩展」更稳。
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    // 扩展页面自己直接加载脚本，preload polyfill 没有宿主文档可挂，纯属多余。
    modulePreload: false,
    minify: false,
    rollupOptions: {
      input: {
        // popup.html 放在项目根目录，Vite 才会把它输出到 dist 根目录 ——
        // manifest 里的路径是相对扩展根解析的。
        popup: resolve(__dirname, "popup.html"),
        worker: resolve(__dirname, "src/background/worker.ts"),
        content: resolve(__dirname, "src/content/content.ts"),
        injected: resolve(__dirname, "src/content/injected.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "popup.css" : "assets/[name]-[hash][extname]",
      },
    },
    cssCodeSplit: false,
  },
  plugins: [
    {
      name: "xhs-watch-extension-assets",
      closeBundle() {
        copyFileSync("manifest.json", "dist/manifest.json");
        if (existsSync("icons")) {
          mkdirSync("dist/icons", { recursive: true });
          cpSync("icons", "dist/icons", { recursive: true });
        }
      },
    },
  ],
});
