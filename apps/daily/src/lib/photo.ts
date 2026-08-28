import { decodeEntities } from "./fetcher";
import { captionZh } from "./summarize";
import { USER_CONFIG } from "./user-config";
import type { DailyPhoto } from "./types";

/**
 * The day's opening photograph: Wikimedia's picture of the day.
 *
 * WHY THIS SOURCE. It needs no API key, which is the whole argument — every
 * alternative that looks better (Unsplash, Pexels) costs a credential, and a
 * credential is a thing that can be missing in one environment, expire, or get
 * rate-limited at 07:00 with nobody watching. The picture of the day is also
 * juried rather than algorithmic, changes every day without being asked, and
 * arrives with the artist, the licence, the file page and a written description
 * already attached. Measured against the others it is the only one that answers
 * "what is this a photo of" without a second request or a guess.
 *
 * WHAT IT IS NOT. It is not news, and it is not recent — the file behind
 * 2026-08-25 was shot in 2023. What ties it to the day is the description, which
 * Wikimedia often anchors to the date itself (the 08-25 photo of Beachy Head
 * carries "Matthew Webb made the first observed and unassisted swim across the
 * channel, reaching France on 25 August 1875"). That anchor is Wikimedia's own
 * fact, which is the only reason it is allowed to appear: see the caption note on
 * `DailyPhoto` for what this page will not write.
 *
 * ONE DIAL, IN config.json: `photoEnabled` turns the whole thing off. It used to
 * be two — `photoCaptionMaxChars` bounded the caption — and that one is gone: the
 * caption is a translation of Wikimedia's description now, so the description's
 * length IS the right length and a ceiling could only make the Chinese say less
 * than the English. The endpoint, the User-Agent and the timeout below stay in
 * code on purpose — they are operational, and the split is the one the README
 * states: editorial decisions in config.json, machine settings in the source.
 * Swapping the endpoint is not a setting either way, because a different feed
 * needs different parsing.
 */

/**
 * Wikimedia asks that clients identify themselves and say how to be reached, and
 * throttles the ones that do not.
 *
 * DELIBERATELY NOT `UA` FROM fetcher.ts. That constant impersonates Chrome
 * because several blogs 403 a bare fetch — the opposite requirement. Reusing it
 * here would send a browser string to the one host that wants a real name.
 */
const UA = "lab115-daily/1.0 (https://daily.lab115.com; naifu.xu@newsbreak.com)";

/** One request, and the page has no photo if it does not come back. Shorter than
 *  the article fetches' 30s: nothing downstream depends on this. */
const TIMEOUT_MS = 12_000;

/** The `featured` endpoint's shape, narrowed to the parts read below. Fields are
 *  optional because a missing one is an ordinary answer, not a broken payload. */
interface FeaturedResponse {
  image?: {
    title?: string;
    thumbnail?: { source?: string; width?: number; height?: number };
    image?: { source?: string; width?: number; height?: number };
    file_page?: string;
    artist?: { text?: string };
    license?: { type?: string; url?: string };
    description?: { text?: string; lang?: string };
    /** Hand-written LABELS per language code — a title for the file rather than
     *  a description of it, which is why the caption below is translated from
     *  `description.text` and only falls back to these. Which codes exist varies
     *  by file: the 08-25 photo had en, fr, ru, hi, pa, sa and `zh-hant`, and no
     *  simplified Chinese at all. */
    structured?: { captions?: Record<string, string> };
  };
}

/**
 * Drop Wikimedia's own analytics parameters.
 *
 * The API appends `utm_source=commons.wikimedia.org&utm_campaign=…` to both
 * image URLs, which is a reasonable thing for it to do — we did not arrive from
 * a Commons page, so the claim would be false, and it is 60 characters of query
 * string in every archived JSON file besides.
 */
function withoutTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * The thumbnail's REAL pixel size, which the API does not report correctly.
 *
 * Measured on the 08-25 photo: `thumbnail.width/height` said 640×598 while the
 * `thumbnail.source` it handed over serves 960×897. Trusting the fields would
 * put a wrong aspect ratio in the `<img>` and reserve the wrong box.
 *
 * The width is in the URL — Wikimedia's thumbnail paths end in `<N>px-<name>`,
 * and that N is the contract. The height comes from the ORIGINAL's ratio rather
 * than from the API, because the ratio is the one thing both agree on
 * (960 × 4700/5030 = 897, exactly what the file serves).
 */
function thumbSize(
  url: string,
  original: { width?: number; height?: number },
  reported: { width?: number; height?: number },
): { width: number; height: number } | null {
  const fromUrl = Number(url.match(/\/(\d+)px-[^/]+$/)?.[1]);
  const width = fromUrl || reported.width;
  if (!width) return null;

  const originalWidth = original.width;
  const originalHeight = original.height;
  if (originalWidth && originalHeight) {
    return {
      width,
      height: Math.round((width * originalHeight) / originalWidth),
    };
  }
  // No original to take the ratio from: the reported height is all there is, and
  // being slightly off beats reserving no box at all.
  return reported.height ? { width, height: reported.height } : null;
}

/**
 * Wikimedia's own text, decoded and trimmed.
 *
 * `description.text` and the structured captions arrive stripped of tags but NOT
 * of entities — the 08-26 lithograph's description reads `published by Ackermann
 * &amp; Co.` — and that string is printed as-is on the page.
 */
function text(value: string | undefined): string {
  return value ? decodeEntities(value).trim() : "";
}

/** The simplified-Chinese caption Wikimedia already holds, if it holds one.
 *  `zh-hant` is NOT accepted — the site is written in simplified Chinese, and
 *  shipping traditional text would be a visible language switch mid-page. */
