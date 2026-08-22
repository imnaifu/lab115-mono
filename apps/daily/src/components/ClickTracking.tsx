"use client";

import { useEffect } from "react";
import { track, type EventParams, type TrackEvent } from "@/lib/track";

/**
 * ONE listener for every tracked link on the page, read off `data-track`.
 *
 * WHY DELEGATED, rather than an `onClick` on each link: almost everything worth
 * counting is inside a SERVER component — the "read the original" pill lives in
 * `ArticleCards`, the archive rows in a page, the language switch in `Shell` —
 * and a component with an event handler has to be a client component. Adding one
 * to `ArticleCards` would drag `Summary`, `Cover` and `ArticleTitle` across the
 * boundary with it, for a handler that does nothing but count. The README treats
 * "DigestBody is the only client component" as a property worth keeping, and this
 * keeps it: a server component gets an ATTRIBUTE, which is just markup.
 *
 * The client components that already exist — the share sheet, the tabs — call
 * `track` directly instead. They carry numbers no attribute could hold (how long
 * a poster took, whether the OS handover took the files), and they are already
 * across the boundary.
 *
 * `capture` and no `preventDefault`: this only ever observes. A navigation that
 * starts before the beacon leaves is fine — `gtag` posts asynchronously and GA's
 * own transport handles an unload mid-flight — and it is emphatically better than
 * delaying a reader's click to be sure of a metric.
 */
export function ClickTracking() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      /**
       * RIGHT-CLICK IS NOT A CLICK, but the middle button is.
       *
       * `click` fires for the left and middle buttons only, so a context menu
       * never reaches here. Middle-click and ⌘-click do, and they should: both
       * open the link, just in a tab the reader comes back to. Counting them is
       * the difference between "opened the original" and "opened the original in
       * the way I happened to think of".
       */
      const target = event.target;
      if (!(target instanceof Element)) return;

      // The closest ancestor that declares itself, so a click on the arrow
      // inside a link still counts as the link.
      const node = target.closest<HTMLElement>("[data-track]");
      const name = node?.dataset.track;
      if (!name) return;

      /**
       * `data-track-*` becomes the event's parameters.
       *
       * Read off the dataset rather than named one by one, so adding a parameter
       * to a link is a change in one file — the markup — and never in two.
       * Everything arrives as a string; GA4 takes strings for dimensions, and a
       * number that matters is sent from a client component through `track`
       * directly rather than round-tripped through an attribute.
       */
      const params: EventParams = {};
      for (const [key, value] of Object.entries(node!.dataset)) {
        if (key === "track" || !key.startsWith("track") || value === undefined) {
          continue;
        }
        // `data-track-source` arrives as `trackSource`; GA4 wants `source`.
        const field = key.slice(5).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        params[field.replace(/^_/, "")] = value;
      }

      track(name as TrackEvent, params);
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
