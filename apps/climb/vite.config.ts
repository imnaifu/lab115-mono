import { defineConfig } from 'vite';

export default defineConfig({
  // 相对 base 让构建产物可以丢进任意静态目录（含 itch.io 那种 zip 上传）直接跑
  base: './',
  server: {
    // 监听所有网卡（0.0.0.0）而不是只有 localhost，这样局域网内可以用本机 IP 访问
    host: true,
    port: 5180,
    strictPort: true,
  },
  build: { target: 'es2022', outDir: 'dist' },
});
