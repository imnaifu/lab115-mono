# 埋点

这个站的分析只有 GA4 的 pageview 时，最重的两块代码是完全没有度量的：`ShareSheet`
和 poster 布局加起来一千三百多行，而分享的任何一个结果都没有数 —— 包括「哪几个平台
tile 值得占那一行」这种直接影响版面的决定。反过来，读者真正的离开动作也一样：这个
digest 存在的意义是让人**多数时候不必**打开原文，而这个赌注赢没赢，之前无从知道。

**没有引入任何第三方 SDK。** 全部走 `Analytics.tsx` 已经加载的那个 `gtag`，bundle
只多了一个函数。

## 两条路径，各有各的理由

### `data-track` 属性 + 一个委托监听

`ClickTracking.tsx` 在 `document` 上挂**一个** `click`（capture 阶段），从
`event.target.closest("[data-track]")` 读事件名，`data-track-*` 读参数。

**因为值得数的链接几乎都在服务端组件里** —— 「阅读全文」在 `ArticleCards`，归档行在
页面里，语言切换在 `Shell`。带事件处理器的组件必须是客户端组件，给 `ArticleCards` 加
一个 `onClick` 就会把 `Summary`、`Cover`、`ArticleTitle` 整棵子树一起拖过边界，而那个
handler 只做一件事：计数。README 把「`DigestBody` 是唯一的客户端组件」当成一条值得守
的性质，这条路径守住了它：服务端组件只加**属性**，那就只是 markup。

顺带覆盖了中键和 ⌘ 点击 —— 那些同样是「打开了原文」，只是开在另一个标签页。右键菜单
到不了这里，因为 `click` 本来就只对左键和中键触发。

**不 `preventDefault`。** 它只观察。导航先于 beacon 发出没关系（`gtag` 是异步 POST，
GA 自己的传输层处理 unload），而为了一个指标去延迟读者的点击是本末倒置。

### 客户端组件直接调 `track()`

`ShareButton`、`ShareSheet`、`DigestBody` 已经在边界另一侧，而且它们带的数据是属性
给不了的：poster 等了多少毫秒、系统面板到底有没有带上文件、是第几张预览失败的。

## 事件

| 事件 | 参数 | 回答什么 | 在哪 |
|---|---|---|---|
| `read_original` | `source` `from`=`list`\|`article` | **反向指标**，见下 | `ArticleCards.tsx`、文章页 |
| `share_open` | `parts` | 按了分享，在图片就绪之前 | `ShareButton.tsx` |
| `share_ready` | `ms` `timed_out` `parts` | **loading 让读者等了多久** | `ShareButton.tsx` |
| `share_target` | `target` | 选了哪个目的地 | `ShareSheet.tsx` |
| `share_result` | `outcome` `files` `parts` `waited` | 系统面板最后怎么收场 | `ShareSheet.tsx` |
| `copy_link` | — | 复制链接（写入成功之后才发） | `ShareButton.tsx` |
| `save_image` | `parts` `shape`=`set`\|`single` | 存图 | `ShareSheet.tsx` |
| `poster_failed` | `part` `parts` | 一张预览重试后仍然失败 | `ShareSheet.tsx` |
| `summary_open` | `source`、`from`=`list`\|`home`\|`topic`\|`topic_hub`\|`related`、`age` | 打开某一篇的概要 —— 站内「留下来」的那一侧，和同一行上的 `read_original` 对读。`from` 分开几个入口：当天的卡片列表、首页那条最新文章、话题页的行、话题总入口卡片里那两条最近更新、文章页底下的「你可能还想读」。`age` 是这一行在列表里的深度 | `ArticleCards.tsx`、首页、`TopicView.tsx`、`TopicHub.tsx`、`RelatedArticles.tsx` |
| `lang_switch` | `to` | 语言切换 | `Shell.tsx` |
| `day_open` | `from`=`archive`\|`article`、`age` | 打开某一天 | archive 页、文章页 |
| `topic_open` | `topic`、`from`=`homepage`\|`article`\|`archive`\|`topic_hub`\|`topic_page`\|`pager`\|`header`、`lang` | 打开某个话题。**反向指标，和 `source_open` 一个读法**：话题页是给搜索做的落地页，站内点击少而 `/topic*` 的自然流量在涨，就是它按设计工作。三个参数各回答一件事 —— `topic` 说哪个领域真的有人要（GA4 里可以直接按它拆），`from` 说哪个入口在起作用（首页那行 chips？还是读完一篇之后？），`lang` 说中英两侧的读者是不是同一种行为。**`from=article` 额外回答一件事**：读完一篇之后，读者想不想要同一话题的下一篇 —— 这和「你可能还想读」是同一个问题的两个方向。`data-track-topic` 在通往 `/topic` 本身的那两个入口上**故意缺席**（顶栏的「探索话题」、chips 行末尾的「更多」）：它们背后没有某一个话题，硬填 `all` 会造出一个别的 chip 从不发送的值 | 文章页、`ArticleCards.tsx`、`TopicChips.tsx`、`TopicHub.tsx`、`TopicView.tsx`、`SiteHeader.tsx` |
| `source_open` | `from`=`sources`、`age` | 打开某个来源页。**订阅源整块目前是隐藏的**（见 `lib/sources.ts` 的 `SOURCE_PAGES_LIVE`）——`/s` 与 `/s/<id>` 都 404，顶栏和首页的两个入口已移除，所以这个事件当下不会有任何量。恢复后它仍是用来看它「没被本站读者用」的：来源页是给搜索和 AI 做的落地页，站内点击接近零而自然流量在涨，就是它按设计工作 | `SourcesView.tsx`（当前不可达） |
| `install_open` | `platform` `can_prompt` | 按了「存成 App」 | `InstallApp.tsx` |
| `install_prompt` | `outcome`=`accepted`\|`dismissed`\|`failed`、`platform` | 浏览器自己那个安装弹窗的结局 | `InstallApp.tsx` |
| `pull_refresh` | — | **下拉刷新真的被用了多少** | `PullToRefresh.tsx` |
| `back_to_top` | — | 回顶按钮被按了多少 —— 页面是不是真的长到读者想要这趟回程。**一直接近零就说明它是家具，可以去掉** | `BackToTop.tsx` |
| `mail_subscribe` | `outcome`=`ok`\|`email`\|`rate`\|`error`、`lang` | 提交了订阅表单。**不等于订阅成功** —— 双向确认还要读者去点邮件里的链接，这个数和 Resend 里的联系人数之差，就是确认这一步的成本 | `Subscribe.tsx` |

