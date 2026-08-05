/**
 * Raw search-API payload → our own flat shape.
 *
 * Everything here is defensive: the response schema is undocumented and
 * changes without notice, so each field falls back rather than throwing. A
 * note with an id and a title is already useful enough to email.
 */

export interface NormalizedNote {
  noteId: string;
  watchId: string;
  title: string;
  description: string;
  authorId: string | null;
  authorName: string | null;
  coverUrl: string | null;
  likedCount: number;
  /** Epoch ms, or null when the payload carries no timestamp at all. */
  publishedAt: number | null;
  /** The raw "3小时前" / "01-15" label, kept for the email body. */
  publishedLabel: string | null;
  xsecToken: string | null;
}

/** "1.2万" → 12000, "3,456" → 3456, "赞" → 0 */
export function parseCount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const text = raw.replace(/[,\s+]/g, "");
  const match = text.match(/^([\d.]+)(万|亿)?/);
  if (!match?.[1]) return 0;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2];
  if (unit === "万") return Math.round(value * 1e4);
  if (unit === "亿") return Math.round(value * 1e8);
  return Math.round(value);
}

/**
 * Xiaohongshu shows relative labels ("昨天", "3小时前") or bare dates
 * ("01-15", "2024-12-01"). Returns epoch ms, or null when unparseable.
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

  const fullDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDate) return Date.UTC(+fullDate[1]!, +fullDate[2]! - 1, +fullDate[3]!);

  // "01-15" has no year — assume the most recent occurrence of that date.
  const monthDay = text.match(/^(\d{2})-(\d{2})$/);
  if (monthDay) {
    const year = new Date(now).getUTCFullYear();
    const guess = Date.UTC(year, +monthDay[1]! - 1, +monthDay[2]!);
    return guess > now ? Date.UTC(year - 1, +monthDay[1]! - 1, +monthDay[2]!) : guess;
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

function pickPublishLabel(card: Record<string, any>): string | null {
  const tags = card.corner_tag_info;
  if (Array.isArray(tags)) {
    const timeTag = tags.find((tag: any) => tag?.type === "publish_time" && tag?.text);
    if (timeTag) return String(timeTag.text);
  }
  return null;
}

/**
 * `items` also contains non-note entries (recommended queries, ad slots);
 * those are dropped rather than half-parsed.
 */
export function normalizeItems(items: unknown[], watchId: string, now: number): NormalizedNote[] {
  const notes: NormalizedNote[] = [];

  for (const entry of items) {
    const item = entry as Record<string, any> | null;
    if (!item) continue;

    const card = item.note_card ?? item.noteCard;
    if (!card) continue;
    if (item.model_type && item.model_type !== "note") continue;

    const noteId: string | undefined = item.id ?? item.note_id ?? card.note_id;
    if (!noteId) continue;

    const label = pickPublishLabel(card);
    const explicitTime = typeof card.time === "number" ? card.time : null;

    notes.push({
      noteId,
      watchId,
      title: String(card.display_title ?? card.title ?? "").trim(),
      description: String(card.desc ?? "").trim(),
      authorId: card.user?.user_id ?? card.user?.userId ?? null,
      authorName: card.user?.nickname ?? card.user?.nick_name ?? null,
      coverUrl: pickCover(card),
      likedCount: parseCount(card.interact_info?.liked_count ?? card.interact_info?.likedCount),
      publishedAt: explicitTime ?? parsePublishLabel(label, now),
      publishedLabel: label,
      xsecToken: item.xsec_token ?? card.xsec_token ?? null,
    });
  }

  return notes;
}

/** Note links 404 without a valid xsec_token, so it is always appended. */
export function noteUrl(noteId: string, xsecToken: string | null): string {
  const base = `https://www.xiaohongshu.com/explore/${noteId}`;
  return xsecToken ? `${base}?xsec_token=${xsecToken}&xsec_source=pc_search` : base;
}
