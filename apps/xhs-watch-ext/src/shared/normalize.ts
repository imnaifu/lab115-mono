/**
 * 搜索接口原始 payload → 我们自己的扁平结构。
 *
 * 这里全部是防御式取值：接口 schema 没有文档、随时可能变，所以每个字段都有兜底
 * 而不是抛错。一条笔记只要有 id 和标题，就已经够推送了。
 */
import type { Note } from "./types";

/** "1.2万" → 12000，"3,456" → 3456，"赞" → 0 */
export function parseCount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const text = raw.replace(/[,\s+]/g, "");
  const match = text.match(/^([\d.]+)(万|亿)?/);
  if (!match?.[1]) return 0;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  if (match[2] === "万") return Math.round(value * 1e4);
  if (match[2] === "亿") return Math.round(value * 1e8);
  return Math.round(value);
}

/**
 * 小红书给的是相对文案（"昨天"、"3小时前"）或裸日期（"01-15"、"2024-12-01"）。
 * 返回 epoch ms，解析不出来返回 null。
 */
export function parsePublishLabel(label: string | null, now: number): number | null {
  if (!label) return null;
  const text = label.trim();

  const relative = text.match(/^(\d+)\s*(分钟|小时|天)前$/);
  if (relative?.[1] && relative[2]) {
    const amount = Number.parseInt(relative[1], 10);
    const unitMs = { 分钟: 60_000, 小时: 3_600_000, 天: 86_400_000 }[relative[2]] ?? 0;
    return now - amount * unitMs;
  }
  if (/^刚刚|^今天/.test(text)) return now;
  if (/^昨天/.test(text)) return now - 86_400_000;

  const fullDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullDate) return new Date(+fullDate[1]!, +fullDate[2]! - 1, +fullDate[3]!).getTime();

  // "01-15" 没有年份 —— 取最近一次出现的那个日期。
  const monthDay = text.match(/^(\d{1,2})-(\d{1,2})$/);
  if (monthDay) {
    const year = new Date(now).getFullYear();
    const guess = new Date(year, +monthDay[1]! - 1, +monthDay[2]!).getTime();
    return guess > now ? new Date(year - 1, +monthDay[1]! - 1, +monthDay[2]!).getTime() : guess;
  }
  return null;
}

function pickCover(card: Record<string, any>): string | null {
  const cover = card.cover ?? {};
  const fromList = Array.isArray(cover.info_list)
    ? cover.info_list.find((info: any) => info?.url)?.url
    : null;
  const firstImage = Array.isArray(card.image_list)
    ? (card.image_list[0]?.url_default ?? card.image_list[0]?.url)
    : null;
  return cover.url_default ?? cover.url_pre ?? cover.url ?? fromList ?? firstImage ?? null;
}

/**
 * corner_tag_info 里可能同时有地点和时间标签，按 type 取而不是取 [0]。
 */
function pickPublishLabel(card: Record<string, any>): string | null {
  const tags = card.corner_tag_info;
  if (!Array.isArray(tags)) return null;
  const timeTag = tags.find((tag: any) => tag?.type === "publish_time" && tag?.text);
  return timeTag ? String(timeTag.text) : null;
}

/**
 * 部分响应会直接带 time 字段，但单位不统一（秒 / 毫秒）。按位数判断，
 * 小于 1e12 的当秒处理。
 */
function parseExplicitTime(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw < 1e12 ? raw * 1000 : raw;
}

/** 笔记链接不带 xsec_token 会 404，所以有 token 就一定拼上。 */
export function noteUrl(noteId: string, xsecToken: string | null): string {
  const base = `https://www.xiaohongshu.com/explore/${noteId}`;
  if (!xsecToken) return base;
  return `${base}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`;
}

/**
 * 用「归一化标题 + 作者 id」当第二层去重键，专治中介 / 搬运号把同一条内容
 * 反复重发（每次都是新 note_id，第一层去重挡不住）。
 *
 * 直接存字符串而不是 hash：反正只在本地存储里比对，省掉一层异步 crypto，
 * 也不用担心 hash 碰撞。标题为空时退回 noteId，避免一堆无标题笔记撞成同一个键。
 */
function buildContentKey(title: string, authorId: string | null, noteId: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .slice(0, 60);
  if (!normalizedTitle) return `id:${noteId}`;
  return `${normalizedTitle}|${authorId ?? ""}`;
}

/**
 * items 里混着非笔记条目（推荐搜索词、广告位），这些整条丢掉而不是半解析。
 */
export function normalizeItems(items: unknown[], now: number): Note[] {
  const notes: Note[] = [];

  for (const entry of items) {
    const item = entry as Record<string, any> | null;
    if (!item) continue;

    const card = item.note_card ?? item.noteCard;
    if (!card) continue;
    if (item.model_type && item.model_type !== "note") continue;

    const noteId: string | undefined = item.id ?? item.note_id ?? card.note_id;
    if (!noteId) continue;

    const title = String(card.display_title ?? card.title ?? "").trim();
    const authorId: string | null = card.user?.user_id ?? card.user?.userId ?? null;
    const label = pickPublishLabel(card);
    const explicitTime = parseExplicitTime(card.time);
    const xsecToken: string | null = item.xsec_token ?? card.xsec_token ?? null;

    notes.push({
      noteId,
      title,
      authorId,
      authorName: card.user?.nickname ?? card.user?.nick_name ?? null,
      coverUrl: pickCover(card),
      likedCount: parseCount(card.interact_info?.liked_count ?? card.interact_info?.likedCount),
      publishedAt: explicitTime ?? parsePublishLabel(label, now),
      publishedLabel: label,
      xsecToken,
      url: noteUrl(noteId, xsecToken),
      contentKey: buildContentKey(title, authorId, noteId),
      firstSeenAt: now,
    });
  }

  return notes;
}
