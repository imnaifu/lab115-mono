/**
 * Everything tunable lives here so Coolify env vars are the only knob.
 *
 * Deliberately free of `node:*` imports: `instrumentation.ts` and the root
 * layout both read from this module, and Next compiles those for the edge
 * runtime too — a single `node:path` import here would warn on every build.
 */

export const SITE = "https://daily.lab115.com";

/**
 * Mounted volume. The git clone lives inside it, so it survives redeploys.
 *
 * The `/data` default is the container's mount point and is unwritable
 * anywhere else, so the `dev` and `once` npm scripts default it to `./data`
 * instead — running them without the variable set must not try to mkdir at the
 * filesystem root.
 *
 * May be relative: `paths.ts` resolves it to an absolute path, which is the
 * only form the git commands may ever see.
 */
export const DATA_DIR = process.env.DAILY_DATA_DIR ?? "/data";

/** github.com/<slug> — the digests are committed here. */
export const REPO_SLUG = process.env.GIT_REPO ?? "imnaifu/files";
export const REPO_BRANCH = process.env.GIT_BRANCH ?? "main";
/** Subdirectory inside that repo, so `files` stays usable for other things. */
export const REPO_SUBDIR = "daily";

/** Fine-grained PAT with contents:write on REPO_SLUG. Never logged. */
export const GIT_TOKEN = process.env.GIT_TOKEN ?? "";

/**
 * Overrides the remote URL entirely, e.g. `git@github.com:imnaifu/files.git`.
 *
 * The container uses HTTPS + GIT_TOKEN because it has no SSH key. On a laptop
 * that already has one, setting this pushes with the existing key and no PAT.
 */
export const GIT_REMOTE = process.env.GIT_REMOTE ?? "";
export const GIT_AUTHOR_NAME = process.env.GIT_AUTHOR_NAME ?? "daily-bot";
export const GIT_AUTHOR_EMAIL =
  process.env.GIT_AUTHOR_EMAIL ?? "daily-bot@lab115.com";

export const CRON = process.env.DAILY_CRON ?? "0 7 * * *";
export const TZ = process.env.DAILY_TZ ?? "America/Los_Angeles";

/**
 * How often to `git pull` without generating anything. The pages serve
 * whatever is in the clone, so without this they cannot see a digest pushed
 * from anywhere but this container until the next daily run.
 *
 * Offset off the hour on purpose. The obvious every-15-minutes spelling fires
 * at minute 0, which is also CRON's minute — both callbacks then land in the
 * same tick and fight over the one lock in `jobs/daily.ts`. The sync grabs it
 * first and the daily run, which has no second chance for 24h, dies on "a run
 * is already in progress". Keep the two minute sets disjoint if CRON is ever
 * overridden.
 */
export const SYNC_CRON = process.env.DAILY_SYNC_CRON ?? "7,22,37,52 * * * *";

/**
 * How many daily slots one run covers. No cross-day dedup state — the window
 * is it.
 *
 * Days, not hours, and that is load-bearing: a window measured in hours cannot
 * tile across a DST change, because the two anchors either side of one are 23
 * or 25 real hours apart. See dailyWindow().
 */
export const WINDOW_DAYS = Number(process.env.DAILY_WINDOW_DAYS ?? 1);

/**
 * The hour, in TZ, that one day's window ends and the next begins.
 *
 * Should match CRON's hour. It is a separate knob rather than parsed out of the
 * cron string because cron expressions can name several hours and this needs
 * exactly one.
 */
export const WINDOW_ANCHOR_HOUR = Number(
  process.env.DAILY_WINDOW_ANCHOR_HOUR ?? 7,
);
/** Articles above this rank get folded into a bare title list. */
export const TOP_N = Number(process.env.DAILY_TOP_N ?? 10);

/** DeepSeek serves an OpenAI-compatible API, so the `openai` SDK talks to it
 *  unchanged — only the base URL and key differ. */
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
export const MODEL = process.env.DAILY_MODEL ?? "deepseek-v4-flash";

