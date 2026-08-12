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
  const { CRON, TZ } = await import("@/lib/config");
  const { ensureRepo } = await import("@/lib/repo");
  const { runDaily } = await import("@/jobs/daily");

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
      runDaily().catch((error) =>
        console.error("[daily] cron run failed:", error),
      );
    },
    { timezone: TZ },
  );

  console.log(`[daily] cron registered: "${CRON}" (${TZ})`);
}
