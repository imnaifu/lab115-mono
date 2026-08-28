/**
 * One full cycle: fetch every enabled watch → dedupe into SQLite → report
 * everything still unnotified, once.
 *
 * Idempotency: the digest is built from `notified_at IS NULL`, and rows are
 * marked only after it has been reported. It was written for a mail send —
 * "marked once Resend accepts it" — and the rule survives the mail going away:
 * it is the only thing stopping one note appearing in the log twice, and a crash
 * between fetch and report still costs nothing.
 */
import { config, loadWatches, type WatchConfig } from "./config.js";
import {
  finishRun,
  hasAnyNote,
  insertNote,
  kvGet,
  kvSet,
  markNotified,
  pendingNotes,
  startRun,
} from "./db.js";
import { BlockedError, politeDelay, withSession, type Session } from "./fetcher.js";
import { normalizeItems } from "./normalize.js";
import { logAlert, logDigest } from "./notifier.js";

const KV_FAILURES = "consecutive_failures";
const KV_LAST_ALERT = "last_alert_at";
const KV_BACKOFF_UNTIL = "backoff_until";

export async function runCycle(): Promise<void> {
  const watches = loadWatches().filter((watch) => watch.enabled);
  if (watches.length === 0) {
    console.warn("[cycle] 没有启用的关键词，请检查 KEYWORDS 或 data/watches.json");
    return;
  }

  const backoffUntil = Number(kvGet(KV_BACKOFF_UNTIL) ?? 0);
  if (Date.now() < backoffUntil) {
    console.warn(`[cycle] 连续失败退避中，${new Date(backoffUntil).toISOString()} 后重试`);
    return;
  }

  try {
    await withSession(async (session) => {
      for (const [index, watch] of watches.entries()) {
        if (index > 0) await politeDelay();
        await runWatch(session, watch);
      }
    });
    kvSet(KV_FAILURES, "0");
  } catch (error) {
    await recordCycleFailure(error);
    return;
  }

  await deliverPending();
}

/** A single keyword. Non-blocking errors are contained so one bad keyword
 *  doesn't kill the other keywords in the cycle. */
async function runWatch(session: Session, watch: WatchConfig): Promise<void> {
  const now = Date.now();
  const runId = startRun(watch.id, now);
  // First run for this keyword: index everything silently, don't mail history.
  const seeding = config.seedOnFirstRun && !hasAnyNote(watch.id);

  try {
    const items = await session.searchNotes(watch);
    const notes = normalizeItems(items, watch.id, now);
    const maxAgeMs = config.maxAgeDays * 86_400_000;

    let newCount = 0;
    for (const note of notes) {
      // Layer 3: known-old notes are recorded (so they never re-trigger) but
      // never mailed — search can surface popular posts from months ago.
      const tooOld = note.publishedAt !== null && now - note.publishedAt > maxAgeMs;
      const suppress = seeding || tooOld || note.likedCount < watch.minLike;
      if (insertNote(note, watch.keyword, now, suppress) === "new" && !suppress) newCount += 1;
    }

    finishRun(runId, "ok", { fetched: notes.length, newCount }, Date.now());
    console.log(
      `[watch:${watch.id}] 抓取 ${notes.length} 条，新增 ${newCount} 条${seeding ? "（首次运行，仅建立基线）" : ""}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(
      runId,
      error instanceof BlockedError ? "blocked" : "failed",
      { fetched: 0, newCount: 0, error: message },
      Date.now(),
    );
    // Blocked = session-wide problem; bubble up and abort the whole cycle.
    if (error instanceof BlockedError) throw error;
    console.error(`[watch:${watch.id}] 失败：${message}`);
  }
}

async function deliverPending(): Promise<void> {
  const pending = pendingNotes();
  if (pending.length === 0) {
    console.log("[cycle] 无新增笔记");
    return;
  }
  logDigest(pending);
  markNotified(
    pending.map((note) => note.noteId),
    Date.now(),
  );
}

async function recordCycleFailure(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const failures = Number(kvGet(KV_FAILURES) ?? 0) + 1;
  kvSet(KV_FAILURES, String(failures));
  console.error(`[cycle] 失败（连续 ${failures} 次）：${message}`);

  if (failures >= config.backoffAfterFailures) {
    kvSet(KV_BACKOFF_UNTIL, String(Date.now() + config.backoffHours * 3_600_000));
    console.warn(`[cycle] 触发退避，暂停 ${config.backoffHours} 小时`);
  }

  // Still rate-limited now that the alert is a log line rather than a mail: a
  // broken login would otherwise repeat itself every cycle, and a log that
  // repeats is a log nobody skims.
  const lastAlert = Number(kvGet(KV_LAST_ALERT) ?? 0);
  if (Date.now() - lastAlert < config.alertCooldownHours * 3_600_000) return;

  kvSet(KV_LAST_ALERT, String(Date.now()));
  logAlert(
    error instanceof BlockedError ? "登录态失效或被风控拦截" : "抓取失败",
    `${message}\n\n连续失败次数：${failures}`,
  );
}
