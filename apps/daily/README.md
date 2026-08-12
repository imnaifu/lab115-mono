# apps/daily — daily.lab115.com

每天 LA 时间早上 7:00 抓一遍订阅的技术博客，用 DeepSeek 提炼中英双语观点摘要，
生成一张适合截图分享的竖版长图页面，同时把当天结果以 JSON 提交到
[`github.com/imnaifu/files`](https://github.com/imnaifu/files)。

**网站和 worker 是同一个容器**：Next.js 服务页面，`src/instrumentation.ts` 在
服务器启动时注册 `node-cron`。数据不进数据库 —— 那个 git 仓库就是存储层，容器把
它 clone 到挂载卷上，页面直接读本地磁盘上的 JSON。

```
每天 07:00 (America/Los_Angeles)
  ↓
git pull ──→ 拉 4 个 feed，筛出过去 24h 的文章 ──→ 按 URL 去重
  ↓
取正文（RSS 全文 / 抓原文页）──→ 一次 LLM 调用：双语摘要 + 信息量打分
  ↓
排序取 Top 10，其余折叠 ──→ 写 JSON ──→ git commit & push ──→ Bark 推送
```

## 订阅源

改 `src/lib/sources.ts` 一个数组即可增删。

| 源 | Feed | 实测频率 |
|---|---|---|
| Heavybit Library | `heavybit.com/library/feed` | ~2 篇/周 |
| XDA · AI Tools | `xda-developers.com/feed/ai-tools/` | ~5.9 篇/天 |
| XDA · News | `xda-developers.com/feed/news/` | ~3.6 篇/天 |
| caolan.uk notes | `caolan.uk/feed/notes/` | ~4 篇/年 |

两个关键取舍，改源之前先读一下：

- **不订 XDA 全站 feed。** 全站每天发 ~69 篇但 feed 只保留 10 条（约 3.5 小时），
  一天抓一次会丢掉 95%。分类 feed 每天只有几篇，10 条足够覆盖 24 小时以上。
  加新源时按这个标准检查：`feed 条数 ÷ 日产量 > 1 天` 才安全。
- **正文大多不在 feed 里。** XDA 的 `content:encoded` 只有 90~270 字符的导语，
  caolan.uk 的 Atom 条目连摘要都没有。所以这两个源标了 `fetchBody: true`，
  另外任何源的正文短于 `SHORT_BODY_CHARS`（1200）也会自动去抓原文页。

## 网络失败怎么办

GitHub over HTTPS 会偶发超时。这是个无人值守的每日任务，而且**没有跨天去重**，
所以一次抖动丢掉的那天是永久性的 —— `repo.ts` 因此对网络操作做了这些事：

- **clone / fetch / push 都重试 4 次**，退避 5s → 15s → 45s
- 传输速率低于 1KB/s 持续 30s 就中断（`http.lowSpeedLimit`），而不是挂到 socket 超时
- **fetch 失败不致命**：只要本地已有 clone，就用本地状态继续出图，下次再同步。
  只有「没有 clone 且 clone 不上」才会让整个任务失败
- **push 失败不致命**：内容已经 commit 在本地，下次运行会带上去

最后一条依赖 `syncToOrigin()` 的一个关键行为：本地有未推送的 commit 时走
**rebase 而不是 `reset --hard`**。早期版本无条件 hard reset（当时假设 push 永远成功），
一旦 push 失败，那天的 digest 会在下次运行时被静默抹掉，且没有任何东西能重新生成它。

走代理的话 `git` 会自动读 `HTTPS_PROXY` / `https_proxy`（`repo.ts` 把整个
`process.env` 透传给子进程），不需要改代码。

## 没有跨天去重

刻意的设计：**没有任何"已读"状态**，窗口就是过滤器 —— 每次只看过去 24 小时。
代价是机器某天没跑成，那天的文章就永久漏掉。同一天重跑会覆盖当天 JSON（幂等）。
一次运行内部仍然按 URL 去重，因为 XDA 两个分类 feed 会有重叠文章。

## 摘要模型：DeepSeek

用 `deepseek-v4-flash`。DeepSeek 提供的是 **OpenAI 兼容接口**，所以代码里装的是
官方 `openai` SDK，只把 `baseURL` 指到 `https://api.deepseek.com` —— 换回别的
OpenAI 兼容服务商只需要改 `DEEPSEEK_BASE_URL` 和 `DAILY_MODEL`，代码不用动。

| | `deepseek-v4-flash` |
|---|---|
| 上下文 | 1M tokens |
| 最大输出 | 384K tokens |
| 输入 | $0.14 / 1M tokens |
| 输出 | $0.28 / 1M tokens |
| 缓存命中输入 | $0.0028 / 1M tokens |

按每天 ~10 篇全文（十几万 input tokens）算，成本在每天几分钱的量级。上下文和输出
上限都远大于我们的用量，所以 `MAX_ARTICLES_PER_CALL`（30）纯粹是防某个源突然
灌量的保险，不是 token 限制。

**相关文档**

- [DeepSeek API 文档首页 / 第一次调用](https://api-docs.deepseek.com/) —— base URL、OpenAI SDK 配置
- [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing) —— 型号列表与计价
- [Tool Calls 指南](https://api-docs.deepseek.com/guides/tool_calls) —— `tools` / `tool_calls` 格式
- [API Keys 控制台](https://platform.deepseek.com/api_keys) —— 申请 key

### thinking mode 必须关掉

v4 模型**默认开启 thinking mode**（effort 默认 `high`），而 thinking mode 拒绝
指定具体函数的 `tool_choice`：

```
400 Thinking mode does not support this tool_choice
```

所以请求里带了 `{"thinking": {"type": "disabled"}}`。这不只是为了绕开报错 ——
这个任务是抽取和打分，不需要思维链，而 thinking token 按 output 计费，开着纯粹
是多花钱多等待。关掉之后 `tool_choice` 才能强制 schema。

这个参数是 DeepSeek 特有的，所以只在 `DEEPSEEK_BASE_URL` 的域名是 `deepseek.com`
时才发送 —— 指向别的 OpenAI 兼容服务商时会自动省略，不会引发 400。

`summarize.ts` 用 tool call 强制模型输出固定 schema。注意两点：

- **`tool_choice` 的强制程度各家实现不一**，所以 `extractRows()` 同时接受 tool call
  和普通 JSON 文本回复（含 ```` ```json ```` 围栏）两种形态。并且调用本身有两次
  尝试：第一次带 `thinking: disabled` + 强制 `tool_choice`，被拒就退回
  `tool_choice: "auto"` 且不带 `thinking`。一次被拒等于一整天没有摘要，值得这层保险。

- **模型返回的 JSON 会坏，而且不止一种坏法。** 实测遇到过 tool-call arguments 里
  某个元素**整个丢掉闭合花括号**：

  ```
  …"en_points": ["…and training"], {"index": 1, "score": 58, …
                                  ↑ 第 0 个元素的 } 从来没出现
  ```

  这跟上游那个 tool-call 序列化 bug 是一类问题。处理分三层：

  1. system prompt 禁止在值里使用直双引号（中文用 「」，英文用单引号）
  2. 解析失败时 `logParseFailure()` 打印出错位置前后各 120 字符 —— 没有这个，
     事后根本无法判断是哪种坏法，只能靠猜
  3. `salvageRows()` **按 `{"index"` 切分**而不是数花括号。数花括号救不了缺失
     `}` 的情况：深度永远回不到零，后面所有元素会被吞进第一个里。改成用我们自己
     schema 保证的「每个元素都以 `index` 开头」来切，再由 `repairElement()`
     逐个补齐未闭合的括号和字符串。**只丢掉真正坏掉的那几篇。**

  `repairElement()` 的扫描是字符串感知的（要区分 `}` 是结构还是摘要里的字符），
  并且会剥掉切分时残留的尾随逗号 —— 否则补出来的是 `{…, }`，仍然不合法。

  另外会检查 `finish_reason === "length"` 并单独告警 —— 截断也会产生非法 JSON，
  但那要加 `max_tokens`，不是解析能救的。

- DeepSeek 另有 **strict mode**（beta：`base_url` 换成 `.../beta`、函数加 `strict: true`、
  所有属性进 `required`、每个 object 加 `additionalProperties: false`）声称能保证
  schema 一致。**目前没用**：它是 beta，且上游有「strict 模式仍返回 malformed JSON」
  的未关闭 issue，不比现在这套兜底更可靠。

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | 不填则跳过摘要，页面只剩标题列表 |
| `GIT_TOKEN` | 二选一 | fine-grained PAT，只授目标仓库的 `contents:write`。容器用这个 |
| `GIT_REMOTE` | 二选一 | 直接指定远端 URL，如 `git@github.com:imnaifu/files.git`。本机已有 SSH key 时用这个，不需要 PAT |
| `BARK_URL` | 否 | 形如 `https://api.day.app/<key>`，不填则不推送 |
| `GIT_REPO` | 否 | 默认 `imnaifu/files` |
| `DAILY_CRON` | 否 | 默认 `0 7 * * *` |
| `DAILY_TZ` | 否 | 默认 `America/Los_Angeles` |
| `DAILY_TOP_N` | 否 | 默认 `10`，超出的折叠成标题链接 |
| `DAILY_WINDOW_HOURS` | 否 | 默认 `24` |
| `DAILY_MODEL` | 否 | 默认 `deepseek-v4-flash` |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com` |
| `DAILY_DATA_DIR` | 否 | 默认 `/data`，clone 落在它下面的 `repo/` |
| `DRY_RUN` | 否 | `=1` 时跑完整流程但不 push、不推送 |

## 本地跑

```bash
cd apps/daily && npm install
```

只跑一次抓取任务，不 push 也不推手机：

```bash
DRY_RUN=1 DEEPSEEK_API_KEY=sk-... npm run once
```

真的推上去（本机走 SSH，不需要 PAT）：

```bash
GIT_REMOTE=git@github.com:imnaifu/files.git DEEPSEEK_API_KEY=sk-... npm run once
```

**push 有两道闸门**，都静默不了：`DRY_RUN=1` 会跳过推送，而 `GIT_TOKEN` 和
`GIT_REMOTE` 都没设时也无法认证 —— 两种情况都只在本地 commit，日志会明说。
内容不会因此丢失：下次运行走 rebase 而非 hard reset，未推送的 commit 会被带上去。

起网站（读上面那次跑出来的数据）：

```bash
npm run dev
```

`dev` 和 `once` 两个脚本会把 `DAILY_DATA_DIR` 默认成 `./data`（想换目录照常在前面
显式指定即可）。`config.ts` 里的默认值是容器的挂载点 `/data`，本地跑会撞到「根目录
不可写」，所以本地入口在脚本层面兜住了。Docker 运行时是 `CMD ["node", "server.js"]`，
不经过 npm scripts，环境变量由 compose 给。

## 输出的 JSON

`daily/<yyyy>/<mm>/<yyyy-mm-dd>.json`，公开可读：

```
https://raw.githubusercontent.com/imnaifu/files/main/daily/2026/08/2026-08-10.json
```

字段定义在 `src/lib/types.ts` —— 那是写入方和页面共用的契约，首份 digest 发出去
之后只能加字段，不要改已有字段的含义。

## 页面

- `/` 今天（截图目标）。当天还没跑时回退显示磁盘上最新的一天
- `/d/2026-08-10` 单日固定链接
- `/archive` 归档列表，直接扫 clone 目录得出，没有索引文件

设计取自 Uizard 的 "Readium" 读书 App 模板：奶油底 `#FBF3E9`、深靛蓝 `#3B3563`、
暖橙 `#EFA050`、卡片米色 `#F3E8D8`，页头有机色块 + 粗衬线标题 + 书封网格。
版心固定 750px 竖版，为整页截图设计，不依赖任何 hover 效果。
颜色和字体都在 `src/index.css` 顶部的 `:root` 里。

封面图的降级是纯 CSS 的：渐变色块（按来源配色 + 文章 id 决定角度）永远渲染在底层，
照片盖在上面。XDA 的 CDN 会间歇性超时，图挂了就自然露出渐变，不需要客户端 JS。
