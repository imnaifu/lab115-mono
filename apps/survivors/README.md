# apps/survivors

`survivors.lab115.com` —— 大厂幸存者（Big Tech Survivors，原名「硅谷幸存者」），一个 Godot 4.7 做的割草游戏。

```
game/              # Godot 工程（玩法、素材、测试都在这里，见 game/README.md）
Dockerfile         # 第一阶段装 Godot、从 game/ 导出 Web 版；第二阶段 nginx:alpine 提供，wasm / pck / js 预先 gzip
nginx.conf         # gzip_static + no-cache（大多数文件名每次导出都一样，必须按 ETag 重新校验）；带哈希的游戏包 index-<哈希>.pck 永久缓存
check-project.mjs  # CI 的 "build"：检查工程文件齐全、地图用到的 soco-st 楼图和 sound.gd 用到的音效都已入库、裁剪过的字体收了脚本里的所有字
```

**更新线上版本**：改 `game/` 里的东西，push 到 main。Coolify 构建镜像时会下载 Godot 4.7.2（按服务器架构选 arm64 / x86_64）和 Web 导出模板，在镜像里导出，所以线上永远和仓库里的源码一致，也不依赖谁本地装的 Godot。Godot 和模板那几层是缓存的，平时一次部署只重新导出游戏本身。

CI 跑不了 Godot，`npm run build` 只做 `check-project.mjs` 里的静态检查；导出真正失败（比如脚本有语法错误导致导出不出 pck）会让 Coolify 构建失败、线上保持旧版本。改了脚本后先在本地跑一遍冒烟测试（见 `game/README.md`）。

导出用的是单线程（nothreads）模板，不需要 `SharedArrayBuffer`，所以服务器不用设 COOP / COEP 头，普通静态托管就行。陀螺仪要 HTTPS 才能用，线上走 Traefik 的 HTTPS 正好满足。

线上的 `index.service.worker.js` 不是 PWA 的缓存脚本（PWA 已关），而是清理用的替身：之前开过 PWA，那时访问过的浏览器靠它清掉旧缓存、注销旧 worker，别删（见 `game/README.md` 的「发布」）。

## 后端：云存档（nakama.lab115.com）

`.28` 起游戏的云存档存在自建的 [Nakama](https://github.com/heroiclabs/nakama)（开源游戏服务器，Apache-2.0）上：根目录 `docker-compose.yml` 的 `nakama`（固定 `heroiclabs/nakama:3.41.0`，有 arm64 镜像）和 `nakama-db`（`postgres:16-alpine`，数据在 `./data/nakama-db`，和 Umami 的库分开）。游戏从浏览器直接调它（Nakama 对任何来源都开 CORS，会话是请求头里的 token，不用 cookie），Traefik 把 `nakama.lab115.com` 转到 7350。机制和界面见 `game/DESIGN.md` 2.11，客户端代码 `game/scripts/cloud.gd`，本地测试见 `game/README.md`「云存档」。

**上线前要在 Coolify 里加 1 个环境变量 `NAKAMA_SECRET`**，用 `openssl rand -hex 24` 生成（只有字母和数字，拼进数据库地址也不用转义）。缺了它 `nakama` 会在启动时报错退出（`:?` 检查）、`nakama-db` 也不会初始化，不会带着 Nakama 文档里公开的默认密钥跑起来（那样任何人都能冒充任何玩家）。

它直接当数据库密码和管理后台密码用；Nakama 要的几把签名密钥（玩家的会话和刷新 token、服务端之间调用、后台登录）在启动时由它算出来：每把是 `sha256(秘密:用途)`，各不相同，不用另外保管。代价是它一泄露全部要换：换的时候改这一个值重新部署，所有玩家的登录 token 失效，游戏下次打开会用设备 id 自动重新登录，玩家无感；数据库密码在 `nakama-db` 第一次初始化后就定下来了，换秘密时还要进库改密码（`ALTER USER nakama PASSWORD '…'`）。

`--socket.server_key`（`survivors-lab115`）写死在 compose 和 `Cloud.SERVER_KEY` 里，它会打进游戏包，本来就不是秘密。

**管理后台**（看玩家、存档）在 <https://nakama-admin.lab115.com>，前面有一道 Cloudflare Access：Zero Trust 里的应用「Nakama admin (survivors)」只放行 `xnaifu@gmail.com`，登录方式是发到这个邮箱的一次性验证码，登录一次管 24 小时；过了这道才是 Nakama 自己的登录，用户名 `chopper`，密码是 `NAKAMA_SECRET`。Access 只拦得住经过 Cloudflare 的访问，所以这个路由还只接受 Cloudflare 的 IP 段（compose 里的 `cloudflare-only`，取自 cloudflare.com/ips，Cloudflare 改了 IP 段要跟着改），直接连服务器 IP 带这个域名会被拒。要加人或换邮箱，改 Zero Trust 里那个应用的策略（API token 在 `~/.config/secrets/cloudflare.env`）。

Cloudflare 出问题时，也可以绕过它，经 SSH 直接连服务器本机的 `127.0.0.1:7351`：

```bash
ssh -L 7351:127.0.0.1:7351 mydev
```

然后浏览器打开 <http://127.0.0.1:7351>，同样用 `chopper` 登录。

**删除只做标记**：玩家在游戏里「删除云存档」时账号和存档都留着，只多一个 `account` / `state` 存储对象（`deleted` 时间、`reason`：`player` 玩家删的，`redeemed` 换设备时被并掉的旧账号，带 `into`），存档码会被摘掉。要真删就在管理后台删那个账号。App 上架前要改成真删除（见 `game/DESIGN.md` 2.11）。

**升级 Nakama**：改 compose 里的镜像版本号再部署；启动时会先跑 `nakama migrate up`。升之前先备份 `./data/nakama-db`。

在 2026-10-27 之前，导出产物曾直接提交在 `public/` 里（约 90 MB 二进制留在 git 历史中）；现在 `public/` 只是本地导出的输出目录，已加入 `.gitignore`。
