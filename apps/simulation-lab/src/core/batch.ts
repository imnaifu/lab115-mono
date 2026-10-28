import type { AnyExperiment } from "./experiment.ts";
import { max, mean, percentile, stdev } from "./stats.ts";

export interface MetricSummary {
  mean: number;
  sd: number;
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
}

export interface BatchResult {
  experimentId: string;
  seeds: number[];
  variants: string[];
  rows: { seed: number; variant: string; metrics: Record<string, number> }[];
  summary: Record<string, Record<string, MetricSummary>>;
  /** Seeds where the variant had the best primary metric; ties count for every tied variant. */
  wins: Record<string, number>;
  winMetric: string;
}

export interface BatchOptions {
  runs: number;
  seedStart: number;
  variants?: string[];
}

export function runBatch(experiment: AnyExperiment, config: unknown, options: BatchOptions): BatchResult {
  const variants = options.variants ?? experiment.variants.map((variant) => variant.id);
  const seeds = Array.from({ length: options.runs }, (_, i) => options.seedStart + i);
  const rows: BatchResult["rows"] = [];
  const wins: Record<string, number> = Object.fromEntries(variants.map((id) => [id, 0]));
  const { primaryMetric, lowerIsBetter } = experiment.meta;

  for (const seed of seeds) {
    // One input per seed, shared by every variant — the comparison is paired.
    const input = experiment.generateInput(config, seed);
    const perVariant = variants.map((variant) => ({
      variant,
      metrics: experiment.metrics(experiment.simulate(input, config, variant)),
    }));
    rows.push(...perVariant.map((entry) => ({ seed, ...entry })));
    const scores = perVariant.map((entry) => entry.metrics[primaryMetric]);
    const best = lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
    for (const entry of perVariant) {
      // Tolerance avoids float noise deciding a "win" between identical outcomes.
      if (Math.abs(entry.metrics[primaryMetric] - best) < 1e-9) wins[entry.variant] += 1;
    }
  }

  const summary: BatchResult["summary"] = {};
  for (const variant of variants) {
    const variantRows = rows.filter((row) => row.variant === variant);
    const metricKeys = Object.keys(variantRows[0]?.metrics ?? {});
    summary[variant] = {};
    for (const key of metricKeys) {
      const values = variantRows.map((row) => row.metrics[key]);
      summary[variant][key] = {
        mean: mean(values),
        sd: stdev(values),
        min: Math.min(...values),
        p10: percentile(values, 10),
        median: percentile(values, 50),
        p90: percentile(values, 90),
        max: max(values),
      };
    }
  }

  return { experimentId: experiment.id, seeds, variants, rows, summary, wins, winMetric: primaryMetric };
}
