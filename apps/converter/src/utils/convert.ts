import type { CategoryKey, Unit } from "../data/categories";
import { REFS, type ReferenceItem } from "../data/references";

export function unitToBase(unit: Unit, v: number): number {
  return unit.toBase ? unit.toBase(v) : v / (unit.factor as number);
}

export function baseToUnit(unit: Unit, baseV: number): number {
  return unit.fromBase ? unit.fromBase(baseV) : baseV * (unit.factor as number);
}

export type RefMatch = {
  ref: ReferenceItem;
  count: number;
  ratio: number;
  exact: boolean;
};

// Pick the reference object closest to `baseVal`.
// For temperature: minimize absolute difference. For everything else:
// minimize |log(value / size)| so we land on the right order of magnitude.
export function findClosestRef(catKey: CategoryKey, baseVal: number): RefMatch {
  const refs = REFS[catKey] || [];
  if (catKey === "temp") {
    let best = refs[0];
    let bestD = Infinity;
    for (const r of refs) {
      const d = Math.abs(baseVal - r.size);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return { ref: best, count: 1, ratio: 1, exact: true };
  }
  const v = Math.abs(baseVal);
  if (v === 0 || !isFinite(v)) {
    return { ref: refs[0], count: 0, ratio: 0, exact: false };
  }
  let best = refs[0];
  let bestD = Infinity;
  for (const r of refs) {
    const d = Math.abs(Math.log(v / r.size));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  const ratio = v / best.size;
  return { ref: best, count: ratio, ratio, exact: ratio >= 0.8 && ratio <= 1.2 };
}
