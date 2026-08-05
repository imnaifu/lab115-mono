/** 在两个 0xRRGGBB 之间做线性插值，t 会被夹到 0..1 */
export function lerpColor(from: number, to: number, t: number): number {
  const amount = Math.min(1, Math.max(0, t));
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;
  const r = Math.round(fromR + (toR - fromR) * amount);
  const g = Math.round(fromG + (toG - fromG) * amount);
  const b = Math.round(fromB + (toB - fromB) * amount);
  return (r << 16) | (g << 8) | b;
}
