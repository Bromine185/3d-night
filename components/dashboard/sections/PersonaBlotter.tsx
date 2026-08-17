"use client";

import { useState } from "react";
import { Spark } from "@/components/dashboard/Spark";
import { runPersonas } from "@/lib/agents";
import { FAMILY_SHORT } from "@/lib/agents/personas";
import { fmtClock } from "@/lib/format";

const GLYPH: Record<number, { g: string; cls: string }> = {
  1: { g: "▲", cls: "text-foreground" },
  0: { g: "–", cls: "text-[var(--night-faint)]" },
  [-1]: { g: "▽", cls: "text-foreground" },
};

const PREVIEW_ROWS = 14;

/** The fifty, as a desk blotter: loudest conviction first, trail beside every view. */
export function PersonaBlotter() {
  const [showAll, setShowAll] = useState(false);
  const views = [...runPersonas()].sort(
    (a, b) => Math.abs(b.signal) - Math.abs(a.signal) || a.personaId - b.personaId,
  );
  const visible = showAll ? views : views.slice(0, PREVIEW_ROWS);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label-caps">the fifty</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          reported 01:04 – 04:56 · sorted by conviction
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--night-faint)]">
              <th className="py-2 pr-4 font-normal">t</th>
              <th className="py-2 pr-4 font-normal">reader</th>
              <th className="py-2 pr-4 font-normal">slice</th>
              <th className="py-2 pr-4 font-normal">asset</th>
              <th className="py-2 pr-3 text-center font-normal">dir</th>
              <th className="py-2 pr-4 text-right font-normal">conv</th>
              <th className="py-2 pr-4 font-normal">60d trail</th>
              <th className="py-2 font-normal">rationale</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.personaId} className="border-b border-border/60">
                <td className="py-1.5 pr-4 font-mono text-[11px] text-[var(--night-faint)]">
                  {fmtClock(v.timestamp)}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-4 text-foreground">{v.name}</td>
                <td className="py-1.5 pr-4 font-mono text-[11px] text-muted-foreground">
                  {FAMILY_SHORT[v.family]}
                </td>
                <td className="py-1.5 pr-4 font-mono text-[11px] text-foreground">{v.asset}</td>
                <td className={`py-1.5 pr-3 text-center font-mono ${GLYPH[v.direction].cls}`}>
                  {GLYPH[v.direction].g}
                </td>
                <td className="num py-1.5 pr-4 text-[11px] text-foreground">
                  {v.conviction.toFixed(2)}
                </td>
                <td className="py-1.5 pr-4">
                  <Spark data={v.trend_context} width={72} height={18} showZero />
                </td>
                <td
                  className="max-w-[26rem] truncate py-1.5 pr-2 text-muted-foreground"
                  title={v.rationale}
                >
                  {v.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowAll((s) => !s)}
        className="mt-3 font-mono text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-[var(--night-accent)]"
      >
        {showAll ? "SHOW FEWER ↑" : `SHOW ALL FIFTY ↓`}
      </button>
    </div>
  );
}
