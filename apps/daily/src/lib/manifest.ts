import { strings } from "./i18n";
import { href, type Lang } from "./lang";

/**
 * The web app manifest, per language.
 *
 * SPLIT OUT OF THE ROUTE because there are two routes now: `/manifest.webmanifest`
 * for the default language and `/en/manifest.webmanifest` for the other. Chinese
 * is served unprefixed (see lib/lang.ts), and `proxy.ts` cannot rewrite a path
 * ending in an extension into the `[lang]` tree — its matcher treats a dot as "this
 * is a file". So the unprefixed manifest needs a route of its own, and the content
 * belongs in exactly one place rather than in both of them.
 */

/**
 * Both `id` and `scope` matter, and they are deliberately different.
 *
 * `id` is what a browser uses to decide whether an install is the same app as one
 * it already has, so the two languages are two installs — which is the honest
 * model for a site that treats them as two publications.
 *
 * BOTH MOVED WITH THE URLS. They were the literal `/${lang}`; they go through
 * `href` now, so Chinese is `/` and English stays `/en`. A CONSEQUENCE WORTH
 * NAMING: `id` is the install's identity, so anyone who had already added the
 * Chinese app to a home screen gets a second icon rather than an update. That is
 * accepted — the alternative is pinning the manifest to a URL the site no longer
 * serves — and it is only reachable for installs made before this change.
 *
 * `scope` is `/` for BOTH, so the language switch stays inside the installed app.
 * Scoping each to its own prefix would make switching language a trip out to the
 * browser, which is not what a link within a site should do.
 */
export function manifest(lang: Lang) {
  const t = strings(lang);

  return {
    id: href(lang, "/"),
    // `name` and `short_name` are the same string now that the title carries no
    // tagline. Both are kept rather than one: a manifest without `short_name` is
    // free to truncate `name` itself for a home-screen label, and this way there
    // is nothing to truncate.
    name: t.brand,
    short_name: t.brand,
    description: t.tagline,
    lang: lang === "zh" ? "zh-CN" : "en-US",
    start_url: href(lang, "/"),
    scope: "/",
    display: "standalone",
    // The page's own background, so the splash screen and the first paint are the
    // same colour and there is no white flash between them.
    background_color: "#fbf3e9",
    theme_color: "#fbf3e9",
    // No `orientation`: a manifest applies to an installed DESKTOP window too,
    // and locking a reading page to portrait there would be nonsense.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /**
       * Separate from the two above, not `purpose: "any maskable"` on one entry.
       *
       * A maskable icon is cropped to whatever shape the launcher wants — as far
       * in as a circle inscribed in the square — so only its central 80% is
       * guaranteed to survive. The `any` icons fill their tile edge to edge, so
       * declaring them maskable too would let a round launcher cut the marks off.
       * This one is drawn full-bleed with the artwork pulled in; see the
       * generator note in public/.
       */
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
