/**
 * Product events, sent to the self-hosted Umami (see components/Analytics.tsx).
 *
 * These four exist to answer the first-stage question in README.md — do people
 * finish a story, play again, and pass it on — so a new event should only be
 * added when it answers a question someone is actually asking.
 */
export type TrackEvent =
  /** A theme was picked and the first question shown. */
  | "start"
  /** All blanks filled and the story shown. */
  | "reveal"
  /** "Play again" after a reveal. `mode` says same story or another. */
  | "replay"
  /** The finished story was copied — the closest proxy for sharing. */
  | "copy";

type EventParams = Record<string, string | number>;
type Umami = { track: (event: string, params?: EventParams) => void };

/**
 * Fire and forget. Silent when Umami is absent, which is normal in development,
 * behind a blocker, before the script loads, and while UMAMI_ID is still empty.
 */
export function track(event: TrackEvent, params?: EventParams): void {
  if (typeof window === "undefined") return;
  const umami = (window as unknown as { umami?: Umami }).umami;
  if (umami) {
    umami.track(event, params);
  } else if (process.env.NODE_ENV !== "production") {
    console.debug("[track]", event, params ?? {});
  }
}
