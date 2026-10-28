# lab115 apps

A monorepo of **independent Next.js apps**, one per subdomain. Each app under
`apps/<name>/` is a self-contained Next.js project (its own `package.json`,
deps and `Dockerfile`). A single `docker-compose.yml` builds them all and
Traefik routes each domain to its container. Coolify auto-deploys on push.

```
repo/
├── apps/
│   ├── home/                 # lab115.com — the lab's front door
│   ├── converter/            # converter.lab115.com — bilingual unit converter
│   │   ├── package.json / next.config.mjs / tsconfig.json / Dockerfile
│   │   ├── public/
│   │   └── src/{app,components,data,hooks,utils,i18n.ts,icons.ts,index.css}
│   ├── daily/                # daily.lab115.com — site *and* cron in one container
│   ├── madlibs/              # madlibs.lab115.com — 疯狂填词 fill-in-the-blank stories
│   ├── xhs-watcher/          # local worker — not deployed either
│   └── xhs-watch-ext/        # Chrome extension — not deployed at all
├── docker-compose.yml        # one service per app + Traefik host routing
└── .github/workflows/ci.yml  # quality gate (builds each app on PR/push)
```

Not every app is a website: an `apps/*` entry can also be a **headless worker**
(a container with no Traefik labels and no port) or a **client-side artifact**
that is never deployed (e.g. a Chrome extension). The only hard requirement is a
`package.json` with a `build` script and a lockfile — CI auto-discovers
`apps/*/` and builds each one, picking npm or yarn from whichever lockfile the
app carries (`package-lock.json` wins if both are present). A `Dockerfile` is only needed for entries that get a compose service.

## Deploy

Deployment is handled by **Coolify's native git integration** — no custom CI:

- Coolify resource = a **Docker Compose** app connected to this repo
  (compose file `docker-compose.yml`), auto-deploy on push to `main`.
- `git push` → Coolify builds each `apps/*` context (Docker layer cache skips
  unchanged apps) → runs the containers → Traefik + Let's Encrypt serve them.
- Wildcard `*.lab115.com` DNS + a DNS-01 wildcard cert means new subdomains
  need no DNS/cert changes.

## Add a new app

1. Drop the (Claude-design-exported) Next.js project into `apps/<name>/`.
2. Ensure it has a `Dockerfile` — copy `apps/converter/Dockerfile` if missing
   (standard Next.js `output: "standalone"` image, works for any Next app).
3. In `docker-compose.yml`, copy the `converter` service block and change:
   the service name, `build.context` (`./apps/<name>`), every `converter` in
   the Traefik labels, and the `Host(...)` domain.
4. Point the subdomain at the server (or rely on the `*.lab115.com` wildcard),
   then `git push`.

## Develop a single app

```bash
cd apps/converter
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (output: standalone)
```

---

## apps/home

`lab115.com` —— 实验室的门面。只有一屏：标志、字标 `lab115` 和几块平涂色块，没有
导航、文案、按钮和页脚，也不滚动。没有后端、没有表单。