/**
 * Per-article body budget handed to the model, in characters.
 *
 * 6000 was calibrated on XDA's short posts. Long-form sources ship 28k–74k
 * characters, and summarizing those from their first 6k produces a summary of
 * the introduction, not of the argument. Input is the cheap half of the bill
 * ($0.14/M) against a 1M context, so the budget is generous on purpose.
 *
 * 20000 was the next stop and it still cut more than it looked like. Measured
 * over a 14-day window (136 articles), 17 of them — 12.5%, spread across
 * ELEVEN sources, not just the two obvious long-form ones — ran past it: Not
 * Boring 84,933 characters, Noahpinion 80,993, ACX 68,463, Dan Luu 63,384,
 * Neciu Dan 47,898, Damodaran 32,646, and on down through Platformer, Works in
 * Progress, Craig Mod, Lenny's and Construction Physics.
 *
 * 80000 rather than more because the curve flattens there: the longest article
 * in that sample was 84,933, so raising the cap to 120000 buys 0.4% more text.
 * Rather than less because BATCH_SIZE is 1 — one request carries one body, so
 * even the longest article is ~36k tokens against a context measured in
 * hundreds of thousands. Nothing here is near a limit.
 *
 * Cost: 31.7k → 42.0k input tokens/day, +32%. That sounds worse than it is —
 * the baseline it grows from already fell by half when Hacker News went to
 * maxPerRun 5 and XDA to 3, so this lands at roughly $2.7/year, still under
 * the $5.40 the job cost before either change.
 */
export const BODY_CHAR_LIMIT = Number(process.env.DAILY_BODY_CHARS ?? 80_000);

export const BARK_URL = process.env.BARK_URL ?? "";

/** DRY_RUN=1 → run the whole pipeline but skip `git push` and Bark. */
export const DRY_RUN = process.env.DRY_RUN === "1";

/** yyyy-mm-dd for an instant, in DAILY_TZ (not the server's local zone). */
export function dateKey(when: Date, timeZone = TZ): string {
  // en-CA formats as yyyy-mm-dd, which is exactly the key format we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

/** How far `timeZone` is from UTC at a given instant, in ms. Positive east. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Read the zone's wall clock back as if it were UTC; the gap is the offset.
  // `% 24` because hour12:false renders midnight as 24 in some environments.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/** The instant when a given wall-clock time in `timeZone` occurs. */
function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour);
  // The offset has to be sampled at roughly the right instant, so guess with
  // the offset at the naive time and correct once. One pass is enough: a DST
  // shift moves the answer by an hour, never across another transition.
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  const second = wall - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/**
 * The window a run covers: the fixed daily slot ending at WINDOW_ANCHOR_HOUR.
 *
 * ANCHORED TO THE CLOCK, NOT TO THE RUN. This used to be `[now - 24h, now]`,
 * which tiles perfectly only if every run is exactly 24h after the last one.
 * The 07:00 cron satisfies that; `npm run once` does not, and the digests show
 * what happens when it does not — two runs 20.3h apart overlapped by 3.7 hours
 * and published the same four articles twice, while two runs 25.2h apart left a
 * 1.2 hour hole whose articles were never published at all. Duplicates are the
 * visible half of that bug; the silent half is worse.
 *
 * Now the slot is the same no matter when the run happens: 08:00 and 09:00
 * both produce yesterday-07:00 → today-07:00. Consecutive days abut exactly.
 *
 * `from` is the PREVIOUS DAY'S ANCHOR, not `anchor` minus twenty-four hours.
 * Those differ twice a year and the difference is the same bug again: across
 * the November fall-back the two 07:00s are 25 real hours apart, so subtracting
 * 24 lands at 08:00 and drops an hour of articles into a gap. Anchoring both
 * ends to the wall clock makes the slot 23 or 25 hours on those two days, which
 * is correct — it covers exactly the time between one 07:00 and the next.
 *
 * A run BEFORE the anchor hour cannot cover time that has not happened yet, so
 * `to` clamps to now. Re-running after the anchor completes the day — writing a
 * digest is idempotent per date.
 */
export function dailyWindow(
  now: Date,
  timeZone = TZ,
): { from: Date; to: Date } {
  const [year, month, day] = dateKey(now, timeZone).split("-").map(Number);
  const anchor = zonedTime(year, month, day, WINDOW_ANCHOR_HOUR, timeZone);

  // Calendar arithmetic, which is timezone-independent for a date alone;
  // Date.UTC rolls months and years over for us.
  const start = new Date(Date.UTC(year, month - 1, day - WINDOW_DAYS));
  const from = zonedTime(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
    WINDOW_ANCHOR_HOUR,
    timeZone,
  );

  return { from, to: now < anchor ? now : anchor };
}
