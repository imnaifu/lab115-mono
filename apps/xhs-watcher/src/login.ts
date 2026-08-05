/**
 * One-time interactive login — run on your laptop, not in the container.
 *
 *   npm run login
 *
 * Opens a real browser window against the same persistent profile the fetcher
 * uses. Scan the QR code, and the session cookies are written to
 * `data/pw-profile`, which you then copy to the server's data volume.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { config } from "./config.js";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

async function main(): Promise<void> {
  fs.mkdirSync(config.profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
    timezoneId: config.timezone,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://www.xiaohongshu.com/explore", { waitUntil: "domcontentloaded" });

  console.log("请在打开的浏览器窗口中扫码登录，登录成功后本程序会自动保存并退出…");

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const cookies = await context.cookies("https://www.xiaohongshu.com");
    if (cookies.some((cookie) => cookie.name === "web_session" && cookie.value)) {
      // The profile is flushed to disk on close, so closing IS the save step.
      await context.close();
      console.log(`✅ 登录态已保存到 ${config.profileDir}`);
      console.log("   部署时把该目录同步到服务器的 ./data/xhs/pw-profile");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await context.close();
  throw new Error("登录超时（5 分钟），未检测到 web_session cookie");
}

main().catch((error) => {
  console.error("[login]", error);
  process.exit(1);
});
