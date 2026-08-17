import Link from "next/link";
import { Spark } from "@/components/dashboard/Spark";
import { runCritic } from "@/lib/agents";
import type { JournalEntry } from "@/lib/agents/types";
import { fmtDate, fmtPct, fmtPctAbs } from "@/lib/format";
import { Section } from "../Section";

/** Wrap the numbers in a prose string so they read in foreground ink. */
function emphasize(text: string) {
  const parts = text.split(/([+−-]?\d[\d.,]*(?:–\d[\d.,]*)?[%R×]?)/g);
  return parts.map((p, i) =>
    /\d/.test(p) ? (
      <span key={i} className="num inline text-foreground">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const R_MAX = 2.5;
const PLAN_R = 1.0;

function RBar({ sizeR, evidence }: { sizeR: number; evidence: boolean }) {
  if (sizeR === 0) {
    return <span className="font-mono text-[10px] text-[var(--night-faint)]">–</span>;
  }
  return (
    <div className="relative h-[3px] w-full bg-border">
      <div
        className={evidence ? "h-full bg-[var(--night-accent)]" : "h-full bg-[var(--night-faint)]"}
        style={{ width: `${Math.min(sizeR / R_MAX, 1) * 100}%` }}
      />
      <div
        className="absolute top-[-2.5px] h-[8px] w-px bg-foreground/40"
        style={{ left: `${(PLAN_R / R_MAX) * 100}%` }}
        title="plan size · 1.0R"
      />
    </div>
  );
}

function JournalRow({ entry, evidence }: { entry: JournalEntry; evidence: boolean }) {
  return (
    <div
      className={`grid grid-cols-[4.5rem_3rem_2.5rem_7rem_4rem_minmax(0,1fr)] items-center gap-x-4 py-2 ${
        evidence ? "border-l-2 border-[var(--night-accent)] pl-4" : "border-l-2 border-transparent pl-4"
      }`}
    >
      <span className="font-mono text-[11px] text-[var(--night-faint)]">
        {fmtDate(entry.date)}
      </span>
      <span className="font-mono text-[11px] text-foreground">{entry.symbol}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{entry.action}</span>
      <RBar sizeR={entry.sizeR} evidence={evidence} />
      <span className="num font-mono text-[11px] text-foreground">
        {entry.outcome === 0 ? "–" : fmtPct(entry.outcome)}
      </span>
      <span
        className={`truncate text-[12px] italic leading-relaxed ${
          evidence ? "text-foreground" : "text-muted-foreground"
        }`}
        title={entry.note}
      >
        {entry.note}
      </span>
    </div>
  );
}

export function MirrorSection() {
  const cr = runCritic();
  const evidenceDates = new Set(cr.evidence.map((e) => e.date));

  return (
    <Section
      id="mirror"
      index="04"
      title="Mirror"
      subtitle="The critic reads seven months of your journal back to you, and names the thing."
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <h3 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
          {cr.pattern}
        </h3>
        <span className="flex items-center gap-2 font-mono text-[10px] text-[var(--night-faint)]">
          size drift from plan, by entry
          <Spark data={cr.trend_context} width={72} height={20} />
        </span>
      </div>

      <p className="mt-6 max-w-[65ch] text-base leading-7 text-muted-foreground">
        {emphasize(cr.diagnosis)}
      </p>

      <div className="mt-12">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label-caps">the journal</span>
          <span className="font-mono text-[10px] text-[var(--night-faint)]">
            bar = size in R · tick = plan · accent rows triggered the diagnosis
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[42rem] flex-col divide-y divide-border/60 border-t border-border">
            {cr.journal.map((j) => (
              <JournalRow key={j.date} entry={j} evidence={evidenceDates.has(j.date)} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-1.5">
        {cr.flaggedRegions.map((r, i) => (
          <p key={i} className="font-mono text-[11px] leading-relaxed text-[var(--night-faint)]">
            flagged · gaps {fmtPctAbs(r.minGap[0], 1)}–{fmtPctAbs(r.minGap[1], 1)} held{" "}
            {r.holdingDays[0]}–{r.holdingDays[1]}d — “{r.whisper}”
          </p>
        ))}
        <Link
          href="/explore"
          className="mt-2 font-mono text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-[var(--night-accent)]"
        >
          the ghost knows where these live →
        </Link>
      </div>
    </Section>
  );
}