视觉用 **Sokosoko** 设计系统（[设计系统](https://claude.ai/artifact/KPRSTffJfVbQawMQ8681A7)）：
白底、圆角、单一 ink 线色、粉彩平涂、只有一个暖黄。**只有浅色**，不跟随系统深色模式。
颜色 token 在 `src/index.css`，值抄自设计系统的 `tokens.json` —— 改色先改设计系统。
字标用 Nunito 800，由 `next/font` 在构建时下载并自托管，访问时不请求 Google。

色块的排法在 `src/components/Blocks.tsx`：位置都是屏幕百分比，横屏和竖屏（`portrait:`）
各排一次。链接预览图 `src/lib/og.tsx` 用同一组数字画同一个画面，**改一个要改两个**。

标志是手写 SVG，`src/components/Logo.tsx`：黄底圆角方块加 ink 描边，里面三笔等宽等高、
两直一弧，读作 1·1·5。og 卡片直接引用其中的 `MARK` 常量；`public/favicon.svg` 和
`public/apple-touch-icon.png`（180×180，满版无描边）是静态文件，**改坐标要同步这两个**。

页面上已经没有文字：`src/lib/i18n.ts` 只剩 title、description 这类 meta 文案，
`src/data/products.ts` 只给结构化数据里 `Organization` 的 `sameAs` 用。

语言路由和 `apps/daily` 一致：中文是不带前缀的 `/`，英文是 `/en`，旧的 `/zh` 308 到 `/`。
`<html lang>` 通过 `src/proxy.ts` 设置的 `x-lang` 请求头传给 root layout（App Router 里
layout 看不到下面的路由段），代价是页面按请求渲染而不是静态预渲染。

> **部署注意**：这是**根域名**，不在 `*.lab115.com` 通配符的覆盖范围里 ——
> 通配证书不含 apex。`lab115.com` 和 `www.lab115.com` 都需要各自的 A 记录指向服务器，
> 首次部署时 Traefik 会为这两个名字单独签一张证书。

---

## apps/converter

Bilingual (中文 / English) unit converter with closest-real-world-reference
illustrations. Next.js 15 (App Router) + React 19, TypeScript strict.
Categories: Length · Weight · Temperature · Volume · Area · Speed.

- Layout / global `<head>` / metadata / GA: `src/app/layout.tsx`
- Page + JSON-LD: `src/app/page.tsx`
- Converter UI: `src/components/` (`ConverterApp.tsx` is the client root)

**Add a unit / reference object**
1. Add the unit to the relevant `CATEGORIES` entry in `src/data/categories.ts`.
2. Add a reference object to `REFS` in `src/data/references.ts` (size in base
   units + svg key + zh/en labels).
3. Add the SVG to `src/icons.ts` (60×60 viewBox).

**Colors / fonts** — edit the CSS variables in `:root` at the top of
`src/index.css`.

---

## apps/daily

`daily.lab115.com` —— 每天 LA 时间 7:00 抓一批技术博客的新文章，用 DeepSeek
(`deepseek-v4-flash`) 提炼中英双语观点摘要，出一张适合截图分享的 750px 竖版长图。

和其他 app 不同的两点：

- **网站和定时任务是同一个容器**。Next.js 的 `src/instrumentation.ts` 在服务器
  启动时注册 `node-cron`，所以只有一个 compose service。
- **没有数据库**。每天的结果以 JSON 提交到 `github.com/imnaifu/files`，容器把那个
  仓库 clone 到挂载卷上，页面直接读本地磁盘。因此 runtime 镜像额外装了 `git`。

摘要走 [DeepSeek API](https://api-docs.deepseek.com/)，它是 OpenAI 兼容接口，所以
依赖是官方 `openai` SDK 加一个 `baseURL` —— 换任何 OpenAI 兼容服务商都只是改环境
变量。订阅源、环境变量、模型文档、JSON 契约和设计说明：
[`apps/daily/README.md`](apps/daily/README.md)。

Compose env：`DEEPSEEK_API_KEY`、`DAILY_GIT_TOKEN`。

---

## apps/madlibs

`madlibs.lab115.com` —— 疯狂填词：先回答几个不带上下文的填词问题，再揭晓用这些词
拼出的搞笑故事。第一阶段只验证玩法：固定模板、只有中文、无数据库。故事正文
`server-only`，揭晓走一次 server action，所以揭晓前在前端看不到故事。
产品想法和后续的视频方案在 [`apps/madlibs/doc/IDEA.md`](apps/madlibs/doc/IDEA.md)，
代码说明在 [`apps/madlibs/README.md`](apps/madlibs/README.md)。

Compose env：无。

---

## apps/xhs-watcher

Local worker: cron → Playwright 抓小红书搜索结果 → 三层去重 → 摘要写进日志和 SQLite.
**不部署** —— 没有 compose service，也没有 Dockerfile。它曾经两样都有；去掉是因为它
要先在本地扫码登录、再把 Playwright profile rsync 到服务器才能跑，而登录态几周就失效
一次，等于每隔几周手动重做一遍部署。邮件推送也一并删了（同一次清理），所以它现在没有
任何对外出口。

Full details, env vars and known limits:
[`apps/xhs-watcher/README.md`](apps/xhs-watcher/README.md).

---

## apps/xhs-watch-ext

Chrome 扩展（MV3）：`chrome.alarms` 定时 → 后台标签页抓小红书搜索结果的最新笔记 →
两层去重 → 桌面通知 + Bark 推手机. **不部署** —— 装在自己的 Chrome 里，用浏览器现成的
登录态，所以没有 compose service、也没有 Dockerfile。

```bash
cd apps/xhs-watch-ext && npm install && npm run build
# chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选 dist/
```

和 `xhs-watcher` 是同一件事的两种形态（本机 Playwright 抓 + 日志 vs. 浏览器扩展 +
桌面通知），
`normalize.ts` 的解析逻辑在两边是移植关系。设计取舍、休眠时的行为和已知限制：
[`apps/xhs-watch-ext/README.md`](apps/xhs-watch-ext/README.md)。
