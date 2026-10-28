import type { MetricDef } from "../../core/experiment.ts";
import { max, mean, median, percentile } from "../../core/stats.ts";
import type { QueueRun } from "./simulate.ts";

export const QUEUE_METRICS: MetricDef[] = [
  { key: "avgWait", label: "Average wait", unit: "seconds", definition: "Mean of (service start − arrival) over all customers. Includes time spent walking between lines." },
  { key: "medianWait", label: "Median wait", unit: "seconds", definition: "50th percentile of waits (linear interpolation between ranks)." },
  { key: "p95Wait", label: "95th-percentile wait", unit: "seconds", definition: "95% of customers waited at most this long (linear interpolation between ranks)." },
  { key: "maxWait", label: "Longest wait", unit: "seconds", definition: "The single worst wait." },
  { key: "avgService", label: "Average service", unit: "seconds", definition: "Mean of (service end − service start) = work ÷ window speed." },
  { key: "avgSojourn", label: "Average time in system", unit: "seconds", definition: "Mean of (service end − arrival) = wait + service." },
  { key: "makespan", label: "Everyone done", unit: "seconds", definition: "Time from t = 0 (first arrival) until the last customer finishes." },
  { key: "utilization", label: "Window utilisation", unit: "ratio", definition: "Total busy time of all windows ÷ (windows × makespan)." },
  { key: "switches", label: "Line switches", unit: "count", definition: "Total number of line changes (strategy C only; 0 otherwise)." },
  { key: "avgSwitchTime", label: "Average switching time", unit: "seconds", definition: "Mean seconds per customer spent walking between lines (already part of wait)." },
];

export function queueMetrics(run: QueueRun): Record<string, number> {
  const waits = run.customers.map((customer) => customer.wait);
  const totalBusy = run.windowBusy.reduce((sum, busy) => sum + busy, 0);
  return {
    avgWait: mean(waits),
    medianWait: median(waits),
    p95Wait: percentile(waits, 95),
    maxWait: max(waits),
    avgService: mean(run.customers.map((customer) => customer.service)),
    avgSojourn: mean(run.customers.map((customer) => customer.sojourn)),
    makespan: run.end,
    utilization: run.end > 0 ? totalBusy / (run.windows * run.end) : 0,
    switches: run.customers.reduce((sum, customer) => sum + customer.switches, 0),
    avgSwitchTime: mean(run.customers.map((customer) => customer.switchTime)),
  };
}

/** Utilisation of each window separately (busy ÷ makespan). */
export function windowUtilization(run: QueueRun): number[] {
  return run.windowBusy.map((busy) => (run.end > 0 ? busy / run.end : 0));
}
