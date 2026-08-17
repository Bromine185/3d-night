/**
 * Fifty personas, each reading one slice of the world — filings, transcripts,
 * options flow, on-chain, macro prints, sector news, tape, credit,
 * positioning, alt-data. None sees another's output. Each session every
 * persona emits a signed conviction in [-1, 1] on its focus asset, built from
 * real features of the fixtures (momentum, events, regime, VIX) plus a seeded
 * idiosyncratic stream.
 *
 * The product isn't any single view — it's the disagreement structure: the
 * cross-sectional dispersion of the fifty, when it fractures, and whether
 * fracture predicts anything.
 */
import {
  DATES,
  EVENTS,
  LATEST_INDEX,
  REGIME_BY_DAY,
  VIX,
  dateIndex,
  getCloses,
} from "../fixtures";
import type { RegimeId } from "../fixtures/types";
import { Rng } from "../fixtures/rng";
import { overnight } from "./clock";
import type {
  Horizon,
  PersonaCluster,
  PersonaFamily,
  PersonaView,
  PersonasSummary,
  TrendPoint,
} from "./types";

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

interface FamilySpec {
  family: PersonaFamily;
  horizon: Horizon;
  /** Symbols this slice actually reads. */
  watch: string[];
  /** Event kinds this slice reacts to. */
  kinds: string[];
  /** Weight on momentum vs events vs regime vs noise — the slice's character. */
  w: { mom: number; event: number; regime: number; vix: number; noise: number };
  /** Momentum lookbacks personas of this family draw from. */
  lookbacks: number[];
  names: string[];
}

/** Display names for the ten slices — shared by the blotter and the 3D
 *  persona layer so both surfaces speak the same words. Index order here
 *  is family order everywhere (personaToWorld's z bands included). */
export const FAMILY_SHORT: Record<PersonaFamily, string> = {
  filings: "filings",
  transcripts: "transcripts",
  options_flow: "options",
  on_chain: "on-chain",
  macro: "macro",
  sector_news: "sector",
  technicals: "tape",
  credit: "credit",
  positioning: "positioning",
  alt_data: "alt-data",
};

export const FAMILY_ORDER: PersonaFamily[] = [
  "filings",
  "transcripts",
  "options_flow",
  "on_chain",
  "macro",
  "sector_news",
  "technicals",
  "credit",
  "positioning",
  "alt_data",
];

