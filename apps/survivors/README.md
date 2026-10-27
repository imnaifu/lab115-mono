# apps/survivors

`survivors.lab115.com` —— 硅谷幸存者，一个 Godot 4.7 做的割草游戏。

```
game/              # Godot 工程（玩法、素材、测试都在这里，见 game/README.md）
Dockerfile         # 第一阶段装 Godot、从 game/ 导出 Web 版；第二阶段 nginx:alpine 提供，wasm / pck / js 预先 gzip
nginx.conf         # gzip_static + no-cache（文件名每次导出都一样，必须按 ETag 重新校验）
check-project.mjs  # CI 的 "build"：检查工程文件齐全、地图用到的 soco-st 楼图都已入库
```

**更新线上版本**：改 `game/` 里的东西，push 到 main。Coolify 构建镜像时会下载 Godot 4.7.2（按服务器架构选 arm64 / x86_64）和 Web 导出模板，在镜像里导出，所以线上永远和仓库里的源码一致，也不依赖谁本地装的 Godot。Godot 和模板那几层是缓存的，平时一次部署只重新导出游戏本身。

CI 跑不了 Godot，`npm run build` 只做 `check-project.mjs` 里的静态检查；导出真正失败（比如脚本有语法错误导致导出不出 pck）会让 Coolify 构建失败、线上保持旧版本。改了脚本后先在本地跑一遍冒烟测试（见 `game/README.md`）。

导出用的是单线程（nothreads）模板，不需要 `SharedArrayBuffer`，所以服务器不用设 COOP / COEP 头，普通静态托管就行。陀螺仪要 HTTPS 才能用，线上走 Traefik 的 HTTPS 正好满足。

线上的 `index.service.worker.js` 不是 PWA 的缓存脚本（PWA 已关），而是清理用的替身：之前开过 PWA，那时访问过的浏览器靠它清掉旧缓存、注销旧 worker，别删（见 `game/README.md` 的「发布」）。

在 2026-10-27 之前，导出产物曾直接提交在 `public/` 里（约 90 MB 二进制留在 git 历史中）；现在 `public/` 只是本地导出的输出目录，已加入 `.gitignore`。
