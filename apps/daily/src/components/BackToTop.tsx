"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";

/**
 * A floating button that puts the reader back at the masthead.
 *
 * THE PAGES HERE ARE LONG BY DESIGN — the front page lists a week, a day page
 * carries every summary that day produced, and the archive pages a whole run of
 * dates. Every one of them ends in a link that leads somewhere ELSE (see
 * `EndLink`), so a reader who scrolled to the bottom to read the last summary and
 * then wants the language switch, the install control or simply the next day's
 * row has nothing to do but swipe back up through everything they just read.
 *
 * It is the counterpart to PullToRefresh at the other end of the page: that one
 * is a gesture with no button, this one is a button because there is no gesture —
 * iOS has its status-bar tap and nothing else does.
 */

/**
 * How far down the button appears, as a multiple of the viewport.
 *
 * ONE SCREEN, not a fixed pixel count. The point of the button is to shorten a
 * return trip that is already too long to swipe, and "too long" is measured in
 * screenfuls rather than in pixels — a phone and a desktop window disagree about
 * what 800px means. One screen is also the first moment the masthead is provably
 * off-screen, which is the thing being scrolled back to.
 */
const SHOW_AFTER_SCREENS = 1;

export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    /**
     * The pending rAF, or 0. Scroll fires far more often than the screen
     * repaints, and this collapses a burst of events into one read of
     * `scrollY` per frame — the value is only ever used to decide a boolean, so
     * reading it more often than that buys nothing.
     */
    let frame = 0;

    const read = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight * SHOW_AFTER_SCREENS);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    // Once up front: a reader arriving on a `#hash` — or coming back to a page
    // the browser restored the scroll position of — is already deep in it, and
    // without this the button would stay hidden until they moved.
    read();

    window.addEventListener("scroll", onScroll, { passive: true });
    // `innerHeight` is the threshold, so a rotation or a resized window changes
    // where the button belongs.
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    track("back_to_top");
    /**
     * Read at click time rather than held in state: the setting can change
     * under a running page, and this is one line either way.
     *
     * `auto` is not a lesser fallback — for a reader who asked for less motion,
     * being teleported to the top is the correct answer, and a smooth scroll
     * across several screens of text is exactly the sweep that setting exists
     * to turn off.
     */
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div
      /**
       * The wrapper spans the viewport but the row inside it is the PAGE COLUMN,
       * so on a wide screen the button sits against the content's right edge
       * rather than out in the margin beside it. `px-4 sm:px-7` is the same
       * gutter every block on the page uses — Shell's `PAD`, inlined rather than
       * imported, because importing a constant out of Shell.tsx would drag that
       * whole server module into the client bundle.
       *
       * `pointer-events-none` on the wrapper and `auto` on the button: the strip
       * of screen either side of it stays the page's, so a tap near the bottom
       * of a summary still lands on the summary.
       */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center"
      /* Below PullToRefresh's z-40 — they are at opposite ends of the screen and
         never overlap, but the indicator is transient feedback and this is
         furniture, so the ordering should not depend on that staying true. */
      aria-hidden={!shown}
    >
      <div
        className="flex w-full max-w-page justify-end px-4 sm:px-7"
        /* Clear of the home indicator in the installed app, and of nothing at
           all in a browser tab, where the inset is 0. */
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={toTop}
          /**
           * NOT REMOVED FROM THE TREE WHEN HIDDEN — it fades and lifts, which
           * needs both states rendered. `tabIndex={-1}` is what keeps it out of
           * the tab order while it is invisible: a keyboard reader at the top of
           * the page must not tab into a control they cannot see, and the
           * `aria-hidden` above covers the same case for a screen reader.
           */
          tabIndex={shown ? 0 : -1}
          aria-label={label}
          title={label}
          className={`pointer-events-auto flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink-mid shadow-soft transition duration-200 ease-out ${
            shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {/* The same arrow PullToRefresh draws, pointing the other way — one
              vocabulary for "this moves the page vertically". */}
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 13.2V2.8M3.4 7.4 8 2.8l4.6 4.6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
