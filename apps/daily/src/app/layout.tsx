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
        {/* Bitter is the closest free match to the template's chunky serif;
            the Noto SC faces carry the Chinese half of every card. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700;800&family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
