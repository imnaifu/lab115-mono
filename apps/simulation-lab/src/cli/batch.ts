// npm run batch -- --experiment queue --config configs/queue-demo.json --runs 100 [--seed-start 1]
// Paired comparison over many seeds: each seed's input is shared by all variants.

import { join } from "node:path";
import { parseArgs } from "node:util";
import { runBatch } from "../core/batch.ts";
import { getExperiment } from "../core/registry.ts";
import { formatMetric } from "../core/scene.ts";
import { createRunDir, displayPath, loadConfig, parseIntArg, printTable, runCli, runMeta, writeCsv, writeJson } from "./common.ts";

runCli(async () => {
  const { values } = parseArgs({
    options: {
      experiment: { type: "string" },
      config: { type: "string" },
      runs: { type: "string" },
      "seed-start": { type: "string" },
      variants: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.experiment) throw new Error("Missing --experiment (e.g. --experiment queue)");
  const experiment = getExperiment(values.experiment);
  const config = loadConfig(experiment, values.config);
  const runs = parseIntArg(values.runs, "runs", 100);
  const seedStart = parseIntArg(values["seed-start"], "seed-start", 1);
  if (runs < 1) throw new Error("--runs must be at least 1");
  const variants = values.variants?.split(",").map((id) => id.trim());
  for (const id of variants ?? []) {
    if (!experiment.variants.some((variant) => variant.id === id)) throw new Error(`Unknown variant "${id}"`);
  }

  const started = performance.now();
  const result = runBatch(experiment, config, { runs, seedStart, variants });
  const elapsed = (performance.now() - started) / 1000;

  const dir = createRunDir("batch", `${experiment.id}-${runs}runs`, values.out);
  writeJson(join(dir, "config.json"), config);
  writeCsv(join(dir, "runs.csv"), result.rows.map((row) => ({ seed: row.seed, variant: row.variant, ...row.metrics })));
  writeJson(join(dir, "summary.json"), { seeds: [result.seeds[0], result.seeds[result.seeds.length - 1]], runs, wins: result.wins, winMetric: result.winMetric, summary: result.summary });
  writeCsv(
    join(dir, "summary.csv"),
    result.variants.flatMap((variant) =>
      Object.entries(result.summary[variant]).map(([metric, summary]) => ({ variant, metric, ...summary })),
    ),
  );
  writeJson(join(dir, "meta.json"), { ...runMeta(), command: "batch", experiment: experiment.id, runs, seedStart, configFile: values.config ?? null, seconds: elapsed });

  const shown = experiment.variants.filter((variant) => result.variants.includes(variant.id));
  console.log(`${experiment.meta.title}\n${runs} runs, seeds ${seedStart}–${seedStart + runs - 1} · mean (10th–90th percentile across runs)\n`);
  printTable([
    ["metric", ...shown.map((variant) => variant.label)],
    ...experiment.meta.metrics.map((def) => [
      def.label,
      ...shown.map((variant) => {
        const summary = result.summary[variant.id][def.key];
        return `${formatMetric(def, summary.mean)} (${formatMetric(def, summary.p10)}–${formatMetric(def, summary.p90)})`;
      }),
    ]),
    [`best ${result.winMetric} (wins)`, ...shown.map((variant) => `${result.wins[variant.id]}/${runs}`)],
  ]);
  console.log(`\n${elapsed.toFixed(2)} s · wrote ${displayPath(dir)}`);
});
