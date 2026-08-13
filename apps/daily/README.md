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
git pull ──→ 拉全部源，筛出过去 24h 的文章 ──→ 按 URL 去重
  ↓
取正文（RSS 全文 / 抓原文页）──→ 一次 LLM 调用：双语摘要 + 信息量打分
  ↓
按类分栏、每类取 top N ──→ 写 JSON ──→ git commit & push ──→ Bark 推送
```

## 配置：`config.json`

**所有需要人工决策的东西都在 `apps/daily/config.json` 里**，改它不用碰 TypeScript：

- `sources` —— 订阅哪些博客（url、名称、配色、版面配额、抓取方式）
- `categories` —— 分几栏、每栏叫什么、边界怎么划、最多几张卡
- `fallbackCategory` —— 分不出来时落到哪一栏

和 `src/lib/config.ts` 的分工：**编辑决策进 `config.json`，运维参数进环境变量**
（密钥、cron、时区、时间窗口）。

它是被 `import` 进来的、打进镜像的，所以改完要 push 并重新部署才生效。

`src/lib/user-config.ts` 在加载时校验，写坏了会**当场抛出可读的错误**，而不是静默
丢掉一条：一个悄悄消失的源看起来和一个停更的博客一模一样，那种 bug 能藏几个月。

```
config.json: source "heavybit" has neither a feed nor a scrape config
config.json: duplicate source id "heavybit"
config.json: fallbackCategory "nope" is not one of the categories — ...
config.json: source "alienchow" scrape.pattern is not a valid regex: ...
config.json: source "alienchow" scrape.flags must include "g"
```

正则在 JSON 里存成 `pattern` + `flags` 两个字符串，加载时编译成 `RegExp`。

## 订阅源

| 源 | Feed / 列表页 | 实测频率 | 正文来源 |
|---|---|---|---|
| XDA · AI Tools | `xda-developers.com/feed/ai-tools/` | ~5.9 篇/天 | 只有导语，抓原文页 |
| Hacker News | `hnrss.org/frontpage?points=200` | ~3.1 篇/天 | 无，抓它指向的第三方站点 |
| WESTENBERG | `joanwestenberg.com/feed` | ~1.1 篇/天 | 全文 1k~8.5k |
| ByteCode.News | `bytecode.news/feed.xml` | ~0.6 篇/天 | 只有 ~260 字符摘要，抓原文页 |
| Jake Gold | `jacob.gold/index.xml` | 近期约每周 1~2 篇 | 只有摘要且双重转义，抓原文页 |
| Uncharted Territories | `unchartedterritories.tomaspueyo.com/feed` | ~1 篇/4 天 | 免费文全文；付费文只有 ~400 字符预览 |
| the singularity is nearer | `geohot.github.io/blog/feed.xml` | ~1 篇/5 天 | Atom，全文 3k~5k |
| Heavybit Library | `heavybit.com/library/feed` | ~2 篇/周 | 文章全文，播客单集只有简介 |
| Neciu Dan’s Blog | `neciudan.dev/rss.xml` | ~1 篇/周 | 全文，28k~74k 字符 |
| Alienchow | `alienchow.dev/`（**爬列表页**） | ~5 篇/年 | 无 feed，抓原文页 |
| Marginal Revolution | `marginalrevolution.com/feed` | ~5 篇/天（限 2） | 短链接贴，~1.6k |
| Astral Codex Ten | `astralcodexten.com/feed` | ~0.8 篇/天 | 全文 ~10k |
| Platformer | `platformer.news/rss/` | ~1 篇/3 天 | 全文 ~15k |
| Construction Physics | `construction-physics.com/feed` | ~1 篇/3 天 | 全文 ~13k |
| Nielsen Norman Group | `nngroup.com/feed/rss/` | ~1 篇/3 天 | 仅摘要，抓原文页 |
| Austin Kleon | `austinkleon.com/feed/` | ~0.5 篇/天 | 仅摘要，抓原文页 |
| Benedict Evans | `ben-evans.com/benedictevans?format=rss` | ~1 篇/月 | 全文 ~10k |
| Nic Chan | `nicchan.me/feed.xml` | 停更中 | Atom，全文 5k~11k |
| caolan.uk notes | `caolan.uk/feed/notes/` | ~4 篇/年 | 无，抓原文页 |

几个需要知道的：

- **Hacker News 走 hnrss.org 而不是官方 `/rss`**，因为只有第三方服务能按分数过滤，
  而没过滤的首页在这堆博客旁边基本是噪声。它的条目指向任意第三方站点，正文靠抓那些
  页面 —— 付费墙、纯 JS 页、PDF 都可能抓不到，这时正文为空，模型只看标题。
- **Uncharted Territories 的 "Dispatch" 系列是付费内容**，feed 只给 ~400 字符预览，
  抓原文页拿到的还是预览。
- **Nic Chan 自 2026-02-10 停更**。留着不花成本 —— 没有新文章的源在页面上只是一个
  计数为 0 的 chip。
- **有些 feed 双重转义自己的正文**（`jacob.gold` 的 description 是
  `&lt;p&gt;US residential…`）。所以 `stripHtml()` 去标签跑两遍：解码实体这一步会
  *产生* 原本不存在的标签，只跑一遍会把字面量 `<p>` 喂给模型。
- **ByteCode.News 和 Jake Gold 都是原创博客**，虽然标题常引用别人（`Bjarnason: …`）。
  两者 feed 里的链接 100% 指向自己站内，所以抓正文抓的是它们自己的页面，不是第三方。

### 没有 feed 的源怎么办

`Source.scrape` 是给完全没有 RSS 的站点准备的（目前只有 alienchow.dev）：给一个列表
页地址和一个带 `url` / `date` / `title` 命名组的全局正则，`parseListing()` 会把它变成
和 feed 完全一样的候选项，后面的流程不用区分两者。

用正则而不是 DOM 库，是因为要解析的列表页就是一串扁平 anchor，而这个文件本来就在用
正则读 HTML。**如果哪天某个站点需要真正的 DOM 遍历，那是该引入解析器的信号，
而不是把正则堆得更复杂。**（alienchow 的 HTML 是压缩过的，属性值不带引号，
正则要能吃 `href=/post/slug/` 这种写法。）

两个关键取舍，改源之前先读一下：

- **不订 XDA 全站 feed。** 全站每天发 ~69 篇但 feed 只保留 10 条（约 3.5 小时），
  一天抓一次会丢掉 95%。分类 feed 每天只有几篇，10 条足够覆盖 24 小时以上。
  加新源时按这个标准检查：`feed 条数 ÷ 日产量 > 1 天` 才安全。
- **正文不一定在 feed 里。** XDA 的 `content:encoded` 只有 90~270 字符的导语，
  caolan.uk 的 Atom 条目连摘要都没有 —— 这两个源标了 `fetchBody: true`。任何源的
  正文短于 `SHORT_BODY_CHARS`（1200）也会自动去抓原文页。
- **正文抓取有并发上限**（`BODY_FETCH_CONCURRENCY`，6）。原来是无上限的
  `Promise.all` —— 在全是已知博客时没问题，但 HN 指向任意第三方站点，任何一个都能
  占住 socket 直到 30 秒超时，窗口一宽就是几百个并发连接。加上限后最坏耗时被约束在
  `ceil(文章数 / 6) × 超时`。
- **正文短于 `MIN_USEFUL_BODY`（200 字符）视为没有正文。** HN 的 feed body 是
  ~150 字符的「Article URL … Points: 257」样板文字，拿它去摘要等于凭空编一篇文章；
  留空反而会让 prompt 说「只看标题判断」，那是诚实的。
- **长文源要留够正文预算。** `BODY_CHAR_LIMIT` 默认 20000 字符。它最初是 6000，
  那是按 XDA 短文校准的；neciudan.dev 这类 28k~74k 字符的长文在 6000 下只会喂进
  前 8%，摘出来的是引言而不是论点。输入侧便宜（$0.14/M，1M 上下文），值得给足。

## 两个 cron，不是一个

| | 频率 | 做什么 |
|---|---|---|
| `DAILY_CRON` | 默认每天 07:00 | 拉取 → **当天已有就跳过** → 抓取 + 摘要 + commit + push |
| `DAILY_SYNC_CRON` | 默认每 15 分钟 | **只 `git pull`**，不调模型、不 commit |

定时任务带 `skipIfPublished`：仓库里已经有当天的 digest 就直接退出，不抓取也不调模型。
因为那一天可能已经在别处生成过（笔记本手动跑、上一个容器实例），重跑等于为同一天付两次
模型钱、还会覆盖已发布的内容。

**这个检查必须放在 `ensureRepo()` 之后**，这是它唯一容易写错的地方：落后于 origin 的
clone 会把「今天」看成不存在，于是重新生成一个上游早就有的日期。

手动 `npm run once` **不带**这个开关 —— 手动重跑本来就是这个入口的用途。想要定时任务
那种行为就加 `npm run once -- --skip-if-published`。

第二个是必需的，不是优化。页面读的是容器里那份 clone，而 clone 原本只在**容器启动时**
和**每日任务运行时**才会前进 —— 从别处推上去的 digest（笔记本手动跑、补数据）在下一个
07:00 之前对站点完全不可见。实际后果是：本地推了三次、远端明明有内容，线上仍然显示
「今日无更新」。

两者共用同一把锁（`jobs/daily.ts` 里的 `running`），因为它们操作同一个工作树，
fetch 撞进 rebase 中间会把它弄坏。每日任务在跑时，同步会直接跳过。

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

## 分类

`config.json` 的 `categories` 是**唯一**要改的地方：模型的 enum、分类说明、页面栏目
顺序和每栏上限全部由它生成。加一类就是往数组里加一项。

目前 AI · 技术 · 商业 · 投资 · 人文，每类上限 4 张卡。

**分类是逐篇由模型判断的，不是按源固定映射。** Hacker News 和 Marginal Revolution
本身就横跨从数据库内核到劳动经济学，按源写死会大面积错分。

`hint` 字段直接进 prompt，**要写成边界而不是主题清单** —— 难的从来不是「什么是 AI」，
而是「为什么归这里而不是隔壁」。实测教训：兜底类最初写成「其余一切值得读的：社会、
经济、历史、科学…」，结果把 `What sort of maths are LLMs good at?` 当成「科学」吸走了。
现在它显式让位（`LAST RESORT — use only when none of the categories above fits`），
prompt 里也加了「永远选最具体的那一类」。

模型没给或给了未知值时落到 `FALLBACK_CATEGORY`。旧 digest 里的类别若已被删除，
`categoryOf()` 也不会抛错 —— 归档页必须永远能渲染。

边界模糊的文章在不同批次间会漂移（`AI is removing the middle class of software
engineering` 有时判成商业、有时人文），这是模型判断的正常方差，不是 bug。

## 页面

- **中英逐句配对**，不是分成两块。英文紧跟在它翻译的那句中文下面，字号小一号、颜色更淡。
  早先的版本把所有英文堆在卡片底部一个 `ENGLISH` 区块里，读者得往回找它对应哪句中文 ——
  而截图是不能滚动的。中英要点按**位置**配对，所以 prompt 明确要求英文数量和顺序与中文
  一一对应（实测 13/13 篇匹配）。数量万一不匹配，多出来的中文行就单独显示。

- **分类用 tab 切换，默认停在「全部」。** tab 会藏内容，而这个页面是用来截图的 ——
  默认过滤到某一栏意味着截图会悄悄丢掉其余部分。所以默认展示全部分栏（和没有 tab 时
  完全一样），tab 只是叠加在上面的筛选器。加载后直接截图，不会缺东西。

- 头条**不进 tab**，它领的是整期而不是某一栏。

`CategoryTabs` 是唯一的客户端组件（需要 `useState`），其余全是服务端渲染。

## 打分：观点优先，不是新闻聚合

这是一份**读观点和分析**的日报，不是用来追新闻的。所以打分的第一个问题是
**「论证还是通告」**：这篇文章有没有推导出一个读者可以反对的主张，还是只在报道
某件事发生了？

判据写得很直白：**如果整篇能被复述成「X 发生了」而不损失什么，它就是新闻**，
压到 30 分档以下，把位置让给有论点的。发布会、跑分表、版本号、链接汇总贴都属此列，
无论那件事本身多重要。

`minScore`（默认 40）是**卡片的门槛**：低于它的文章永远不上卡片，哪怕那一栏是空的。
这条是补上的 —— 回填原本只看「有没有空位」不看分数，于是 30 分的
`Wednesday assorted links` 靠着商业栏当天没内容就上了页面。**空栏是诚实的，
凑数不是。**

门槛**只对模型真正判过分的文章生效**。曾经有一次模型调用整体失败，所有分数退回 0，
门槛把整页清空了 —— 把「降级」变成了「空白」。现在没有 thesis 的文章视为「未判定」，
照常占位并以纯标题渲染，和门槛存在之前一样。

折叠列表里带 `score`，所以能一眼看出折叠原因：分数低 = 模型觉得单薄，分数高 =
那一栏或那个源已经满了。

## 摄入上限 `maxPerRun`

`sources[].maxPerRun` 限制一个源在**一次运行里最多进来几篇**。目前只有
Hacker News 设了 10，其余不限。

它加在**抓正文之前** —— 时间窗口过滤之后、并发抓取和送模型之前。这是关键：
这个上限的意义就是「不为这些文章花钱」，而钱花在抓第三方页面和摘要的 input token 上，
放在后面截断等于白截。按发布时间取最新的 N 篇（打分之前没有别的排序依据）。

**别和已删除的 `maxPerDay` 混淆。** 那个是版面配额（一个源能占几张卡），已经删了；
这个是摄入上限（花不花钱）。

实测数据（27 篇的一天）：

```
Hacker News          13 篇  112,195 字符  53%   ← 它一个源占一半
Not Boring            1 篇   20,000 字符   9%
其余 7 个源           13 篇   80,883 字符  38%
```

HN 占大头是因为它指向任意第三方站点，每篇都按 `BODY_CHAR_LIMIT` 上限抓。

**但限制篇数省不了多少**，因为主因是长度不是数量：

```
限制前                85,231 input tokens   全年 $5.40
HN 限 10 篇            81,839                全年 $5.11
```

真正的杠杆是给 HN 单独降 `BODY_CHAR_LIMIT`，但那是拿摘要质量换每年 0.5 美元 ——
一篇 2 万字的长文只看前 8000 字，判断会失真，而把这个值从 6000 提到 20000
正是为了修那个问题。**所以正文预算保持 20000。**

## 版面：所有文章都发布，只分卡片和行

**没有折叠，没有源配额。** 只有两个东西决定版面：模型给的**分类**和**分数**。

每个分类内按分数排序：

- **前 `cardCount` 篇（默认 3）→ 完整卡片**：封面、中英摘要、要点
- **其余 → 一行**：来源 + 标题 + 阅读时长，可点击

抓到的文章一篇都不会消失。早先的版本会把超出配额的丢进底部一个「其余更新」栏，
现在它们就待在自己的分类里，只是不占卡片的篇幅。

**`minScore`（默认 40）现在只决定卡片资格，不决定是否出现。** 分数不够的文章排名再靠前
也只拿一行 —— 否则某天某栏只有一篇 20 分的链接汇总贴，它就会独占一张大卡片。

源配额（原来 HN 3、Marginal Revolution 2）**已全部删除**。当时加它是因为纯按分数排序时
HN 靠数量霸榜；现在分类本身就限制了每栏的卡片数，高产源最多在自己那栏占 3 张卡，
其余自动降为行。

`Digest.folded` 字段保留但永远为空 —— 归档里的旧 digest 仍带着数据，页面照常渲染它们。

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

### 用 JSON mode，不用 tool call

请求带 `response_format: {"type":"json_object"}`，模型的回复走 `content` 字段。

**换掉 tool call 是因为 DeepSeek 的 tool-call `arguments` 会返回非法 JSON** ——
实测约每 5 次坏 1 次，而且坏法有四种，全是括号层面的：

```
丢闭合花括号   …"zh_points": ["…"], {"index": 1, …
缺开方括号     "zh_points": "A", "B"]
闭合符类型错   "zh_points": ["…", "…"}]}
未转义双引号   "zh_thesis": "他说"你好"世界"
```

这些不像模型生成正文时会犯的错，更像序列化/分片拼装的问题，而且上游有未关闭的
同类 issue。走 `content` 绕开了那条路径。

JSON mode 有自己的要求，三条都满足了：prompt 里必须出现 "json"、必须给格式样例、
`max_tokens` 要够大以免截断。官方还提示**可能返回空 content**，所以 `extractRows()`
会显式检查并报错。

**代价**：分类的 `enum` 强制没有了 —— tool schema 能约束取值，prompt 文字不能。
所以分类边界、打分标准、字数限制全部移进了 system prompt，`resolveCategory()` 兜底把
未知值归到 fallback 分类。实测 28 篇无效分类 0 个。

曾经有一层约 130 行的抢救代码，按 `{"index"` 切分再逐个补齐括号，能从坏 JSON 里救回
大部分文章。**切到 JSON mode 后删掉了** —— 那是为 tool-call 的坏法写的。风险是坏一次
就整批退化成纯标题；`logParseFailure()` 保留着，出错时打印出错位置前后 120 字符，
那是判断新坏法的唯一线索。

## 环境变量

本地写进 `.env`（见 `.env.example`）；生产由 Coolify 经 docker-compose 注入。

| 变量 | 必需 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | 不填则跳过摘要，页面只剩标题列表 |
| `GIT_TOKEN` | 容器需要 | fine-grained PAT，只授目标仓库的 `contents:write`。本机有 SSH key 时不需要 |
| `GIT_REMOTE` | 否 | 覆盖远端 URL。不设时按上面的三条规则推导 |
| `BARK_URL` | 否 | 形如 `https://api.day.app/<key>`，不填则不推送 |
| `GIT_REPO` | 否 | 默认 `imnaifu/files` |
| `DAILY_CRON` | 否 | 默认 `0 7 * * *`，生成当日 digest |
| `DAILY_SYNC_CRON` | 否 | 默认 `*/15 * * * *`，只拉取不生成 |
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

配置一次，之后命令行不用再带任何变量：

```bash
cp .env.example .env      # 填入 DEEPSEEK_API_KEY
```

`.env` 已被 gitignore（`git add` 会直接拒绝它），`npm run once` 和 `npm run dev`
都会自动加载 —— 密钥不必出现在命令行，也就不会进 shell history。

```bash
npm run once      # 抓取 + 摘要 + commit + push
npm run dev       # 起网站，读上面那次跑出来的数据
```

想只跑不推，在 `.env` 里加 `DRY_RUN=1`（或临时 `DRY_RUN=1 npm run once`）。

**远端地址是推导出来的，不用配**：

1. 设了 `GIT_REMOTE` → 原样使用
2. 否则设了 `GIT_TOKEN` → HTTPS + token（**容器走这条**，它没有 SSH key）
3. 否则 → `git@github.com:<GIT_REPO>.git`，用你本机已加载的 SSH key

顺序不是随意的：直接把 SSH 设成默认值会更简单，但会让每次部署都挂。

push 失败不致命 —— 内容已 commit 在本地，下次运行走 rebase 而非 hard reset，
会被一并带上去。认证类错误（`Repository not found`、`Permission denied` 等）
不会重试，2 秒内失败，而不是白等 65 秒退避。

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
