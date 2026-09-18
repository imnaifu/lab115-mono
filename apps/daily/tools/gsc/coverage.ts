import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspect, resolveSite, type IndexStatus } from "./gsc";
import { toCsv } from "./csv";

/**
 * HOW MUCH OF THIS SITE IS ACTUALLY IN GOOGLE'S INDEX, and for the part that is
 * not, why.
 *
 * THE ONE NUMBER WORTH HAVING. With three weeks and ten clicks, the performance
 * report has nothing in it to analyse — ten is noise, and no breakdown of noise
 * becomes signal. What decides where the effort goes is whether the ~380 pages
 * are indexed: if most are not, there is still technical work; if most are and
 * impressions are still ~0, the problem is that nobody searches for this content
 * and no amount of markup changes that.
 *
 * The «编制索引 → 网页» report answers it in aggregate, but its export is a
 * summary plus ≤1,000 example URLs per reason — you cannot ask it about a URL you
 * name, and you cannot join it to anything. Inspecting each URL gives a row per
 * page, which is a table you can actually sort.
 *
 *   npx tsx tools/gsc/coverage.ts            # 全部
 *   npx tsx tools/gsc/coverage.ts --limit 20 # 先试 20 个
 */

const SITEMAP_URL = "https://daily.lab115.com/sitemap.xml";

/**
 * QUOTA: 2,000 inspections per day per property, 600 per minute.
 *
 * `MIN_INTERVAL_MS` paces request STARTS at ~8/second (480/min), which leaves
 * headroom under the per-minute ceiling without making a ~380-URL sweep take
 * longer than a minute of wall clock. Concurrency alone cannot do this job: six
 * in flight against a fast endpoint would burst well past 600/min, and the 429
 * retry in gsc.ts is a safety net, not a rate limiter.
 */
const MIN_INTERVAL_MS = 125;
const CONCURRENCY = 6;

/**
 * ONE LANGUAGE PER RUN — the `<loc>`, or its `xhtml:link` alternate.
 *
 * Each sitemap entry carries both languages: the `<loc>` is the default-language
 * (Chinese) URL, with the English twin beside it as an `alternate`. Inspecting
 * both in one pass would be ~760 URLs against a 2,000/day quota, leaving no room
 * to re-check — so the language is a flag and each run costs ~380.
 *
 * THAT THE TWO CAN DIVERGE IS THE WHOLE REASON THIS IS A FLAG. They are separate
 * URLs with separate index status, and the first full sweep found the Chinese
 * side at 0% indexed while the performance report showed the English side
 * collecting every impression the site has ever had. A tool that could only ask
 * about `<loc>` would have reported that asymmetry as "nothing is indexed".
 */
type SitemapEntry = { loc: string; alternates: Record<string, string> };

async function sitemapEntries(): Promise<SitemapEntry[]> {
  const response = await fetch(SITEMAP_URL);
  if (!response.ok) {
    throw new Error(`拉取 sitemap 失败: ${response.status}`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((block) => {
    const body = block[1];
    const alternates: Record<string, string> = {};
    for (const link of body.matchAll(
      /hreflang="([^"]+)"\s+href="([^"]+)"/g,
    )) {
      alternates[link[1]] = link[2];
    }
    return { loc: body.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "", alternates };
  });
}

/**
 * `--lang en` picks the `en-US` alternate; anything else stays on the `<loc>`.
 *
 * Falling back to the `<loc>` rather than skipping the entry, because an entry
 * with no alternate for the requested language is a sitemap bug worth seeing in
 * the results — a silent skip would shorten the list and look like a smaller site.
 */
function urlsFor(entries: SitemapEntry[], lang: string): string[] {
  if (lang !== "en") return entries.map((entry) => entry.loc);
  return entries.map((entry) => entry.alternates["en-US"] ?? entry.loc);
}

type Row = {
  url: string;
  verdict: string;
  coverageState: string;
  robotsTxtState: string;
  indexingState: string;
  pageFetchState: string;
  lastCrawlTime: string;
  googleCanonical: string;
  userCanonical: string;
  canonicalAgrees: string;
  inSitemap: string;
  referringUrls: number;
  error: string;
};

function toRow(url: string, status: IndexStatus): Row {
  const googleCanonical = status.googleCanonical ?? "";
  const userCanonical = status.userCanonical ?? "";
  return {
    url,
    verdict: status.verdict ?? "",
    coverageState: status.coverageState ?? "",
    robotsTxtState: status.robotsTxtState ?? "",
    indexingState: status.indexingState ?? "",
    pageFetchState: status.pageFetchState ?? "",
    lastCrawlTime: status.lastCrawlTime ?? "",
    googleCanonical,
    userCanonical,
    /**
     * WHETHER GOOGLE ACCEPTED THE PAGE'S OWN CANONICAL.
     *
     * A disagreement here is the specific failure this site has been bitten by
     * before — the Accept-Language negotiation that made every unprefixed URL a
     * second address for a Chinese page, and put three of them in Search Console
     * as "duplicate, Google chose a different canonical". The fix is in
     * `proxy.ts` and is believed to hold; this column is how you check rather
     * than believe. Blank on both sides means never crawled, which is neither
     * agreement nor disagreement.
     */
    canonicalAgrees:
      !googleCanonical && !userCanonical
        ? ""
        : googleCanonical === userCanonical
          ? "yes"
          : "NO",
    inSitemap: status.sitemap?.length ? "yes" : "no",
    referringUrls: status.referringUrls?.length ?? 0,
    error: "",
  };
}

/** Counts per distinct value, biggest first — the shape every summary here wants. */
function tally(rows: Row[], field: keyof Row): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[field] || "(空)");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([, left], [, right]) => right - left);
}

