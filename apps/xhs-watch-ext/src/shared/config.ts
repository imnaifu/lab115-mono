import type { Config, Watch } from "./types";

/** chrome.alarms 会把小于 1 分钟的周期静默拉长，索性明确 clamp 在这里。 */
export const MIN_INTERVAL_MINUTES = 1;

const DEFAULT_WATCH: Watch = {
  id: "bay-rent",
  name: "湾区租房",
  // 用 search_result（而不是 search_result_ai）因为它有稳定的「最新」排序 tab；
  // 想换成 AI 搜索页直接改这个 URL 即可，响应拦截是按路径通配的。
  url:
    "https://www.xiaohongshu.com/search_result" +
    "?keyword=%E6%B9%BE%E5%8C%BA%E7%A7%9F%E6%88%BF&source=web_explore_feed&type=51",
  sortTabLabel: "最新",
  timeFilterLabel: "一天内",
  minLike: 0,
  enabled: true,
};

/** 筛选面板「发布时间」分组里实际存在的选项。 */
export const TIME_FILTER_OPTIONS = ["一天内", "一周内", "半年内"] as const;

export const DEFAULT_CONFIG: Config = {
  intervalMinutes: 10,
  watches: [DEFAULT_WATCH],
  captureLimit: 20,
  seedOnFirstRun: true,
  maxAgeDays: 7,
  keepAwake: false,
  notifyDesktop: true,
  barkUrl: "",
  barkGroup: "小红书",
};

/**
 * 补齐缺失字段而不是整体替换，这样加新配置项时老用户的存量设置不会被重置。
 */
export function withDefaults(stored: Partial<Config> | undefined): Config {
  const merged = { ...DEFAULT_CONFIG, ...(stored ?? {}) };
  return {
    ...merged,
    intervalMinutes: Math.max(MIN_INTERVAL_MINUTES, Math.round(merged.intervalMinutes) || 10),
    captureLimit: Math.min(200, Math.max(1, Math.round(merged.captureLimit) || 20)),
    maxAgeDays: Math.max(0, Math.round(merged.maxAgeDays) || 0),
    watches: (merged.watches ?? []).map((watch) => ({
      ...watch,
      sortTabLabel: watch.sortTabLabel?.trim() ? watch.sortTabLabel.trim() : null,
      timeFilterLabel: watch.timeFilterLabel?.trim() ? watch.timeFilterLabel.trim() : null,
      minLike: Math.max(0, Math.round(watch.minLike) || 0),
    })),
  };
}

export function newWatchId(): string {
  // 只需在本机唯一，用时间戳 + 随机后缀足够，不引依赖。
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
