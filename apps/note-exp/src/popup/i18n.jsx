import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// UI languages in menu order. Codes match the _locales folders; labels are each
// language's own name so people can find theirs whatever is showing.
export const LANGS = [
  { code: "zh_CN", label: "简体中文" },
  { code: "zh_TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "vi", label: "Tiếng Việt" },
];

// UI strings. Functions take args; components apply emphasis. zh_CN and en are
// complete; the other languages only translate keys the popup renders, and
// anything missing (the demo-only keys) falls back to English.
export const STR = {
  zh_CN: {
    brand: "小红书导出工具",
    tabList: "导出笔记列表",
    tabPost: "下载单帖资源",
    openNote: "打开原帖",
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
  en: {
    brand: "RedNote Exporter",
    tabList: "Export Note List",
    tabPost: "Download Single Post",
    openNote: "Open the post",
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
  zh_TW: {
    brand: "小紅書匯出工具",
    tabList: "匯出筆記列表",
    tabPost: "下載單篇資源",
    openNote: "開啟原貼文",
    connected: "已連線",
    captured: "已收集",
    unit: "則",
    capturing: "收集中…",
    pageHint: "在網頁上繼續往下捲動，新載入的筆記會自動收集",
    nopageT: "未偵測到筆記列表",
    nopageS:
      "請先開啟小紅書的首頁推薦、搜尋結果或使用者主頁，等筆記載入後再開啟本擴充功能。",
    nopageBtn: "我已開啟列表頁",
    exportCsv: "匯出 CSV",
    clear: "清空",
    exporting: (t) => `正在匯出 ${t} 則資料…`,
    exportDone: "匯出完成",
    rows: (t) => `${t} 列`,
    savedTo: "已儲存到「下載」資料夾",
    done: "完成",
    videoUnit: "部影片",
    imageUnit: "張圖片",
    videoWord: "影片",
    imagesWord: "圖片",
    selAll: "全選",
    deselAll: "取消全選",
    dlSel: (n) => `下載所選 · ${n}`,
    downloading: (d, t) => `正在下載 ${d}/${t}`,
    dlSub: (v, n) => `${v ? "影片 + " : ""}${n} 張圖片`,
    savedN: (n) => `已儲存 ${n} 個檔案`,
    savedPath: (name) => `下載/${name}`,
    dedup: (r, d) => (d > 0 ? `已接收 ${r} · 略過 ${d} 則重複` : `已接收 ${r}`),
    errT: "目前不是筆記頁面",
    errS: "請先開啟一篇小紅書筆記，再點擊擴充功能下載其影片與圖片。",
    errBtn: "我已開啟筆記",
    fmt: (n) =>
      n >= 10000
        ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "萬"
        : n >= 1000
          ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
          : "" + n,
  },
  // Counts render as "<number> <unit>", so units are worded to read naturally
  // after the number in each language.
  ko: {
    tabList: "노트 목록 내보내기",
    tabPost: "게시물 다운로드",
    openNote: "원본 게시물 열기",
    connected: "연결됨",
    captured: "수집됨",
    unit: "개",
    capturing: "수집 중…",
    pageHint:
      "페이지를 계속 아래로 스크롤하면 새로 불러온 노트가 자동으로 수집됩니다",
    nopageT: "노트 목록을 찾을 수 없습니다",
    nopageS:
      "샤오홍슈 홈 피드, 검색 결과 또는 프로필을 열고 노트가 보이면 다시 열어 주세요.",
    nopageBtn: "목록 페이지를 열었어요",
    exportCsv: "CSV 내보내기",
    clear: "지우기",
    exporting: (t) => `${t}개 항목 내보내는 중…`,
    exportDone: "내보내기 완료",
    rows: (t) => `${t}행`,
    savedTo: "다운로드 폴더에 저장됨",
    done: "완료",
    videoUnit: "동영상",
    imageUnit: "이미지",
    videoWord: "동영상",
    imagesWord: "이미지",
    selAll: "전체 선택",
    deselAll: "선택 해제",
    dlSel: (n) => `다운로드 · ${n}`,
    downloading: (d, t) => `다운로드 중 ${d}/${t}`,
    dlSub: (v, n) => `${v ? "동영상 + " : ""}이미지 ${n}장`,
    savedN: (n) => `파일 ${n}개 저장됨`,
    savedPath: (name) => `다운로드/${name}`,
    dedup: (r, d) =>
      d > 0 ? `${r}개 받음 · 중복 ${d}개 건너뜀` : `${r}개 받음`,
    errT: "게시물 페이지가 아닙니다",
    errS: "먼저 샤오홍슈 게시물을 연 다음, 확장 프로그램을 클릭해 동영상과 이미지를 다운로드하세요.",
    errBtn: "게시물을 열었어요",
    fmt: (n) =>
      n >= 10000
        ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만"
        : n >= 1000
          ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "천"
          : "" + n,
  },
  ja: {
    tabList: "ノート一覧を出力",
    tabPost: "投稿をダウンロード",
    openNote: "元の投稿を開く",
    connected: "接続済み",
    captured: "収集済み",
    unit: "件",
    capturing: "収集中…",
    pageHint:
      "ページを下にスクロールすると、新しく読み込まれたノートが自動で収集されます",
    nopageT: "ノート一覧が見つかりません",
    nopageS:
      "小紅書のフィード、検索結果、またはプロフィールを開き、ノートが表示されてから開いてください。",
    nopageBtn: "一覧ページを開きました",
    exportCsv: "CSV を出力",
    clear: "クリア",
    exporting: (t) => `${t} 件を出力中…`,
    exportDone: "出力が完了しました",
    rows: (t) => `${t} 行`,
    savedTo: "ダウンロードフォルダに保存しました",
    done: "完了",
    videoUnit: "本の動画",
    imageUnit: "枚の画像",
    videoWord: "動画",
    imagesWord: "画像",
    selAll: "すべて選択",
    deselAll: "選択を解除",
    dlSel: (n) => `ダウンロード · ${n}`,
    downloading: (d, t) => `ダウンロード中 ${d}/${t}`,
    dlSub: (v, n) => `${v ? "動画 + " : ""}画像 ${n} 枚`,
    savedN: (n) => `${n} 個のファイルを保存しました`,
    savedPath: (name) => `ダウンロード/${name}`,
    dedup: (r, d) =>
      d > 0 ? `${r} 件受信 · 重複 ${d} 件をスキップ` : `${r} 件受信`,
    errT: "投稿ページではありません",
    errS: "先に小紅書の投稿を開いてから、拡張機能をクリックして動画と画像をダウンロードしてください。",
    errBtn: "投稿を開きました",
    fmt: (n) =>
      n >= 10000
        ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "万"
        : n.toLocaleString("ja-JP"),
  },
  vi: {
    tabList: "Xuất danh sách ghi chú",
    tabPost: "Tải bài viết",
    openNote: "Mở bài gốc",
    connected: "Đã kết nối",
    captured: "Đã thu thập",
    unit: "ghi chú",
    capturing: "Đang thu thập…",
    pageHint:
      "Tiếp tục cuộn trang xuống — ghi chú mới tải sẽ được thu thập tự động",
    nopageT: "Không tìm thấy danh sách ghi chú",
    nopageS:
      "Hãy mở trang chủ, trang kết quả tìm kiếm hoặc trang cá nhân trên Xiaohongshu, chờ ghi chú tải xong rồi mở lại tiện ích này.",
    nopageBtn: "Tôi đã mở trang danh sách",
    exportCsv: "Xuất CSV",
    clear: "Xóa",
    exporting: (t) => `Đang xuất ${t} mục…`,
    exportDone: "Đã xuất xong",
    rows: (t) => `${t} dòng`,
    savedTo: "Đã lưu vào thư mục Tải xuống",
    done: "Xong",
    videoUnit: "video",
    imageUnit: "ảnh",
    videoWord: "Video",
    imagesWord: "Ảnh",
    selAll: "Chọn tất cả",
    deselAll: "Bỏ chọn",
    dlSel: (n) => `Tải xuống · ${n}`,
    downloading: (d, t) => `Đang tải ${d}/${t}`,
    dlSub: (v, n) => `${v ? "video + " : ""}${n} ảnh`,
    savedN: (n) => `Đã lưu ${n} tệp`,
    // The folder on disk is "Downloads" on most Vietnamese systems.
    savedPath: (name) => `Downloads/${name}`,
    dedup: (r, d) =>
      d > 0 ? `Đã nhận ${r} · bỏ qua ${d} trùng lặp` : `Đã nhận ${r}`,
    errT: "Đây không phải trang bài viết",
    errS: "Hãy mở một bài viết Xiaohongshu trước, rồi nhấp vào tiện ích để tải video và ảnh.",
    errBtn: "Tôi đã mở bài viết",
  },
};

// Only a language the user picked in the menu is stored. A new key, because the
// old "rx-lang" was written on every open and so says nothing about choice.
const PICKED_KEY = "rx-ui-lang";

/** Browser UI language → one of our codes; anything we don't ship gets English. */
function browserLang() {
  const ui = (
    globalThis.chrome?.i18n?.getUILanguage?.() ||
    navigator.language ||
    "en"
  ).toLowerCase();
  if (ui.startsWith("zh")) {
    // Taiwan, Hong Kong and Macau read Traditional Chinese.
    return /(tw|hk|mo|hant)/.test(ui) ? "zh_TW" : "zh_CN";
  }
  const base = ui.slice(0, 2);
  return STR[base] ? base : "en";
}

function readPicked() {
  try {
    const saved = localStorage.getItem(PICKED_KEY);
    return STR[saved] ? saved : null;
  } catch {
    return null;
  }
}

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => readPicked() || browserLang());
  const setLang = (code) => {
    setLangState(code);
    try {
      localStorage.setItem(PICKED_KEY, code);
    } catch {
      // Storage blocked: the pick still applies for this popup session.
    }
  };
  // <html lang> picks the right CJK glyph forms and the matching font stack in
  // index.css (Japanese kanji must not render in Chinese shapes).
  useEffect(() => {
    document.documentElement.lang = lang.replace("_", "-");
  }, [lang]);
  const L = useMemo(() => ({ ...STR.en, ...STR[lang] }), [lang]);
  return (
    <LangCtx.Provider value={{ lang, setLang, L }}>{children}</LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);
