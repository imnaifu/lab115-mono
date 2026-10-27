# apps/survivors

`survivors.lab115.com` —— 硅谷幸存者的 Web 版。游戏源码在 `games/survivors/`（Godot 4.7），这里只放导出结果和把它端出去的 nginx：

```
public/            # Godot Web 导出（index.html / .js / .wasm / .pck …），由 games/survivors/tools/export_web.sh 生成
Dockerfile         # nginx:alpine，构建时把 wasm / pck / js 预先 gzip
nginx.conf         # gzip_static + no-cache（文件名每次导出都一样，必须按 ETag 重新校验）
check-export.mjs   # CI 的 "build"：只检查 public/ 里的导出文件齐全
```

**更新线上版本**：在 `games/survivors/` 跑 `./tools/export_web.sh`，提交 `apps/survivors/public/` 的变化，push 到 main。CI 跑不了 Godot，所以导出是在本地做完再提交的；`npm run build` 只防止漏提交文件导致白屏。

导出用的是单线程（nothreads）模板，不需要 `SharedArrayBuffer`，所以服务器不用设 COOP / COEP 头，普通静态托管就行。陀螺仪要 HTTPS 才能用，线上走 Traefik 的 HTTPS 正好满足。

`index.pck` 里打包了 soco-st 的楼的插画：作为游戏的一部分发布符合其条款，但别把那些 PNG 单独放进仓库（见 `games/survivors/README.md` 的「素材」）。
