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
git pull ──→ 当天已有就退出 ──→ 拉全部源，筛出过去 24h 的文章 ──→ 按 URL 去重
  ↓
取正文（RSS 全文 / 抓原文页）
  ↓
每篇两次 LLM 调用：① 中文摘要 + 分类 + 打分  ② 由中文改写英文
  ↓
按分类排序，前 3 张卡 + 其余成行 ──→ 写 JSON ──→ git commit & push ──→ Bark
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
| Heavybit Library | `heavybit.com/library/**blog**/feed` | ~2.7 篇/月 | 全文 7k~17k |
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
| Not Boring | `notboring.co/feed` | ~1.7 篇/周 | 全文，中位 14k |
| Noahpinion | `noahpinion.blog/feed` | ~4 篇/周 | 全文，中位 18k |
| Lenny's Newsletter | `lennysnewsletter.com/feed` | ~6.4 篇/周 | 全文，中位 3.5k；3/20 是付费预览 |
| Slow Boring | `slowboring.com/feed` | ~2.1 篇/天 | **一半是付费预览**，中位 2k |
| 阮一峰的网络日志 | `ruanyifeng.com/blog/atom.xml` | ~1.5 篇/周 | 全文 5k~6.5k |

几个需要知道的：

- **Hacker News 走 hnrss.org 而不是官方 `/rss`**，因为只有第三方服务能按分数过滤，
  而没过滤的首页在这堆博客旁边基本是噪声。它的条目指向任意第三方站点，正文靠抓那些
  页面 —— 付费墙、纯 JS 页、PDF 都可能抓不到，这时正文为空，模型只看标题。
- **Heavybit 订的是 `/library/blog/feed`，不是 `/library/feed`。** 全站 feed 里 1449 条
  有 771 条是播客单集（53%），只带 ~500 字符 show notes，摘出来的必然是空话。栏目 feed
  415 条、播客 0 条、正文 7k~17k。代价是频率从 3.4 天/篇降到 11 天/篇 —— 少的正是那些
  没有文字内容的条目。
- **Uncharted Territories 的 "Dispatch" 系列是付费内容**，feed 只给 ~400 字符预览，
  抓原文页拿到的还是预览。**Slow Boring 有一半条目同样是付费预览**，Lenny's 约 3/20。
  这类源留着仍有价值（免费文是全文），但预期里就该有一部分只能凭标题和导语摘要。
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

目前 AI · 技术 · 商业 · 投资 · 人文，每类 `cardCount: 3`（超出的不消失，降为一行）。

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

## 交互

- **中英是页面级切换，不是逐句对照。** 早先两种语言逐句交错排，在摘要还是一句话时读着
  没问题；改成散文后一张卡片要 150~300 字，两种语言同屏就是一面上千字符的墙。现在读者
  在页头选语言，一次只看一种。

- **分类 tab 默认停在「第一个有卡片的分类」，不是「全部」。** 不用「全部」是因为散文摘要
  太长，整页平铺读不完。不用「第一个分类」是实测踩出来的：某天 AI 栏全是版本发布，
  分数集体低于卡片门槛，页面一打开就是一列光秃秃的链接 —— 所以要找的是第一个真正有卡片
  的分类（`DigestBody.tsx`）。「全部」仍在，留给需要一张图截完的场合。

- 头条**不进 tab**，它领的是整期而不是某一栏。

`DigestBody` 是唯一的客户端组件（语言和分类是同一份 `useState`），其余全是服务端渲染。

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

（`FoldedArticle.score` 这个字段还在，但折叠功能已经删了，`folded` 永远是空数组 ——
它只为让归档里的旧 digest 仍能渲染。）

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

## 摘要写成段落，不是要点列表

每篇产出 **一句话论点 + 2~3 段散文**，总长由 `config.json` 的
`summaryMinChars` / `summaryMaxChars` 控制（当前 120~300），每段上限是总长的 1/2.5。
标准是**读完不用再打开原文**。

早先的结构是 `background / thesis / points[] / implication`，结果**字段的形状决定了
文字的形状**：`points` 是数组，模型就把每条压成一个孤立短句，卡片读起来像电报 ——
六条断言彼此没有承接。改成段落后模型必须把事实互相关联，那正是「可读」和「完整」的
差别。

prompt 里把这一点写成了最重的一条约束，并给了正反例：写「OPT 扩展使本土高技能就业
增长 0.5%、工资增长 1%，说明高技能移民并未挤出本地人」，而不是「高技能移民促进本土
就业。」。同时反复强调**不能丢数字和案例** —— 没有证据的散文只是含糊。

`SummaryText` 里 `background` / `points` / `implication` 三个字段保留但已废弃，
只为让归档中的旧 digest 仍能渲染。

### 一次请求一篇文章

`BATCH_SIZE = 1`，从最初的 8 一路降下来的。

见过的所有畸形 JSON 都是**长回复里的结构性失误**：数组用 `}` 闭合、wrapper 在第一条
之后就关掉、少一个括号、写到一半被截断。它们随「模型要同时维持多少 JSON」增长，
按坏法逐个打补丁是输的 —— 补到第七种还在出新的。一篇文章的回复只有 ~300 字符、
一层嵌套，那是**另一个可靠性区间**，不是同一件事的小号版本。

