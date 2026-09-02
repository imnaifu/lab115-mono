import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Analytics } from "@/components/Analytics";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ClickTracking } from "@/components/ClickTracking";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BackToTop } from "@/components/BackToTop";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang, otherLang, type Lang } from "@/lib/lang";
import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/config";
import { alternatesFor, ogCardFor } from "@/lib/seo";
import "@/index.css";

/** What both the layout and its metadata need: see the note on RootLayout. */
async function langFromHeader(): Promise<Lang> {
  const header = (await headers()).get("x-lang") ?? undefined;
  return isLang(header) ? header : DEFAULT_LANG;
}

const OG_LOCALE: Record<Lang, string> = { zh: "zh_CN", en: "en_US" };

/**
 * ONE language per document, title included.
 *
 * This was a static `metadata` holding the brand in both languages at once plus a
 * description written half in each, so the browser tab said the site's name twice
 * no matter which side you were reading. A function instead,
 * because the language is only knowable at request time — see RootLayout below
 * for why it comes from a header rather than from the route.
 *
 * The description is `tagline`, the same sentence the footer prints, rather than
 * a second copy that lists blogs by name: the one it used to list included XDA,
 * which is no longer subscribed, and a description that enumerates the feed is
 * guaranteed to rot every time config.json changes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await langFromHeader();
  const t = strings(lang);
  /**
   * THE BRAND ALONE. There was a tagline after an em dash — "值得一读的博客文章
   * 摘要", and before that a subject claim — and both were spending the front of
   * every browser tab, bookmark and search result on a sentence nobody reads
   * twice. A masthead does not explain itself; `description` below is where an
   * explanation belongs, and it is still there.
   */
  const title = t.brand;

  return {
    metadataBase: new URL(SITE),
    title,
    description: t.tagline,
    /**
     * HOW MUCH OF THIS PAGE A SEARCH RESULT MAY SHOW — and the answer is all of
     * it, which was NOT the default it was getting.
     *
     * With no directive at all Google applies `max-image-preview:standard`, which
     * caps a result's thumbnail at roughly 100px on its long edge. On this site
     * that is the single worst default available: every article page declares its
     * POSTER as `og:image` (a 1080x1440 card with the cover, the headline and the
     * claim set on it — see the note in the article page's `generateMetadata`),
     * and the whole distribution model is that the poster is the thing people
     * pass around. Rendered at 100px it is an illegible grey rectangle.
     *
     * `large` is also the ENTRY REQUIREMENT for Google Discover, which for a
     * daily bilingual digest is the surface with the most upside of any of them —
     * and it was unreachable by omission rather than by decision.
     *
     * `-1` ON THE OTHER TWO means "no limit" rather than zero: `max-snippet` caps
     * the characters of text a result may quote, and every page here is a summary
     * whose point IS the prose, so a truncated snippet is a result that shows less
     * of the writing than the writing is. `max-video-preview` is declared for
     * completeness — there is no video on this site and there is no cost to being
     * explicit about a directive that will one day be inherited by a page that has
     * one.
     *
     * INSIDE `googleBot`, not at the top level, because these three are Google's
     * directives. The plain `index`/`follow` pair above them is the part every
     * engine reads.
     *
     * INHERITANCE IS THE MECHANISM, and it is the reason this belongs in the root
     * layout and nowhere else. Next merges metadata per TOP-LEVEL FIELD, so a page
     * that declares any `robots` of its own replaces this whole object — which is
     * exactly what the two pages that must never be indexed already do
     * (`/preview` and `/mail/confirm` both set `robots: { index: false }`), and
     * they keep working untouched. Every other page declares no `robots` at all
     * and therefore gets this.
     */
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    // The home page in both languages — see alternatesFor. On the Chinese side
    // that canonical is now `${SITE}/` itself. An older note here warned against
    // exactly that, because the bare URL used to be the one that REDIRECTED here;
    // it is the page now, so naming it is correct rather than dangerous.
    //
    // `types` is the feed's AUTODISCOVERY link, and it is the whole reason a
    // reader can be handed `daily.lab115.com` and find the subscription itself.
    // THIS LANGUAGE'S FEED ONLY: a document declares the feed it is a rendering
    // of, and offering both here would leave the reader to guess which of two
    // equally-advertised feeds is the page it is looking at.
    alternates: {
      ...alternatesFor(lang, "/"),
      types: {
        "application/atom+xml": [
          { url: `${SITE}${href(lang, "/feed.xml")}`, title: t.brand },
        ],
      },
    },
    openGraph: {
      type: "website",
      title,
      description: t.tagline,
      /**
       * THIS LANGUAGE'S HOME PAGE, through `href` like the canonical above, so the
       * two can never disagree. On the Chinese side both are the bare `${SITE}/`.
       *
       * The point the old note here made still holds and is worth keeping: an
       * og:url is what an unfurler stores and shows as the link's identity, so it
       * has to name a page rather than a redirect. What changed is which URL that
       * is.
       */
      url: `${SITE}${href(lang, "/")}`,
      siteName: t.brand,
      locale: OG_LOCALE[lang],
      alternateLocale: OG_LOCALE[otherLang(lang)],
      /**
       * The card, which the whole site was missing.
       *
       * Only the article page had an og:image — it points at its poster — so the
       * home page, the archive and every day unfurled as a line of grey text in
       * the one place this site is actually passed around. See lib/og.tsx for why
       * the card is 1200x630 rather than the poster's 3:4.
       *
       * `"site"` is the card's NAME, not a path: the cards live in `/og/<lang>/`
       * rather than hanging off the page they belong to. See `ogUrl` in lib/links.
       *
       * INHERITANCE DOES NOT SAVE THE PAGES BELOW THIS ONE. Next merges metadata
       * per top-level field, so a page that declares any `openGraph` of its own
       * replaces this whole object rather than adding to it — which is exactly why
       * the day page had no image despite this layout being its parent. Every page
       * that sets `openGraph` therefore sets `images` too.
       */
      images: ogCardFor(lang, "site"),
    },
    /**
     * `summary_large_image`, now that there is an image worth the space. `summary`
     * draws a 1:1 thumbnail beside the text — the right card when the only image
     * available is a favicon, and the wrong one for a 1.91:1 card built to be the
     * whole preview.
     */
    twitter: {
      card: "summary_large_image",
      title,
      description: t.tagline,
      images: ogCardFor(lang, "site").map((image) => image.url),
    },
    icons: {
      /**
       * `?v=2`, and the query is the whole point of it.
       *
       * A browser's favicon store is keyed by URL and is not the HTTP cache: it
       * survives a reload, a hard reload, and `max-age=0` on the response. So an
       * icon redrawn at a fixed address is an icon a returning reader may never
       * see — which is not hypothetical here twice over. The service worker had
       * it cache-first once (see VERSION in sw.js), and the file was unparseable
       * XML for two days (see the comment in it), and in both cases the tab kept
       * an icon nobody could dislodge with any amount of reloading.
       *
       * Bumping this is the only thing that changes the address, so it belongs to
       * the list in mark.svg of what does not follow the artwork on its own. The
       * pathname is untouched, which is what keeps `ASSETS` in sw.js matching.
       */
      icon: "/favicon.svg?v=2",
      // iOS does not read the manifest for home-screen icons, and it ignores
      // transparency — so this is a separate, full-bleed PNG.
      apple: "/apple-touch-icon.png",
    },
    /**
     * The manifest of THIS document's language, because there is one per language
     * — see the route. Linking the root would install whichever language the
     * browser's Accept-Language happened to resolve to, which is not necessarily
     * the one being read.
     */
    manifest: href(lang, "/manifest.webmanifest"),
    /**
     * iOS reads none of the above from the manifest: `display: standalone` and the
     * app's name on the home screen come from these two meta tags instead.
     *
     * `default` STILL, now that there are two themes. It means "let the status
     * bar take the page's own colour", which is exactly right twice over: cream
     * on the light side, #1d1a33 on the dark one, with no third value to keep in
     * step. `black-translucent` would have hardcoded one of them.
     */
    appleWebApp: { capable: true, title: t.brand, statusBarStyle: "default" },
  };
}

