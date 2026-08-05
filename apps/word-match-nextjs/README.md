# 单词配对游戏 · Next.js

拖拽英语单词卡到场景图对应位置的学习游戏。**学习 → 挑战**两步流程，带生命值、计时和"超过百分之多少玩家"结算。全部内容由 JSON 驱动，加新场景无需改代码。

## 运行

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

生产构建：`npm run build && npm start`

## 目录结构

```
app/
  layout.tsx          根布局 + 全局样式引入
  page.tsx            首页，渲染 <WordMatchGame />
  globals.css         主题变量（可爱糖果风）、字体、动画
components/
  WordMatchGame.tsx   全部游戏逻辑与界面（客户端组件）
lib/
  scenes.ts           数据类型 + 加载器（读取下面的 JSON）
data/
  categories.json     分类与每个分类下的场景 id
  scenes/
    hospital.json     医院病房（含定位 + 词汇）
    living.json       客厅（占位，locked）
    kitchen.json      厨房（占位，locked）
    classroom.json    教室（占位，locked）
public/
  scenes/
    hospital.png      场景图片
```

## 数据格式

### `data/categories.json`
```jsonc
{
  "categories": [
    { "id": "medical", "name": "医疗", "en": "Medical", "scenes": ["hospital"] }
  ]
}
```
`scenes` 数组里的每个 id 对应 `data/scenes/<id>.json` 一个文件。

### `data/scenes/<id>.json`
```jsonc
{
  "id": "hospital",
  "name": "医院病房",
  "category": "医疗",
  "aspectRatio": "1024 / 559",   // 图片宽高比，用于舞台
  "levels": {
    "easy":   { "image": "/scenes/xxx.png", "words": [ /* ... */ ] },
    "medium": { "image": "/scenes/yyy.png", "words": [ /* ... */ ] },
    "hard":   { "image": "/scenes/zzz.png", "words": [ /* ... */ ] }
  }
}
```
**每个难度是一张独立图片 + 一组独立单词**（不是同图不同数量）。未提供的难度会自动显示为置灰不可选。占位/未开放场景加 `"locked": true` 且 `levels` 留空。

### 单词对象 `Word`
```jsonc
{
  "id": "window",            // 关卡内唯一 id（拖拽句柄 + 空格 id）
  "word": "WINDOW",          // 英文（卡片与答案）
  "ipa": "/ˈwɪn.doʊ/",       // 音标
  "zh": "窗户",               // 中文（学习模式显示）
  "box": [24.2, 9.8, 11.2, 15.2]  // 定位框，单位为图片百分比：[left, top, width, height]
}
```
`box` 用百分比，所以图片缩放时定位框始终对齐。左上角为原点。

## 加一个新场景（三步）

1. 把图片放进 `public/scenes/`，例如 `public/scenes/kitchen.png`。
2. 编辑 `data/scenes/kitchen.json`：去掉 `locked`，在 `levels` 里填入至少一个难度，写好每个单词的 `box`（百分比定位）、`ipa`、`zh`。
3. 确认该场景 id 已在 `data/categories.json` 某个分类的 `scenes` 里（`kitchen` 已经在"家居"下）。

> 调 `box` 坐标的小技巧：先估一个值，`npm run dev` 打开学习模式看单词卡是否盖住图上物体，微调百分比即可。

## 主题

配色、字体、圆角都是 `app/globals.css` 里的 CSS 变量（`--color-accent`、`--font-head`、`--radius` 等）。改这些变量即可换肤，无需动组件。

## 说明

- 发音使用浏览器内置 `speechSynthesis`（英文 en-US），无需联网 API。
- "超过 X% 玩家"是根据用时和剩余生命由 `beatPercent()` 估算的本地公式，非真实排行榜；如需真实数据，把结果 POST 到你的后端并返回百分位即可。
- 拖拽用全局 pointer 事件实现，支持鼠标与触屏。
