/**
 * Every tunable value in the app, as a plain constant.
 *
 * THE ENVIRONMENT IS FOR SECRETS ONLY. Six names are read from it and no more:
 * `GIT_TOKEN`, `GIT_REMOTE`, `DEEPSEEK_API_KEY`, `RESEND_API_KEY`,
 * `MAIL_SECRET`, `DRY_RUN` — four credentials, one machine-specific remote, one
 * switch for a single invocation.
 * Everything else used to have one too (`GIT_REPO`, `DAILY_CRON`, `DAILY_TZ`,
 * `DAILY_MODEL`, `DAILY_BODY_CHARS`, `DAILY_CONCURRENCY` and half a dozen more)
 * and they are all literals now.
 *
 * WHY, when an env var looks strictly more flexible: because it was not. Every
 * one of them was passed through docker-compose as
 * `${DAILY_MODEL:-deepseek-v4-flash}` — the same default the code already
 * carried — so the indirection bought no configurability at all, only a second
 * and a third place to look before you could believe the value in front of you.
 * `DAILY_TOP_N` is where that ends: declared in compose and in `.env.example`,
 * read by nothing in `src/` for however long, and impossible to tell apart from
 * a live setting without grepping. It is deleted along with the rest.
 *
 * The cost is real and small: changing the cron or the model is now a commit and
 * a redeploy rather than a field in the Coolify UI. That is already how
 * `config.json` works — imported, baked into the image, "改完要 push 并重新部署"
 * — so this makes one deployment story instead of two.
 *
 * Deliberately free of `node:*` imports: `instrumentation.ts` and the root
 * layout both read from this module, and Next compiles those for the edge
 * runtime too — a single `node:path` import here would warn on every build.
 */

export const SITE = "https://daily.lab115.com";

/**
 * Mounted volume. The git clone lives inside it, so it survives redeploys.
 *
 * HARDCODED, and `./data` rather than `/data`.
 *
 * It was `process.env.DAILY_DATA_DIR ?? "/data"`, which meant the same code read
 * two different paths depending on who launched it: compose set the variable to
 * the container's mount point, and the `dev` and `once` npm scripts each set it
 * to `./data` because nothing can mkdir at the filesystem root of a Mac. Two
 * environments, two values, and a local run that forgot the prefix failed with a
 * bare EACCES on a path nobody had typed.
 *
 * One relative path is the version of that with no configuration in it. Resolved
 * against the process cwd by `paths.ts`, it is `apps/daily/data` locally and
 * `/app/data` in the container — where WORKDIR is `/app`, so the compose volume
 * mounts at `/app/data`. The HOST side of that mount is unchanged, so there is
 * nothing to migrate.
 *
 * Relative is fine here and only here: `paths.ts` resolves it to an absolute path,
 * which is the only form the git commands may ever see.
 */
export const DATA_DIR = "./data";

/** github.com/<slug> — the digests are committed here. Private. */
export const REPO_SLUG = "imnaifu/files";
export const REPO_BRANCH = "main";
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
export const GIT_AUTHOR_NAME = "daily-bot";
export const GIT_AUTHOR_EMAIL = "daily-bot@lab115.com";

export const CRON = "0 7 * * *";
/**
 * The zone every date in this app is expressed in.
 *
 * NOT `process.env.TZ`, which compose also sets to the same string — that one is
 * the container's clock, and this one is the publication's timezone. They agree
 * today and they are still two different facts: `dateKey` and `dailyWindow` pass
 * this to `Intl`, so a digest is dated Los Angeles time no matter what clock the
 * host that runs it keeps.
 */
export const TZ = "America/Los_Angeles";

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
 * changed.
 */
export const SYNC_CRON = "7,22,37,52 * * * *";

/**
 * How many daily slots one run covers. No cross-day dedup state — the window
 * is it.
 *
 * Days, not hours, and that is load-bearing: a window measured in hours cannot
 * tile across a DST change, because the two anchors either side of one are 23
 * or 25 real hours apart. See dailyWindow().
 */
export const WINDOW_DAYS = 1;

