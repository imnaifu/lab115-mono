/**
 * Everything this app draws that is NOT a page, on one screen:
 * `npm run preview [-- 2026-08-25]`.
 *
 * WHAT IT IS FOR. The site you can look at — `npm run dev` and it is in front of
 * you. The four things that are not the site cannot be looked at that way: two
 * emails land in an inbox, the share poster is a PNG the share sheet fetches, and
 * the OG card is only ever seen by an unfurler. All four are drawn from the same
 * palette and the same lockup as the pages, and all four used to be checked by
 * sending yourself a test mail or by reading a base64 string. This renders the lot
 * into `.preview/` and serves it.
 *
 * THE POSTER IS RENDERED AS A WHOLE DECK, every part of the day's top article,
 * rather than as the one card that carries the wordmark. Part 1 is where a lockup
 * change shows up, but a lockup change is also what pushes the prose on the parts
 * after it — `POSTER_FRAME` in lib/share.ts is computed WITHOUT the lockup for
 * exactly that reason — so a preview that stops at part 1 cannot show the thing
 * most likely to break.
 *
 * NOT A TEST, and it asserts nothing. It renders what ships and puts it where you
 * can see it; whether the result is right is a question for your eyes.
 *
 * Renders today's digest unless a date is given, the same fallback `npm run mail`
 * uses. `--build-only` writes the files and stops, for when you want to open them
 * somewhere other than a browser.
 */
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { displayTitle } from "@/components/ArticleTitle";
import { strings } from "@/lib/i18n";
import { href, LANGS, type Lang } from "@/lib/lang";
import { absolute, confirmEmail, digestEmail } from "@/lib/mail/render";
import { renderOgCard } from "@/lib/og";
import { renderPoster } from "@/lib/poster";
import { posterParts } from "@/lib/share";
import { readDigest, readLatest, shownArticles } from "@/lib/store";
import { summaryFor } from "@/lib/take";
import type { Digest } from "@/lib/types";

const args = process.argv.slice(2);
const buildOnly = args.includes("--build-only");
const date = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));

/** Inside the app, beside `.next/`, and gitignored with it. */
const OUT = resolve(process.cwd(), ".preview");

const PORT = Number(process.env.PORT) || 4321;

/** The colours the index page is drawn in — the site's own, so the contact sheet
 *  cannot tint what is being judged on it. Light side only; see lib/mail/render. */
const CREAM = "#fbf3e9";
const CARD = "#f3e8d8";
const PAPER = "#fffdf9";
const INK = "#3b3563";
const INK_SOFT = "#8a83a8";
const LINE = "#e2ddd4";

interface Shot {
  file: string;
  label: string;
}

