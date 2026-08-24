import { BARK_URL, DRY_RUN, SITE } from "./config";
import { dayPath } from "./links";
import type { Digest } from "./types";

/**
 * Bark push. BARK_URL is the device endpoint, e.g. https://api.day.app/<key>.
 * Notification failure is never fatal — the digest is already committed by the
 * time we get here.
 */
export async function notify(digest: Digest): Promise<void> {
  if (!BARK_URL) return;

  const failed = digest.sources.filter((s) => !s.ok);
  // `shown`, not `fetched`. The publish floor means a run can fetch plenty and
  // publish none, and the notification has to promise what the page delivers.
  const title =
    digest.stats.shown === 0
      ? `今日无更新 · ${digest.date}`
      : `每日干货 ${digest.stats.shown} 篇 · ${digest.date}`;

  // `||` not `??` — a failed summary is an empty string, not null, and an
  // empty Bark body renders as a blank notification.
  //
  // `.zh` ON PURPOSE, not through `summaryFor`: this push goes to one device that
  // belongs to whoever runs the digest, and the title beside it is Chinese too.
  // There is no reader language to honour here — there is one reader.
  const lead =
    digest.articles[0]?.summary.zh.thesis ||
    digest.articles[0]?.title ||
    "各源今天都没有新文章";
  const body = failed.length
    ? `${lead}（${failed.length} 个源抓取失败）`
    : lead;

  if (DRY_RUN) {
    console.log(`[daily] DRY_RUN — would push: ${title} / ${body}`);
    return;
  }

  const url = new URL(
    `${BARK_URL.replace(/\/+$/, "")}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`,
  );
  // Tapping the notification opens that day's permalink.
  // Through `dayPath`, and unprefixed: the default language needs no prefix and
  // the bare form is a real page now, so this no longer opens on a redirect.
  url.searchParams.set("url", `${SITE}${dayPath(digest.date)}`);
  url.searchParams.set("group", "daily");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("[daily] bark pushed");
  } catch (error) {
    console.error("[daily] bark push failed:", error);
  }
}