/**
 * The hour, in TZ, that one day's window ends and the next begins.
 *
 * Should match CRON's hour. It is a separate knob rather than parsed out of the
 * cron string because cron expressions can name several hours and this needs
 * exactly one.
 */
export const WINDOW_ANCHOR_HOUR = 7;

/** DeepSeek serves an OpenAI-compatible API, so the `openai` SDK talks to it
 *  unchanged — only the base URL and key differ. */
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * The two models this app is written against, side by side because choosing
 * between them is a real decision that gets revisited — and because a bare id
 * string in one place tells you nothing about what the alternative costs.
 *
 * Valid ids come from `GET /models` (there is also a flash vision preview).
 * Check there rather than guessing at a name.
 *
 * MEASURED ON THE SAME DAY (2026-08-26, 28 articles, one run each):
 *
 *                                  flash        pro
 *   highest / lowest score         38 / 23    44 / 16
 *   times a dimension scored 9          0         10
 *   times it scored 1-4                 9         26
 *   published (floor at 30)            20         17
 *
 * The rubric in summarize.ts asks for the full 1-10 range and says so twice;
 * flash never once used the top of it, so its scores piled up between 30 and 38
 * and a floor of 30 passed 90% of everything fetched. Pro spreads them out and
 * rejects what the rubric says to reject — `AWS Acquires DuckLabs` went from 30
 * to 16, a Qwen release announcement from 33 to 18. That is the same failure the
 * README's HN notes describe, fixed at the scorer rather than at the source list.
 *
 * PRO COSTS EXACTLY 3× FLASH — every line of DeepSeek's price table, so the
 * multiple holds whatever the usage. Estimated on the run above: flash ~$0.07 a
 * day, pro ~$0.21, i.e. $2.15 vs $6.44 a month at off-peak rates (the 07:00
 * Los Angeles cron lands off-peak; peak is UTC 01-04 and 06-10 on weekdays).
 * Nothing records real token counts yet — `response.usage` is available and
 * unread — so those are estimates from character counts.
 */
export const MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
} as const;

/**
 * The one in use. SWITCHING IS EDITING THIS LINE — `MODELS.pro` and back.
 *
 * No environment variable and no CLI flag, which is the decision recorded at the
 * top of this file rather than an oversight: `DAILY_MODEL` existed once, was
 * passed through compose as `${DAILY_MODEL:-deepseek-v4-flash}` — the same
 * default the code already carried — and bought no configurability at all, only
 * more places to look before you could believe the value in front of you. The
 * cost is a commit and a redeploy to change models, which is the same
 * deployment story as config.json.
 */
export const MODEL: string = MODELS.flash;

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
export const BODY_CHAR_LIMIT = 80_000;

/** DRY_RUN=1 → run the whole pipeline but skip `git push` and the mail. */
export const DRY_RUN = process.env.DRY_RUN === "1";

/**
 * The email edition.
 *
 * THE SUBSCRIBER LIST IS NOT HERE AND NOT ANYWHERE IN THIS REPO. Contacts live
 * in Resend, which is also what handles unsubscribes, the `List-Unsubscribe`
 * headers and bounce suppression — so this app stores no reader data at all, and
 * "delete my data" is one API call rather than a rewrite of git history. The
 * alternative was a list in the digest repo, which would have meant a lock over
 * a working tree that two cron jobs already reset, and email addresses in a git
 * history that cannot forget them.
 *
 * The one piece of state we would otherwise need — "this address asked to
 * subscribe but has not confirmed yet" — is carried in a signed token instead of
 * being stored. See lib/mail/token.ts.
 */

/** https://resend.com/api-keys. Empty → the whole feature is off: no form on the
 *  page, no send after a run. */
export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