/**
 * Two values, because the browser paints its chrome from this and the page has
 * two grounds now.
 *
 * IT ONLY KNOWS ABOUT THE OS. A reader who used the switch in the masthead has a
 * preference these media queries cannot see, so `ThemeToggle` rewrites the
 * rendered tags on every flip, and the pre-paint script below does the same on a
 * fresh load. This declaration is the state of things for a reader who never
 * touched it — which is most of them.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

/**
 * The language comes from a header the middleware set, not from the route.
 *
 * A root layout in the App Router cannot see the segments beneath it, so it has
 * no way to read `[lang]` itself — and `<html lang>` has to be right, because
 * screen readers choose a voice from it and browsers decide whether to offer a
 * translation by it.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const lang = await langFromHeader();
  // Only for BackToTop's label — everything else this layout renders is chrome
  // with no words in it.
  const t = strings(lang);
  // Set by the admin branch in proxy.ts. See the note beside `Analytics` below.
  const isAdmin = (await headers()).get("x-admin") === "1";

  return (
    /**
     * suppressHydrationWarning because browser extensions get to the document
     * before React does. Immersive Translate stamps
     * `data-immersive-translate-page-theme` onto <html>, and React then reports
     * the attribute it did not render as a hydration mismatch — an error about
     * the reader's browser, not about this app.
     *
     * Safe precisely because it is SHALLOW: it silences mismatches on this one
     * element's own attributes and nothing below it, so a real mismatch inside
     * the page still reports. And there is nothing here to hide — this element
     * is a static `lang="zh"` with no state, no date, no locale formatting.
     */
    <html
      lang={lang}
      /**
       * `overscroll-y-contain` TURNS OFF THE PLATFORM'S OWN OVERSCROLL, and it is
       * what makes PullToRefresh possible rather than being a second indicator
       * fighting the first: Chrome on Android has a pull-to-refresh of its own,
       * and iOS rubber-bands the whole document — including the `fixed` badge,
       * which would ride down with the page it is supposed to be hovering over.
       *
       * A Tailwind class on the element rather than a rule in index.css: that file
       * is tokens only and says so at the top.
       */
      className="overscroll-y-contain"
      suppressHydrationWarning
    >
      <head>
        {/**
         * THE THEME, STAMPED BEFORE THE FIRST PAINT.
         *
         * Everything else about dark mode is CSS — `light-dark()` against
         * `color-scheme`, see index.css — and CSS alone gets a reader who chose
         * dark on a light machine no further than the second paint. Without this
         * script every navigation would flash cream and then correct itself,
         * which is worse than not offering the switch.
         *
         * It has to be INLINE and it has to be here: an external file is a
         * network round trip the paint will not wait for, and anything React
         * renders happens after the document has already been shown once.
         * `<html suppressHydrationWarning>` below is what lets an attribute
         * appear here that the server did not render — it was already needed for
         * translation extensions, and this is the same shape of change.
         *
         * The absence of the key is "follow the OS", so this touches nothing
         * unless the reader has actually used the switch. It swallows its own
         * errors: a private window can refuse the read, and a theme that fails to
         * load is a page in the OS's theme, not a broken page.
         *
         * The literals come from lib/theme.ts, interpolated because a script that
         * runs before the bundle cannot import.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/**
         * Two families, not four. Manrope sets the Latin, Noto Sans SC — 思源
         * 黑体, the same typeface Adobe ships as Source Han Sans — sets the
         * Chinese, and nothing on the page uses anything else.
         *
         * Dropped: Bitter and Noto Serif SC (思源宋体), which carried every
         * heading back when hierarchy came from the face rather than the weight.
         * That is two fewer font files on a page whose whole point is being
         * screenshotted quickly.
         *
         * 600 is requested for Noto Sans SC and was NOT there before, which was
         * a latent bug: `.summary__thesis` has always asked for 600, so Chinese
         * theses were being synthesised from 500 or 700 by the browser. Now that
         * weight is the only thing separating a thesis from the prose beneath
         * it, the real face has to be available.
         *
         * Neither family ships an italic on Google Fonts, and NOTHING ASKS FOR ONE
         * ANY MORE. Two lines used to — the masthead's second line and the English
         * section names — and both got a synthesised oblique, which this note said
         * was acceptable on secondary text until it looked wrong. It did, once the
         * masthead's second line started carrying a whole Chinese sentence rather
         * than a short title: a slant applied to upright CJK glyphs is an artefact
         * at any size and unmissable at 18px. Both now lean on size and colour,
         * which were already doing the separating.
         */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-page font-sans text-ink antialiased">
{children}
        {/* Touch screens only, and it attaches nothing on a desktop — see the
            note in the component. */}
        <PullToRefresh />
        {/* Every page here can outrun a screen, so it is mounted once at the
            root rather than per page — see the note in the component. */}
        <BackToTop label={t.backToTop} />
        <ServiceWorker />
        {/**
         * NOT ON `/admin`, and this is about the integrity of the numbers rather
         * than about the page.
         *
         * There is one GA property for one site (see GA_ID in Analytics), and the
         * admin page is opened by the one person whose visits must not be in it —
         * a tuning session is a dozen reloads of the same URL, which is the same
         * pollution `Analytics` already refuses to send from `npm run dev`. It
         * would land in exactly the reports being used to judge whether the SEO
         * work is doing anything.
         *
         * `ClickTracking` goes with it for the same reason: it is one delegated
         * listener that fires `data-track` events, and the admin pages carry
         * links of their own.
         *
         * The flag is a REQUEST HEADER set by the admin branch in proxy.ts, not a
         * pathname — a root layout cannot see the route segments beneath it, which
         * is the same constraint that makes `x-lang` a header. See the note on
         * `langFromHeader`.
         */}
        {isAdmin ? null : (
          <>
            <Analytics />
            {/* One delegated listener for every `data-track` link on the page —
                see the note there for why the links themselves stay
                server-rendered. */}
            <ClickTracking />
          </>
        )}
      </body>
    </html>
  );
}
