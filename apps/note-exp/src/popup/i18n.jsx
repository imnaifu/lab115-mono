import React, { createContext, useContext, useEffect, useState } from "react";

// Bilingual UI strings. Functions take args; components apply emphasis.
export const STR = {
  中文: {
    brand: "小红书导出工具",
    tabList: "导出笔记列表",
    tabPost: "下载单帖资源",
    demoH: "跳转到状态 · 演示",
    demoSearch: [
      ["nopage", "未检测到页面"],
      ["capturing", "采集中"],
      ["exporting", "导出中"],
      ["exported", "导出完成"],
    ],
    demoPost: [
      ["ready", "笔记详情"],
      ["downloading", "下载中"],
      ["done", "下载完成"],
      ["error", "非详情页"],
    ],
    connected: "已连接",
    captured: "已采集",
    unit: "条",
    fromPages: (m) => `来自 ${m} 页`,
    capturing: "采集中…",
    pageHint: "在网页上继续向下滚动，新加载的笔记会自动采集",
    simScroll: "模拟页面滚动 +1 页",
    pageEnd: (t) => `页面已到底 · 共 ${t} 条`,
    nopageT: "未检测到笔记列表",
    nopageS:
      "请先打开小红书的首页推荐、搜索结果或用户主页，等笔记加载出来后再打开本插件。",
    nopageBtn: "我已打开列表页",
    back: "返回",
    footRows: (t, p) => `${t} 条 · ${p} 页`,
    exportCsv: "导出 CSV",
    clear: "清空",
    exporting: (t) => `正在导出 ${t} 条数据…`,
    exportDone: "导出完成",
    rows: (t) => `${t} 行`,
    savedTo: "已保存到 下载文件夹",
    openFolder: "打开文件夹",
    done: "完成",
    videoUnit: "个视频",
    imageUnit: "张图片",
    videoWord: "视频",
    imagesWord: "图片",
    selAll: "全选",
    deselAll: "取消全选",
    dlSel: (n) => `下载选中 · ${n}`,
    downloading: (d, t) => `正在下载 ${d}/${t}`,
    dlSub: (v, n) => `${v ? "视频 + " : ""}${n} 张图片`,
    savedN: (n) => `已保存 ${n} 个文件`,
    savedPath: (name) => `下载/${name}`,
    dedup: (r, d) => (d > 0 ? `已接收 ${r} · 跳过 ${d} 条重复` : `已接收 ${r}`),
    errT: "当前不是笔记详情页",
    errS: "请先打开一篇小红书笔记，再点击插件下载其视频与图片。",
    errBtn: "我已打开笔记",
    fmt: (n) =>
      n >= 10000
        ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "w"
        : n >= 1000
          ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
          : "" + n,
  },
  English: {
    brand: "RedNote Exporter",
    tabList: "Export Note List",
    tabPost: "Download Single Post",
    demoH: "Jump to state · Demo",
    demoSearch: [
      ["nopage", "No page"],
      ["capturing", "Capturing"],
      ["exporting", "Exporting"],
      ["exported", "Export done"],
    ],
    demoPost: [
      ["ready", "Post detail"],
      ["downloading", "Downloading"],
      ["done", "Download done"],
      ["error", "Not a post"],
    ],
    connected: "Connected",
    captured: "Captured",
    unit: "items",
    fromPages: (m) => `from ${m} ${m > 1 ? "pages" : "page"}`,
    capturing: "Capturing…",
    pageHint:
      "Scroll down on the page — newly loaded notes are captured automatically",
    simScroll: "Simulate page scroll +1",
    pageEnd: (t) => `end of page · ${t} items total`,
    nopageT: "No note list detected",
    nopageS:
      "Open RedNote's home feed, a search results page, or a user profile and let notes load, then open this extension.",
    nopageBtn: "I've opened a list page",
    back: "Back",
    footRows: (t, p) => `${t} items · ${p} ${p > 1 ? "pages" : "page"}`,
    exportCsv: "Export CSV",
    clear: "Clear",
    exporting: (t) => `Exporting ${t} items…`,
    exportDone: "Export complete",
    rows: (t) => `${t} rows`,
    savedTo: "Saved to your Downloads folder",
    openFolder: "Open folder",
    done: "Done",
    videoUnit: "video",
    imageUnit: "images",
    videoWord: "Video",
    imagesWord: "Images",
    selAll: "Select all",
    deselAll: "Deselect",
    dlSel: (n) => `Download · ${n}`,
    downloading: (d, t) => `Downloading ${d}/${t}`,
    dlSub: (v, n) => `${v ? "video + " : ""}${n} images`,
    savedN: (n) => `Saved ${n} files`,
    savedPath: (name) => `Downloads/${name}`,
    dedup: (r, d) =>
      d > 0 ? `${r} received · ${d} duplicate(s) skipped` : `${r} received`,
    errT: "Not a post detail page",
    errS: "Open a Xiaohongshu post first, then click the extension to download its video and images.",
    errBtn: "I've opened a post",
    fmt: (n) =>
      n >= 1000000
        ? (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
        : n >= 1000
          ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
          : "" + n,
  },
};

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem("rx-lang") || "中文",
  );
  useEffect(() => {
    localStorage.setItem("rx-lang", lang);
  }, [lang]);
  const L = STR[lang] || STR["中文"];
  return (
    <LangCtx.Provider value={{ lang, setLang, L }}>{children}</LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);