/**
 * SIGNUPS CLOSED. Set to true to open them.
 *
 * A SECOND SWITCH, and not a redundant one: `RESEND_API_KEY` answers "is the
 * mail configured", which is about the machine, and this answers "is the door
 * open", which is about us. Both have to be true before a reader is shown the
 * form or allowed through the endpoint. Emptying the key to hide the form would
 * be the wrong lever — it also stops the send to anyone already confirmed, and
 * it makes a deliberate decision look like a missing credential.
 *
 * IT CLOSES THE ENDPOINT TOO, not just the form. A hidden form whose API still
 * accepts posts is open to anyone who read the page source once, and the whole
 * point of holding this back is that a subscriber acquired now would be a
 * subscriber acquired against a flow we are not finished checking.
 *
 * THE DAILY SEND IS NOT GATED BY THIS. It still runs on `mailEnabled()` alone,
 * because closing the door on new readers is not a reason to stop delivering to
 * the ones already behind it. If the edition itself needs holding back, that is
 * `DRY_RUN` or an empty `MAIL_SEGMENT`, and it is a different decision.
 */
export const MAIL_SIGNUP_OPEN = false;

/**
 * HMAC key for confirmation links. Any long random string.
 *
 * ROTATING IT INVALIDATES EVERY UNCLICKED CONFIRMATION LINK, and nothing else —
 * confirmed readers are contacts in Resend by then and never need the token
 * again. That is the whole reason the token carries the pending state: losing
 * this key costs at most one day of unconfirmed signups.
 */
export const MAIL_SECRET = process.env.MAIL_SECRET ?? "";

/**
 * Resend segment ids, one per language, from the dashboard.
 *
 * Empty means that language does not send — which is the correct behaviour
 * before the segments exist, and the reason these are not `undefined`: a missing
 * id is an ordinary "not set up yet", not a crash.
 *
 * TWO SEGMENTS RATHER THAN ONE WITH A FILTER, because a broadcast takes exactly
 * one `segment_id` and the two languages are two different emails — different
 * subject, different prose, different links. If the plan turns out to allow only
 * one segment, the fallback is one segment plus a topic per language, and only
 * these constants change: the job passes whichever ids it is given.
 */
export const MAIL_SEGMENT: Record<"zh" | "en", string> = {
  zh: "9d8683f8-4159-45ad-be8f-ed07daf696ae",
  en: "acf62e33-6778-4be1-9fc2-693286ee7cab",
};

/**
 * How many articles one issue carries.
 *
 * FIVE, AND THE EMAIL IS NOT THE EDITION. The site publishes everything that
 * clears the floor — twenty-odd on a busy day — and the mail is a doorway to it,
 * not a copy of it: title, one-sentence thesis, source, and a link. A reader who
 * wants the rest is one tap from the day's page, which is where the writing was
 * always meant to be read.
 *
 * That also settles a question the full-text version had to answer badly: Gmail
 * clips a message over ~102KB behind a "view entire message" link, and twenty
 * Chinese summaries in UTF-8 land close enough to that line to need a fallback
 * that trimmed the tail of the digest. Five headlines are ~3KB. The problem is
 * not mitigated, it is absent.
 *
 * No per-category quota: these are `digest.articles` in the order the site ranks
 * them, so the first mail item is the first item on the page. A diversity rule
 * would be a second ordering that exists nowhere else on the site.
 */
export const MAIL_TOP_N = 5;

/** The From line. A domain rather than a name in either language: it reads the
 *  same to both halves of a bilingual list, the way the masthead chip does. */
export const MAIL_FROM = "daily.lab115.com <daily@lab115.com>";

/** Nobody reads replies, so the address says so rather than bouncing silently. */
export const MAIL_REPLY_TO = "no-reply@lab115.com";

/** How long a confirmation link stays valid. Long enough for "I'll do it
 *  tonight", short enough that a leaked link is not a standing invitation. */
export const MAIL_CONFIRM_TTL_HOURS = 24;

/**
 * Per-IP ceiling on the subscribe form.
 *
 * The confirmation mail is transactional, and the free plan meters those by the
 * day — so a script hammering the form does not just make noise, it spends the
 * quota that real signups need. Three in five minutes is far above what a person
 * typing their own address needs and far below what a script wants.
 */
export const MAIL_RATE_LIMIT = { windowMs: 5 * 60_000, max: 3 };

/** yyyy-mm-dd for an instant, in TZ (not the server's local zone). */
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
