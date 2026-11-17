# Chrome 网上应用店：后台要填的内容

API 改不了描述、截图和隐私表格，这些都要在开发者后台手填。名称和简短描述来自
`_locales/*/messages.json`（随 zip 上传），这里不重复。

提交前：隐私政策页要先在 daily 上线（审核会打开它），用 `curl -s -o /dev/null -w '%{http_code}' https://daily.lab115.com/en/extension` 确认是 200。

## 软件包

- 上传 `daily-picks-v<version>.zip`（`npm run package` 生成）

## 商品详情（Store listing）标签页

- **类别**：新闻和天气（News & Weather）
- **语言**：默认 English，另加 中文（简体）
- **商店图标**：`icons/icon128.png`（128×128，96px 图案 + 16px 透明边，商店规范就是这样）
- **截图**：`branding/out/<zh|en>/01-side-panel.png`、`02-languages.png`（1280×800）
- **小型宣传图块**：`branding/out/<zh|en>/small-tile-440x280.png`
- **顶部宣传图块（1400×560）**：没做，选填
- **宣传视频**：没有，选填
- 两种语言各一套图，分别传到对应语言下。重新生成：`npm run build && node branding/capture.mjs && bash branding/render.sh`
- **官方网址**：不填（要先在 Search Console 验证域名并关联到开发者账号，选填）
- **主页网址**：`https://daily.lab115.com/`
- **支持网址**：`https://daily.lab115.com/en/extension`（页尾写了联系邮箱 help@lab115.com；这一栏只收网址，不收邮箱）
- **成人内容**：否

## 详细描述 — 中文（简体）

```
每天早上，每日严选从几十个优质信息源里抓取过去 24 小时的文章，逐篇打分，只留下最值得读的几篇，并为每一篇写好概要。这个扩展把它放进浏览器的侧边栏。

• 点工具栏图标，右侧打开侧边栏，显示最新一期的严选：每篇一张卡片，有栏目、来源、标题和一句话概要
• 对哪篇感兴趣，点卡片就在新标签页打开它的完整概要，侧边栏留在原处，可以接着往下看
• 出了新一期，图标上显示这一期的篇数，看过就消失；侧边栏一直开着的话，新一期会直接换上
• 中英文随时切换；深色模式跟随系统
• 断网时也能看上次获取的列表

隐私：扩展不收集、不上传任何个人信息，没有账号，不含统计和广告代码。它只读取 daily.lab115.com 公开的 feed，请求不带 cookie。详见 https://daily.lab115.com/extension
```

## Detailed description — English

```
Every morning, Daily Picks reads the last 24 hours from several dozen high-quality sources, scores every article, keeps only the few worth your time, and writes a summary of each. This extension puts it in your browser's side panel.

• Click the toolbar icon and the newest edition opens in the side panel: one card per article, with its section, its source, its headline and its one-sentence take
• Click a card to open its full summary in a new tab, while the side panel stays put for the next one
• When a new edition is out, the icon shows how many picks it has; the number goes away once you have looked, and a side panel left open simply switches to the new edition
• Switch between English and Chinese, and follow your system's dark mode
• See the last list you loaded, even offline

Privacy: the extension collects and uploads no personal information. There is no account, and no analytics or advertising code. It only reads the public feed on daily.lab115.com, without cookies. Details: https://daily.lab115.com/en/extension
```

## 隐私权规范（Privacy practices）标签页

**单一用途说明**

```
Shows the daily selection of article summaries published on daily.lab115.com in the browser's side panel, and marks the toolbar icon when a new edition is available.
```

**权限理由**

| 权限 | 理由（英文填写） |
|---|---|
| `storage` | `Stores the reader's language choice, a cached copy of the daily.lab115.com feed so the side panel opens instantly and works offline, and the date of the newest edition already seen, which decides whether the icon shows a count. Nothing is synced or sent anywhere.` |
| `alarms` | `Checks daily.lab115.com for a new edition every 30 minutes so the toolbar icon can show the number of new picks.` |
| `sidePanel` | `The extension's only interface is a side panel: clicking the toolbar icon opens it, and it shows the newest edition's list. Nothing is injected into web pages.` |
| 主机权限 `https://daily.lab115.com/*` | `Fetches the site's public Atom feed (/feed.xml and /en/feed.xml), which is the only content the extension shows. No other site is accessed.` |

**远程代码**：否，不使用远程代码（所有 JS 都打包在扩展里）。

**隐私政策网址**：`https://daily.lab115.com/en/extension`（只有一栏，填英文页；中文页是 `https://daily.lab115.com/extension`）

**数据使用**：所有类别都**不勾选**（不收集个人身份信息、健康、财务、身份验证、个人通讯、位置、网络记录、用户活动、网站内容）。下面三条声明都勾选：
- 不会将用户数据出售给第三方
- 不会将用户数据用于或转移至与该项目单一用途无关的用途
- 不会将用户数据用于或转移至用于确定信用度或用于贷款目的

## 分发（Distribution）标签页

- **付费**：免费
- **公开范围**：公开（Public）
- **地区**：所有地区

## 测试说明（Test instructions）标签页

不用填：没有账号、不用登录，装上就能用。
