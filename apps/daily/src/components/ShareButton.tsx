"use client";

import { useEffect, useRef, useState } from "react";
import { ShareSheet } from "./ShareSheet";
import { strings } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { posterPartUrl } from "@/lib/links";
import { track } from "@/lib/track";

/**
 * How long the button will wait for the posters before opening the sheet anyway.
 *
 * A cold poster is ~830ms per part and a share carries up to five, so this does
 * not cover the worst case on purpose — it is the point past which a spinner is
 * worse than a half-loaded preview. On a timeout the sheet opens with its own
 * `<img>` loading and its own retry (see `attempts` in ShareSheet), which is
 * exactly the behaviour this preload replaced; nothing is lost but the wait.
 *
 * The requests are NOT aborted when it fires: they keep going and land in the
 * HTTP cache, so the reader's next press is served from there.
 */
const PREPARE_WAIT_MS = 4000;

/**
 * One poster, decoded and in cache — or failed, which resolves the same way.
 *
 * Both outcomes resolve because a part that cannot load must not hold the sheet
 * shut: the sheet retries it and drops it if the retry fails too, and a reader
 * whose part 3 is missing still wants the other three.
 *
 * `new Image()` rather than `fetch`: this warms the very cache entry the sheet's
 * `<img>` will read (`share.png` sends `public, max-age=3600`), and it decodes
 * the bytes as well as fetching them, so the preview paints on the first frame
 * instead of one frame later.
 */
function preloadPoster(href: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = href;
  });
}

/**
 * The card's share control: the pill, and the sheet it opens.
 *
 * It lives on the LIST, one per card, which is where a reader decides to pass
 * something on — they have just read the summary, and the thing they want is the
 * sheet, not another page. It used to be a plain link to the article page, and
 * the whole share block lived down there; that cost a navigation to reach the
 * one action the pill was named after.
 *
 * WHAT GETS SHARED IS STILL THE ARTICLE PAGE. Sharing from the list does not mean
 * sharing the list: `url` is the permalink for this one article, so a link opens
 * on the piece it came from and the poster is that piece's poster.
 */
export function ShareButton({
  url,
  posterBase,
  parts,
  title,
  thesis,
  tags,
  lang,
}: {
  /**
   * This article's permalink, absolute or root-relative. Relative is resolved
   * against the current page after mount, so a caller never has to import SITE
   * from lib/config — that module also holds DEEPSEEK_API_KEY and GIT_TOKEN, and
   * a client component importing it drags the whole thing into the browser
   * bundle.
   */
  url: string;
  /** The poster route for this article, WITHOUT a `?part=`. */
  /** The base of this article's posters, WITHOUT a part or an extension —
   *  `posterPartUrl` adds those. See `posterBase` in lib/links. */
  posterBase: string;
  /** How many images this article's share carries — see the same prop on
   *  ShareSheet, and `posterParts` in lib/share.ts. */
  parts: number;
  title: string;
  /** The summary's opening sentence — see ShareSheet's `systemShare`. */
  thesis: string;
  /** This take's hashtags, WITHOUT their `#` — same place. Empty is ordinary:
   *  every digest archived before tags existed has none. */
  tags: string[];
  lang: Lang;
}) {
  const t = strings(lang);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * Absolute forms of both props, for the places a relative URL is not merely
   * inconvenient but wrong: an intent link hands the URL to ANOTHER origin, and
   * `navigator.share` rejects a relative one outright.
   *
   * Seeded with the props so the first paint has real hrefs, then resolved
   * against the document after mount, which is the earliest `location` exists.
   */
  const [links, setLinks] = useState({ page: url, poster: posterBase });
  /**
   * Whether the press is still waiting on the posters. TWO OF THEM, and they are
   * not redundant — the same split as `saving`/`savingRef` in ShareSheet.
   *
   * The REF is the guard: a second press has to be rejected synchronously, and
   * `setPreparing(true)` does not change the `preparing` the running handler
   * closed over, so a double click inside one render would start both preloads
   * and open the sheet twice.
   *
   * The STATE is the appearance, because `disabled` and the spinner have to come
   * from something React renders.
   */
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  /**
   * Whether the posters have all arrived once, so a reopen is instant.
   *
   * Latched only on a real completion, NOT on a timeout: a press that gave up
   * early may have given up on images that never came, and the next press is
   * worth another wait — one that the requests still in flight from the first
   * usually satisfy immediately out of cache.
   */
  const readyRef = useRef(false);

  useEffect(() => {
    setLinks({
      page: new URL(url, location.href).href,
      poster: new URL(posterBase, location.href).href,
    });
  }, [url, posterBase]);

  /**
   * Open the sheet, but not before there is something to see in it.
   *
   * The sheet used to open on the click and start fetching its previews after,
   * so the reader watched a row of empty boxes fill in one by one — the poster is
   * rendered per request and cannot be ready when the dialog appears. Waiting out
   * here instead means the first frame of the sheet is the finished thing.
   *
   * The wait is bounded by `PREPARE_WAIT_MS` and every failure resolves, so the
   * button always ends up opening the sheet. There is no path where a press does
   * nothing.
   */
  async function openWhenReady() {
    // The ref, not the state — see the note on both.
    if (preparingRef.current) return;
    if (readyRef.current) {
      setOpen(true);
      return;
    }

    preparingRef.current = true;
    setPreparing(true);
    track("share_open", { parts });
    /**
     * HOW LONG THE READER ACTUALLY WAITED, which is the one number that says
     * whether the spinner above was worth adding.
     *
     * `performance.now` rather than `Date.now`: this is an elapsed duration, and
     * the monotonic clock cannot be moved by an NTP correction mid-wait.
     */
    const started = performance.now();
    try {
      const loaded = await Promise.race([
        Promise.all(
          Array.from({ length: parts }, (_, at) =>
            preloadPoster(posterPartUrl(links.poster, at + 1)),
          ),
        ).then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(resolve, PREPARE_WAIT_MS, false),
        ),
      ]);
      if (loaded) readyRef.current = true;
      track("share_ready", {
        ms: Math.round(performance.now() - started),
        // The distinction that matters: a sheet that opened because the images
        // arrived, versus one that opened because the budget ran out and the
        // reader is about to see a half-drawn preview.
        timed_out: !loaded,
        parts,
      });
    } finally {
      preparingRef.current = false;
      setPreparing(false);
      setOpen(true);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(url, location.href).href);
      // After the write, not before: on http the clipboard throws and nothing
      // was copied, so counting the attempt would count a failure as a share.
      track("copy_link");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; on http the button simply does
      // nothing rather than throwing into the console.
    }
  }

  return (
    <>
      {/* Primary, and rightmost in the card's action row: passing a piece on is
          the action worth making obvious. */}
      <button
        type="button"
        className="relative cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper disabled:cursor-wait"
        onClick={openWhenReady}
        disabled={preparing}
      >
        {/* The label KEEPS ITS BOX while the spinner is up — `invisible`, not
            unmounted — so the pill does not change width mid-press and shove the
            rest of the card's action row sideways. */}
        <span className={preparing ? "invisible" : undefined}>{t.share}</span>
        {preparing ? (
          <span
            /* The only thing said out loud: the spinner is decoration, and
               `role="status"` is what makes the wait audible to a reader who
               cannot see it. */
            role="status"
            aria-label={t.preparing}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="size-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
          </span>
        ) : null}
      </button>

      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        page={links.page}
        poster={links.poster}
        parts={parts}
        title={title}
        thesis={thesis}
        tags={tags}
        onCopy={copy}
        copied={copied}
        lang={lang}
      />
    </>
  );
}
