import {
  DRY_RUN,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  SITE,
  WEBSUB_HUB,
} from "./config";
import { href, LANGS } from "./lang";
import { articlePath, dayPath } from "./links";
import { shownArticles } from "./store";
import type { Digest } from "./types";

/**
 * The one thing this app did not do after writing a digest: TELL ANYBODY.
 *
 * Everything else about discovery here is passive and correct — a sitemap with
 * `lastModified`, an Atom feed with the full text, `alternates` on every page —
 * and all of it waits to be fetched. For an archive that is the right shape. For
 * the front page of a daily publication it means the most valuable hour of a
 * digest's life is spent invisible: a crawler arrives on its own schedule, a feed
 * reader polls on its own, and the site has no way to say "now".
 *
 * TWO PROTOCOLS, TWO AUDIENCES, ONE MOMENT. IndexNow reaches the search indexes
 * that accept a push (Bing above all, which is what ChatGPT search and Copilot
 * answer from); WebSub reaches feed readers and aggregators. They are pinged from
 * the same place because they answer the same question, and because a publish is
 * the only event either one cares about.
 *
 * NOTHING HERE MAY FAIL THE RUN. Every request is wrapped, every failure is a
 * log line, and the caller needs no try/catch of its own. The digest is committed
 * and the site is already serving it by the time this is reached — an
 * unannounced day is a day that gets found the slow way, which is precisely the
 * status quo this replaces, not a regression from it.
 */

/** How long a ping may take before it is abandoned. Generous enough for a slow
 *  hop, short enough that two dead endpoints cannot add a minute to the run. */
const PING_TIMEOUT_MS = 10_000;

/**
 * Every URL this digest made new or changed, in both languages.
 *
 * THE DAY PAGE AND ITS ARTICLES, and deliberately not `/` or the archive. Those
 * two change today as well — but they are LISTS, and their content is the day
 * page's content seen from further away. Submitting them would spend a crawl on
 * a page whose novelty is entirely in the pages already named here, and the
 * sitemap's `lastModified` covers them for the crawler that wants the overview.
 *
 * Built through `href`/`dayPath`/`articlePath` rather than assembled from
 * strings, because a submitted URL that does not match the page's own
 * `<link rel="canonical">` is worse than no submission: it asks an index to
 * store an address this site does not claim. Those helpers are what every
 * canonical on the site is already built from, so the two cannot drift.
 *
 * Only published articles. `shownArticles` is the same filter the sitemap uses —
 * an article with no take has no page, and submitting one is submitting a 404.
 */
function publishedUrls(digest: Digest): string[] {
  const urls: string[] = [];
  for (const lang of LANGS) {
    urls.push(`${SITE}${href(lang, dayPath(digest.date))}`);
    for (const article of shownArticles(digest)) {
      urls.push(`${SITE}${href(lang, articlePath(digest.date, article))}`);
    }
  }
  return urls;
}

/**
 * Submit a batch of URLs to IndexNow.
 *
 * ONE POST FOR THE WHOLE DAY, which is what the protocol's batch form is for:
 * the limit is 10,000 URLs per request and a busy day here produces around
 * forty-two (twenty-odd articles plus a day page, twice for the two languages).
 * The single-URL GET form exists too and would be forty-two requests to say one
 * thing.
 *
 * `host` is the BARE HOSTNAME — no scheme, no trailing slash — and it must be
 * the host every URL in the list belongs to, or the whole batch is rejected as
 * mixed. Derived from SITE so a domain change cannot leave this behind.
 *
 * `keyLocation` is named explicitly even though the endpoint would look for
 * `${SITE}/${key}.txt` by default. It costs one field and it documents, at the
 * point of the request, where the other half of this lives — see INDEXNOW_KEY.
 *
 * THE STATUS CODES ARE WORTH READING and that is why they are logged rather than
 * ignored: 200 accepted, 202 accepted with the key not yet verified (normal on
 * the first submission), 400 malformed, 403 the key file does not match, 422 a
 * URL is not on `host`, 429 too many. Three of those five are configuration
 * mistakes that are invisible from the outside — a silent ping would leave this
 * feature looking like it worked for months.
 */
