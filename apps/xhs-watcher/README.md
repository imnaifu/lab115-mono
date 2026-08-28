# xhs-watcher

定时抓取小红书搜索结果的**最新发布** → 去重 → 写进日志和 SQLite。

**邮件推送已经删掉**：这个 worker 曾经把每轮的新笔记渲染成 HTML 经 Resend 发出去，
现在只写日志。留下来的是当年那封邮件的 `text/plain` 那一半 —— 没配 key 时的 dry-run
分支本来打的就是它，所以这个输出格式是一直在用的那个，不是删东西时顺手编的。

不是 Next.js 应用，是一个本地跑的 Node worker —— 不对外暴露端口，也不部署（见文末）。

```
Scheduler ─▶ Fetcher ─▶ Normalizer ─▶ Dedupe ─▶ Notifier
(node-cron)  (Playwright) (统一 schema)  (SQLite)  (stdout)
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
| `src/notifier.ts` | 把摘要 / 告警写进日志 |
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

**首轮只建基线**（`SEED_ON_FIRST_RUN`）：否则第一份摘要就是 20 条存量笔记。

**推送幂等**：只取 `notified_at IS NULL`，写完日志才回写时间戳。中途崩溃不丢也不
重复。这一层是当年为「Resend 返回成功之后才算送达」建的，删掉邮件之后它照样成立，
而且是唯一保证一条笔记不在日志里出现两次的东西。

## 已知限制

- 搜索接口**不一定返回发布时间**。`publishedAt` 可能为 null，此时年龄过滤不生效，
  但靠 `note_id` 去重仍然正确 —— 只是"新"的定义变成"我们没见过"。
- 笔记链接必须带 `xsec_token`，而 token 有时效。所以摘要里同时给了标题、作者、
  点赞数和时间，链接失效那一行本身仍然读得懂。
- 登录态大约几周会失效，届时日志里会出现 `[alert]`（每 `ALERT_COOLDOWN_HOURS` 小时
  最多一条），重新 `npm run login` 即可。**没有邮件会来提醒你了** —— 这是删掉推送的
  代价，得自己看日志。

## 本地开发

```bash
cd apps/xhs-watcher && npm install && npx playwright install chromium
```

```bash
cp .env.example .env && npm run login    # 弹出浏览器扫码，写入 data/pw-profile
```

```bash
export $(grep -v '^#' .env | xargs) && npm run dev    # 跑一轮就退出
```

## 不部署

**这个 worker 不是服务，也不在 `docker-compose.yml` 里。**它曾经是：一个常驻容器，
自带 Chromium 的 ~500MB 镜像、一个 `/data` 卷、以及一份要 rsync 上服务器的登录 profile。
连同 `Dockerfile` 一起去掉了 —— 一个必须先在本地扫码登录、再把浏览器 profile 同步到
服务器才能跑的东西，本来就不适合当服务；登录态几周一失效，每次都要重来一遍。

在本地跑：

```bash
npm start          # 按 CRON 常驻
npm run dev        # 跑一轮就退出
```

关键词改 `$DATA_DIR/watches.json`（本地默认 `./data/watches.json`），改完下一轮生效：

```json
[{ "id": "camping", "keyword": "露营装备", "sort": "time_descending", "minLike": 0, "enabled": true }]
```

CI 仍然会构建它 —— `.github/workflows/ci.yml` 是按 `apps/*` 自动发现的，「不部署」不等于
「不编译」。
