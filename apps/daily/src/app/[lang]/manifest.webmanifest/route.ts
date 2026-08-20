import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang, LANGS, type Lang } from "@/lib/lang";

/**
 * The web app manifest — one PER LANGUAGE, under the language prefix.
 *
 * Not Next's root-level `app/manifest.ts` convention, and not a single manifest
 * at `/manifest.webmanifest`, for two reasons that both come from this site's own
 * rules:
 *
 *   - ONE LANGUAGE PER DOCUMENT applies here too. A manifest carries a `name`, a
 *     `short_name` and a `description`, and those are the strings that end up on
 *     a home screen and in an app launcher. A single manifest would have to name
 *     the app twice, in both scripts, in the one place where the text is a label
 *     rather than a sentence.
 *   - `start_url` has to be a real page, and every page here lives under `/zh` or
 *     `/en`. A root manifest would start the app at `/`, which redirects — an
 *     installed app whose first request is a 307 to whatever the browser's
 *     Accept-Language happened to say.
 *
 * A directory named with the extension plus `route.ts` is the same trick
 * `share.png/route.tsx` uses next door.
 */
export const dynamic = "force-static";

/** Both languages, prerendered at build: this is fixed text and two icon lists. */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

/**
 * Both `id` and `scope` matter, and they are deliberately different.
 *
 * `id` is what a browser uses to decide whether an install is the same app as one
 * it already has, so `/zh` and `/en` are two installs — which is the honest model
 * for a site that treats them as two publications.
 *
 * `scope` is `/` for BOTH, so the language switch stays inside the installed app.
 * Scoping each to its own prefix would make switching language a trip out to the
 * browser, which is not what a link within a site should do.
 */
function manifest(lang: Lang) {
  const t = strings(lang);

  return {
    id: `/${lang}`,
    name: `${t.brand} — ${t.titleTag}`,
    short_name: t.brand,
    description: t.tagline,
    lang: lang === "zh" ? "zh-CN" : "en-US",
    start_url: `/${lang}`,
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const body = manifest(isLang(lang) ? lang : DEFAULT_LANG);

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      // The registered type. Chrome accepts application/json as well, but Safari
      // has been stricter about this than the spec requires.
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
