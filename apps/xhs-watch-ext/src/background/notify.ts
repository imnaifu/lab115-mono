/**
 * 推送：桌面通知 + Bark（手机）。
 *
 * 两条通道刻意互不依赖 —— 一边失败不影响另一边，因为它们解决的是不同问题：
 * 桌面通知只在你人在电脑前时有用，Bark 才能在你离开时真正触达。
 */
import { rememberNotificationUrl } from "../shared/store";
import type { Config, Note, Watch } from "../shared/types";

/** 一轮最多弹几条桌面通知，多出来的合并成一条汇总，避免刷屏。 */
const MAX_DESKTOP_NOTIFICATIONS = 3;
/** 一轮最多发几条 Bark，多出来的同样合并。 */
const MAX_BARK_PUSHES = 5;
const LOCAL_ICON = "icons/icon128.png";

function truncate(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

/** 「小王 · 128赞 · 3小时前」 */
function describe(note: Note): string {
  const parts = [note.authorName, `${note.likedCount}赞`, note.publishedLabel];
  return parts.filter(Boolean).join(" · ");
}

function noteTitle(note: Note): string {
  return truncate(note.title || "(无标题)", 60);
}

/**
 * MV3 的通知不接受远程图片 URL，封面必须先取回来转成 data URL。
 * 顺手缩到通知能显示的尺寸，避免 data URL 过大。任何一步失败都返回 null，
 * 调用方退回没有大图的普通通知。
 */
async function coverAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, 360 / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    return await blobToDataUrl(await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }));
  } catch {
    return null;
  }
}

/** service worker 里没有 FileReader，只能手动 base64。 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // 分块拼接：一次性 spread 几十万个参数会爆栈。
  const CHUNK_SIZE = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function createNotification(
  options: chrome.notifications.NotificationOptions<true>,
  clickUrl: string | null,
): Promise<void> {
  // 用 callback 形式而不是 await：这个 API 的 promise 重载在部分 @types/chrome
  // 版本里缺失，而且这样能顺手读到 lastError（例如系统层面关掉了通知权限）。
  const notificationId = await new Promise<string>((resolve, reject) => {
    chrome.notifications.create(options, (id) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message ?? "通知创建失败"));
      else resolve(id);
    });
  });
  if (clickUrl) await rememberNotificationUrl(notificationId, clickUrl);
}

async function notifyDesktop(watch: Watch, notes: Note[]): Promise<void> {
  const shown = notes.slice(0, MAX_DESKTOP_NOTIFICATIONS);

  for (const note of shown) {
    const cover = await coverAsDataUrl(note.coverUrl);
    await createNotification(
      {
        // 封面同时当 iconUrl 和 imageUrl：macOS 走系统通知中心，只显示 icon 而会
        // 忽略 image；Windows / Linux 上的 Chrome 原生通知才会显示大图。
        type: cover ? "image" : "basic",
        iconUrl: cover ?? LOCAL_ICON,
        ...(cover ? { imageUrl: cover } : {}),
        title: noteTitle(note),
        message: describe(note),
        contextMessage: watch.name,
        // 不自动消失：错过一条就等于没推送到。
        requireInteraction: true,
      },
      note.url,
    );
  }

  const remaining = notes.length - shown.length;
  if (remaining > 0) {
    await createNotification(
      {
        type: "basic",
        iconUrl: LOCAL_ICON,
        title: `${watch.name} 还有 ${remaining} 条新笔记`,
        message: notes
          .slice(shown.length)
          .map((note) => noteTitle(note))
          .join("\n"),
        contextMessage: "点击打开插件查看全部",
      },
      null,
    );
  }
}

/**
 * Bark 的 POST /:key 接受 JSON body。用户在设置里填的是含 key 的完整地址
 * （https://api.day.app/xxxxx），自建服务器同样适用。
 */
async function pushBark(
  config: Config,
  payload: { title: string; body: string; url?: string; icon?: string | null },
): Promise<void> {
  const endpoint = config.barkUrl.trim().replace(/\/+$/, "");
  if (!endpoint) return;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      group: config.barkGroup || undefined,
      icon: payload.icon || undefined,
      // 存进 Bark 的历史列表，手机锁屏时错过也能回看。
      isArchive: 1,
    }),
  });
  if (!response.ok) {
    throw new Error(`Bark 返回 ${response.status}`);
  }
}

async function notifyBark(config: Config, watch: Watch, notes: Note[]): Promise<void> {
  const pushed = notes.slice(0, MAX_BARK_PUSHES);
  for (const note of pushed) {
    await pushBark(config, {
      title: `${watch.name} · ${noteTitle(note)}`,
      body: describe(note),
      url: note.url,
      icon: note.coverUrl,
    });
  }

  const remaining = notes.length - pushed.length;
  if (remaining > 0) {
    await pushBark(config, {
      title: `${watch.name} 还有 ${remaining} 条新笔记`,
      body: notes
        .slice(pushed.length)
        .map((note) => noteTitle(note))
        .join("\n"),
    });
  }
}

/**
 * 推送一轮的新笔记。返回推送过程中的错误描述（用于写运行日志），
 * 一条通道挂了不影响另一条。
 */
export async function notifyNewNotes(
  config: Config,
  watch: Watch,
  notes: Note[],
): Promise<string[]> {
  // 新的排前面，便于「只看最上面一条」也是最新的。
  const ordered = [...notes].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const errors: string[] = [];

  if (config.notifyDesktop) {
    try {
      await notifyDesktop(watch, ordered);
    } catch (error) {
      errors.push(`桌面通知失败：${String(error)}`);
    }
  }

  if (config.barkUrl.trim()) {
    try {
      await notifyBark(config, watch, ordered);
    } catch (error) {
      errors.push(`Bark 推送失败：${String(error)}`);
    }
  }

  return errors;
}

/** 抓取被拦截 / 登录过期之类的告警，走同样两条通道。 */
export async function notifyAlert(config: Config, title: string, message: string): Promise<void> {
  try {
    await createNotification(
      {
        type: "basic",
        iconUrl: LOCAL_ICON,
        title,
        message,
        requireInteraction: true,
      },
      "https://www.xiaohongshu.com/explore",
    );
  } catch {
    // 通知权限被系统关掉了，忽略；下面还有 Bark 兜底。
  }
  if (config.barkUrl.trim()) {
    await pushBark(config, { title, body: message }).catch(() => undefined);
  }
}

/** popup 里的「测试推送」用。 */
export async function sendTestNotification(config: Config): Promise<string[]> {
  const errors: string[] = [];
  try {
    await createNotification(
      {
        type: "basic",
        iconUrl: LOCAL_ICON,
        title: "小红书新帖监控",
        message: "桌面通知正常工作。",
      },
      null,
    );
  } catch (error) {
    errors.push(`桌面通知失败：${String(error)}`);
  }

  if (config.barkUrl.trim()) {
    try {
      await pushBark(config, { title: "小红书新帖监控", body: "Bark 推送正常工作。" });
    } catch (error) {
      errors.push(`Bark 推送失败：${String(error)}`);
    }
  } else {
    errors.push("未配置 Bark 地址，只测试了桌面通知。");
  }
  return errors;
}
