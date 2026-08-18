import type { ReactNode } from "react";
import { headers } from "next/headers";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang, otherLang, type Lang } from "@/lib/lang";
import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/config";
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
 * This was a static `metadata` holding "每日干货 · Daily Takes — 技术博客每日摘要"
 * and a description written half in each language, so the browser tab said the
 * site's name twice no matter which side you were reading. A function instead,
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
  const title = `${t.brand} — ${t.titleTag}`;

  return {
    metadataBase: new URL(SITE),
    title,
    description: t.tagline,
    alternates: { canonical: `${SITE}/` },
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
    icons: { icon: "/favicon.svg" },
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
{children}</body>
    </html>
  );
}
