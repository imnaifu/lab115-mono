import type { CategoryKey, Lang } from "./data/categories";

export type Strings = {
  brand1: string;
  brand2: string;
  edition: string;
  lede: string;
  meta1: string;
  meta2: string;
  meta3: string;
  foot1: string;
  foot2: string;
  save: string;
  saved: string;
  fav: string;
  emptyFav: string;
  approx: string;
  cat: Record<CategoryKey, string>;
  tagline: Record<CategoryKey, string>;
  hint: Record<CategoryKey, string>;
};

export const I18N: Record<Lang, Strings> = {
  zh: {
    brand1: "Converter",
    brand2: "单位转换",
    edition: "第一卷 · 日常度量",
    lede: '<span class="tip"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 2l3 3-8 8H3v-3z"/></svg>点任意数字可编辑</span>其他全部跟着变。上方插图会换成<b>最接近当前数值的日常参照物</b>。',
    meta1: "点格子编辑",
    meta2: "★ 收藏 / 历史",
    meta3: "切换 中 / EN",
    foot1: "字体 Newsreader & Space Grotesk · 无追踪 · 无 Cookie",
    foot2: "© 2026 · 一个小而实用的页面",
    save: "收藏",
    saved: "已收藏",
    fav: "★ 收藏",
    emptyFav: "暂无收藏",
    approx: "约等于",
    cat: {
      length: "长度",
      weight: "重量",
      temp: "温度",
      volume: "容量",
      area: "面积",
      speed: "速度",
    },
    tagline: {
      length: "横竖斜的距离",
      weight: "捧在手里有多沉",
      temp: "热不热，烫不烫",
      volume: "能装多少",
      area: "占多大地方",
      speed: "跑得多快",
    },
    hint: {
      length: "皮尺、跑道、咖啡桌。",
      weight: "回形针、糖袋、小汽车。",
      temp: "唯一一个不是简单乘法的家伙。",
      volume: "一滴水到一桶牛奶。",
      area: "A4 纸到足球场。",
      speed: "散步到子弹列车。",
    },
  },
  en: {
    brand1: "Converter",
    brand2: "Unit Atlas",
    edition: "Vol. I · everyday measures",
    lede: '<span class="tip"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 2l3 3-8 8H3v-3z"/></svg>Click any number to edit</span>The rest update in lock-step. The illustration above swaps to the <b>closest everyday reference</b>.',
    meta1: "Tap a field to edit",
    meta2: "★ Save / History",
    meta3: "Switch 中 / EN",
    foot1: "Set in Newsreader & Space Grotesk · No tracking · No cookies",
    foot2: "© 2026 · A small, useful page",
    save: "Save",
    saved: "Saved",
    fav: "★ Favorites",
    emptyFav: "Nothing saved yet",
    approx: "about",
    cat: {
      length: "Length",
      weight: "Weight",
      temp: "Temp",
      volume: "Volume",
      area: "Area",
      speed: "Speed",
    },
    tagline: {
      length: "Distances",
      weight: "Heft",
      temp: "How warm",
      volume: "How much it holds",
      area: "How much ground",
      speed: "How fast",
    },
    hint: {
      length: "Tape measures, sprint tracks, coffee tables.",
      weight: "Paperclips, sugar bags, small cars.",
      temp: "The only one that isn't just multiplication.",
      volume: "From a drop to a milk jug.",
      area: "A sheet of paper to a football pitch.",
      speed: "A stroll to a bullet train.",
    },
  },
};
