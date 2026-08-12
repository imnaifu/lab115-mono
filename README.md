# lab115 apps

A monorepo of **independent Next.js apps**, one per subdomain. Each app under
`apps/<name>/` is a self-contained Next.js project (its own `package.json`,
deps and `Dockerfile`). A single `docker-compose.yml` builds them all and
Traefik routes each domain to its container. Coolify auto-deploys on push.

```
repo/
├── apps/
│   ├── converter/            # converter.lab115.com — bilingual unit converter
│   │   ├── package.json / next.config.mjs / tsconfig.json / Dockerfile
│   │   ├── public/
│   │   └── src/{app,components,data,hooks,utils,i18n.ts,icons.ts,index.css}
│   ├── daily/                # daily.lab115.com — site *and* cron in one container
│   ├── xhs-watcher/          # headless worker — no domain, no exposed port
│   └── xhs-watch-ext/        # Chrome extension — not deployed at all
├── docker-compose.yml        # one service per app + Traefik host routing
└── .github/workflows/ci.yml  # quality gate (builds each app on PR/push)
```

Not every app is a website: an `apps/*` entry can also be a **headless worker**
(a container with no Traefik labels and no port) or a **client-side artifact**
that is never deployed (e.g. a Chrome extension). The only hard requirement is a
`package.json` with an `npm run build` — CI auto-discovers `apps/*/` and builds
each one. A `Dockerfile` is only needed for entries that get a compose service.

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

Compose env：`DEEPSEEK_API_KEY`、`DAILY_GIT_TOKEN`、`DAILY_BARK_URL`。

---

## apps/xhs-watcher

Headless worker: cron → Playwright 抓小红书搜索结果 → 三层去重 → Resend 邮件摘要.
No domain, no port; state lives on the `./data/xhs` volume (SQLite + the
Playwright login profile).

Needs a one-time local `npm run login` (QR scan) whose profile is rsync'd to the
server — the container has no display. Full details, env vars and known limits:
[`apps/xhs-watcher/README.md`](apps/xhs-watcher/README.md).

Compose env: `XHS_KEYWORDS`, `RESEND_API_KEY`, `XHS_MAIL_TO`, `XHS_MAIL_FROM`.

---

## apps/xhs-watch-ext

Chrome 扩展（MV3）：`chrome.alarms` 定时 → 后台标签页抓小红书搜索结果的最新笔记 →
两层去重 → 桌面通知 + Bark 推手机. **不部署** —— 装在自己的 Chrome 里，用浏览器现成的
登录态，所以没有 compose service、也没有 Dockerfile。

```bash
cd apps/xhs-watch-ext && npm install && npm run build
# chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选 dist/
```

和 `xhs-watcher` 是同一件事的两种形态（服务端 24×7 邮件 vs. 本机随开随改推送），
`normalize.ts` 的解析逻辑在两边是移植关系。设计取舍、休眠时的行为和已知限制：
[`apps/xhs-watch-ext/README.md`](apps/xhs-watch-ext/README.md)。
