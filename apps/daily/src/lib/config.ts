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

/** How far back a run looks. No cross-day dedup state — the window is it. */
export const WINDOW_HOURS = Number(process.env.DAILY_WINDOW_HOURS ?? 24);
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
 * ($0.14/M) against a 1M context, so the budget is generous on purpose:
 * ~10 articles × 20k chars is still only ~55k tokens.
 */
export const BODY_CHAR_LIMIT = Number(process.env.DAILY_BODY_CHARS ?? 20_000);

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
