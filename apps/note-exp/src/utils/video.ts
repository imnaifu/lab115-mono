/**
 * Post-detail parsing utilities
 * Pure helpers that turn an intercepted note-detail (feed) item into a
 * PostDetail: the playable video stream plus its metadata, the image list, and
 * author/time info. Unlike the search/list API, the feed API
 * (/api/sns/web/v1/feed) carries the video stream URLs under
 * note_card.video.media.stream.
 */

export interface VideoInfo {
  // The directly playable/downloadable .mp4 URL — the watermark-free original
  // (built from consumer.origin_video_key) when available, otherwise the
  // stream master_url.
  url: string;
  // Fallback URLs tried in order when the primary url fails to download:
  // remaining watermark-free CDN mirrors first, then the watermarked stream
  // URLs (master_url + backup_urls) as a last resort.
  backupUrls: string[];
  duration: string; // "mm:ss"
  size: string; // human-readable, e.g. "38.2 MB"
  resolution: string; // "WIDTHxHEIGHT"
}

export interface ImageInfo {
  url: string;
  width: number;
  height: number;
  // Live Photo (实况图) motion clip: primary .mp4 URL first, then backups.
  // Empty for ordinary still images.
  liveUrls: string[];
}

// Everything the note.txt export needs beyond what the post head shows.
// Counts stay as the API's display text ("1.2万"), the same figures the page
// itself shows.
export interface NoteText {
  desc: string; // body with topic markers cleaned up
  tags: string[];
  ipLocation: string;
  publishedAt: string; // YYYY-MM-DD HH:mm
  likes: string;
  collects: string;
  comments: string;
  shares: string;
}

export interface PostDetail {
  noteId: string;
  title: string;
  author: string;
  avatar: string;
  time: string; // YYYY-MM-DD
  noteUrl: string;
  video: VideoInfo | null;
  images: ImageInfo[];
  text: NoteText;
}

// Codecs are listed in preference order: h264 is the most universally
// playable/downloadable, so we take it first and only fall back to newer
// codecs when h264 is absent.
const STREAM_CODEC_PREFERENCE = ["h264", "h265", "av1", "h266"];

// CDN hosts serving the original (watermark-free) upload addressed by
// consumer.origin_video_key. They are mirrors of the same file; bd is the
// commonly working one, hw/al are alternates.
const NO_WATERMARK_CDN_HOSTS = [
  "https://sns-video-bd.xhscdn.com",
  "https://sns-video-hw.xhscdn.com",
  "https://sns-video-al.xhscdn.com",
];

