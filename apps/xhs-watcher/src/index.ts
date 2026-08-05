/**
 * Entry point. Long-running container with an in-process scheduler.
 *
 * The cron lives inside the process (rather than host cron / `docker exec`) so
 * the browser profile, SQLite handle and backoff state are shared by every
 * cycle and can never overlap.
 */
import cron from "node-cron";
import { config, loadWatches } from "./config.js";
import { runCycle } from "./runner.js";

let running = false;

/** Cycles are serialised — a slow run must not overlap the next tick. */
async function guardedCycle(trigger: string): Promise<void> {
  if (running) {
    console.warn(`[${trigger}] 上一轮尚未结束，跳过本次触发`);
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    await runCycle();
  } catch (error) {
    console.error(`[${trigger}] 未捕获异常：`, error);
  } finally {
    running = false;
    console.log(`[${trigger}] 本轮结束，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const watches = loadWatches();
  console.log(
    `[boot] 关键词 ${watches.length} 个：${watches.map((watch) => watch.keyword).join(", ") || "(空)"}`,
  );

  if (once) {
    await guardedCycle("once");
    return;
  }

  if (!cron.validate(config.cron)) throw new Error(`非法的 CRON 表达式：${config.cron}`);
  cron.schedule(config.cron, () => void guardedCycle("cron"), { timezone: config.timezone });
  console.log(`[boot] 调度已启动：${config.cron} (${config.timezone})`);

  if (config.runOnStart) await guardedCycle("boot");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[exit] 收到 ${signal}，退出`);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exit(1);
});
