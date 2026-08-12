import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  DRY_RUN,
  GIT_AUTHOR_EMAIL,
  GIT_AUTHOR_NAME,
  GIT_REMOTE,
  GIT_TOKEN,
  REPO_BRANCH,
  REPO_SLUG,
} from "./config";
import { DATA_PATH, REPO_PATH } from "./paths";

const run = promisify(execFile);

/**
 * The clone lives on the mounted volume and is the site's read path — pages
 * read JSON off local disk, never over the network. Each run does
 * pull → write → commit → push.
 */

/**
 * Which URL to talk to origin on. Auth is embedded here, so the result must
 * never reach a log un-redacted.
 *
 * The order matters and is not arbitrary:
 *   1. GIT_REMOTE — an explicit override always wins.
 *   2. GIT_TOKEN  — HTTPS with the token. This is the container's route; it
 *                   has no SSH key, so it must be preferred whenever a token
 *                   exists.
 *   3. SSH        — derived from REPO_SLUG for a laptop that already has a key
 *                   loaded, so local runs need no flags and no PAT.
 *
 * Defaulting straight to SSH would have been simpler and would have broken
 * every deploy.
 */
function remoteUrl(): string {
  if (GIT_REMOTE) return GIT_REMOTE;
  if (GIT_TOKEN) {
    return `https://x-access-token:${GIT_TOKEN}@github.com/${REPO_SLUG}.git`;
  }
  return `git@github.com:${REPO_SLUG}.git`;
}

/** Scrub credentials from anything we print — git echoes the remote on error. */
function redact(message: string): string {
  const withoutToken = GIT_TOKEN
    ? message.split(GIT_TOKEN).join("***")
    : message;
  // Also covers a user-supplied GIT_REMOTE that embeds its own credentials.
  return withoutToken.replace(/\/\/[^/@\s]+:[^/@\s]+@/g, "//***:***@");
}

