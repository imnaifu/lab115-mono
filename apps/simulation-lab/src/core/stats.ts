export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Percentile with linear interpolation between closest ranks (same as numpy's default). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

export function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  let sumSquares = 0;
  for (const value of values) sumSquares += (value - avg) ** 2;
  return Math.sqrt(sumSquares / (values.length - 1));
}

export function max(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((best, value) => (value > best ? value : best), -Infinity);
}
