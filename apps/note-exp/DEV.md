# 开发 / 测试 / 上线指南

本文档说明本扩展的本地开发、测试验证、构建与发布上线流程。

> 技术栈:Manifest V3 + TypeScript + Vite。无运行时依赖。

---

## 1. 环境准备

```bash
npm install
```

> 仓库带 `yarn.lock`,用 `yarn` 也可;命令把 `npm run` 换成 `yarn` 即可。

---

## 2. 本地开发

启动 watch 模式,改动源码后自动重新构建到 `dist/`:

```bash
npm run dev
```

在 Chrome 加载未打包扩展:

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」,选择 `dist/` 目录
4. 每次改完代码,在扩展卡片上点 🔄 重新加载;改动 content/injected 脚本后还需**刷新目标网页**

源码结构见 `README.md` 的 Project Structure;数据流概览:

```
页面 (xiaohongshu.com / rednote.com)
  injected.ts  →  hook XHR,拦截 note-list 接口、按 id 去重累积
  content.ts   →  在隔离上下文与页面上下文间转发消息
  popup.ts     →  显示计数 / 解析 / 触发导出 / Clear
  background.ts→  生成 CSV 并通过 chrome.downloads 下载
```

---

## 3. 测试

### 3.1 类型检查(必做)

```bash
npx tsc --noEmit
```

退出码为 0 才算通过。

### 3.2 纯函数 + 样本验证

`src/utils/` 下为纯函数(`note.ts` 解析、`datetime.ts` 时间归一化、`csv.ts` 转换),
可脱离浏览器用 `test/` 下的真实接口样本验证解析是否正确。

样本文件(文件名为字面反斜杠,引用时需单引号包裹):

- `'test/api\sns\web\v1\search\notes.json'` —— 搜索接口响应(v1,结构参考)
- `'test/api\sns\web\v2\search\notes.json'` —— 搜索接口响应(v2,当前线上)

> 注:当前线上搜索接口为 `so.xiaohongshu.com/api/sns/web/v2/search/notes`,
> 响应结构与 v1 一致;`injected.ts` 的 `NOTE_LIST_PATHS` 同时匹配 v2 与旧版 v1。

快速核对解析条数与字段(示例):

```bash
node -e 'const fs=require("fs");for(const f of ["test/api\\sns\\web\\v1\\search\\notes.json","test/api\\sns\\web\\v2\\search\\notes.json"]){const d=JSON.parse(fs.readFileSync(f,"utf8"));const a=d.data.items||[];console.log(f.split("\\").pop(),"items:",a.length);}'
```

### 3.3 浏览器手动测试清单

构建后加载 `dist/`,在 **xiaohongshu.com** 和 **rednote.com** 上分别验证:

**核心流程**
- [ ] 搜索结果页:滚动后弹窗「notes captured」计数增长
- [ ] 点「Export CSV」能弹出保存框并下载
- [ ] CSV 用 Excel/Numbers 打开,核对各列(尤其 Author URL 可点开)

**本项目重点改动**
- [ ] 去重:反复上下滚动制造重复请求,计数不虚高;弹窗显示 `N received · K duplicate(s) skipped`
- [ ] Clear:点击后计数归零,可重新搜索采集
- [ ] rednote:在 rednote 页面 DevTools→Network 确认接口域名,Console 有 `Injected script loaded`,计数能增长
- [ ] 链接域名:在 rednote 导出的 URL 用 rednote 域名,小红书页面用小红书域名
- [ ] 时间归一化:导出的 Publish Time 为 `YYYY-MM-DD`(相对时间已转换)
- [ ] CSV 安全:标题以 `=`/`+`/`@`/`-` 开头的笔记,导出后单元格不被当公式执行

**边界**
- [ ] 非列表页(首页/详情页)打开弹窗:计数为 0,Export 按钮 disabled
- [ ] 未滚动就导出:提示 "No search results found…"
- [ ] 关闭弹窗再打开:计数能恢复(数据存在页面上下文,不丢)

---

## 4. 构建

```bash
npm run build
```

确认 `dist/` 产物齐全:`manifest.json`、`background.js`、`content.js`、
`injected.js`、`popup.html`、`popup.js`、`icons/`。

在 `chrome://extensions/` 加载 `dist/` 后,查看扩展卡片**没有 Errors 红字**。

---

## 5. 上线 / 发布(Chrome Web Store)

1. **更新版本号**:`manifest.json` 与 `package.json` 的 `version` 同步递增(如 `1.0.0` → `1.1.0`)。
2. **构建并打包**:
   ```bash
   npm run package
   ```
   一步完成生产构建 + 打包,产出 `rednote-exporter-v<version>.zip`(`manifest.json`
   在压缩包根目录、已排除 `.DS_Store`)。版本号自动取自 `manifest.json`。
   > 所有 `*.zip` 已在 `.gitignore` 中,不会被提交。
3. **上传**:登录 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole/),
   选择对应扩展 → 上传该 zip 包。
4. **填写审核信息**:如实说明扩展功能(用户主动导出当前浏览页面的笔记列表到 CSV、不上传任何数据到外部服务器),
   与权限申明保持一致。
5. **提交审核**,等待 Google 审核通过后发布。

### 发布前自查

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过,`dist/` 无 Errors
- [ ] 第 3.3 节手动测试清单跑过一遍
- [ ] 版本号已递增且 `manifest.json` / `package.json` 一致
- [ ] 权限保持最小(当前:`downloads` + 两组 host + 两个 API host)

> ⚠️ 合规提醒:本扩展定位为「用户主动触发、仅导出当前浏览页面已加载的数据、不做自动爬取、不外传数据」。
> 新增功能时务必保持这一定位,避免触碰 Chrome Web Store 政策红线。

---

## 6. 排查

- **计数一直为 0**:接口路径/域名未命中。在目标页 DevTools→Network 找到实际请求 URL,
  对照 `injected.ts` 的 `NOTE_LIST_PATHS` 与域名匹配逻辑调整。
- **导出乱码**:CSV 已用 UTF-8 base64 data URL;若 Excel 打开中文乱码,可考虑给 CSV 加 BOM(待办)。
- **改了脚本不生效**:扩展卡片点 🔄 重新加载,并刷新目标网页(content/injected 注入在页面加载时发生)。
