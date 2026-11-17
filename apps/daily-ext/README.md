# apps/daily-ext — 每日严选 Chrome 扩展

把 [daily.lab115.com](https://daily.lab115.com) 的每日严选放进 Chrome 的**侧边栏**：点工具栏图标，
右侧打开侧边栏，显示**最新一期**的列表，每张卡片是栏目、来源、标题和完整的一句话概要，点卡片在新标签页
打开 daily 上这篇的页面，侧边栏留在原处；出了新一期，图标上显示篇数。侧边栏里没有详情页、没有翻日期，
看全文和往期都去网站（列表滚到底有一行「已经到底了 · 更多在 daily.lab115.com」，域名是链接）。
没有弹窗，也没有接管新标签页。

侧边栏可能一开一整天，所以它跟着 `chrome.storage` 走：后台每 30 分钟拉到的新一期直接换上；侧边栏
开着时后台不在图标上显示篇数，直接记为已读（`chrome.runtime.getContexts` 看有没有打开的侧边栏）。
Chrome 自己在侧边栏上方画图标、名称、固定和关闭按钮，所以页面里不再放品牌栏，日期和中英开关
是列表的第一行。

Manifest V3 + React + TypeScript + Vite，最低 Chrome 116（点图标开侧边栏的 `setPanelBehavior` 从这版开始）。
权限只有 `storage`、`alarms`、`sidePanel` 和 `https://daily.lab115.com/*`。不收集任何数据，没有统计。

## 数据从哪来

**只读站点公开的 Atom feed**：`/feed.xml`（中文）和 `/en/feed.xml`（英文）。digest 的 JSON 在私有
仓库里取不到，站点也没有 JSON 接口；feed 带整篇概要、近 7 天、边缘缓存 30 分钟。

feed 是 `apps/daily/src/lib/feed.ts` 生成的，扩展依赖它的几处格式（entry `<id>` 里的日期路径、
排序、`<category>`、正文第一个 `<p>` 是论点、最后一个 `<p>` 是原文链接 + 来源名）。那边的
文件头注释和 daily README「站点自己的 feed」都写了这条依赖。**改了那边的格式，这里的
`src/shared/feed.ts` 和 `src/sidepanel/take.ts` 要一起改**，而且已安装的扩展要等商店发了新版才会换。

feed 里没有配图、每日照片和阅读时长，所以侧边栏里也没有。feed 带近 7 天，侧边栏只用最新的一天。

## 结构

```
src/shared/feed.ts        解析 feed（字符串匹配，因为 service worker 里没有 DOMParser）
src/shared/store.ts       chrome.storage.local 里存的全部东西 + 角标逻辑
src/shared/categories.ts  八个栏目的颜色（从 daily 的 config.json 抄的）
src/background/           点图标开侧边栏；每 30 分钟拉一次 feed，有新一期就在图标上显示篇数
src/sidepanel/            侧边栏：最新一期的列表 + 中英开关；take.ts 用 DOMParser 取出论点和来源名
test/                     feed 解析测试，fixtures 是 2026-11-13 的线上快照
branding/                 商店图：capture.mjs 截真实侧边栏页面（文章文字换成灰色占位条）→ index.html 合成 → render.sh 出图
STORE.md                  商店后台要手填的描述、权限理由、数据使用声明
```

隐私政策在 daily 站上：`/extension`（`apps/daily/src/app/[lang]/extension/page.tsx`，文案在
`lib/i18n.ts` 的 `ext*`）。**扩展的权限、存储的键、网络请求一变，那页要跟着改** ——
`store.ts` 开头的清单就是那页「保存在你电脑上的」那一段的依据。

## 开发

```bash
npm install
```

```bash
npm run dev
```

在 `chrome://extensions` 打开开发者模式，「加载已解压的扩展程序」选 `dist/`。改完代码在扩展卡片上点刷新。

## 测试

```bash
npm run typecheck && npm test
```

`npm test` 用 Node 自带的测试运行器跑 feed 解析（不需要浏览器）。侧边栏的端到端检查（安装后角标、
列表、各种宽度下的排版、后台拉到新一期时自动换上、中英开关、卡片链接、离线回退）目前是手动或用
Playwright 加载 `dist/`、把 `sidepanel.html` 当普通页面打开跑的，没有固化成脚本。无头浏览器打不开真正的
侧边栏，所以「点图标滑出侧边栏」和「侧边栏开着时不显示角标」只能在真 Chrome 里试。

## 图标

```bash
npm run icons
```

从 `apps/daily/public/mark.svg` 生成 `icons/icon{16,32,48,128}.png` 和商店图里用的 `branding/mark.svg`。
128 按商店规范是 96px 图案加 16px 透明边。站点的 mark 改了要重跑。

## 发布

```bash
npm run package
```

生成 `daily-picks-v<version>.zip`（版本号取自 `manifest.json`）。第一次上架要在开发者后台手动
新建条目、上传 zip、按 `STORE.md` 填表；之后可以照 RedNote Exporter 的方式用商店 API 上传。
隐私政策页要先在 daily 上线，商店审核会打开它。
