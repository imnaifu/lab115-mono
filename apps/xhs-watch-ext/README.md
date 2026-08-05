# xhs-watch-ext

Chrome 扩展（MV3）：定时抓小红书某个搜索结果的**最新**笔记 → 和本地记录对比 → 有新的就
桌面通知 + Bark 推手机。

不是 Next.js 应用，也不部署到服务器 —— 装在你自己的 Chrome 里，用你自己的登录态。

```
chrome.alarms ─▶ 后台标签页 ─▶ injected.js ─▶ content.js ─▶ worker.js ─▶ 通知
 (间隔可配)      (active:false)  (hook XHR)     (等结果/点最新)  (两层去重)   桌面 + Bark
                     │                                            │
              页面自己发签名请求                          chrome.storage.local
```

| 文件 | 职责 |
|---|---|
| `src/background/worker.ts` | 调度、开关标签页、去重、退避、状态机 |
| `src/background/notify.ts` | 桌面通知（含封面大图）+ Bark 推送 |
| `src/content/injected.ts` | 页面上下文 hook XHR / fetch，按批次存搜索响应 |
| `src/content/content.ts` | 等首屏结果、展开筛选面板选「最新」/「一天内」、稳定后上报 |
| `src/shared/normalize.ts` | 原始 JSON → `Note`（全字段容错） |
| `src/shared/store.ts` | `chrome.storage.local` 读写，已见记录 FIFO 封顶 |
| `popup.html` + `src/popup/` | 状态、监控列表、设置、最近抓到、运行日志 |

## 装上去

```bash
cd apps/xhs-watch-ext && npm install && npm run build
```

打开 `chrome://extensions` → 右上角开「开发者模式」→「加载已解压的扩展程序」→ 选
`apps/xhs-watch-ext/dist`。

前提：**这个 Chrome profile 得已经登录小红书**。插件用的就是你浏览器里的登录态，
不需要单独配 cookie，也不需要扫码。

改代码时 `npm run dev` 会 watch 重建，改完在扩展页点一次刷新图标即可。

## 为什么这么设计

**用浏览器而不是直接发 HTTP**：搜索接口需要 `x-s` / `x-t` 签名，由页面里混淆过的 JS
生成。让真实页面自己发请求、我们只**监听 response**，就永远不用逆向也不用跟版。这也是
`apps/xhs-watcher` 里用 Playwright 的同一个理由 —— 只不过在扩展里，那个"真实浏览器"
就是你正在用的这个。

**拦 XHR 而不是解析 DOM**：拿到的是结构化 JSON，UI 改版不影响。

**按路径通配匹配接口**，而不是写死 `/api/sns/web/v2/search/notes`：普通搜索页、AI 搜索页
（`search_result_ai`）走的接口路径不一样。只要是小红书域下、路径含 `/search/`、响应里有
`data.items`，就收 —— 换个搜索页面或者接口升个版都不会突然抓不到。

**存 `chrome.storage.local` 而不是 `localStorage`**：定时任务必须跑在 service worker 里，
而 service worker 没有 `localStorage`。`chrome.storage.local` 是等价物，同样持久化、
浏览器重启不丢，而且 popup 和 worker 读的是同一份。

**一轮的进度存 `chrome.storage.session`，不放内存变量**：MV3 的 service worker 空闲 30 秒
就被回收，而一轮抓取要几十秒 —— 中途被回收是常态。状态外置之后，worker 被重新拉起也能
正确收尾，不会留下野标签页或永久卡住的 pending。另有一个看门狗 alarm 兜底。

**两层去重**：

1. `note_id` 主键 —— 同一条笔记永远只推一次（`xsec_token` 每次都变，绝不入键）
2. `contentKey = 归一化标题 + author_id` —— 干掉中介 / 搬运号重复发布（每次都是新
   `note_id`，第一层挡不住）。标题为空时退回 `id:<note_id>`，避免一堆无标题笔记撞成同一个键

加上一条发布时间阈值（`只推送 N 天内发布的`）：搜索会混进几个月前的爆款，这些**入库但不
推送**。

