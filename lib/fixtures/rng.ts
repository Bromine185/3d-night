/**
 * Deterministic PRNG for fixture generation.
 *
 * Every number in `lib/fixtures/data/*.json` traces back to `FIXTURE_SEED`.
 * Streams are forked by label so that adding an asset or an event type does not
 * perturb the numbers already generated for everything else — regenerating is a
 * no-op diff unless the model itself changed.
 */

export const FIXTURE_SEED = 20260814;

/** cyrb53 — fast, well-distributed string hash. Used to derive stream seeds. */
function hashLabel(label: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < label.length; i++) {
    const ch = label.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) % 4294967296;
}

/** mulberry32 — 32-bit state, integer-only ops, identical across platforms. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next01: () => number;
  private spare: number | null = null;

  constructor(private readonly seed: number) {
    this.next01 = mulberry32(seed);
  }

  /** Independent stream derived from this one's seed plus a label. */
  fork(label: string): Rng {
    return new Rng(hashLabel(label, this.seed));
  }

  /** Uniform on [0, 1). */
  uniform(): number;
  /** Uniform on [min, max). */
  uniform(min: number, max: number): number;
  uniform(min?: number, max?: number): number {
    const u = this.next01();
    return min === undefined || max === undefined ? u : min + u * (max - min);
  }

  /** Standard normal, Box–Muller with the second deviate cached. */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = this.next01() * 2 - 1;
      v = this.next01() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * f;
    return u * f;
  }

  /** Student-t via normal / sqrt(chi2/df). Fat tails for shock days. */
  studentT(df: number): number {
    let chi2 = 0;
    for (let i = 0; i < df; i++) {
      const z = this.normal();
      chi2 += z * z;
    }
    return this.normal() / Math.sqrt(chi2 / df);
  }

  bool(p: number): boolean {
    return this.next01() < p;
  }

  int(minInclusive: number, maxExclusive: number): number {
    return minInclusive + Math.floor(this.next01() * (maxExclusive - minInclusive));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  /** Index sampled from a discrete distribution. Weights need not be normalised. */
  categorical(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next01() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}
