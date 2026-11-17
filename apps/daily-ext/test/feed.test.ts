/**
 * The feed parser against real snapshots of daily.lab115.com's feeds
 * (test/fixtures, saved 2026-11-13) plus the edge cases the writer can produce.
 *
 * Run: npm test   (Node's built-in runner, no extra dependency)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { datesOf, dayUrl, decodeXml, parseFeed, siteUrl } from "../src/shared/feed.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("zh snapshot: every entry parses, grouped by digest date", () => {
  const feed = parseFeed(fixture("feed.zh.xml"), "zh", 0);
  assert.equal(feed.entries.length, 61);
  assert.equal(feed.updated, "2026-11-13T15:00:00.001Z");
  const first = feed.entries[0];
  assert.equal(first.date, "2026-11-13");
  assert.equal(first.title, "机房是新的写字楼");
  assert.equal(first.categoryId, "business");
  assert.equal(first.categoryLabel, "商业");
  assert.ok(first.html.startsWith("<p>"), "content is markup after one decode");
  assert.ok(first.html.includes("看原文 →"));
  // Dates come out newest first and are all real calendar days.
  const dates = datesOf(feed);
  assert.equal(dates[0], "2026-11-13");
  assert.deepEqual([...dates].sort().reverse(), dates);
  for (const date of dates) assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
});

test("en snapshot: links carry the /en prefix and labels are English", () => {
  const feed = parseFeed(fixture("feed.en.xml"), "en", 0);
  assert.equal(feed.entries.length, 61);
  const first = feed.entries[0];
  assert.ok(first.link.startsWith("https://daily.lab115.com/en/2026/11/13/"));
  assert.equal(first.date, "2026-11-13");
  assert.equal(first.categoryLabel, "Business & Product");
  // `&#39;` in titles is decoded.
  assert.ok(feed.entries.some((entry) => entry.title.includes("'")));
  assert.ok(feed.entries.every((entry) => !entry.title.includes("&#39;")));
});

test("both languages list the same days with the same counts", () => {
  const zh = parseFeed(fixture("feed.zh.xml"), "zh", 0);
  const en = parseFeed(fixture("feed.en.xml"), "en", 0);
  const counts = (entries: { date: string }[]) =>
    entries.reduce<Record<string, number>>((all, { date }) => ({ ...all, [date]: (all[date] ?? 0) + 1 }), {});
  assert.deepEqual(counts(zh.entries), counts(en.entries));
});

test("decodeXml undoes exactly one level", () => {
  assert.equal(decodeXml("&amp;lt;p&amp;gt;"), "&lt;p&gt;");
  assert.equal(decodeXml("&lt;p&gt;A &amp; B&lt;/p&gt;"), "<p>A & B</p>");
  assert.equal(decodeXml("&#39;&#x4e2d;&quot;"), "'中\"");
  assert.equal(decodeXml("&unknown;"), "&unknown;");
});

test("non-Atom responses are refused, not cached as empty", () => {
  assert.throws(() => parseFeed("<html><body>Captive portal</body></html>", "zh"));
});

test("an entry whose URL has no date is dropped", () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <updated>2026-11-13T15:00:00Z</updated>
    <entry><id>https://daily.lab115.com/about</id><title type="text">x</title></entry>
    <entry><id>https://daily.lab115.com/2026/11/12/a-1</id><title type="text">ok</title>
      <category term="tech" label="技术"/><content type="html">&lt;p&gt;hi&lt;/p&gt;</content></entry>
  </feed>`;
  const feed = parseFeed(xml, "zh", 0);
  assert.equal(feed.entries.length, 1);
  assert.equal(feed.entries[0].date, "2026-11-12");
  assert.equal(feed.entries[0].html, "<p>hi</p>");
});

test("site URLs follow the site's language prefix rule", () => {
  assert.equal(siteUrl("zh"), "https://daily.lab115.com/");
  assert.equal(siteUrl("en"), "https://daily.lab115.com/en");
  assert.equal(dayUrl("zh", "2026-11-13"), "https://daily.lab115.com/2026/11/13");
  assert.equal(dayUrl("en", "2026-11-13"), "https://daily.lab115.com/en/2026/11/13");
});