async function git(args: string[], cwd = REPO_PATH): Promise<string> {
  try {
    const { stdout } = await run("git", args, {
      cwd,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        // Never let git block the job waiting on a credential prompt.
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message?: string; code?: string };
    // Node reports a non-existent cwd as `spawn git ENOENT` — identical to the
    // error for a missing binary. Say which one it actually is.
    if (err.code === "ENOENT") {
      throw new Error(
        `git could not run in "${cwd}" — the directory is missing, ` +
          `or git is not installed on PATH`,
      );
    }
    throw new Error(redact(err.stderr || err.message || "git failed"));
  }
}

/**
 * Network git (clone / fetch / push) with retries.
 *
 * GitHub over HTTPS times out intermittently, and this job runs unattended
 * once a day — with no cross-day dedup state, a run lost to one flaky TCP
 * connection loses that day's articles permanently. So: retry, and make a
 * stalled transfer give up fast instead of hanging until the socket dies.
 */
const NETWORK_ATTEMPTS = 4;
const BACKOFF_MS = [5_000, 15_000, 45_000];

/** Abort a transfer moving under 1 KB/s for 30s, rather than waiting minutes. */
const STALL_GUARD = [
  "-c",
  "http.lowSpeedLimit=1000",
  "-c",
  "http.lowSpeedTime=30",
];

/**
 * Errors that will fail identically on every attempt. Retrying a bad key or a
 * missing repo just burns the whole backoff budget — 65s of sleeping before
 * reporting something that was knowable on attempt one.
 */
const PERMANENT = [
  /repository not found/i,
  /permission denied/i,
  // GitHub's SSH wording when the key's account lacks write access:
  // "ERROR: Permission to owner/repo.git denied to some-user."
  /permission to .+ denied to /i,
  /authentication failed/i,
  /could not read username/i,
  /invalid username or (?:password|token)/i,
  /access rights/i,
  /host key verification failed/i,
];

function isPermanent(error: unknown): boolean {
  const message = (error as Error)?.message ?? "";
  return PERMANENT.some((pattern) => pattern.test(message));
}

async function gitNetwork(args: string[], cwd = REPO_PATH): Promise<string> {
  let last: unknown;

  for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt += 1) {
    try {
      return await git([...STALL_GUARD, ...args], cwd);
    } catch (error) {
      last = error;
      if (isPermanent(error)) break; // no amount of waiting fixes auth
      const wait = BACKOFF_MS[attempt];
      if (wait === undefined) break; // that was the final attempt
      console.warn(
        `[daily] git ${args[0]} failed (attempt ${attempt + 1}/` +
          `${NETWORK_ATTEMPTS}), retrying in ${wait / 1000}s: ` +
          `${(error as Error).message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw last;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make REPO_PATH a working clone on BRANCH, up to date with origin.
 * Safe to call on every run and on every container boot.
 */
export async function ensureRepo(): Promise<void> {
  if (!(await exists(path.join(REPO_PATH, ".git")))) {
    try {
      await fs.mkdir(DATA_PATH, { recursive: true });
    } catch (error) {
      // Almost always one of two things: the compose volume is not mounted, or
      // someone ran this locally without DAILY_DATA_DIR and hit the container
      // default of /data. Neither is obvious from a bare ENOENT/EACCES.
      throw new Error(
        `cannot create the data directory "${DATA_PATH}" ` +
          `(${(error as NodeJS.ErrnoException).code}) — set DAILY_DATA_DIR to a ` +
          `writable path, or check that the volume is mounted`,
      );
    }
    // REPO_PATH is absolute, so git cannot resolve it against DATA_PATH and
    // clone into a nested data/data/repo.
    await gitNetwork(
      ["clone", "--branch", REPO_BRANCH, remoteUrl(), REPO_PATH],
      DATA_PATH,
    );
    await setIdentity();
    return;
  }

  // The token rotates independently of the volume, so refresh the remote
  // rather than trusting whatever URL the old clone was made with.
  await git(["remote", "set-url", "origin", remoteUrl()]);
  await setIdentity();

  try {
    await gitNetwork(["fetch", "origin", REPO_BRANCH]);
  } catch (error) {
    // A clone already exists, so a failed fetch is survivable: generate today's
    // digest against the local state and let the next run push both days.
    // Only a missing clone is fatal.
    console.warn(
      `[daily] fetch failed, continuing on the local clone: ` +
        `${(error as Error).message}`,
    );
    return;
  }

  await syncToOrigin();
}

async function setIdentity(): Promise<void> {
  await git(["config", "user.name", GIT_AUTHOR_NAME]);
  await git(["config", "user.email", GIT_AUTHOR_EMAIL]);
}

/**
 * Bring the clone in line with origin WITHOUT discarding digests that were
 * committed locally but never pushed.
 *
 * This used to be an unconditional `reset --hard origin/BRANCH`, on the theory
 * that the clone is a disposable cache. That is only true while every push
 * succeeds — once a push can fail (it can: see gitNetwork), a hard reset on the
 * next run would silently destroy that day's digest, and with no cross-day
 * dedup there is nothing to regenerate it from.
 */
async function syncToOrigin(): Promise<void> {
  const ahead = Number(
    await git(["rev-list", "--count", `origin/${REPO_BRANCH}..HEAD`]),
  );

  if (!ahead) {
    await git(["reset", "--hard", `origin/${REPO_BRANCH}`]);
    return;
  }

  console.log(`[daily] ${ahead} local commit(s) not on origin — rebasing`);
  try {
    await git(["rebase", `origin/${REPO_BRANCH}`]);
  } catch (error) {
    // Each day writes its own file, so a conflict means something unusual
    // (e.g. the same day generated from two places). Take origin's side, but
    // say so loudly rather than losing work silently.
    console.error(
      `[daily] rebase conflicted, discarding ${ahead} local commit(s): ` +
        `${(error as Error).message}`,
    );
    await git(["rebase", "--abort"]).catch(() => {});
    await git(["reset", "--hard", `origin/${REPO_BRANCH}`]);
  }
}

/**
 * Stage `relPaths`, commit, and push. No-ops when nothing changed (a re-run on
 * the same day producing identical JSON), and skips the push under DRY_RUN.
 */
export async function commitAndPush(
  relPaths: string[],
  message: string,
): Promise<boolean> {
  await git(["add", "--", ...relPaths]);

  const staged = await git(["diff", "--cached", "--name-only"]);
  if (!staged) {
    console.log("[daily] no content change — nothing to commit");
    return false;
  }

  await git(["commit", "-m", message]);

  if (DRY_RUN) {
    console.log("[daily] DRY_RUN — committed locally, skipping push");
    return false;
  }
  try {
    await gitNetwork(["push", "origin", `HEAD:${REPO_BRANCH}`]);
  } catch (error) {
    // The digest is committed locally and ensureRepo() now rebases rather than
    // resetting, so the next successful run carries it up. Don't fail the run
    // over this — the site already reads the local clone.
    console.error(
      `[daily] push failed, digest is committed locally and will go up on ` +
        `the next run — check GIT_TOKEN, or that an SSH key with write access ` +
        `is loaded: ${(error as Error).message}`,
    );
    return false;
  }

  // Report the remote actually used, not REPO_SLUG — GIT_REMOTE may point
  // somewhere else entirely, and a wrong destination in the log is worse than
  // no log at all.
  console.log(`[daily] pushed to ${redact(remoteUrl())}@${REPO_BRANCH}`);
  return true;
}