> **三个事件从表里删掉了，不是漏写**：`all_days_open`、`archive_open`、`home_open`，
> 以及只在本文出现过、从未进过代码联合的 `today_open`。它们各自命名的那个链接都已经
> 不存在了 —— 日页末尾通往归档的那一块、首页的「更多」加归档旧的数字分页器、归档末尾
> 回首页的那一块、归档里的「今天」。留着它们比留一段死代码更坏：一个没有发送方的事件
> 在 GA4 报表里读作「计数为零」，也就是「没人按」，而事实是「没有东西在发」。见
> `lib/track.ts` 里同一处的注释。
>
> 顶栏的「今天」现在通向 `/today`（重定向到当天那一期），它**不发事件**。要量它的话，
> 诚实的做法是 `day_open` 加一个新的 `from=header`，而那是对埋点契约的改动 —— 见
> `SiteHeader.tsx` 里那段说明。

### 首页在 `summary_open` 里叫 `home`，在 `topic_open` 里叫 `homepage`

知道，不改。`summary_open` 的 `from=home` 已经在跑、GA 里有历史数据，改名会把一条指标
从中间劈成两段；`topic_open` 是新的，取值按这一轮定下来的那一组（`homepage` /
`article` / `archive` / `topic_hub` / `topic_page`）写。两边各自内部是自洽的，跨事件对
比「首页贡献了多少」时记得它有两个拼法 —— 这条注释存在的唯一目的，就是让下一个人看到
这个不一致时知道它是被看见过的，而不是顺手「修」掉其中一个。

事件名在 `lib/track.ts` 里是一个**联合类型**，不是 `string`。GA4 会照单全收任何事件名，
`shre_open` 会被永久归档成一个独立事件，报表上只表现为少了一部分点击 —— 这种错只有
编译器能挡住。

## 几个刻意的决定

**`install_open` 带 `can_prompt`，因为它分成两种完全不同的点击。** `true` 是浏览器给了
`beforeinstallprompt`（Chrome / Edge），面板里有一个「现在安装」按钮，一下就装完；`false`
是 Safari 这类什么都不给的，面板里只有分步说明。两者混在一个数里的话，「有多少人真的装
上了」这个问题就没法答了 —— `can_prompt` 为 `true` 而后面没有跟着 `install_prompt`，说明
读者看了说明然后把面板关掉了。

**`platform` 就是 `lib/install.ts` 里那个 `GuideKey`**（`ios-safari`、`android-chromium`
…），不是自由拼出来的字符串。它同时是分支表的键：报表上哪个平台的安装最多，直接对应到
要去校对哪一段步骤说明。UA 嗅探会猜错，而猜错只会印出错的步骤、不会报错，所以这个维度
是唯一能发现「某个平台的文案一直是错的」的东西。

**`pull_refresh` 是「这个站被当成 App 在用吗」的唯一指标。** 会下拉的人，是回到了同一个
窗口而不是重开一个标签页 —— 装没装 GA 的 `display-mode` 维度都看不出这件事。它不带参数：
数量本身就是答案。

**`read_original` 是反向指标。** 这个 digest 存在就是为了让读者多数时候不用点它，所以
它不是成功数，是摘要被拿去比对的那个数，按 `source` 分。**不要把它标成 GA 的 key
event** —— 那会让报表把「读者跑去看原文」当成转化来庆祝。

**`from` 区分列表页和单篇页。** 在单篇页按下这个 pill 的读者是从分享或搜索来的，和在
列表里往下滚的读者不是同一种人。

