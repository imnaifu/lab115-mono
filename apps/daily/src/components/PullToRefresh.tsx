"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

/**
 * Pull down at the top of the page to refresh it, the way an app does.
 *
 * IT EXISTS FOR THE INSTALLED APP. In a browser tab there is a reload button and
 * the platform's own pull gesture; in a standalone window — which is what the
 * "存成 App" button next door produces — there is neither, and the content
 * changes every morning. Without this, a reader who opened the app yesterday has
 * no way to ask for today's digest but to close it and open it again.
 *
 * It is mounted for every touch screen rather than only in standalone mode: the
 * gesture is harmless in a tab (the native one is turned off in its favour, see
 * `overscroll-y-contain` in app/layout.tsx) and being present in both means the
 * reader who installs the app does not have to learn a second set of gestures.
 */

/**
 * How far the INDICATOR must travel to arm the refresh, in CSS pixels.
 *
 * The finger travels further than this: the drag is damped by RESISTANCE, so
 * arming it takes about 100px of actual movement. That number is the one being
 * tuned, and it is deliberately past what a lazy flick reaches — this is a
 * gesture that throws away the page you are looking at and asks the server for
 * another, so a false positive costs more than a second pull does.
 */
const TRIGGER_PX = 56;

/** Where the indicator stops. Past this the finger keeps moving and nothing on
 *  screen does, which is what tells the reader they have gone far enough. */
const MAX_PX = 80;

/** Indicator pixels per finger pixel. Under 1 so the pull feels weighted rather
 *  than stuck to the finger, and so MAX_PX is reachable without a long drag. */
const RESISTANCE = 0.6;

/**
 * Finger pixels before this counts as a pull at all.
 *
 * A tap is never perfectly still, and without a floor the indicator flickers into
 * view under every tap that lands near the top of the page.
 */
const START_PX = 8;

/**
 * The floor on how long the spinner is shown.
 *
 * A warm `router.refresh()` on this site can come back in well under a hundred
 * milliseconds, and a spinner that appears and vanishes inside one frame reads as
 * a glitch rather than as work done — the reader is left unsure whether the
 * gesture registered. Holding it briefly is the acknowledgement.
 */
const MIN_SPIN_MS = 600;

/**
 * When to stop waiting.
 *
 * `router.refresh()` returns nothing and rejects nothing, so a refresh with no
 * network does not fail — it simply never arrives, and `isPending` stays true.
 * This is the only thing that takes the spinner off the screen in that case.
 */
const GIVE_UP_MS = 8000;