/** Formats a byte count as a human-readable MB string, e.g. "38.2 MB". */
function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats a millisecond duration as "mm:ss". */
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Formats an epoch-ms timestamp as YYYY-MM-DD (local time). */
function formatDate(epochMs: number): string {
  if (!epochMs) return "";
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats an epoch-ms timestamp as YYYY-MM-DD HH:mm (local time). */
function formatDateTime(epochMs: number): string {
  const day = formatDate(epochMs);
  if (!day) return "";
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${hours}:${minutes}`;
}

/** First entry with a master_url in a variant list, or null. */
function firstVariantWithUrl(variants: any): any | null {
  if (!Array.isArray(variants)) return null;
  return variants.find((entry: any) => entry?.master_url) ?? null;
}

/**
 * Walks codecs in preference order and returns the first stream variant with
 * a master_url, or null. Shared by note videos and Live Photo clips, which use
 * the same { <codec>: [{ master_url, backup_urls, ... }] } stream shape.
 */
function pickStreamVariant(stream: any): any | null {
  if (!stream || typeof stream !== "object") return null;
  for (const codec of STREAM_CODEC_PREFERENCE) {
    const variant = firstVariantWithUrl(stream[codec]);
    if (variant) return variant;
  }
  // Live Photos key their variants with opaque names instead (EF4–EF7 seen in
  // Nov 2026, only EF4 filled), and the SSR camel→snake conversion turns those
  // into "_e_f4". So fall back to any key holding a playable variant, sorted so
  // EF4 is tried before EF5.
  for (const key of Object.keys(stream).sort()) {
    const variant = firstVariantWithUrl(stream[key]);
    if (variant) return variant;
  }
  return null;
}

/** A stream variant's master_url followed by its backup_urls. */
function variantUrls(variant: any): string[] {
  return [
    variant.master_url,
    ...(Array.isArray(variant.backup_urls)
      ? variant.backup_urls.filter(Boolean)
      : []),
  ];
}

/** Picks the best video stream variant across codecs, or null if none. */
function pickVideoInfo(note: any): VideoInfo | null {
  const variant = pickStreamVariant(note.video?.media?.stream);
  if (!variant) return null;

  // The stream variants are watermarked encodes (stream_desc "WM_..."), while
  // consumer.origin_video_key addresses the original watermark-free upload on
  // the sns-video CDNs. Prefer the watermark-free file and keep the
  // watermarked stream URLs as last-resort fallbacks so downloads still
  // succeed if the key is missing or those CDNs reject the request.
  const originVideoKey = note.video?.consumer?.origin_video_key;
  const watermarkFreeUrls = originVideoKey
    ? NO_WATERMARK_CDN_HOSTS.map((host) => `${host}/${originVideoKey}`)
    : [];
  const watermarkedStreamUrls = variantUrls(variant);
  const [primaryUrl, ...fallbackUrls] = [
    ...watermarkFreeUrls,
    ...watermarkedStreamUrls,
  ];

  return {
    url: primaryUrl,
    backupUrls: fallbackUrls,
    duration: formatDuration(variant.duration ?? variant.video_duration ?? 0),
    // Size/resolution metadata only exists on the stream variant; the original
    // file's size differs slightly from the watermarked encode's.
    size: formatSize(variant.size ?? 0),
    resolution:
      variant.width && variant.height
        ? `${variant.width}×${variant.height}`
        : "",
  };
}

/** Extracts the downloadable image URLs from a note's image_list. */
function pickImages(note: any): ImageInfo[] {
  if (!Array.isArray(note.image_list)) return [];
  return note.image_list
    .map((img: any): ImageInfo | null => {
      // Prefer url_default (full-size); fall back to the WB_DFT scene in
      // info_list, then any info_list entry.
      let url = img.url_default ?? "";
      if (!url && Array.isArray(img.info_list)) {
        const dft = img.info_list.find(
          (info: any) => info?.image_scene === "WB_DFT"
        );
        url = dft?.url ?? img.info_list[0]?.url ?? "";
      }
      if (!url) return null;
      // Live Photos carry their motion clip under img.stream in the same
      // per-codec shape as note videos (flagged live_photo: true). Ordinary
      // images have an empty stream, so a playable variant alone decides —
      // not the flag, in case it is missing or renamed.
      const liveVariant = pickStreamVariant(img.stream);
      return {
        url,
        width: img.width ?? 0,
        height: img.height ?? 0,
        liveUrls: liveVariant ? variantUrls(liveVariant) : [],
      };
    })
    .filter((img: ImageInfo | null): img is ImageInfo => img !== null);
}

/**
 * Turns the body's inline topic markers into plain hashtags: XHS writes a
 * topic as "#name[话题]#" (the bracket word varies by site language), which
 * reads as noise in a text file.
 */
function cleanDesc(desc: string): string {
  return desc.replace(/#([^#\n\[\]]+)\[[^\]\n]*\]#/g, "#$1").trim();
}

/** Builds the NoteText block from a feed note_card. */
function pickNoteText(note: any): NoteText {
  const interact = note.interact_info ?? {};
  const asText = (value: any) =>
    value === undefined || value === null ? "" : String(value);
  return {
    desc: cleanDesc(note.desc ?? ""),
    tags: Array.isArray(note.tag_list)
      ? note.tag_list.map((tag: any) => tag?.name).filter(Boolean)
      : [],
    ipLocation: note.ip_location ?? "",
    publishedAt: formatDateTime(note.time ?? note.last_update_time ?? 0),
    likes: asText(interact.liked_count),
    collects: asText(interact.collected_count),
    comments: asText(interact.comment_count),
    // The feed API names it share_count; list APIs say shared_count.
    shares: asText(interact.share_count ?? interact.shared_count),
  };
}

/**
 * Converts a single intercepted feed item into a PostDetail object.
 * Handles both video notes (with a playable stream) and image (图文) notes.
 * Returns null only when the item has nothing downloadable — neither a
 * resolvable video stream nor any images.
 */
export function parseNoteDetail(raw: any, baseOrigin: string): PostDetail | null {
  const note = raw?.note_card;
  if (!note) return null;

  // video is null for image-only (图文) posts — that's expected.
  const video = pickVideoInfo(note);
  const images = pickImages(note);
  // Nothing to download (no stream and no images) → skip.
  if (!video && images.length === 0) return null;

  const noteId = note.note_id ?? raw.id ?? "";
  // The feed response carries no note-scoped xsec_token (only the search/list
  // API does). We intentionally do NOT fall back to note.user.xsec_token —
  // that's the author-profile token and produces a broken /explore link
  // (error 300031). When no note token is available, emit the bare /explore
  // path; the popup overrides this with the live page URL (which has a working
  // token + xsec_source) for the note the user currently has open.
  const xsecToken = raw.xsec_token ?? "";
  const noteUrl = noteId
    ? `${baseOrigin}/explore/${noteId}${
        xsecToken
          ? `?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_feed`
          : ""
      }`
    : "";

  return {
    noteId,
    title: note.title ?? "",
    author: note.user?.nickname ?? "",
    avatar: note.user?.avatar ?? "",
    time: formatDate(note.time ?? note.last_update_time ?? 0),
    noteUrl,
    video,
    images,
    text: pickNoteText(note),
  };
}

// Field labels for note.txt, supplied by the popup in the UI language. Each
// includes its own separator ("Author: ", "作者：") since CJK uses a
// full-width colon.
export interface NoteTextLabels {
  author: string;
  published: string;
  ip: string;
  counts: string; // e.g. "Likes / Collects / Comments / Shares"
  tags: string;
  link: string;
}

/**
 * Renders a post as the plain-text note.txt saved next to its media: a
 * "label: value" header (empty fields skipped), then the body.
 */
export function formatNoteText(post: PostDetail, labels: NoteTextLabels): string {
  const { text } = post;
  const counts = [text.likes, text.collects, text.comments, text.shares];
  const header: Array<[string, string]> = [
    [labels.author, post.author],
    [labels.published, text.publishedAt || post.time],
    [labels.ip, text.ipLocation],
    [labels.counts, counts.some(Boolean) ? counts.map((c) => c || "-").join(" / ") : ""],
    [labels.tags, text.tags.map((tag) => `#${tag}`).join(" ")],
    [labels.link, post.noteUrl],
  ];
  const lines = [
    post.title,
    "",
    ...header.filter(([, value]) => value).map(([label, value]) => `${label}${value}`),
  ];
  if (text.desc) lines.push("", text.desc);
  return lines.join("\n").trim() + "\n";
}
