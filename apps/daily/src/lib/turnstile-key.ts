/**
 * The Turnstile site key — PUBLIC, and in its own module for that reason.
 *
 * It ships to every browser that opens the subscribe sheet, so it is a constant
 * like the GA id rather than an env var. It is not in lib/config because the
 * sheet is a client component, and importing config there would drag every
 * `process.env` read in the app into the browser bundle for one string.
 *
 * OUTSIDE PRODUCTION IT IS CLOUDFLARE'S TEST KEY, which always passes and needs
 * no network round trip to a real widget — so `npm run dev` exercises the whole
 * flow on localhost, which the real key would refuse. The matching test secret
 * is in lib/turnstile.ts.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 *
 * EMPTY MEANS NO WIDGET. That is only ever safe together with an empty
 * TURNSTILE_SECRET: a server that verifies and a page that never asks would
 * refuse every signup. See the note on `verifyTurnstile`.
 */
const PRODUCTION_SITE_KEY = "0x4AAAAAAFRsVZap8mt5mkgf";

export const TURNSTILE_SITE_KEY =
  process.env.NODE_ENV === "production"
    ? PRODUCTION_SITE_KEY
    : "1x00000000000000000000AA";