export function PullToRefresh() {
  const router = useRouter();
  /** How far down the indicator is, in CSS pixels. 0 is parked and invisible. */
  const [distance, setDistance] = useState(0);
  /**
   * Whether a refresh is in flight. TWO OF THEM, for the reason ShareSheet's
   * `saving` pair documents: the ref is the guard, read synchronously by a touch
   * handler that closed over its state one render ago, and the state is what the
   * indicator renders from.
   */
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  /**
   * The transition is how completion is observed. `router.refresh()` gives back
   * no promise, so `isPending` — true from the moment the transition starts until
   * the new server render has been applied — is the only signal that the page in
   * front of the reader is now today's.
   */
  const [pending, startTransition] = useTransition();
  const startedAt = useRef(0);
  /**
   * Whether `pending` has actually been seen true yet.
   *
   * Without it the effect below fires on the very first render after the release,
   * when the transition has been started but React has not yet re-rendered with
   * `isPending` set — a state indistinguishable from a finished refresh, which
   * ended the spinner immediately and every time.
   */
  const sawPending = useRef(false);

  function finish() {
    refreshingRef.current = false;
    setRefreshing(false);
    setDistance(0);
  }

  useEffect(() => {
    /**
     * TOUCH SCREENS ONLY, and tested on the input device rather than on the OS
     * name: pulling is a property of having a finger, not of being a phone. On a
     * desktop the listeners are never attached at all — there is a reload button
     * up there, and a mouse cannot perform this.
     */
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    /** Where the finger started. */
    let startY = 0;
    let startX = 0;
    /** A candidate: began at the top of the page, one finger, nothing modal. */
    let tracking = false;
    /** Confirmed downward drag — from here the gesture is ours and the page must
     *  not scroll under it. */
    let pulling = false;
    /** The live indicator distance. A local rather than a read of `distance`,
     *  because this closure is created once and would otherwise be reading the
     *  value from the render it was created in. */
    let pulled = 0;

    const cancel = () => {
      tracking = false;
      pulling = false;
      pulled = 0;
      setDistance(0);
    };

    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current) return;
      // Two fingers is a pinch-zoom, not a pull.
      if (event.touches.length !== 1) return;
      // Only from the very top: anywhere else, down means scroll up.
      if (window.scrollY > 0) return;
      /**
       * Not while a modal is up. The share sheet is a `<dialog>` with its own
       * scrolling contents, and a drag inside it belongs to it — hijacking that
       * would refresh the page out from under a reader who was scrolling to reach
       * the save button.
       */
      if (document.querySelector("dialog[open]")) return;

      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      tracking = true;
      pulling = false;
      pulled = 0;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (event.touches.length !== 1) {
        cancel();
        return;
      }

      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;

      if (!pulling) {
        /**
         * The gesture is not claimed until it is clearly a downward drag —
         * `dx` bigger than `dy` is a sideways swipe (the category tabs scroll
         * that way) and a negative `dy` is an ordinary scroll. Until then this
         * neither prevents anything nor draws anything.
         */
        if (dy < START_PX || Math.abs(dx) > dy) {
          // And once it has committed to going somewhere else, stop watching:
          // re-entering the top of the arc mid-swipe should not start a pull.
          if (dy < -START_PX || Math.abs(dx) > START_PX) tracking = false;
          return;
        }
        pulling = true;
      }

      /**
       * Ours now, so the page must not move: without this the document scrolls
       * (Android) or rubber-bands (iOS) behind an indicator that is trying to be
       * the thing that moves. This is why the listener is registered non-passive
       * — a passive one is not allowed to call this.
       */
      event.preventDefault();
      // `- START_PX` so the indicator starts from zero at the moment of
      // commitment rather than jumping to wherever the floor put it.
      pulled = Math.min(MAX_PX, (dy - START_PX) * RESISTANCE);
      setDistance(pulled);
    };

    const onEnd = () => {
      if (!tracking) return;
      const armed = pulling && pulled >= TRIGGER_PX;
      tracking = false;
      pulling = false;
      pulled = 0;

      if (!armed) {
        // Snapped back, nothing asked for. The transition in the style below is
        // what makes this a spring rather than a jump.
        setDistance(0);
        return;
      }

      refreshingRef.current = true;
      sawPending.current = false;
      startedAt.current = performance.now();
      setRefreshing(true);
      // Parked at the threshold while it spins, so the indicator ends up in one
      // fixed place no matter how far the pull went.
      setDistance(TRIGGER_PX);
      track("pull_refresh");
      /**
       * A SOFT REFRESH, not `location.reload()`. Every page here is
       * `force-dynamic`, so this re-runs the server components and swaps in the
       * new markup — no white flash, no scroll jump, no re-fetch of the fonts or
       * the bundle. A full reload would do all four, and on a slow phone the
       * difference is the whole feel of the gesture.
       */
      startTransition(() => router.refresh());
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [router]);

  /** The refresh landed: hold the spinner out to MIN_SPIN_MS, then put it away. */
  useEffect(() => {
    if (!refreshing) return;
    if (pending) {
      sawPending.current = true;
      return;
    }
    if (!sawPending.current) return;

    const rest = Math.max(0, MIN_SPIN_MS - (performance.now() - startedAt.current));
    const timer = setTimeout(finish, rest);
    return () => clearTimeout(timer);
  }, [refreshing, pending]);

  /** The refresh that never lands — see GIVE_UP_MS. */
  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(finish, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);

  const active = refreshing || distance > 0;
  /** Armed, and the finger is still down: the arrow has flipped and letting go
   *  now will refresh. */
  const ready = !refreshing && distance >= TRIGGER_PX;
  /** Only while the finger is driving it. See the `transition` below. */
  const dragging = !refreshing && distance > 0;
  const progress = Math.min(1, distance / TRIGGER_PX);

  return (
    <div
      /**
       * Hidden from assistive tech, deliberately. This is feedback for a gesture
       * that cannot be performed without a finger on a screen, and the thing it
       * reports — that the page has been replaced by a fresh copy of itself — is
       * announced by the document changing, not by a badge. A `role="status"` here
       * would interrupt a screen reader with the word "refreshing" for an action
       * its user did not take.
       */
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{
        transform: `translate3d(0, ${active ? distance : 0}px, 0)`,
        opacity: active ? 1 : 0,
        /**
         * NO TRANSITION WHILE DRAGGING. The finger is the animation — easing each
         * frame towards the last touch position puts the indicator visibly behind
         * the thumb, which is the single thing that makes a gesture feel cheap.
         * The spring back and the park at the threshold are the only animated
         * moves.
         */
        transition: dragging
          ? "none"
          : "transform 240ms ease-out, opacity 180ms ease-out",
      }}
    >
      <div
        className="mt-3 flex size-9 items-center justify-center rounded-full border border-line bg-paper shadow-soft"
        /* Grows in with the pull, so the badge arrives rather than appearing. */
        style={{
          transform: `scale(${refreshing ? 1 : 0.7 + 0.3 * progress})`,
          transition: dragging ? "none" : "transform 240ms ease-out",
        }}
      >
        {refreshing ? (
          /* Three quarters of a circle, spun by Tailwind's own `animate-spin` —
             the accent colour, because this is the one moment on the page where
             something is happening. */
          <svg
            viewBox="0 0 16 16"
            className="size-4 animate-spin text-orange"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 1.6a6.4 6.4 0 1 1-6.4 6.4" />
          </svg>
        ) : (
          /* A down arrow that flips over when the pull is far enough: the state of
             the gesture, without a word of text to translate. */
          <svg
            viewBox="0 0 16 16"
            className="size-4 text-ink-mid"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: `rotate(${ready ? 180 : 0}deg)`,
              transition: "transform 180ms ease-out",
            }}
          >
            <path d="M8 2.8v10.4M3.4 9.2 8 13.8l4.6-4.6" />
          </svg>
        )}
      </div>
    </div>
  );
}