**抓到的全部记为已见**，包括因为太旧、点赞太少而没推送的那些 —— 否则它们下一轮又变成
"新"，每轮都重复提醒。

**首轮只建基线**（默认开）：否则第一次就收到 20 条存量笔记。

**排序和发布时间都是 UI 状态，URL 里带不了**，只能点 —— 而且是两步：先展开「筛选」
（`div.filter`）面板，再在「排序依据」里点「最新」、在「发布时间」里点「一天内」。
所以「用当前标签页 URL」这个按钮只能抓到 URL 本身：你在浏览器里选了最新再复制地址，
重新打开还是综合排序。

**面板在桌面宽度下是 hover 展开的，窄视口下才是点击。** `element.click()` 不会产生任何
hover 状态，所以先派发合成的 `mouseover` + `mouseenter`（`mouseenter` 不冒泡，必须直接
派发在目标元素上），1.5 秒内没展开再退回 `click()`。两条路径都实测过。

而且面板是 `v-if` 懒渲染的 —— 收起时 `.filter-panel` 和里面 19 个 `.tags` **根本不在
DOM 里**（实测展开前 `.tags` 数量为 0，展开后 19）。所以没有「绕过展开、直接 click 隐藏
元素」这条捷径，必须真的把它打开。

切换筛选后返回的是另一批结果，所以只取**最后一次**筛选变更之后的批次（前面那些默认排序的、
还没加时间过滤的批次全部丢掉）。

**服务端的「发布时间」过滤比客户端的 `maxAgeDays` 强得多**：前者让返回的 20 条本身就都是
新帖，后者是抓 20 条老爆款回来再扔掉 19 条。两者可以同时开，不冲突。

**点击目标要排除别的扩展注入的透明覆盖层。** 页面上每个 `.tags` 可能有两份：

```
真的：  <div data-v-7323ae50 class="tags"><span>最新</span></div>
克隆：  <div class="tags" data-hp-kind="xhs-filter-tag-最新" aria-hidden="true"
             style="position:absolute; opacity:1e-05; z-index:-1; width:96px; height:40px">
```

带 `data-hp-*` 的那份是另一个扩展复制出来的热区代理。它有真实的盒子尺寸，光看
`getClientRects()` 会误判成可见并点上去 —— 点击落在克隆的子树里，冒泡也到不了 Vue
绑定的真元素，于是「点了但什么都没发生」。所以可见性判断额外看 `aria-hidden` 和计算后的
`opacity`。刻意**不**用 `data-v-7323ae50` 来认真元素：那是 Vue scope id，小红书每次
构建都会变。

**每一步筛选是否生效都写进运行日志。** 静默退化的代价太高：排序没切成「最新」时抓回来的是
综合排序的老爆款，真正的新帖可能根本不在前 20 条里 —— 监控实际已经失效，但每轮看起来都
"成功"。所以 popup 里会明确显示「排序『最新』未生效（找不到「筛选」按钮）」这种话，
日志条目也会标红。

## 电脑休眠怎么办

先说清楚：**电脑真正休眠时整个 Chrome 进程被冻结，插件跑不了**，没有任何办法在休眠中
发请求。所以是三层「尽可能」：

1. **唤醒即补一轮** —— 休眠期间错过的周期性 alarm 会在唤醒时立刻触发一次，几秒内完成
   检查并推送。这个是 `chrome.alarms` 自带行为，不需要额外代码。
2. **可选阻止休眠**（设置里的开关，默认关）—— `chrome.power.requestKeepAwake("system")`
   让系统不睡，屏幕仍可熄灭，轮询真正不中断。代价是耗电，需要长时间盯的时候再开。
3. **Bark 推手机** —— 人不在电脑前时只有这条真的能触达你。但同理，Chrome 被冻结时它也
   发不出去；它解决的是「人离开」，不是「机器休眠」。

## 配置项

都在 popup 里改，即时生效（改完 worker 会重建定时器）。

