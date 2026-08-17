import { SummaryLine } from "@/components/dashboard/SummaryLine";
import { STRATEGY, runBreaker } from "@/lib/agents";
import { fmtDateYear, fmtPct } from "@/lib/format";
import { Section } from "../Section";
import { KillerChart } from "./KillerChart";

export function StressSection() {
  const br = runBreaker(STRATEGY);
  const worstRegimeStress = br.stresses.find((s) => s.id === "worst_regimes");
  const held = br.stresses.filter((s) => !s.broke).length;

  return (
    <Section
      id="stress"
      index="03"
      title="Stress"
      subtitle="The breaker's only job is to kill the strategy. Five attempts, one success."
      summary={
        <SummaryLine trend={br.trend_context}>
          <span className="text-[var(--night-accent)]">{br.killer.label.toLowerCase()}</span> broke
          it · cagr {fmtPct(br.killer.base.cagr)} → {fmtPct(br.killer.stressed.cagr)} · {held} of{" "}
          {br.stresses.length} held
        </SummaryLine>
      }
    >
      <p className="max-w-[58ch] text-xl leading-relaxed text-foreground">{br.verdict}</p>

      <div className="mt-12">
        <div className="label-caps mb-3">the battery</div>
        <div className="flex flex-col">
          {br.stresses.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-8 gap-y-1 border-t border-border py-3.5 md:grid-cols-[minmax(0,5fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_4rem]"
            >
              <div>
                <div className="text-sm text-foreground">{s.label}</div>
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  {s.description}
                </div>
              </div>
              <div className="num font-mono text-[11px]">
                <span className="text-[var(--night-faint)]">cagr </span>
                <span className="text-muted-foreground">{fmtPct(s.base.cagr)}</span>
                <span className="text-[var(--night-faint)]"> → </span>
                <span className="text-foreground">{fmtPct(s.stressed.cagr)}</span>
              </div>
              <div className="num font-mono text-[11px]">
                <span className="text-[var(--night-faint)]">dd </span>
                <span className="text-muted-foreground">{fmtPct(s.base.maxDrawdown)}</span>
                <span className="text-[var(--night-faint)]"> → </span>
                <span className="text-foreground">{fmtPct(s.stressed.maxDrawdown)}</span>
              </div>
              <div className="hidden items-center md:flex">
                <div className="h-[3px] w-full bg-border">
                  <div
                    className="h-full bg-[var(--night-accent)]"
                    style={{ width: `${Math.round(s.severity * 100)}%`, opacity: 0.9 }}
                  />
                </div>
              </div>
              <div
                className={`font-mono text-[11px] uppercase tracking-[0.14em] md:text-right ${
                  s.broke ? "text-[var(--night-accent)]" : "text-[var(--night-faint)]"
                }`}
              >
                {s.broke ? "broke" : "held"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="label-caps">the kill, replayed</span>
          <span className="font-mono text-[10px] text-[var(--night-faint)]">
            same signals, every fill 150bps worse
          </span>
        </div>
        <KillerChart />
      </div>

      <div className="mt-12 grid gap-x-14 gap-y-8 lg:grid-cols-2">
        <div>
          <div className="label-caps mb-2">the ten worst windows</div>
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-[var(--night-faint)]">
                <th className="py-1.5 text-left font-normal">regime</th>
                <th className="py-1.5 text-left font-normal">window</th>
                <th className="py-1.5 text-right font-normal">spy</th>
              </tr>
            </thead>
            <tbody>
              {br.worstWindows.map((w, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-1.5 text-muted-foreground">{w.regime.replace("_", " ")}</td>
                  <td className="py-1.5 text-foreground">
                    {fmtDateYear(w.startDate)} → {fmtDateYear(w.endDate)}
                  </td>
                  <td className="num py-1.5 text-foreground">{fmtPct(w.spyReturn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="max-w-[48ch] self-end">
          <div className="label-caps mb-2">the surprise</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Confined to those ten windows alone, the strategy{" "}
            <span className="text-foreground">improves</span> — CAGR{" "}
            <span className="num inline text-foreground">
              {fmtPct(worstRegimeStress?.stressed.cagr ?? 0)}
            </span>{" "}
            against{" "}
            <span className="num inline text-foreground">
              {fmtPct(worstRegimeStress?.base.cagr ?? 0)}
            </span>{" "}
            for the full tape. The fade likes panic; overreaction is its raw material. What kills
            it is friction, not fear.
          </p>
        </div>
      </div>
    </Section>
  );
}
