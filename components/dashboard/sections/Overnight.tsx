import { Spark } from "@/components/dashboard/Spark";
import { SummaryLine } from "@/components/dashboard/SummaryLine";
import { personasSummary, signalsAt } from "@/lib/agents";
import type { TrendPoint } from "@/lib/agents/types";
import { DATES, LATEST_INDEX } from "@/lib/fixtures";
import { fmtNum, fmtPctAbs } from "@/lib/format";
import { Section } from "../Section";
import { PersonaBlotter } from "./PersonaBlotter";

/** Mean signed conviction across the fifty, one point per session. */
function consensusTrail(sessions = 60): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = Math.max(0, LATEST_INDEX - sessions + 1); i <= LATEST_INDEX; i++) {
    const row = signalsAt(i);
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    out.push({ date: DATES[i], value: Math.round(mean * 1e4) / 1e4 });
  }
  return out;
}

function Stat({
  label,
  value,
  trail,
  note,
  showZero,
}: {
  label: string;
  value: string;
  trail?: TrendPoint[];
  note: string;
  showZero?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label-caps">{label}</div>
      <div className="flex items-end gap-3">
        <span className="num text-2xl leading-none text-foreground">{value}</span>
        {trail && <Spark data={trail} width={84} height={22} showZero={showZero} />}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

/** All fifty signals as ticks on one −1…+1 axis — the disagreement, visible. */
function SignalStrip({ signals, centers }: { signals: number[]; centers: number[] }) {
  const x = (s: number) => ((s + 1) / 2) * 600;
  return (
    <div>
      <svg viewBox="0 0 600 30" className="h-[30px] w-full" aria-hidden>
        <line x1={300} x2={300} y1={2} y2={28} stroke="#232329" strokeWidth={1} />
        {signals.map((s, i) => (
          <line
            key={i}
            x1={x(s)}
            x2={x(s)}
            y1={7}
            y2={23}
            stroke="#9a9aa3"
            strokeWidth={1.5}
            opacity={0.55}
          />
        ))}
        {centers.map((c, i) => (
          <circle key={i} cx={x(c)} cy={15} r={3} fill="var(--night-accent)" />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-[var(--night-faint)]">
        <span>−1 · short</span>
        <span>0</span>
        <span>+1 · long</span>
      </div>
    </div>
  );
}

export function OvernightSection() {
  const s = personasSummary();
  const signals = signalsAt(LATEST_INDEX);
  const edgeRatio = s.fractureEdge.afterFracture / s.fractureEdge.baseline;
  const trail = consensusTrail();

  return (
    <Section
      id="overnight"
      index="01"
      title="Overnight"
      subtitle="Fifty readers, fifty slices, none seeing another's work. The signal is where they disagree."
      summary={
        <SummaryLine trend={trail} showZero>
          fifty readers · consensus {fmtNum(s.consensus, 2)} · tonight reads{" "}
          <span className={s.fractured ? "text-[var(--night-accent)]" : "text-foreground"}>
            {s.fractured ? "fractured" : "coherent"}
          </span>
        </SummaryLine>
      }
    >
      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
        <Stat
          label="consensus"
          value={fmtNum(s.consensus, 2)}
          trail={consensusTrail()}
          showZero
          note="Mean signed conviction across all fifty, past 60 sessions beside it."
        />
        <Stat
          label="dispersion"
          value={s.dispersion.toFixed(2)}
          trail={s.trend_context}
          note="Cross-sectional σ of the fifty, past year beside it."
        />
        <Stat
          label="tonight reads"
          value={s.fractured ? "fractured" : "coherent"}
          note={
            s.fractured
              ? "Dispersion cleared the 80th percentile of the year — the slices stopped agreeing."
              : "Dispersion sits below the year's fracture line. The slices broadly agree."
          }
        />
        <Stat
          label="fracture edge"
          value={`${edgeRatio.toFixed(2)}×`}
          note={`Disagreement precedes motion: |SPY, next 5d| runs ${fmtPctAbs(
            s.fractureEdge.afterFracture,
          )} after fractured sessions vs ${fmtPctAbs(s.fractureEdge.baseline)} baseline.`}
        />
      </div>

      <div className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="label-caps">tonight&apos;s structure</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {s.clusters.map((c) => c.label).join(" · ")}
          </span>
        </div>
        <SignalStrip signals={signals} centers={s.clusters.map((c) => c.center)} />
      </div>

      <div className="mt-12">
        <PersonaBlotter />
      </div>
    </Section>
  );
}
