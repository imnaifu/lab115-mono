// Compact number formatter: trims trailing zeros, switches to scientific
// for very large / very small magnitudes, and adds thousand separators.
export function fmt(n: number, decimals: number): string {
  if (!isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9 || (abs > 0 && abs < 1e-4)) return n.toExponential(2);
  let s: string;
  if (abs >= 1000)      s = n.toFixed(Math.max(0, decimals - 2));
  else if (abs >= 100)  s = n.toFixed(Math.max(0, decimals - 1));
  else if (abs >= 10)   s = n.toFixed(Math.max(0, decimals));
  else                  s = n.toFixed(decimals);
  s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const m = s.match(/^(-?\d+)(\.\d+)?$/);
  if (m) s = m[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[2] || "");
  return s;
}

// Wider tolerance for "approximately N reference objects" counts.
export function fmtCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100) return fmt(n, 0);
  if (abs >= 10)  return fmt(n, 1);
  if (abs >= 1)   return fmt(n, 1);
  return fmt(n, 2);
}
