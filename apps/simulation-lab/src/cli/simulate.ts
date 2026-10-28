// npm run simulate -- --experiment queue --config configs/queue-demo.json [--seed 7] [--out dir]
// Runs every variant on one shared input and writes inputs, event logs, per-entity records and metrics.

import { join } from "node:path";
import { parseArgs } from "node:util";
import { getExperiment } from "../core/registry.ts";
import { formatMetric } from "../core/scene.ts";
import { createRunDir, displayPath, loadConfig, parseIntArg, printTable, runCli, runMeta, writeCsv, writeJson } from "./common.ts";

runCli(async () => {
  const { values } = parseArgs({
    options: {
      experiment: { type: "string" },
      config: { type: "string" },
      seed: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.experiment) throw new Error("Missing --experiment (e.g. --experiment queue)");
  const experiment = getExperiment(values.experiment);
  const config = loadConfig(experiment, values.config);
  const seed = parseIntArg(values.seed, "seed", 1);

  const input = experiment.generateInput(config, seed);
  const dir = createRunDir("simulate", `${experiment.id}-seed${seed}`, values.out);
  writeJson(join(dir, "config.json"), config);
  writeJson(join(dir, "input.json"), input);

  const metrics: Record<string, Record<string, number>> = {};
  for (const variant of experiment.variants) {
    const run = experiment.simulate(input, config, variant.id);
    metrics[variant.id] = experiment.metrics(run);
    writeJson(join(dir, `events-${variant.id}.json`), experiment.events(run));
    writeCsv(join(dir, `records-${variant.id}.csv`), experiment.records(run));
  }
  writeJson(join(dir, "metrics.json"), { seed, note: "Single run — one random draw. Use `npm run batch` for multi-seed statistics.", metrics });
  writeCsv(
    join(dir, "metrics.csv"),
    experiment.variants.map((variant) => ({ variant: variant.id, seed, ...metrics[variant.id] })),
  );
  writeJson(join(dir, "meta.json"), { ...runMeta(), command: "simulate", experiment: experiment.id, seed, configFile: values.config ?? null });

  console.log(`${experiment.meta.title}\nseed ${seed} · single run\n`);
  printTable([
    ["metric", ...experiment.variants.map((variant) => variant.label)],
    ...experiment.meta.metrics.map((def) => [def.label, ...experiment.variants.map((variant) => formatMetric(def, metrics[variant.id][def.key]))]),
  ]);
  console.log(`\nWrote ${displayPath(dir)}`);
});
