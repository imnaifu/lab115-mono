import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

// This app serves a single domain, so SEO/analytics are static constants
// (no per-request host lookup needed anymore).
const SITE = "https://converter.lab115.com";
const GA_ID = "G-5X27KERS7Q";
const TITLE = "Converter · 单位转换 — 长度、重量、温度、容量、面积、速度";
const DESCRIPTION =
  "Free bilingual unit converter (中文 / English) for length, weight, temperature, volume, area, and speed. Click any number to edit, with real-world reference illustrations. No tracking, no signup.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    "单位转换, unit converter, 长度转换, 重量转换, 温度转换, 容量转换, 面积转换, 速度转换, length, weight, temperature, volume, area, speed converter, online tool",
  alternates: { canonical: `${SITE}/` },
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
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}/`,
    siteName: "Converter · 单位转换",
    locale: "zh_CN",
    alternateLocale: "en_US",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#f1ead9" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang starts as zh (deterministic SSR); ConverterApp updates it client-side.
    <html lang="zh" data-lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Serif+SC:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}

        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
