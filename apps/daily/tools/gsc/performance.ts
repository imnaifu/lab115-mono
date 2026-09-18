import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveSite, searchAnalytics } from "./gsc";
import { toCsv } from "./csv";

/**
 * Clicks, impressions, queries and pages — the Performance report, as tables.
 *
 * WHAT THE UI CANNOT DO, and the only reason to pull this rather than read the
 * chart: the UI shows one breakdown at a time, capped at 1,000 rows, and will
 * not cross two dimensions. The question that matters for a site with no traffic
 * is not "how many clicks" — it is IMPRESSIONS BY QUERY: what Google thinks this
 * site is about, and at what position. Ten clicks tells you nothing; a thousand
 * impressions at position 40 for queries nobody would type tells you the whole
 * story.
 *
 *   npx tsx tools/gsc/performance.ts           # 最近 90 天
 *   npx tsx tools/gsc/performance.ts --days 28
 *
 * Writes four CSVs, one per breakdown, into out/.
 */

/**
 * SIXTEEN MONTHS is Search Console's entire retention, and the default here is
 * 90 days rather than all of it because this site is younger than that — asking
 * for more returns the same rows plus a longer wait.
 */
const DEFAULT_DAYS = 90;

/** `YYYY-MM-DD` in UTC, which is the only format the API accepts. */
function isoDate(daysAgo: number): string {
  const when = new Date(Date.now() - daysAgo * 86_400_000);
  return when.toISOString().slice(0, 10);
}

/** Totals for a set of rows — printed so the summary does not require the CSV. */
function totals(rows: { clicks: number; impressions: number; position: number }[]) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  /**
   * AVERAGE POSITION IS WEIGHTED BY IMPRESSIONS, not a plain mean of the column.
   *
   * A query seen once at position 3 and one seen 900 times at position 60 do not
   * average to 31.5 in any sense that means anything — Search Console's own
   * "average position" is impression-weighted, and an unweighted mean here would
   * disagree with the UI for no reason anyone could later reconstruct.
   */
  const weighted = rows.reduce((sum, row) => sum + row.position * row.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    position: impressions ? weighted / impressions : 0,
  };
}

async function pull(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
) {
  const rows = await searchAnalytics(siteUrl, { startDate, endDate, dimensions });
  return rows.map((row) => {
    const named: Record<string, unknown> = {};
    dimensions.forEach((dimension, at) => {
      named[dimension] = row.keys?.[at] ?? "";
    });
    named.clicks = row.clicks;
    named.impressions = row.impressions;
    named.ctr = (row.ctr * 100).toFixed(2);
    named.position = row.position.toFixed(1);
    return named;
  });
}

async function main() {
  const daysFlag = process.argv.indexOf("--days");
  const days = daysFlag > -1 ? Number(process.argv[daysFlag + 1]) : DEFAULT_DAYS;

  const siteUrl = await resolveSite();
  const startDate = isoDate(days);
  const endDate = isoDate(0);

  console.log(`资源: ${siteUrl}`);
  console.log(`区间: ${startDate} → ${endDate}（${days} 天）\n`);

  const breakdowns: [string, string[]][] = [
    ["date", ["date"]],
    ["query", ["query"]],
    ["page", ["page"]],
    ["query-page", ["query", "page"]],
  ];

  for (const [name, dimensions] of breakdowns) {
    const rows = await pull(siteUrl, startDate, endDate, dimensions);
    const outPath = resolve(import.meta.dirname, `out/performance-${name}.csv`);
    writeFileSync(outPath, toCsv(rows as Record<string, unknown>[]));
    console.log(`${name.padEnd(12)} ${String(rows.length).padStart(5)} 行 → ${outPath}`);
  }

  /**
   * The summary is computed from the `date` breakdown because it is the one with
   * no sampling: Search Console drops long-tail queries from a `query` breakdown
   * for privacy (a search only a handful of people made would identify them), so
   * summing THAT one understates the totals — often badly on a small site, which
   * is exactly the site this is being run on.
   */
  const daily = await searchAnalytics(siteUrl, {
    startDate,
    endDate,
    dimensions: ["date"],
  });
  const summary = totals(daily);
  console.log(`\n━━━ ${days} 天合计 ━━━`);
  console.log(`点击      ${summary.clicks}`);
  console.log(`展示      ${summary.impressions}`);
  console.log(`CTR       ${summary.ctr.toFixed(2)}%`);
  console.log(`平均排名  ${summary.position.toFixed(1)}`);
  console.log(`有展示的天数 ${daily.filter((row) => row.impressions > 0).length}/${daily.length}\n`);

  const byQuery = await searchAnalytics(siteUrl, {
    startDate,
    endDate,
    dimensions: ["query"],
  });
  const top = byQuery
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, 15);
  if (top.length) {
    console.log(`展示量最高的 ${top.length} 个搜索词:`);
    console.log(`  ${"展示".padStart(6)} ${"点击".padStart(5)} ${"排名".padStart(6)}  词`);
    for (const row of top) {
      console.log(
        `  ${String(row.impressions).padStart(6)} ${String(row.clicks).padStart(5)} ${row.position.toFixed(1).padStart(6)}  ${row.keys?.[0] ?? ""}`,
      );
    }
  } else {
    console.log(`没有任何搜索词有展示 —— 这个站在搜索结果里基本不出现。`);
  }
  console.log();
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
