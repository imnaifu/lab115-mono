import Script from "next/script";

/**
 * Google Analytics 4.
 *
 * `next/script` rather than the two raw `<script>` tags Google hands out. A raw
 * tag in an App Router tree is not reliably kept: React may reorder or re-run it
 * across navigations, and this app navigates client-side between the day list, an
 * article and the archive. `Script` registers the load with the framework
 * instead, so it happens once per document and survives every route change after
 * it.
 *
 * `afterInteractive` is Next's default for exactly this case and it is the right
 * one: analytics must not compete with the page for the first paint, and it must
 * not wait for idle either, or a reader who opens a summary and shares it inside
 * five seconds is never counted.
 *
 * The inline half needs the `id` — that is how Next dedupes an inline script, and
 * without one it can be injected twice. Its body is Google's snippet unchanged;
 * `dangerouslySetInnerHTML` is the only way to put literal JS in a React tree and
 * there is nothing dynamic in it to escape.
 */

/**
 * The measurement ID, hardcoded.
 *
 * It is not a secret — it ships to every browser inside the script URL above, and
 * anyone can read it from the page source. There is one property for one site, so
 * an env var would add a way for the two to disagree without adding anything.
 */
const GA_ID = "G-Q7MJEE3PM5";

/**
 * Umami, self-hosted at stats.lab115.com, ALONGSIDE GA rather than instead of it.
 *
 * GA's script barely loads from mainland China, so those readers were missing
 * from every report; this one comes from our own domain through the same
 * Cloudflare edge as the site. `s.js` and its `/api/c` endpoint are renamed on the
 * server (TRACKER_SCRIPT_NAME / COLLECT_API_ENDPOINT in docker-compose.yml) so
 * blocker lists aimed at Umami's defaults miss them.
 *
 * The website id is public for the same reason GA_ID is.
 */
const UMAMI_SRC = "https://stats.lab115.com/s.js";
const UMAMI_ID = "d1933970-a541-4a7d-9755-de3923dc0b84";

export function Analytics() {
  /**
   * NOT IN DEVELOPMENT.
   *
   * Every `npm run dev` page load would otherwise land in the reports, and local
   * traffic is the noisiest possible kind: one person reloading the same article
   * fifty times while a layout is being adjusted. There is no separate dev
   * property to send it to, so the choice is polluted numbers or none, and none is
   * the honest answer for a run nobody is reading.
   */
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
      {/* Page views, client-side route changes included, need nothing more than
          this tag; events reach it through `track()` in lib/track.ts. */}
      <Script
        src={UMAMI_SRC}
        data-website-id={UMAMI_ID}
        strategy="afterInteractive"
      />
    </>
  );
}