代价是延迟和 system prompt 每篇重发一次，分别由 `REQUEST_CONCURRENCY`（默认 8，
`DAILY_CONCURRENCY` 可调）和 DeepSeek 的缓存命中价（$0.0028/M 对 $0.14/M）抵掉。
现在坏一次只损失一篇。

另外两个实测撞到的坑：

- **撞 `max_tokens` 被截断。** 上限 16000 是摘要还只有 45 字时定的；散文一批就写到
  30000 字符，截断后是非法 JSON，整批全灭。已提到 48000（模型支持 384k，这里不再是
  稀缺资源）。
- **静默少给。** 给 6 篇只返回 5 篇，**不报错**，JSON 完全合法只是短。所以每轮之后会
  检查哪些文章没有 thesis，**只针对缺口重新要一次**（`GAP_RETRIES = 2`）。

**SDK 超时必须压住**：`timeout: 60_000` + `maxRetries: 1`。原来是 180 秒 × 2 次重试，
一个卡住的请求能占着一个并发位 9 分钟 —— 实测整轮耗时在 28 秒和 10 分钟之间跳，
就是这个原因。

### 两轮调用，不是一轮

① 中文摘要 + 分类 + 打分 → ② 拿中文改写英文。

合成一轮试过，结果是**中文 10/10、英文 0/10**：模型把每个对象的前四个字段填完就停了。
拆开之后每次回复都小到能写完，而且英文那轮不需要正文（它是从中文改写的），几乎不花钱。

### 改 prompt 之前先读这一节

`ZH_SYSTEM` 看起来啰嗦、重复、可以压缩。**那些重复是承重的。** 每一条都是某次故障留下的，
压掉就会把故障放回来。曾经把它从 4622 字符压到 2578，A/B 立刻显示：

| | 压缩前 | 压缩后 |
|---|---|---|
| 段落超字数 | 1/35 | **14/38** |
| 条目超上限 | 5/14 | 9/14 |
| 打分均值 | 52 | 61（明显变松） |

三处删掉的东西各自对应一个具体后果：

- **每段字数限制原本说两遍**（字段说明里一次、长度块里一次），还带
  `Not "about" — at most`。合并成一句流畅的话，模型就不当回事了。
- **「能被复述成『X 发生了』就是新闻」是可操作的判据**，不是修辞。删掉后打分普涨 9 分。
- **一个冒号的位置能决定输出长度。** 字段说明写成
  `2 or 3 paragraphs, each AT MOST 120 characters: the context, the evidence, what follows`
  时，冒号后三个并列项被读成「三段各写一项」，每篇段落数从 2.4 涨到 2.7 —— 而
  3 段 × 120 字上限 = 360，本来就超 300。改回 `Together they carry…` 立刻回到 2.5。

现在的版本是 3164 字符（发出去 1445 tokens，比原来省 17%），各项指标与原版持平、
段落合规更好。**方法比结论重要**：单轮 A/B 不可信 —— 同一份 prompt 连跑 6 轮，
「超上限篇数」在 2~5 之间飘、均分在 52~59 之间飘。要 n≥2 稳定复现才算数。
`scripts/` 里没留这个 A/B 脚本，重做时记住一点：**两份 prompt 必须跑同一批文章**。

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
- [JSON Mode](https://api-docs.deepseek.com/guides/json_mode) —— 当前用的输出模式
- [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) —— v4 默认开，这里显式关掉
- [Tool Calls 指南](https://api-docs.deepseek.com/guides/tool_calls) —— 已弃用，见下节
- [API Keys 控制台](https://platform.deepseek.com/api_keys) —— 申请 key

**思考模式要显式关掉。** v4 系列默认以 `high` effort 跑 thinking，而这个任务只做抽取和
打分，不需要思维链，thinking token 还按 output 计费 —— 白花钱和延迟。请求里带
`thinking: {type: "disabled"}`，且**只发给 DeepSeek**（这是它特有的参数，
`isDeepSeek()` 判断 host）。早期没关时报过
`400 Thinking mode does not support this tool_choice`。

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
未知值归到 fallback 分类。

无效分类是**低频但真实**的：一次 prompt 压缩里删掉了
`Never invent a value outside the list.` 这句，A/B 立刻出现 1/14 的编造值；加回去之后
连续 4 轮 56 篇全部合法。所以那句不是废话，`resolveCategory()` 的兜底也不是摆设。

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
| `DAILY_WINDOW_HOURS` | 否 | 默认 `24` |
| `DAILY_MODEL` | 否 | 默认 `deepseek-v4-flash` |
| `DAILY_CONCURRENCY` | 否 | 默认 `8`，同时在飞的模型请求数 |
| `DAILY_BODY_CHARS` | 否 | 默认 `20000`，单篇正文喂给模型的上限 |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com` |
| `DAILY_DATA_DIR` | 否 | 默认 `/data`，clone 落在它下面的 `repo/` |
| `GIT_BRANCH` | 否 | 默认 `main` |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | 否 | commit 署名 |
| `DRY_RUN` | 否 | `=1` 时跑完整流程但不 push、不推送 |

`DAILY_TOP_N` 仍被 `config.ts` 读成 `TOP_N`，但**没有任何地方消费它** —— 折叠功能删掉时
漏了它，是个死变量，别照着它配。

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
