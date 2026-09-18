import { readFile } from "node:fs/promises";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, SITE } from "../../src/lib/config";

/**
 * TELL THE SEARCH ENGINES THAT EVERY URL ON THIS SITE JUST CHANGED — the one-off
 * push to run AFTER the redirect fix is deployed.
 *
 * Two structural migrations shipped without redirects (2026-08-28 and
 * 2026-09-02), and every URL Google held became a 404. The fix makes those
 * addresses answer 308 instead. But a redirect only does its work when a crawler
 * REFETCHES the old URL, and measurement says this site's old URLs are refetched
 * every three to four weeks. This shortens that wait where it can be shortened.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT DOES NOT REACH GOOGLE. Google does not participate in IndexNow — the
 * protocol is Bing, Yandex, Seznam and Naver. Since the problem being fixed is a
 * GOOGLE indexing problem, that limitation is the most important thing on this
 * page, and it is stated here rather than discovered later from a flat graph.
 *
 * FOR GOOGLE THERE ARE EXACTLY THREE LEVERS, and none of them is an API:
 *   1. The sitemap. It already carries an accurate `lastModified` and is already
 *      submitted; resubmitting it in Search Console re-queues a read of it.
 *   2. «网址检查» → «请求编制索引», by hand, roughly ten URLs a day. Worth
 *      spending on the handful of pages that once ranked — see out/dead-urls.txt.
 *   3. Waiting. The Indexing API exists but is documented for JobPosting and
 *      BroadcastEvent only; using it here would be a misuse that earns nothing.
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   npx tsx tools/gsc/resubmit.ts            # 只打印将要提交的清单
 *   npx tsx tools/gsc/resubmit.ts --confirm  # 真的提交
 *
 * Dry by default. This writes to somebody else's index, which is not a thing to
 * do by pressing up-arrow in a shell.
 */

const SITEMAP_URL = `${SITE}/sitemap.xml`;

/** Where the list of dead old URLs came from — see coverage.ts and the GSC data. */
const DEAD_URLS_FILE = "tools/gsc/out/dead-urls.txt";

/**
 * Every URL the site serves today, both languages, from the sitemap.
 *
 * The `<loc>` plus each `xhtml:link` alternate — the opposite choice from
 * coverage.ts, which takes one language per run to stay inside a 2,000/day
 * inspection quota. IndexNow has no such quota (10,000 URLs per request) and the
 * point here is breadth, so both languages go.
 */
async function currentUrls(): Promise<string[]> {
  const response = await fetch(SITEMAP_URL);
  if (!response.ok) throw new Error(`拉取 sitemap 失败: ${response.status}`);
  const xml = await response.text();
  const found = new Set<string>();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) found.add(match[1]);
  for (const match of xml.matchAll(/hreflang="[^"]+"\s+href="([^"]+)"/g)) {
    found.add(match[1]);
  }
  return [...found];
}

/**
 * The old addresses — submitted DELIBERATELY, although they no longer serve a page.
 *
 * IndexNow's contract is "this URL changed", and a URL that changed into a
 * permanent redirect is exactly that. Submitting them is how the engines learn to
 * follow the 308 rather than waiting out their own recrawl schedule, and it is
 * the only part of this push that could not be achieved by the sitemap alone —
 * a sitemap lists what a site HAS, so it structurally cannot mention these.
 *
 * Missing file is not an error: the dead list is produced by an earlier analysis
 * run, and pushing only the live URLs is a reasonable thing to want.
 */
async function legacyUrls(): Promise<string[]> {
  try {
    const text = await readFile(DEAD_URLS_FILE, "utf8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("http"));
  } catch {
    console.log(`（没有 ${DEAD_URLS_FILE}，跳过旧 URL）`);
    return [];
  }
}

async function main() {
  const confirmed = process.argv.includes("--confirm");

  const live = await currentUrls();
  const legacy = await legacyUrls();
  const urls = [...new Set([...live, ...legacy])];

  console.log(`当前 URL: ${live.length}`);
  console.log(`旧 URL  : ${legacy.length}`);
  console.log(`合计    : ${urls.length}\n`);

  if (!confirmed) {
    console.log(urls.slice(0, 10).join("\n"));
    if (urls.length > 10) console.log(`… 另外 ${urls.length - 10} 条`);
    console.log(`\n这是空跑。加 --confirm 才会真的提交。`);
    console.log(`注意：IndexNow 推不到 Google，只到 Bing/Yandex 等。`);
    return;
  }

  const host = new URL(SITE).host;
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  /**
   * 200 and 202 both mean accepted — 202 is "received, key validation pending",
   * which is the normal answer for a first submission from a host.
   */
  console.log(`IndexNow → ${response.status} ${response.statusText}`);
  if (!response.ok) console.log(await response.text());
  console.log(`\n别忘了 Google 那三条（见本文件顶部注释）：`);
  console.log(`  1. Search Console 里重新提交 sitemap`);
  console.log(`  2. 对 ${DEAD_URLS_FILE} 里曾经有排名的几条手动「请求编制索引」`);
  console.log(`  3. 2–4 周后跑 coverage.ts 重测`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
