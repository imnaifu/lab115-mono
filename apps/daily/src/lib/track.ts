/**
 * Sending an event to the analytics already on the page.
 *
 * WHY THIS EXISTS AT ALL: the site had page views and nothing else. The share
 * sheet is the heaviest thing in the codebase — the sheet and the poster layout
 * are over 1,300 lines between them — and not one of its outcomes was measured,
 * so every decision about it, including which destination tiles deserve the row,
 * rested on a guess. Same for the reader's actual exit: a digest exists so that
 * most of the time you do NOT have to open the original, and how often that bet
 * pays off was unknowable.
 *
 * NO SDK. It calls the `gtag` that `Analytics` already loads, and adds nothing
 * to the bundle but this function.
 */

/** GA's global, as much of it as this file uses. */
type Gtag = (command: "event", name: string, params?: EventParams) => void;

export type EventParams = Record<string, string | number | boolean>;

/**
 * Every event this site sends, named once.
 *
 * A UNION RATHER THAN `string`, because the failure mode of a typo here is
 * invisible: GA4 accepts any event name and files `shre_open` as its own event
 * forever, so the report shows a number that is quietly missing some of its
 * clicks. The compiler is the only thing that can catch that.
 *
 * Kept flat and snake_case to match GA4's own conventions for custom events.
 */
export type TrackEvent =
  /** The reader left for the original article. The digest's counter-metric. */
  | "read_original"
  /** The share sheet was opened — one per press, before the posters are ready. */
  | "share_open"
  /** The posters finished (or the wait was cut short) and the sheet appeared. */
  | "share_ready"
  /** A destination inside the sheet was chosen. */
  | "share_target"
  /** How the OS handover actually ended — with files, without, or dismissed. */
  | "share_result"
  | "copy_link"
  | "save_image"
  /** A preview that failed twice. Diagnostic: it means a poster is not arriving. */
  | "poster_failed"
  /** A category tab. Says whether the 全部 tab is used at all. */
  | "category_tab"
  /** The language switch, which has just come back from being hidden. */
  | "lang_switch"
  /** The end-of-page link on a day page, to the archive's full run of dates. */
  | "all_days_open"
  /** The front page's "更多" link into the archive, and the archive's own pager. */
  | "archive_open"
  /** The archive's end-of-page link back to the front page. */
  | "home_open"
  /** The masthead's install control was pressed — one per press, whether or not
   *  the browser had a native offer to make (`can_prompt` says which). */
  | "install_open"
  /**
   * How the browser's own install dialog ended. Only ever sent where there was
   * one to show, so `install_open` with `can_prompt` true and no `install_prompt`
   * after it means the reader read the steps and closed the sheet.
   */
  | "install_prompt"
  /**
   * The pull-to-refresh gesture completed. THE ONE NUMBER that says whether the
   * installed app is being used as an app — a reader who pulls is a reader who
   * came back to the same window rather than opening a new tab.
   */
  | "pull_refresh"
  /** A single day opened — from a row on the home page's list, or from an article
   *  page (`from` says which). */
  | "day_open";

/**
 * Fire and forget.
 *
 * SILENT WHEN THERE IS NO `gtag`, which is the normal case in three situations
 * and none of them is an error: development, where `Analytics` renders nothing on
 * purpose; a reader with a blocker; and the window between first paint and the
 * script loading, which is exactly when the fastest reader clicks something.
 *
 * In development it logs instead, so the events can be checked without a GA
 * property to send them to.
 */
export function track(event: TrackEvent, params?: EventParams): void {
  if (typeof window === "undefined") return;

  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!gtag) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[track]", event, params ?? {});
    }
    return;
  }
  gtag("event", event, params);
}
