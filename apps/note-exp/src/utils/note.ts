/**
 * Note parsing utilities
 * Pure helpers that turn intercepted Xiaohongshu API items into PostData.
 */

import { type PostData } from "./csv";
import { normalizePublishTime } from "./datetime";

/**
 * Renders an interact_info counter as text, leaving it empty when the API
 * didn't return it. Only the search endpoint returns the full interact_info;
 * the homepage feed (/ and /explore) and user_posted only carry liked_count.
 * An absent counter must stay blank so a reader can tell "not provided" apart
 * from a genuine zero — the previous `?? 0` fallback made every /explore row
 * look like it had 0 collects/comments/shares.
 */
function toCountText(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/**
 * Converts a single intercepted note item into a PostData object.
 * Returns null when the item has no note_card payload.
 *
 * `baseOrigin` is the origin of the page the user is browsing (e.g.
 * https://www.xiaohongshu.com or https://www.rednote.com) so the generated
 * author link points at the same site the data came from.
 */
export function parseNoteToPostData(
  raw: any,
  baseOrigin: string
): PostData | null {
  // Search items wrap the note under note_card; non-note items (e.g. hot_query
  // recommend cards) have no note_card and are dropped.
  if (!raw?.note_card) return null;
  const note = raw.note_card;

  const title = note.display_title ?? "";
  const authorName = note.user?.nickname ?? "";
  const userId = note.user?.user_id ?? "";

  const authorUrl = userId ? `${baseOrigin}/user/profile/${userId}` : "";

  const coverUrl = note.cover?.url_default ?? "";

  const imageUrls: string[] = Array.isArray(note.image_list)
    ? note.image_list
        .map((img: any) => {
          if (Array.isArray(img.info_list) && img.info_list.length > 0) {
            return img.info_list[0]?.url ?? "";
          }
          return img.url_default ?? "";
        })
        .filter(Boolean)
    : [];

  // Prefer the corner tag explicitly marked as publish_time; some items put a
  // location tag at index 0, so picking by type is more reliable than [0].
  const publishTimeTag = Array.isArray(note.corner_tag_info)
    ? note.corner_tag_info.find((tag: any) => tag?.type === "publish_time")
    : null;
  const publishTime = normalizePublishTime(publishTimeTag?.text ?? "");

  const likeCount = toCountText(note.interact_info?.liked_count);
  const collectCount = toCountText(note.interact_info?.collected_count);
  const commentCount = toCountText(note.interact_info?.comment_count);
  // List APIs name it shared_count; the note-detail feed API calls it
  // share_count, so accept either rather than silently emitting an empty cell.
  const sharedCount = toCountText(
    note.interact_info?.shared_count ?? note.interact_info?.share_count
  );

  // Build a link to the note's detail page from its id. The xsec_token (when
  // present on the item) is required for the link to open without a login
  // wall, so include it as a query param when available.
  const noteId = raw.id ?? note.note_id ?? "";
  const xsecToken = raw.xsec_token ?? note.user?.xsec_token ?? "";
  const noteUrl = noteId
    ? `${baseOrigin}/explore/${noteId}${
        xsecToken
          ? `?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`
          : ""
      }`
    : "";

  return {
    title,
    authorName,
    publishTime,
    likeCount,
    collectCount,
    commentCount,
    sharedCount,
    coverUrl,
    authorUrl,
    imageUrls,
    noteUrl,
  };
}

/**
 * Converts a list of intercepted note items into PostData objects,
 * skipping any item that can't be parsed.
 */
export function parseInterceptedDataLocal(
  items: any,
  baseOrigin: string
): PostData[] {
  const posts: PostData[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      const parsed = parseNoteToPostData(item, baseOrigin);
      if (parsed) posts.push(parsed);
    }
  }
  return posts;
}