async function pingIndexNow(urls: string[]): Promise<void> {
  // An empty key means the feature is off, the same way an empty RESEND_API_KEY
  // turns the mail off. Nothing to verify ownership with, so nothing to send.
  if (!INDEXNOW_KEY) {
    console.log("[ping] no INDEXNOW_KEY — skipping");
    return;
  }
  if (urls.length === 0) return;

  const host = new URL(SITE).host;
  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  if (DRY_RUN) {
    console.log(
      `[ping] DRY_RUN — would submit ${urls.length} URL(s) to IndexNow ` +
        `(${urls[0]} …)`,
    );
    return;
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    console.log(
      `[ping] IndexNow ${response.status} for ${urls.length} URL(s)` +
        (response.ok ? "" : ` — ${await response.text().catch(() => "")}`),
    );
  } catch (error) {
    console.error(`[ping] IndexNow failed: ${(error as Error).message}`);
  }
}

/**
 * Tell the hub that a feed changed, so it can fan the new entries out to
 * whoever subscribed.
 *
 * ONE PING PER LANGUAGE, because there are two feeds. They are two publications
 * with different prose and different links (see lib/feed.ts), so a subscriber to
 * one must not be delivered the other.
 *
 * BOTH `hub.topic` AND `hub.url`, carrying the same value, and this is the one
 * piece of belt-and-braces here. `hub.url` is the parameter name from
 * PubSubHubbub 0.3 and it is what Google's hub documents; `hub.topic` is what
 * WebSub 0.4 renamed it to and what the W3C recommendation specifies. Google's
 * hub accepts either. Sending both means this keeps working if we ever move to a
 * spec-strict hub, and the cost is one duplicated form field.
 */
async function pingWebSub(): Promise<void> {
  for (const lang of LANGS) {
    const topic = `${SITE}${href(lang, "/feed.xml")}`;

    if (DRY_RUN) {
      console.log(`[ping] DRY_RUN — would publish ${topic} to ${WEBSUB_HUB}`);
      continue;
    }

    try {
      const response = await fetch(WEBSUB_HUB, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          "hub.mode": "publish",
          "hub.topic": topic,
          "hub.url": topic,
        }),
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      });
      console.log(`[ping] WebSub ${response.status} for ${topic}`);
    } catch (error) {
      console.error(
        `[ping] WebSub failed for ${topic}: ${(error as Error).message}`,
      );
    }
  }
}

/**
 * Everything to send after a digest is on disk. Called once, from `publishFrom`.
 *
 * NOT GATED ON THE PUSH SUCCEEDING. `commitAndPush` returns false for three
 * different outcomes — nothing changed, DRY_RUN, and a failed push — and only the
 * first of those means there is nothing to announce. The site serves the LOCAL
 * clone, so a digest is live the moment it is written and a push that failed is a
 * durability problem, not a visibility one: suppressing the ping there would hide
 * today's URLs for good, since tomorrow's run announces tomorrow's date.
 *
 * A re-run of the same date therefore re-announces it. That is acceptable in both
 * protocols — each is a "this changed, come look" hint rather than a submission
 * that accumulates — and the cron fires once a day, so the only thing that
 * repeats it is somebody running the job by hand.
 *
 * WebSub is not skipped on an empty day the way the mail is. An empty digest still
 * writes a page and the feed still changes (the day appears with nothing in it),
 * and a subscriber's client showing no new entries is the correct outcome rather
 * than an unwanted message. IndexNow gets the day page for the same reason.
 */
export async function announcePublished(digest: Digest): Promise<void> {
  const urls = publishedUrls(digest);
  // Sequential, not `Promise.all`: two independent services, and a burst of
  // parallel requests buys a few hundred milliseconds on a job that has already
  // spent minutes talking to a model.
  await pingIndexNow(urls);
  await pingWebSub();
}
