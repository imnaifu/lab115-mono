// Seeded randomness. Simulations must never touch Math.random() or the wall clock;
// every random draw comes from a named stream derived from (seed, streamName).

/** 32-bit FNV-1a hash, used to derive independent stream seeds from names. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** mulberry32: small, fast, good enough for simulation inputs. Returns [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Exponential with the given mean. 1 - u keeps the argument of log in (0, 1]. */
  exponential(mean: number): number {
    return -mean * Math.log(1 - this.next());
  }

  /** Standard normal via Box–Muller (uses two draws, discards the second value for simplicity). */
  normal(): number {
    const u1 = 1 - this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Lognormal parameterised by its own mean and coefficient of variation. */
  lognormal(mean: number, cv: number): number {
    if (cv <= 0) return mean;
    const sigma2 = Math.log(1 + cv * cv);
    const mu = Math.log(mean) - sigma2 / 2;
    return Math.exp(mu + Math.sqrt(sigma2) * this.normal());
  }
}

/**
 * Independent stream per purpose, so e.g. changing the slow-customer fraction
 * does not shift the arrival times drawn from the same seed.
 */
export function rngStream(seed: number, name: string): Rng {
  return new Rng(hashString(`${seed >>> 0}:${name}`));
}
