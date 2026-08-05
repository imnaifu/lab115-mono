/** 一个监控目标：一个小红书搜索页 URL。 */
export interface Watch {
  id: string;
  name: string;
  /** 完整搜索页 URL，直接用它开后台标签页。 */
  url: string;
  /** 筛选面板「排序依据」里要选的文案（如「最新」）；null = 用页面默认排序。 */
  sortTabLabel: string | null;
  /**
   * 筛选面板「发布时间」里要选的文案（「一天内」/「一周内」/「半年内」）；null = 不动它。
   * 这是服务端过滤，比客户端的 maxAgeDays 强得多 —— 返回的 20 条本身就都是新帖，
   * 而不是抓 20 条老爆款回来再扔掉 19 条。
   */
  timeFilterLabel: string | null;
  /** 点赞数低于此值的新笔记不推送（0 = 不过滤）。 */
  minLike: number;
  enabled: boolean;
}

export interface Config {
  /** 轮询间隔；chrome.alarms 最短 1 分钟，保存时会 clamp。 */
  intervalMinutes: number;
  watches: Watch[];
  /** 每轮每个 watch 最多取多少条（首屏约 20 条）。 */
  captureLimit: number;
  /** 首轮只建立基线不推送，否则第一次就会收到 20 条存量笔记。 */
  seedOnFirstRun: boolean;
  /** 已知发布时间超过该天数的笔记入库但不推送；0 = 不按时间过滤。 */
  maxAgeDays: number;
  /** 阻止系统休眠，让轮询在无人值守时不中断（耗电）。 */
  keepAwake: boolean;
  notifyDesktop: boolean;
  /** Bark 推送地址，形如 https://api.day.app/<你的key>；留空则不推手机。 */
  barkUrl: string;
  barkGroup: string;
}

export interface Note {
  noteId: string;
  title: string;
  authorId: string | null;
  authorName: string | null;
  coverUrl: string | null;
  likedCount: number;
  /** epoch ms；搜索接口不一定返回发布时间，拿不到时为 null。 */
  publishedAt: number | null;
  /** 原始的「3小时前」/「01-15」文案，展示用。 */
  publishedLabel: string | null;
  xsecToken: string | null;
  url: string;
  /** 归一化标题 + 作者 id，用来识别搬运号 / 重复发布。 */
  contentKey: string;
  firstSeenAt: number;
}

export interface RunState {
  lastRunAt: number | null;
  lastOkAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  /** 连续失败后退避到这个时间点，期间跳过定时抓取（手动检查不受限）。 */
  backoffUntil: number | null;
  /** 上次发告警的时间，用来做冷却，避免失败被刷成通知轰炸。 */
  lastAlertAt: number | null;
  /** 未读新笔记数，显示在插件图标 badge 上。 */
  unreadCount: number;
}

/**
 * 进行中的一轮抓取。存 chrome.storage.session 而不是内存变量：
 * service worker 随时可能被回收，重新拉起后要能接上或收尾。
 */
export interface PendingRun {
  watchId: string;
  tabId: number;
  startedAt: number;
  /** 本轮还没跑的 watch id，逐个串行。 */
  queue: string[];
  manual: boolean;
}

export interface LogEntry {
  at: number;
  watchName: string;
  ok: boolean;
  captured: number;
  fresh: number;
  message: string;
}

/** content script 抓完一轮后回报给 service worker 的结果。 */
export type WatchResult =
  | {
      type: "WATCH_RESULT";
      ok: true;
      items: unknown[];
      /** 排序 / 发布时间筛选各自有没有真的生效，写进运行日志用。 */
      sortOutcome?: string;
      timeOutcome?: string;
    }
  | { type: "WATCH_RESULT"; ok: false; reason: string; blocked: boolean };