function printTally(title: string, entries: [string, number][], total: number) {
  console.log(`\n${title}`);
  for (const [value, count] of entries) {
    const share = ((count / total) * 100).toFixed(1).padStart(5);
    console.log(`  ${share}%  ${String(count).padStart(4)}  ${value}`);
  }
}

async function main() {
  const limitFlag = process.argv.indexOf("--limit");
  const limit =
    limitFlag > -1 ? Number(process.argv[limitFlag + 1]) : Number.POSITIVE_INFINITY;

  const langFlag = process.argv.indexOf("--lang");
  const lang = langFlag > -1 ? process.argv[langFlag + 1] : "zh";

  /**
   * `--urls <file>` INSPECTS A LIST INSTEAD OF THE SITEMAP — one URL per line.
   *
   * The sitemap only holds URLs the site still serves, which makes it the wrong
   * input for the one question a redirect raises: what does Google still believe
   * about the addresses the site NO LONGER has? Those are exactly the URLs a
   * sitemap cannot contain, and watching them drop out of the index is how you
   * learn when a redirect has finished its job rather than guessing a date.
   */
  const urlsFlag = process.argv.indexOf("--urls");
  const listFile = urlsFlag > -1 ? process.argv[urlsFlag + 1] : null;

  const siteUrl = await resolveSite();
  const allUrls = listFile
    ? readFileSync(listFile, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : urlsFor(await sitemapEntries(), lang);
  const urls = allUrls.slice(0, limit);

  console.log(`资源: ${siteUrl}`);
  console.log(listFile ? `清单: ${listFile}` : `语言: ${lang}`);
  console.log(`共 ${allUrls.length} 条，本次检查 ${urls.length} 条`);
  if (urls.length > 2000) {
    console.log(`⚠️  超过每日 2000 次配额，超出的部分会失败`);
  }
  console.log(`预计约 ${Math.ceil((urls.length * MIN_INTERVAL_MS) / 1000)} 秒\n`);

  const rows: Row[] = [];
  let nextIndex = 0;
  let lastStart = 0;
  let done = 0;

  /**
   * A worker pulls the next URL, waits out the pacing interval, inspects it.
   *
   * `lastStart` is shared across workers on purpose — it is the pacing, and each
   * worker waiting only on its OWN previous start would multiply the rate by
   * CONCURRENCY and put the sweep straight through the per-minute ceiling.
   */
  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
      lastStart = Date.now() + wait;
      if (wait) await new Promise((go) => setTimeout(go, wait));

      try {
        rows.push(toRow(url, await inspect(siteUrl, url)));
      } catch (error) {
        // One URL's failure must not lose the other 379 results. It is recorded
        // as a row so the CSV stays a complete account of what was asked.
        rows.push({
          ...toRow(url, {}),
          error: error instanceof Error ? error.message.split("\n")[0] : String(error),
        });
      }
      done++;
      if (done % 25 === 0 || done === urls.length) {
        process.stdout.write(`\r  已检查 ${done}/${urls.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("\n");

  const outPath = resolve(import.meta.dirname, `out/coverage-${listFile ? "list" : lang}.csv`);
  writeFileSync(outPath, toCsv(rows));

  const indexed = rows.filter((row) => row.verdict === "PASS").length;
  console.log(`━━━ ${rows.length} 个 URL ━━━`);
  console.log(
    `已编入索引: ${indexed} (${((indexed / rows.length) * 100).toFixed(1)}%)`,
  );
  printTally("覆盖状态 (coverageState):", tally(rows, "coverageState"), rows.length);
  printTally("裁定 (verdict):", tally(rows, "verdict"), rows.length);

  const mismatches = rows.filter((row) => row.canonicalAgrees === "NO");
  if (mismatches.length) {
    console.log(`\n⚠️  ${mismatches.length} 个页面 Google 选了别的 canonical:`);
    for (const row of mismatches.slice(0, 5)) {
      console.log(`  ${row.url}\n    → Google: ${row.googleCanonical}`);
    }
  }

  const failed = rows.filter((row) => row.error);
  if (failed.length) console.log(`\n${failed.length} 个 URL 检查失败，见 CSV 的 error 列`);

  console.log(`\n明细: ${outPath}\n`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
