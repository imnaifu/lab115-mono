import Script from "next/script";

/**
 * Umami at stats.lab115.com, the same instance apps/daily reports to. `s.js` is
 * the renamed tracker (TRACKER_SCRIPT_NAME in docker-compose.yml).
 *
 * UMAMI_ID IS EMPTY UNTIL A WEBSITE IS CREATED for madlibs.lab115.com in the
 * Umami dashboard — each site gets its own id, and reusing daily's would mix the
 * two sites' numbers. While it is empty nothing loads and `track()` is a no-op.
 * The id is public (it ships in the page source), so it is a constant, not env.
 */
const UMAMI_SRC = "https://stats.lab115.com/s.js";
const UMAMI_ID = "";

export function Analytics() {
  // Local reloads during development would otherwise land in the reports.
  if (process.env.NODE_ENV !== "production" || !UMAMI_ID) return null;

  return <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} strategy="afterInteractive" />;
}