| 项 | 默认 | 说明 |
|---|---|---|
| 检查间隔 | 10 分钟 | `chrome.alarms` 最短 1 分钟，低于会被 clamp |
| 每轮抓取条数 | 20 | 首屏大约就是 20 条；不下拉翻页 |
| 只推送 N 天内发布的 | 7 | 0 = 不按时间过滤 |
| 首轮只建立基线 | 开 | |
| 桌面通知 | 开 | 一轮最多弹 3 条，多的合并成一条汇总 |
| 阻止系统休眠 | 关 | 见上 |
| Bark 推送地址 | 空 | `https://api.day.app/<你的key>`；留空则不推手机 |
| 监控目标 | 湾区租房 | 名称 / URL / 排序依据 / 发布时间 / 最低赞 / 启用，可加多个 |

每个监控目标各自可配：

| 项 | 默认 | 说明 |
|---|---|---|
| 排序依据 | 最新 | 筛选面板「排序依据」里的文案；留空则不动它 |
| 发布时间 | 一天内 | 筛选面板「发布时间」里的选项（一天内 / 一周内 / 半年内）；「不设置」则不动它 |
| 最低赞 | 0 | 低于此点赞数的新笔记不推送 |

想换关键词最省事的办法：在浏览器里打开你要监控的搜索结果页，然后 popup 里点
**「用当前标签页 URL」** —— 名称会自动从 URL 的 `keyword` 参数取。

Bark 用自建服务器的话，第一次要点一次**「测试推送」**来授权那个域名
（`chrome.permissions.request` 必须在用户手势里调用）。`api.day.app` 已经预授权。

## 已知限制

- 搜索接口**不一定返回发布时间**。拿不到时年龄过滤不生效（宁可多推一条也不漏），
  但靠 `note_id` 去重仍然正确 —— 只是"新"的定义变成"我们没见过"。
- 笔记链接必须带 `xsec_token`，而 token 有时效。所以通知里同时给了封面、标题、作者、
  点赞数，链接失效通知本身仍可读。
- 每轮会在后台开一个标签页几十秒（`active: false`，不抢焦点），抓完自动关。它会在
  标签栏里短暂出现一下 —— 这是让页面自己发签名请求的代价。
- 登录态失效 / 撞上验证码时会收到一条告警通知（6 小时冷却），去浏览器里重新登录即可。
  连续失败 3 次或被判定为拦截会退避 60 分钟，手动「立即检查」不受退避限制。
- 筛选面板的 DOM 结构（`.filter` / `.filter-panel` / `.filters` / `.tags`）是硬依赖，
  小红书改版会让点击失效。改版后不会静默退化：popup 状态栏和日志会明确写出哪一步没生效
  （找不到「筛选」按钮 / 面板没打开 / 面板里没有这个分组 / 找不到该选项），照着改
  `content.ts` 里的选择器即可。
- 同一次筛选变更会让 `/api/sns/web/v2/search/notes` **连发两次**（实测），两次内容相同。
  取「最后一次点击之后的所有批次」再按 note id 去重，所以不受影响。
- 除了 `v2/search/notes`，页面还会打 `search/onebox`、`search/filter`、
  `search/history/sync` 等同样含 `/search/` 的接口。实测只有 `v2/search/notes` 会返回带
  `note_card` 的 `data.items`，其余的通配不到东西，所以宽松匹配不会误收。
- MV3 的通知不接受远程图片 URL，封面是 worker 里 fetch 回来转成 data URL 的 ——
  所以 manifest 要 `https://*.xhscdn.com/*` 权限。取不到时退回没有大图的普通通知。

## 和 apps/xhs-watcher 的关系

同一件事的两种形态，可以只用一个也可以都用：

|  | `xhs-watcher`（服务端） | `xhs-watch-ext`（本插件） |
|---|---|---|
| 跑在哪 | 服务器容器，24×7 | 你的 Chrome，跟着电脑开关机 |
| 登录态 | Playwright profile，需 rsync 上服务器，几周失效一次 | 浏览器现成的，无需维护 |
| 推送 | Resend 邮件 | 桌面通知 + Bark |
| 去重存储 | SQLite | `chrome.storage.local` |
| 适合 | 长期不间断盯 | 随时改关键词、要秒级看到 |

`normalize.ts` 的解析逻辑是从 `xhs-watcher` 移植过来的，两边的字段容错策略保持一致。
