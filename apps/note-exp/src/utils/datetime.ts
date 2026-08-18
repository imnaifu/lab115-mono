/**
 * Date/time utility functions
 * Pure helpers for normalizing Xiaohongshu publish_time values.
 */

/**
 * Formats a Date into a standard YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  // getMonth() is 0-based; pad month/day to 2 digits for a stable format
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes Xiaohongshu's publish_time text into a YYYY-MM-DD date.
 *
 * The corner tag uses several relative/partial formats (e.g. "昨天 22:33",
 * "5天前", "2小时前", "09-20", "2024-08-09"). We resolve them against the
 * current time so the exported CSV always has comparable absolute dates.
 * Unrecognized values are returned unchanged so we never corrupt real data.
 */
export function normalizePublishTime(text: string): string {
  if (!text) return "";
  const raw = text.trim();
  const now = new Date();

  // 刚刚 / X分钟前 / X小时前 / 今天 → all fall on the current day
  if (
    raw === "刚刚" ||
    raw.endsWith("分钟前") ||
    raw.endsWith("小时前") ||
    raw.startsWith("今天")
  ) {
    return formatDate(now);
  }

  // 昨天 [HH:mm] → current day minus 1
  if (raw.startsWith("昨天")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return formatDate(date);
  }

  // 前天 [HH:mm] → current day minus 2
  if (raw.startsWith("前天")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 2);
    return formatDate(date);
  }

  // X天前 → current day minus X
  const daysAgoMatch = raw.match(/^(\d+)\s*天前$/);
  if (daysAgoMatch) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(daysAgoMatch[1], 10));
    return formatDate(date);
  }

  // X周前 → current day minus 7X
  const weeksAgoMatch = raw.match(/^(\d+)\s*周前$/);
  if (weeksAgoMatch) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(weeksAgoMatch[1], 10) * 7);
    return formatDate(date);
  }

  // Already an absolute date YYYY-MM-DD → just zero-pad it
  const fullDateMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // MM-DD → assume the current year, unless that lands in the future,
  // in which case the post is from last year (e.g. viewing "12-20" in January)
  const monthDayMatch = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);
    let year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate.getTime() > now.getTime()) {
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  // Unrecognized format (e.g. a location tag) → keep as-is
  return raw;
}
