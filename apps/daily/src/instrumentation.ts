/**
 * Next.js calls `register()` once when the server boots — that is where the
 * daily cron gets scheduled, which is what lets the site and the worker be a
 * single container instead of two.
 *
 * Every import is lazy and lives below the runtime check, so the edge build of
 * this file stays free of node-only modules.
 */
export async function register(): Promise<void> {
  // The edge runtime has no timers, no filesystem and no child_process.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = await import("node-cron");
  const { CRON, SYNC_CRON, TZ } = await import("@/lib/config");
  const { ensureRepo } = await import("@/lib/repo");
  const { runDaily, syncRepo } = await import("@/jobs/daily");

  // Clone on boot so the pages have data to read before the first cron tick.
  try {
    await ensureRepo();
    console.log("[daily] repo ready");
  } catch (error) {
    console.error("[daily] repo init failed (pages may be empty):", error);
  }

  cron.schedule(
    CRON,
    () => {
      // Skip if the day is already in the repo — it may have been generated
      // elsewhere, and rewriting it would pay for the model twice.
      runDaily(new Date(), { skipIfPublished: true }).catch((error) =>
        console.error("[daily] cron run failed:", error),
      );
    },
    { timezone: TZ },
  );

  // Cheap pull so the site picks up digests pushed from elsewhere without
  // waiting for the next daily run. No model calls, no commits.
  cron.schedule(
    SYNC_CRON,
    () => {
      syncRepo().catch((error) =>
        console.error("[daily] repo sync failed:", error),
      );
    },
    { timezone: TZ },
  );

  console.log(
    `[daily] cron registered: "${CRON}" (${TZ}), sync "${SYNC_CRON}"`,
  );
}
