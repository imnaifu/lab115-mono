import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import "@/index.css";

const TITLE = "疯狂填词 — 先填词，再看你写了个什么故事";
const DESCRIPTION = "不看故事，先回答几个填词问题，最后拼出一个离谱的搞笑故事。";

export const metadata: Metadata = {
  metadataBase: new URL("https://madlibs.lab115.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, locale: "zh_CN" },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf3" },
    { media: "(prefers-color-scheme: dark)", color: "#17120d" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-surface font-sans text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