**语言切换只数会真正改变语言的那一半。** 当前语言那半也是个 `<a>`（理由见
`LangSwitch` 的注释），但按它什么都不会发生，数进去会灌水 —— 而这个事件唯一想回答的
问题就是「到底有没有人用这个切换器」。

**`poster_failed` 只在第二次失败时发。** 第一次会重试而且通常成功，数它等于把一次普通
的丢包变成警报。而且它是在 state updater **之外**读 `attempts` 的：updater 必须是纯
函数，在里面发 beacon 在 StrictMode 下会发两次。

**`copy_link` 在写入之后发。** 剪贴板在 http 下会抛，那时什么都没复制成 —— 数尝试就
等于把一次失败记成一次分享。

**`share_result` 的四种 outcome 是在夹逼一个不可观测的东西。** 这个函数整个是围绕一个
不确定性建起来的：`navigator.canShare({files})` 对一个真实的 PNG 返回 true，然后分享
到达时图片不在。**没有任何 API 会报告这件事**，现在也依然没有。能数的是它周围的一切
—— `files` 是面板打开时手里握着几个 File，`waited` 是读者按下时 fetch 还在跑（这种
情况下降级成纯链接不是平台的错）—— 合起来就把问题夹住了。

**`category_tab` 会验证 README 的一个断言。** 「『全部』实际上没人会用」这句话从来
没被测过，`tab=all` 的占比就是答案。

## GA4 里要注册什么

事件不用注册，`Realtime` 和 `Events` 报表直接就有。**但参数不注册就查不到** ——
事件收到了，参数在报表里根本不存在。

**Admin → Data display → Custom definitions**

Custom dimensions，全部 Scope = Event：

```
source  from  target  outcome  parts  files  timed_out  tab  to  shape  age
```

Custom metric，Scope = Event、Unit = Standard：

```
ms
```

**`ms` 必须是 metric 而不是 dimension**，否则只能看到「87ms 出现过 3 次」这种计数，
取不了平均值和分位数 —— 而「读者到底等了多久」正是加这个埋点唯一想知道的新数字。

三件要知道的：

- **不回填。** 自定义维度只对注册之后收到的数据生效。注册之前收到的事件里那些参数
  **永久**查不到，没有补救办法。
- **`part` 和 `parts` 是两个参数。** `poster_failed` 带 `part`（单数，第几张失败），
  其他事件带 `parts`（复数，一共几张）。上面**没有**注册 `part` —— 它只在诊断时有用，
  而 `poster_failed` 的事件数本身就够说明问题。
- **配额**：事件级维度上限 50，用了 11；metric 上限 50，用了 1。

`GA_ID` 硬编码在 `Analytics.tsx` 里，它不是密钥（随脚本 URL 发到每个浏览器）。
`NODE_ENV !== "production"` 时 `Analytics` 返回 null，所以本地跑不会污染报表 ——
`track()` 这时退化成 `console.debug`，不接 GA 也能验证事件。

## 加一个新事件

1. 在 `lib/track.ts` 的 `TrackEvent` 联合类型里加名字（不加就编译不过）。
2. 服务端组件：加 `data-track="名字"` 和需要的 `data-track-*`。
   客户端组件：`track("名字", { ... })`。
3. 新参数要去 GA 注册，否则查不到。
4. 参数名转换规则：`data-track-source` → `source`，`data-track-someThing` →
   `some_thing`。全部以字符串到达 —— 需要数字的从客户端组件直接调 `track()`，不要
   绕一趟属性。

## 怎么验证

`track()` 只在 `window.gtag` 存在时才走真实路径，所以在浏览器控制台里装一个假的就能
看到完整 payload，而且走的是**生产那条路径**、不是 dev 的 console 兜底：

```js
window.__events = [];
window.gtag = (cmd, name, params) => window.__events.push({ name, params });
// 点几下，然后：
JSON.stringify(window.__events, null, 1);
```

要看 GA 自己收到了什么就用 DebugView，但它需要 debug 模式，而 `Analytics.tsx` 既没开
`debug_mode` 也不在本地跑 —— 装 Chrome 的 *Google Analytics Debugger* 扩展开生产站，
或者临时给 `gtag('config')` 加一个 `debug_mode: true`。

Realtime 报表几秒内可见；标准报表 24–48 小时。

## 刻意没埋的

- **滚动深度和阅读时长。** 那是另一类埋点（需要 IntersectionObserver 和计时器，而且
  会在每个读者身上持续发事件），要不要加是独立的一笔账。
- **`article_open` 不存在，因为那个链接不存在。** 卡片上没有任何通往单篇页的链接 ——
  `/d/<date>/<id>` 只能从分享链接、搜索和 sitemap 进。所以关于一张卡片，站内唯一的
  信号就是 `read_original` 和那几个分享事件。这是产品事实，不是漏埋。
- **任何个人数据。** 没有新增采集，GA 本来就在跑，这次只是多了几个事件。
