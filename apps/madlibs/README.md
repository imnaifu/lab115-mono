# madlibs

`madlibs.lab115.com` —— 疯狂填词。先回答几个不带上下文的填词问题，再揭晓故事，
意料之外的词撞进通顺的句子里就是笑点。产品想法、视频方案、成本和验证计划见
[`doc/IDEA.md`](doc/IDEA.md)；这里是**第一阶段：只验证玩法**。

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## 结构

```
src/
├── data/templates.ts   # 故事模板（server-only）
├── lib/game.ts         # listThemes / startGame / revealStory，纯函数（server-only）
├── lib/types.ts        # 跨前后端的类型：Theme、Segment、RevealResult
├── lib/track.ts        # Umami 事件
├── app/actions.ts      # reveal() server action —— 唯一一次服务端往返
├── app/page.tsx        # server component，只把模板的公开部分传给前端
└── components/         # MadLibs（状态机）→ ThemePicker / QuestionStep / StoryReveal
```

## 设计取舍

**故事正文不出服务端，但没有数据库。** `data/templates.ts` 和 `lib/game.ts` 都
`import "server-only"`，前端拿到的只有标题、简介和问题。揭晓时前端把
`themeId + answers` 发给 server action，服务端校验、填好，再按「普通文字 / 填进去的词」
切成 segments 返回，前端只负责高亮。无状态，所以没有 `game_id`，也不用存库。
验证方法：`npm run build` 后 `grep -r 前胸贴后背 .next/static` 应当没有结果。

**和 MCP 接口草案对应。** `startGame` ≈ `start_game`，`revealStory` ≈
`submit_answers` + `reveal_story`。以后做 ChatGPT 插件时，MCP server 直接包这几个
函数；到那时需要存状态（`game_id`），可以在外面加一层存储，函数本身不用改。

**一屏只问一个词。** 看得见前面答了什么，就会开始「凑」故事，信息差就没了。
问题顺序故意和故事里的出现顺序打乱，`label` 只描述词性（「一种动物」），
不描述它在故事里的角色。

## 加一个模板

在 `src/data/templates.ts` 的 `TEMPLATES` 里加一项，写法要求在文件头注释里。
同一个 `{key}` 可以在故事里出现多次，重复往往就是笑点（「我这个人，太{adjective}了」）。

## 埋点

`lib/track.ts` 定义了四个事件，用来回答第一阶段的问题：

| 事件 | 含义 | 参数 |
| --- | --- | --- |
| `start` | 选了主题，开始答题 | `theme` |
| `reveal` | 答完、看到故事 | `theme` |
| `replay` | 揭晓后再玩 | `theme`, `mode`: `same` / `other` |
| `copy` | 复制了故事（最接近「分享」的信号） | `theme` |

**`UMAMI_ID` 目前为空**（`src/components/Analytics.tsx`）：要先在
stats.lab115.com 里新建 `madlibs.lab115.com` 这个站点，把生成的 website id 填进去。
id 为空时脚本不加载，`track()` 什么也不发；开发环境下只在 console 打日志。
