import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Analytics } from "@/components/Analytics";
import { ServiceWorker } from "@/components/ServiceWorker";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, href, isLang, otherLang, type Lang } from "@/lib/lang";
import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/config";
import { alternatesFor } from "@/lib/seo";
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
    // The home page in both languages — see alternatesFor. It used to declare
    // `${SITE}/` as its own canonical, which is the URL that REDIRECTS here: a
    // canonical pointing at a 307 is a canonical a crawler cannot follow.
    alternates: alternatesFor(lang, "/"),
    openGraph: {
      type: "website",
      title,
      description: t.tagline,
      url: `${SITE}/`,
      siteName: t.brand,
      locale: OG_LOCALE[lang],
      alternateLocale: OG_LOCALE[otherLang(lang)],
    },
    twitter: { card: "summary", title, description: t.tagline },
    icons: {
      icon: "/favicon.svg",
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
     * app's name on the home screen come from these two meta tags instead. The
     * status bar is left `default` so it keeps the page's own cream rather than
     * being painted over.
     */
    appleWebApp: { capable: true, title: t.brand, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#fbf3e9" };

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
    <html lang={lang} suppressHydrationWarning>
      <head>
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
         * Neither family ships an italic on Google Fonts, and `.masthead__title
         * small` / `.section__sub` still ask for one — those two lines now get a
         * synthesised oblique. Acceptable on secondary text; if it ever looks
         * wrong, the fix is to drop `font-style: italic` and lean on the size
         * and colour that already distinguish them.
         */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cream font-sans text-ink antialiased">
{children}
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
