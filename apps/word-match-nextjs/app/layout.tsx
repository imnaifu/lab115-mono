import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "医院病房单词配对游戏",
  description: "拖拽单词卡到场景对应位置的英语学习游戏",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