const FAMILIES: FamilySpec[] = [
  {
    family: "filings",
    horizon: "1q",
    watch: ["SRPT", "IONS", "ARWR", "CRSP", "VRTX", "LLY", "SCHW"],
    kinds: ["earnings", "guidance"],
    w: { mom: 0.25, event: 0.5, regime: 0.1, vix: 0, noise: 0.15 },
    lookbacks: [21, 42, 63],
    names: ["Footnote Diver", "Accruals Hawk", "8-K Sentry", "Dilution Counter", "Going Concern"],
  },
  {
    family: "transcripts",
    horizon: "1m",
    watch: ["NVDA", "MSFT", "AAPL", "AMZN", "COST", "CAT"],
    kinds: ["earnings", "guidance"],
    w: { mom: 0.3, event: 0.45, regime: 0.1, vix: 0, noise: 0.15 },
    lookbacks: [10, 21, 42],
    names: ["Tone Reader", "Guidance Parser", "Q&A Hedger", "CapEx Whisperer", "Margin Listener"],
  },
  {
    family: "options_flow",
    horizon: "1w",
    watch: ["NVDA", "AMD", "SPY", "SRPT", "CRSP"],
    kinds: ["fda", "earnings", "ma_rumor"],
    w: { mom: 0.35, event: 0.3, regime: 0, vix: 0.2, noise: 0.15 },
    lookbacks: [3, 5, 10],
    names: ["Gamma Watcher", "Skew Trader", "Zero-Day Clerk", "Vol Surface", "Pin Risk"],
  },
  {
    family: "on_chain",
    horizon: "1w",
    watch: ["SPY", "NVDA", "AMD"],
    kinds: ["macro"],
    w: { mom: 0.3, event: 0.1, regime: 0.15, vix: 0.25, noise: 0.2 },
    lookbacks: [5, 10, 21],
    names: ["Stablecoin Flows", "Miner Wallets", "Bridge Volume", "Perp Funding", "Whale Alert"],
  },
  {
    family: "macro",
    horizon: "1q",
    watch: ["SPY", "XOM", "JPM", "CAT", "UNP"],
    kinds: ["macro"],
    w: { mom: 0.2, event: 0.35, regime: 0.25, vix: 0.2, noise: 0 },
    lookbacks: [21, 63, 126],
    names: ["Prints Reader", "Curve Watcher", "Dot Plotter", "Payrolls Desk", "CPI Component"],
  },
  {
    family: "sector_news",
    horizon: "1w",
    watch: ["SRPT", "IONS", "ARWR", "CRSP", "LLY", "VRTX", "OXY", "SLB"],
    kinds: ["fda", "ma_rumor", "guidance"],
    w: { mom: 0.2, event: 0.55, regime: 0.05, vix: 0, noise: 0.2 },
    lookbacks: [3, 5, 10],
    names: ["FDA Calendar", "Deal Chatter", "Trial Tracker", "Label Reader", "Panel Odds"],
  },
  {
    family: "technicals",
    horizon: "1w",
    watch: ["NVDA", "AMD", "SPY", "GS", "XOM", "AMZN"],
    kinds: [],
    w: { mom: 0.7, event: 0, regime: 0.05, vix: 0.1, noise: 0.15 },
    lookbacks: [5, 10, 21, 42],
    names: ["Trend Ruler", "Mean Reverter", "Breakout Scout", "Volume Profile", "Failed Move"],
  },
  {
    family: "credit",
    horizon: "1q",
    watch: ["JPM", "GS", "SCHW", "OXY", "SPY"],
    kinds: ["macro", "guidance"],
    w: { mom: 0.25, event: 0.25, regime: 0.3, vix: 0.2, noise: 0 },
    lookbacks: [21, 63],
    names: ["Spread Watcher", "CDS Desk", "Covenant Reader", "Refi Wall", "Downgrade Row"],
  },
  {
    family: "positioning",
    horizon: "1m",
    watch: ["SPY", "NVDA", "XOM", "GS"],
    kinds: ["macro"],
    w: { mom: -0.35, event: 0.1, regime: 0.15, vix: 0.25, noise: 0.15 },
    lookbacks: [10, 21, 42],
    names: ["CoT Contrarian", "Flow Fader", "Crowding Index", "Beta Chaser", "Short Interest"],
  },
  {
    family: "alt_data",
    horizon: "1m",
    watch: ["AMZN", "COST", "AAPL", "CAT", "SLB"],
    kinds: ["earnings"],
    w: { mom: 0.35, event: 0.3, regime: 0.05, vix: 0, noise: 0.3 },
    lookbacks: [10, 21],
    names: ["Card Panels", "Truck Pings", "App Rankings", "Satellite Lots", "Job Postings"],
  },
];

const REGIME_TILT: Record<RegimeId, number> = {
  expansion: 0.6,
  late_cycle: 0.15,
  chop: 0,
  correction: -0.5,
  crisis: -0.9,
  recovery: 0.45,
};

interface Persona {
  id: number;
  name: string;
  family: PersonaFamily;
  horizon: Horizon;
  focus: string;
  lookback: number;
  kinds: string[];
  w: FamilySpec["w"];
  /** Persistent lean of this reader, small. */
  bias: number;
  noiseAmp: number;
}

const ROOT = new Rng(20260814).fork("personas");

export const PERSONAS: Persona[] = FAMILIES.flatMap((f, fi) =>
  f.names.map((name, ni) => {
    const rng = ROOT.fork(`${f.family}:${name}`);
    return {
      id: fi * 5 + ni,
      name,
      family: f.family,
      horizon: f.horizon,
      focus: f.watch[(ni * 3 + fi) % f.watch.length],
      lookback: f.lookbacks[ni % f.lookbacks.length],
      kinds: f.kinds,
      w: f.w,
      bias: rng.uniform(-0.25, 0.25),
      noiseAmp: f.w.noise * (0.7 + 0.6 * rng.uniform()),
    };
  }),
);

// ---------------------------------------------------------------------------
// The signal
// ---------------------------------------------------------------------------

