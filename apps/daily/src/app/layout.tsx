import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/config";
import "@/index.css";

const TITLE = "今日速读 · Daily Read — 技术博客每日摘要";
const DESCRIPTION =
  "每天自动抓取 Heavybit、XDA、caolan.uk 等博客的新文章，提炼中英双语观点摘要。A daily bilingual digest of new posts from a handful of engineering blogs.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/` },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}/`,
    siteName: "今日速读 · Daily Read",
    locale: "zh_CN",
    alternateLocale: "en_US",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#fbf3e9" };

export default function RootLayout({ children }: { children: ReactNode }) {
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
    <html lang="zh" suppressHydrationWarning>
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
      <body className="bg-cream font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
