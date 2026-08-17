/**
 * Pinned outputs for the five agents. The snapshots are the contract: if a
 * refactor moves any number, the diff shows up here before it shows up in a
 * demo. Determinism is tested explicitly — every agent must return identical
 * output when called twice.
 */
import { describe, expect, it } from "vitest";
import { LATEST_DATE } from "../fixtures";
import {
  PERSONAS,
  STORM_OPTS,
  STRATEGY,
  SURFACE_AXES,
  computeSurface,
  personasSummary,
  runBacktest,
  runBreaker,
  runCoder,
  runCritic,
  runPersonas,
} from "./index";
import { RUN_DATE } from "./clock";

describe("clock", () => {
  it("runs the overnight after the last bar", () => {
    expect(RUN_DATE > LATEST_DATE).toBe(true);
    expect(RUN_DATE).toMatchInlineSnapshot(`"2026-08-17"`);
  });
});

describe("envelope", () => {
  it("every agent output carries timestamp, asset, horizon, trend_context", () => {
    const outputs = [
      ...runPersonas(),
      personasSummary(),
      runCoder(),
      runBacktest(STRATEGY),
      runBreaker(STRATEGY),
      runCritic(),
    ];
    for (const o of outputs) {
      expect(o.timestamp).toMatch(/^2026-08-17T0[0-5]:/);
      expect(o.asset.length).toBeGreaterThan(0);
      expect(o.horizon).toBeTruthy();
      expect(o.trend_context.length).toBeGreaterThan(0);
    }
  });
});

describe("personas", () => {
  it("is fifty distinct readers", () => {
    expect(PERSONAS).toHaveLength(50);
    expect(new Set(PERSONAS.map((p) => p.name)).size).toBe(50);
    expect(new Set(PERSONAS.map((p) => p.family)).size).toBe(10);
  });

  it("is deterministic", () => {
    const a = runPersonas()[7];
    const b = runPersonas()[7];
    expect(a).toStrictEqual(b);
  });

  it("pins tonight's first and last views", () => {
    const views = runPersonas();
    const compact = (v: (typeof views)[number]) => ({
      name: v.name,
      asset: v.asset,
      timestamp: v.timestamp,
      direction: v.direction,
      conviction: v.conviction,
      signal: v.signal,
      rationale: v.rationale,
      trailLen: v.trend_context.length,
    });
    expect(compact(views[0])).toMatchSnapshot();
    expect(compact(views[49])).toMatchSnapshot();
  });

  it("pins the disagreement structure", () => {
    const s = personasSummary();
    expect({
      consensus: s.consensus,
      dispersion: s.dispersion,
      fractured: s.fractured,
      fractureEdge: s.fractureEdge,
      clusters: s.clusters.map((c) => ({
        label: c.label,
        center: c.center,
        size: c.members.length,
      })),
    }).toMatchSnapshot();
  });
});

describe("coder", () => {
  it("compiles the sentence into three drafts with real previews", () => {
    const out = runCoder();
    expect(out.drafts).toHaveLength(3);
    expect(out.drafts[0].broke).toBeTruthy();
    expect(out.drafts[2].broke).toBeNull();
    expect(out.final.id).toBe("fade-fda-v3");
    expect(
      out.drafts.map((d) => ({ v: d.version, ...d.preview })),
    ).toMatchSnapshot();
  });
});

describe("backtester", () => {
  const result = runBacktest(STRATEGY);

  it("replays the whole window", () => {
    expect(result.equity.length).toBeGreaterThan(1200);
    expect(result.equity[0].date >= "2021-08-16").toBe(true);
    expect(result.equity.at(-1)!.date).toBe(LATEST_DATE);
  });

  it("pins the summary and regime split", () => {
    expect(result.summary).toMatchSnapshot();
    expect(result.regimeStats).toMatchSnapshot();
  });

  it("pins the first and last trades", () => {
    expect(result.tradeLog[0]).toMatchSnapshot();
    expect(result.tradeLog.at(-1)).toMatchSnapshot();
  });

  it("drawdown is never positive and equity stays positive", () => {
    expect(result.drawdown.every((p) => p.value <= 0)).toBe(true);
    expect(result.equity.every((p) => p.value > 0)).toBe(true);
  });
});

describe("surface", () => {
  it("pins the terrain's shape and corners", () => {
    const s = computeSurface(STRATEGY, SURFACE_AXES);
    expect(s.cells).toHaveLength(21);
    expect(s.cells[0]).toHaveLength(21);
    expect({
      corners: [
        s.cells[0][0],
        s.cells[0][20],
        s.cells[20][0],
        s.cells[20][20],
      ],
      center: s.cells[10][10],
    }).toMatchSnapshot();
  });

  it("stressed terrain sits below the base terrain on average", () => {
    const base = computeSurface(STRATEGY, SURFACE_AXES);
    const storm = computeSurface(STRATEGY, SURFACE_AXES, STORM_OPTS);
    const mean = (cells: number[][]) =>
      cells.flat().reduce((a, b) => a + b, 0) / (21 * 21);
    expect(mean(storm.cells)).toBeLessThan(mean(base.cells));
  });
});

describe("breaker", () => {
  it("pins the stress battery and the verdict", () => {
    const out = runBreaker(STRATEGY);
    expect(out.stresses).toHaveLength(5);
    expect(out.worstWindows).toHaveLength(10);
    expect(
      out.stresses.map((s) => ({
        id: s.id,
        cagr: s.stressed.cagr,
        dd: s.stressed.maxDrawdown,
        broke: s.broke,
        severity: s.severity,
      })),
    ).toMatchSnapshot();
    expect(out.killer.id).toMatchSnapshot();
    expect(out.verdict).toMatchSnapshot();
  });
});

describe("critic", () => {
  it("pins the diagnosis and its evidence", () => {
    const out = runCritic();
    expect(out.journal).toHaveLength(14);
    expect(out.evidence).toHaveLength(3);
    expect(out.flaggedRegions).toHaveLength(2);
    expect(out.pattern).toMatchSnapshot();
    expect(out.evidence.map((e) => e.date)).toMatchSnapshot();
  });

  it("journal dates sit inside the fixture window", () => {
    const out = runCritic();
    for (const j of out.journal) {
      expect(j.date >= "2021-08-16" && j.date <= LATEST_DATE).toBe(true);
    }
  });
});
