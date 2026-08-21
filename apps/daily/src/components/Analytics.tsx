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
    </>
  );
}