/** What one language contributed, so the index can group by it. */
interface Section {
  lang: Lang;
  brand: string;
  mails: Shot[];
  posters: Shot[];
  og: Shot;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One language's worth of output.
 *
 * SEQUENTIAL, not `Promise.all`. Satori loads a font subset per image and the
 * poster's parts are drawn from the same article, so running them concurrently
 * buys a second at the cost of interleaved progress lines on a command whose only
 * output IS progress.
 */
async function renderLang(digest: Digest, lang: Lang): Promise<Section> {
  const t = strings(lang);
  const mails: Shot[] = [];

  const edition = digestEmail(digest, lang);
  await writeFile(join(OUT, `digest-${lang}.html`), edition.html);
  mails.push({ file: `digest-${lang}.html`, label: edition.subject });

  /**
   * A token that is deliberately not a real one. `confirmToken` in lib/mail/token
   * signs against MAIL_SECRET, which a preview has no business reading and which
   * is empty on most machines this runs on — and the link is here to be LOOKED at,
   * not followed. Clicking it lands on the expired-link page, which is itself
   * worth seeing.
   */
  const confirmUrl = `${absolute(href(lang, "/mail/confirm"))}?t=preview.not.a.real.token`;
  const confirm = confirmEmail(lang, confirmUrl);
  await writeFile(join(OUT, `confirm-${lang}.html`), confirm.html);
  mails.push({ file: `confirm-${lang}.html`, label: confirm.subject });

  const shown = shownArticles(digest);

  // Mirrors the /og route exactly — the digest's own date as the meta line, and
  // the published headlines in the reader's language.
  const ogBytes = await renderOgCard({
    lang,
    meta: digest.date,
    headlines: shown.map((article) => displayTitle(article, lang)),
  });
  await writeFile(join(OUT, `og-${lang}.png`), ogBytes);
  console.log(`[preview] og-${lang}.png`);

  const posters: Shot[] = [];
  const top = shown[0];
  if (top) {
    // `posterParts` off the take that will be DRAWN, because the two halves
    // paginate differently and the English one may not exist for an archived day.
    const parts = posterParts(summaryFor(top, lang));
    for (let part = 1; part <= parts; part += 1) {
      const bytes = await renderPoster({ article: top, date: digest.date, lang, part });
      if (!bytes) continue;
      const file = `poster-${lang}-${part}.png`;
      await writeFile(join(OUT, file), bytes);
      posters.push({ file, label: `${part} / ${parts}` });
      console.log(`[preview] ${file}`);
    }
  }

  return { lang, brand: t.brand, mails, posters, og: { file: `og-${lang}.png`, label: digest.date } };
}

/** The contact sheet. Plain HTML in a template string, for the reason
 *  lib/mail/render.ts gives: there is nothing here a component would buy. */
function indexPage(digest: Digest, sections: Section[]): string {
  const font = `-apple-system,'PingFang SC','Segoe UI',Roboto,sans-serif`;

  const mailCard = (shot: Shot) =>
    `<a href="${shot.file}" style="display:block;background:${PAPER};border:1px solid ${LINE};border-radius:18px;padding:16px 20px;text-decoration:none;color:${INK};font-weight:700;">${escapeHtml(
      shot.label,
    )}<small style="display:block;font-weight:500;color:${INK_SOFT};font-size:13px;margin-top:2px;">${shot.file}</small></a>`;

  /* The poster is 3:4 and there can be five or six of them, so they scroll
     sideways in a row rather than wrapping into a grid that pushes the OG card
     off the screen. `flex:none` is what stops the row squeezing them instead. */
  const posterStrip = (shots: Shot[]) =>
    `<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;">${shots
      .map(
        (shot) =>
          `<a href="${shot.file}" style="flex:none;text-decoration:none;color:${INK_SOFT};">
<img src="${shot.file}" width="210" style="display:block;width:210px;border-radius:12px;border:1px solid ${LINE};">
<div style="font:500 12px/1.6 ${font};padding-top:6px;">${escapeHtml(shot.label)}</div></a>`,
      )
      .join("")}</div>`;

  const section = (item: Section) => `
<section style="margin:0 0 44px;">
<h2 style="font:700 20px/1.3 ${font};margin:0 0 16px;">${escapeHtml(item.brand)} <span style="color:${INK_SOFT};font-weight:500;">/${item.lang}</span></h2>
<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:0 0 20px;">
${item.mails.map(mailCard).join("")}
</div>
${item.posters.length ? posterStrip(item.posters) : `<div style="color:${INK_SOFT};font:500 13px/1.6 ${font};">没有可渲染的海报</div>`}
<a href="${item.og.file}" style="display:block;margin-top:20px;text-decoration:none;color:${INK_SOFT};">
<img src="${item.og.file}" width="520" style="display:block;width:100%;max-width:520px;border-radius:12px;border:1px solid ${LINE};">
<div style="font:500 12px/1.6 ${font};padding-top:6px;">${item.og.file} · 1200×630</div></a>
</section>`;

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>daily preview · ${digest.date}</title>
</head>
<body style="margin:0;padding:40px 24px 64px;background:${CREAM};color:${INK};font-family:${font};">
<div style="max-width:920px;margin:0 auto;">
<h1 style="font:700 26px/1.3 ${font};margin:0 0 6px;">daily preview</h1>
<p style="font:500 14px/1.6 ${font};color:${INK_SOFT};margin:0 0 36px;">${digest.date} · 邮件、分享海报、链接预览卡片，全部按线上代码渲染</p>
${sections.map(section).join("")}
<p style="font:500 12px/1.7 ${font};color:${INK_SOFT};background:${CARD};border-radius:18px;padding:14px 18px;margin:0;">
邮件里的 logo 和链接都是指向 <code>daily.lab115.com</code> 的绝对地址 —— 收件箱里没有相对路径可言，所以这两样在预览页里走的是线上站点。确认信的 token 是假的，点进去会落在「链接失效」页。
</p>
</div>
</body>
</html>`;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
};

/**
 * The smallest static server that can serve this directory.
 *
 * `node:http` rather than a dependency: it is one directory of two file types
 * with no range requests, no compression and no caching, and a devDependency for
 * that is a devDependency to keep up to date forever.
 *
 * `normalize` then a prefix check, because a preview server still listens on a
 * socket and `GET /../../.env` is two keystrokes.
 */
function serve(): void {
  createServer(async (request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    const file = resolve(OUT, `.${normalize(path === "/" ? "/index.html" : path)}`);
    if (!file.startsWith(OUT)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end("Not found");
    }
  }).listen(PORT, "127.0.0.1", () => {
    console.log(`\n[preview] http://127.0.0.1:${PORT}\n`);
  });
}

async function main(): Promise<void> {
  const digest = date ? await readDigest(date) : await readLatest();
  if (!digest) {
    console.error(`[preview] no digest for ${date ?? "the most recent day"}`);
    process.exit(1);
  }

  // Emptied rather than merged: a stale `poster-zh-6.png` from a day that
  // paginated longer would sit in the directory looking like part of this run.
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  console.log(`[preview] ${digest.date}\n`);
  const sections: Section[] = [];
  for (const lang of LANGS) sections.push(await renderLang(digest, lang));

  await writeFile(join(OUT, "index.html"), indexPage(digest, sections));
  console.log(`\n[preview] ${OUT}`);

  if (buildOnly) return;
  serve();
}

main().catch((error) => {
  console.error("[preview] failed:", error);
  process.exit(1);
});
