# xhs-watcher

定时抓取小红书搜索结果的**最新发布** → 去重 → 邮件推送。

不是 Next.js 应用，是一个常驻 Node worker 容器，不对外暴露端口。

```
Scheduler ─▶ Fetcher ─▶ Normalizer ─▶ Dedupe ─▶ Notifier
(node-cron)  (Playwright) (统一 schema)  (SQLite)  (Resend)
                    │                      │
              pw-profile/              notes.sqlite      ← 都在 /data 卷上
```

| 文件 | 职责 |
|---|---|
| `src/index.ts` | cron 调度、单例保护（上一轮没跑完就跳过） |
| `src/config.ts` | env + `watches.json` 订阅配置 |
| `src/fetcher.ts` | Playwright 持久化登录态、拦截搜索接口响应 |
| `src/normalize.ts` | 原始 JSON → `NormalizedNote`（全字段容错） |
| `src/db.ts` | SQLite schema、三层去重的存取 |
| `src/runner.ts` | 一轮完整流程、失败退避与告警 |
| `src/notifier.ts` | Resend HTML 邮件（摘要 / 告警） |
| `src/login.ts` | 一次性扫码登录，本地跑 |

## 为什么这么设计

**用浏览器而不是直接发 HTTP**：搜索接口 `/api/sns/web/v1/search/notes` 需要
`x-s` / `x-t` 签名，由页面里混淆过的 JS 生成。让真实页面自己发请求、我们只
**监听 response**，就永远不用逆向也不用跟版。

**拦截 XHR 而不是解析 DOM**：拿到的是结构化 JSON，UI 改版不影响。

**三层去重**：

1. `note_id` 主键 —— 同一条笔记永远只推一次（`xsec_token` 每次都变，绝不入键）
2. `content_hash = sha1(归一化标题 + author_id)` —— 干掉搬运号 / 重复发布
3. 发布时间年龄阈值（`MAX_AGE_DAYS`）—— 搜索会混进几个月前的爆款，入库但不推送

**首轮只建基线**（`SEED_ON_FIRST_RUN`）：否则第一封邮件就是 20 条存量笔记。

**推送幂等**：邮件只取 `notified_at IS NULL`，Resend 返回成功后才回写。中途崩溃
不丢也不重复。

## 已知限制

- 搜索接口**不一定返回发布时间**。`publishedAt` 可能为 null，此时年龄过滤不生效，
  但靠 `note_id` 去重仍然正确 —— 只是"新"的定义变成"我们没见过"。
- 笔记链接必须带 `xsec_token`，而 token 有时效。所以邮件里同时给了封面、标题、
  作者、点赞数，链接失效邮件本身仍可读。
- 登录态大约几周会失效，届时会收到一封告警邮件，重新 `npm run login` 即可。

## 本地开发

```bash
cd apps/xhs-watcher && npm install && npx playwright install chromium
```

```bash
cp .env.example .env && npm run login    # 弹出浏览器扫码，写入 data/pw-profile
```

```bash
export $(grep -v '^#' .env | xargs) && npm run dev    # 跑一轮就退出，邮件走 dry-run
```

不配 `RESEND_API_KEY` 时邮件内容直接打印到日志，方便调试。

## 部署

`docker-compose.yml` 里的 `xhs-watcher` service，数据卷 `./data/xhs:/data`。

首次部署需要把本地登录好的 profile 传上去（容器里没有显示器，无法扫码）：

```bash
rsync -a apps/xhs-watcher/data/pw-profile/ <server>:<coolify-app-path>/data/xhs/pw-profile/
```

关键词日常调整改服务器上的 `data/xhs/watches.json`，无需重新部署：

```json
[{ "id": "camping", "keyword": "露营装备", "sort": "time_descending", "minLike": 0, "enabled": true }]
```