/** Events indexed by symbol for fast lookback scans. */
const eventDaysBySymbol = (() => {
  const m = new Map<string, Array<{ idx: number; kind: string; gap: number }>>();
  for (const e of EVENTS) {
    const list = m.get(e.symbol) ?? [];
    list.push({ idx: dateIndex(e.date), kind: e.kind, gap: e.gap });
    m.set(e.symbol, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.idx - b.idx);
  return m;
})();

function tanh(x: number): number {
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

/** Signed conviction of persona `p` as of session `idx`. Deterministic. */
export function personaSignal(p: Persona, idx: number): number {
  const closes = getCloses(p.focus);
  const back = Math.max(0, idx - p.lookback);
  const ret = closes[idx] / closes[back] - 1;
  // Scale momentum so a lookback-proportional move saturates.
  const mom = tanh(ret / (0.06 * Math.sqrt(p.lookback / 10)));

  // Most recent watched event inside 7 sessions, decayed.
  let eventKick = 0;
  const evs = eventDaysBySymbol.get(p.focus);
  if (evs && p.kinds.length) {
    for (let k = evs.length - 1; k >= 0; k--) {
      const e = evs[k];
      if (e.idx > idx) continue;
      if (idx - e.idx > 7) break;
      if (!p.kinds.includes(e.kind)) continue;
      const decay = 1 - (idx - e.idx) / 8;
      eventKick = tanh(e.gap / 0.05) * decay;
      break;
    }
  }

  const regime = REGIME_TILT[REGIME_BY_DAY[idx]];
  // VIX above ~20 reads risk-off, below reads risk-on.
  const vix = tanh((20 - VIX[idx]) / 12);
  const noise = ROOT.fork(`sig:${p.id}:${idx}`).normal() * p.noiseAmp;

  const s =
    p.w.mom * mom + p.w.event * eventKick + p.w.regime * regime + p.w.vix * vix + noise + p.bias * 0.3;
  return Math.max(-1, Math.min(1, tanh(1.4 * s)));
}

const TRAIL_SESSIONS = 60;

function rationaleFor(p: Persona, idx: number, signal: number): string {
  const closes = getCloses(p.focus);
  const back = Math.max(0, idx - p.lookback);
  const ret = (closes[idx] / closes[back] - 1) * 100;
  const dirWord = signal > 0.15 ? "constructive" : signal < -0.15 ? "defensive" : "neutral";
  const move = `${p.focus} ${ret >= 0 ? "+" : ""}${ret.toFixed(1)}% over ${p.lookback}d`;
  const vix = VIX[idx].toFixed(0);
  const regime = REGIME_BY_DAY[idx].replace("_", " ");
  switch (p.family) {
    case "filings":
      return `${move}; accrual quality ${signal > 0 ? "improving" : "slipping"} into the print — ${dirWord}.`;
    case "transcripts":
      return `Management tone ${signal > 0 ? "firmer" : "softer"} than the tape implies; ${move}.`;
    case "options_flow":
      return `Dealer books ${signal > 0 ? "long" : "short"} gamma around spot; ${move}, vol ${vix}.`;
    case "on_chain":
      return `Risk appetite proxy ${signal > 0 ? "inflows" : "outflows"} for a third session; maps ${dirWord} onto ${p.focus}.`;
    case "macro":
      return `${regime} regime, VIX ${vix}; prints lean ${signal > 0 ? "reflation" : "slowdown"} — ${dirWord} on ${p.focus}.`;
    case "sector_news":
      return `Calendar density ${signal > 0 ? "favours" : "threatens"} ${p.focus}; ${move}.`;
    case "technicals":
      return `${move}; structure reads ${signal > 0 ? "accumulation" : "distribution"} at the ${p.lookback}d mean.`;
    case "credit":
      return `Spread complex ${signal > 0 ? "tightening" : "widening"} under a ${regime} tape — ${dirWord} on ${p.focus}.`;
    case "positioning":
      return `Crowding ${signal > 0 ? "washed out" : "stretched"} after ${move}; fading the consensus.`;
    case "alt_data":
      return `Panel data ${signal > 0 ? "ahead of" : "behind"} street on ${p.focus}; ${move}.`;
  }
}

/** One persona's full output for a session — envelope, view, and trail. */
export function personaView(p: Persona, idx: number = LATEST_INDEX): PersonaView {
  const signal = personaSignal(p, idx);
  const trail: TrendPoint[] = [];
  for (let i = Math.max(0, idx - TRAIL_SESSIONS + 1); i <= idx; i++) {
    trail.push({ date: DATES[i], value: round4(personaSignal(p, i)) });
  }
  return {
    agent: "personas",
    // The fifty report through the night, 01:04 to 04:57.
    timestamp: overnight(64 + p.id * 4.73),
    asset: p.focus,
    horizon: p.horizon,
    trend_context: trail,
    personaId: p.id,
    name: p.name,
    family: p.family,
    direction: signal > 0.15 ? 1 : signal < -0.15 ? -1 : 0,
    conviction: round4(Math.abs(signal)),
    rationale: rationaleFor(p, idx, signal),
    signal: round4(signal),
  };
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

// ---------------------------------------------------------------------------
// The disagreement structure
// ---------------------------------------------------------------------------

const signalMatrix = new Map<number, number[]>();

/** All fifty signals for a session, cached. */
export function signalsAt(idx: number): number[] {
  let row = signalMatrix.get(idx);
  if (!row) {
    row = PERSONAS.map((p) => personaSignal(p, idx));
    signalMatrix.set(idx, row);
  }
  return row;
}

export function dispersionAt(idx: number): number {
  const row = signalsAt(idx);
  const mean = row.reduce((a, b) => a + b, 0) / row.length;
  const v = row.reduce((a, b) => a + (b - mean) * (b - mean), 0) / row.length;
  return Math.sqrt(v);
}

/** 1-D k-means over tonight's signals — the cluster structure, deterministic. */
function clustersAt(idx: number): PersonaCluster[] {
  const row = signalsAt(idx);
  let centers = [-0.5, 0, 0.5];
  let assign: number[] = new Array(row.length).fill(0);
  for (let iter = 0; iter < 24; iter++) {
    assign = row.map((s) => {
      let best = 0;
      for (let c = 1; c < centers.length; c++) {
        if (Math.abs(s - centers[c]) < Math.abs(s - centers[best])) best = c;
      }
      return best;
    });
    centers = centers.map((c, ci) => {
      const members = row.filter((_, i) => assign[i] === ci);
      return members.length ? members.reduce((a, b) => a + b, 0) / members.length : c;
    });
  }
  const labelFor = (c: number, n: number) =>
    c > 0.2 ? `${n} constructive` : c < -0.2 ? `${n} defensive` : `${n} on the fence`;
  return centers
    .map((center, ci) => {
      const members = PERSONAS.filter((_, i) => assign[i] === ci).map((p) => p.id);
      return {
        label: labelFor(center, members.length),
        center: round4(center),
        members,
      };
    })
    .filter((c) => c.members.length > 0)
    .sort((a, b) => b.center - a.center);
}

let summaryCache: PersonasSummary | null = null;

/** The aggregate: consensus, dispersion trend, fracture flag, fracture edge. */
export function personasSummary(): PersonasSummary {
  if (summaryCache) return summaryCache;

  const yearBack = Math.max(0, LATEST_INDEX - 251);
  const dispersionSeries: TrendPoint[] = [];
  const dispersions: number[] = [];
  for (let i = yearBack; i <= LATEST_INDEX; i++) {
    const d = dispersionAt(i);
    dispersions.push(d);
    dispersionSeries.push({ date: DATES[i], value: round4(d) });
  }
  const sorted = [...dispersions].sort((a, b) => a - b);
  const p80 = sorted[Math.floor(0.8 * (sorted.length - 1))];
  const tonight = dispersions[dispersions.length - 1];

  // Does fracture predict anything? |SPY fwd 5d| after high-dispersion days.
  const spy = getCloses("SPY");
  let fracSum = 0;
  let fracN = 0;
  let baseSum = 0;
  let baseN = 0;
  for (let i = yearBack; i <= LATEST_INDEX - 5; i++) {
    const fwd = Math.abs(spy[i + 5] / spy[i] - 1);
    baseSum += fwd;
    baseN++;
    if (dispersionAt(i) > p80) {
      fracSum += fwd;
      fracN++;
    }
  }

  const row = signalsAt(LATEST_INDEX);
  const consensus = row.reduce((a, b) => a + b, 0) / row.length;

  summaryCache = {
    agent: "personas",
    timestamp: overnight(299), // 04:59 — after the last persona reports
    asset: "UNIVERSE",
    horizon: "overnight",
    trend_context: dispersionSeries,
    consensus: round4(consensus),
    dispersion: round4(tonight),
    fractured: tonight > p80,
    fractureEdge: {
      afterFracture: round4(fracN ? fracSum / fracN : 0),
      baseline: round4(baseN ? baseSum / baseN : 0),
    },
    clusters: clustersAt(LATEST_INDEX),
  };
  return summaryCache;
}

/** All fifty views for the latest session — the Overnight section's feed. */
export function runPersonas(idx: number = LATEST_INDEX): PersonaView[] {
  return PERSONAS.map((p) => personaView(p, idx));
}