function chineseCaption(captions: Record<string, string> = {}): string {
  return text(captions.zh ?? captions["zh-hans"]);
}

/**
 * The photo for one day, or null.
 *
 * NULL IS AN ORDINARY RESULT, not an error to handle. Wikimedia can be slow, the
 * endpoint occasionally has no `image` for a date, and a file can arrive without
 * the artist the licence obliges us to print. In all three cases the day simply
 * has no photo and the page renders without the card — which is why the job
 * calls this outside anything that could fail a run. A photo is decoration; the
 * takes are the product.
 *
 * @param date `yyyy-mm-dd`, THE DIGEST'S OWN DATE and not today's.
 *
 * The two agree on the live path and must not be assumed to: `npm run summary`
 * can publish hours after the scoring, and a backfill runs against dates long
 * past — both need the picture that ran on the day being written, the same
 * reasoning as the `window` field in jobs/daily.ts.
 *
 * The endpoint keys on the UTC date while a digest is keyed on Los Angeles, and
 * the two cannot disagree here: 07:00 in Los Angeles is 14:00 or 15:00 UTC on
 * the same day, in either half of the year.
 */
export async function dailyPhoto(date: string): Promise<DailyPhoto | null> {
  // Checked here rather than at the call site, so "no photo today" has exactly
  // one shape for the job to handle whatever the reason.
  if (!USER_CONFIG.photoEnabled) return null;

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return null;

  const endpoint =
    `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/` +
    `${year}/${month}/${day}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[daily] photo — HTTP ${response.status} from Wikimedia`);
      return null;
    }

    const image = ((await response.json()) as FeaturedResponse).image;
    if (!image) {
      console.log(`[daily] photo — Wikimedia has no picture for ${date}`);
      return null;
    }

    const source = image.thumbnail?.source;
    const artist = text(image.artist?.text);
    const licenseName = image.license?.type?.trim();
    const licenseUrl = image.license?.url?.trim();
    const filePage = image.file_page;

    /**
     * Four fields or nothing, and the licence is why. Attribution is a condition
     * of use rather than a courtesy — the 08-25 file reports
     * `AttributionRequired: true` — so a photo we cannot credit is a photo we
     * cannot publish. Deciding it here keeps the component free of a
     * partial-credit branch.
     *
     * THE LICENCE URL IS NOT ONE OF THE FOUR. Public-domain files have no deed
     * to link and Wikimedia sends none; requiring it rejected an 1843 lithograph
     * on the grounds that it was too free to use. See `DailyPhoto.license`.
     */
    if (!source || !artist || !licenseName || !filePage) {
      console.warn(
        `[daily] photo — ${image.title ?? "untitled"} is missing credit ` +
          `fields, so it is not used`,
      );
      return null;
    }

    const src = withoutTracking(source);
    const size = thumbSize(src, image.image ?? {}, image.thumbnail ?? {});
    if (!size) {
      console.warn(`[daily] photo — cannot size ${src}, so it is not used`);
      return null;
    }

    const captions = image.structured?.captions;
    const english = text(image.description?.text);
    /**
     * The ENGLISH DESCRIPTION is preferred over `structured.captions.en` for the
     * English half: both are one sentence about the photo, but the description is
     * the longer of the two and it is the one carrying the date anchor. The
     * structured caption is the fallback for the days it is missing.
     */
    const en = english || text(captions?.en);
    /**
     * THE CHINESE IS A TRANSLATION OF THE ENGLISH DESCRIPTION, and Wikimedia's own
     * simplified-Chinese caption is what answers when there is no English to
     * translate.
     *
     * The preference used to run the other way, and it was comparing two things
     * that are not the same kind of string. `description.text` is a written
     * sentence about the photograph and it carries the day's anchor — the reason
     * the picture is on today's page at all. `structured.captions.zh` is a LABEL:
     * 「多洛米堤山脚下的科尔代湖」, twelve characters against 230 of English about
     * the same lake, with the World Lake Day line that ties it to the date nowhere
     * in it. Across the archive the Chinese ran 11 to 19 times shorter than the
     * English, and none of that gap was the two languages' exchange rate.
     *
     * The three-step fallback is stated HERE rather than inside `captionZh`
     * because this is the only place that knows all three strings exist. A
     * translation failure lands on the label, and a photo with neither keeps the
     * English line rather than being dropped for want of words.
     *
     * THE LABEL IS ALSO HANDED TO THE TRANSLATION, and that is not the same use of
     * it: as a fallback it is a whole caption, and as an argument it is a glossary
     * of one entry — how the subject's name is written in Chinese, which is the
     * one thing the translation cannot work out and kept getting wrong. See the
     * `zhLabel` note in summarize.ts for the three names one lake was given.
     */
    const label = chineseCaption(captions);
    const zh = (await captionZh(en, date, label)) || label || en;

    // A photo with no words under it is a decoration with no reason to be on a
    // page that is otherwise entirely text.
    if (!zh) {
      console.warn(`[daily] photo — no caption for ${image.title}, not used`);
      return null;
    }

    console.log(`[daily] photo — ${image.title} (${licenseName})`);
    return {
      src,
      width: size.width,
      height: size.height,
      filePage,
      artist,
      license: {
        name: licenseName,
        ...(licenseUrl ? { url: licenseUrl } : {}),
      },
      caption: { zh, ...(en ? { en } : {}) },
    };
  } catch (error) {
    console.warn(`[daily] photo — ${(error as Error).message}`);
    return null;
  }
}
