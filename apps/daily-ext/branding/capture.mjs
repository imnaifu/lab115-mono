/**
 * Capture the REAL side panel page (built dist/, loaded as an extension in
 * Playwright's Chromium, opened as a page at a side panel's size) at 2× for the
 * store images. The 400×628 viewport must match `.panel img.shot` in
 * index.html. Branded Chrome no longer accepts --load-extension, which is why
 * this step cannot use render.sh's Chrome.
 *
 * NO ARTICLE CONTENT IN THE PICTURES. Every headline, take and source name is
 * replaced with grey placeholder bars right before each shot (`blankList`), one
 * bar per line at the element's own line height, so the layout is exactly what
 * the panel draws. What stays real is the panel's own chrome: language switch,
 * date, count, section chips.
 *
 * DETERMINISTIC: the feed requests are answered from test/fixtures (the
 * 2026-11-13 snapshot), so the date, count and section chips are the same on
 * every run.
 *
 * Usage: npm run build && node branding/capture.mjs
 * Output: branding/shots/<lang>-list[-dark].png
 */
import { chromium } from "playwright";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const EXT = join(root, "dist");
const OUT = join(root, "branding/shots");

const fixture = (lang) => readFileSync(join(root, `test/fixtures/feed.${lang}.xml`), "utf8");

const profile = mkdtempSync(join(tmpdir(), "daily-ext-capture-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: { width: 400, height: 628 },
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
await context.route("https://daily.lab115.com/feed.xml", (route) =>
  route.fulfill({ status: 200, contentType: "application/atom+xml", body: fixture("zh") }),
);
await context.route("https://daily.lab115.com/en/feed.xml", (route) =>
  route.fulfill({ status: 200, contentType: "application/atom+xml", body: fixture("en") }),
);

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker");
const id = new URL(worker.url()).host;

/**
 * The placeholder bars. Each `.ph` is one line box tall (`1lh`) with the bar
 * drawn in its middle, so a bar list takes exactly the room the text took.
 * Colours derive from `currentColor`, which makes them right in dark mode too.
 */
const PLACEHOLDER_CSS = `
  .ph { display: block; height: 1lh; position: relative; }
  .ph::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 0.62em;
    transform: translateY(-50%); border-radius: 999px;
    background: color-mix(in srgb, currentColor 14%, transparent); }
  .ph.strong::after { background: color-mix(in srgb, currentColor 26%, transparent); }
  .ph-inline { display: inline-block; height: 0.8em; border-radius: 999px; vertical-align: middle;
    background: color-mix(in srgb, currentColor 22%, transparent); }
`;

async function blankList(page) {
  await page.evaluate((css) => {
    const bars = (widths, strong = false) =>
      widths.map((w) => `<span class="ph${strong ? " strong" : ""}" style="width:${w}%"></span>`).join("");
    document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
    // Fixed width patterns, so re-runs draw the same picture. Takes run three to
    // four lines, as the real ones do now that the card shows them in full.
    const TITLES = [[92, 48], [84], [96, 62], [78], [88, 40], [70], [94, 55], [82], [90, 66], [76]];
    const THESES = [[100, 97, 100, 46], [100, 94, 62], [100, 100, 88, 30], [100, 96, 54], [100, 92, 100, 70]];
    const SOURCES = [96, 120, 84, 108, 132];
    document.querySelectorAll(".item").forEach((item, at) => {
      const title = item.querySelector(".item-title");
      const thesis = item.querySelector(".item-thesis");
      const source = item.querySelector(".source");
      if (title) title.innerHTML = bars(TITLES[at % TITLES.length], true);
      if (thesis) thesis.innerHTML = bars(THESES[at % THESES.length]);
      if (source) source.innerHTML = `<span class="ph-inline" style="width:${SOURCES[at % SOURCES.length]}px"></span>`;
    });
  }, PLACEHOLDER_CSS);
}

async function shoot(lang, scheme) {
  // Seed the stored language so the panel opens in the language being shot.
  await worker.evaluate(async (l) => chrome.storage.local.clear().then(() => chrome.storage.local.set({ lang: l })), lang);
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await page.waitForSelector(".item");
  const day = await page.textContent(".day");
  await blankList(page);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `${lang}-list${scheme === "dark" ? "-dark" : ""}.png`) });
  console.log(lang, scheme, "|", day);
  await page.close();
}

for (const lang of ["zh", "en"]) {
  await shoot(lang, "light");
  await shoot(lang, "dark");
}

await context.close();
rmSync(profile, { recursive: true, force: true });
console.log(`✓ ${OUT}`);
