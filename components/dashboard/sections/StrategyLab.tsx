import { Spark } from "@/components/dashboard/Spark";
import { STRATEGY, runBacktest, runCoder } from "@/lib/agents";
import type { RegimeStat } from "@/lib/agents/types";
import { fmtDate, fmtNum, fmtPct, fmtPctAbs } from "@/lib/format";
import { Section } from "../Section";
import { EquityCharts } from "./EquityCharts";

const REGIME_ORDER = ["expansion", "late_cycle", "chop", "correction", "crisis", "recovery"];

function orderRegimes(stats: RegimeStat[]): RegimeStat[] {
  return [...stats].sort(
    (a, b) => REGIME_ORDER.indexOf(a.regime) - REGIME_ORDER.indexOf(b.regime),
  );
}

function DraftBlock({
  version,
  accepted,
  broke,
  fixed,
  preview,
}: {
  version: number;
  accepted: boolean;
  broke: string | null;
  fixed: string | null;
  preview: { cagr: number; maxDrawdown: number; sharpe: number; trades: number };
}) {
  return (
    <div className="border-l border-border pl-5">
      <div className="mb-1.5 flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          draft {version}
        </span>
        {accepted && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--night-accent)]">
            accepted
          </span>
        )}
      </div>
      {fixed && <p className="mb-1.5 text-xs leading-relaxed text-foreground">{fixed}</p>}
      {broke && (
        <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">
          <span className="text-[var(--night-faint)]">broke — </span>
          {broke}
        </p>
      )}
      <div className="num flex gap-5 text-left font-mono text-[11px] text-muted-foreground">
        <span>
          cagr <span className="text-foreground">{fmtPct(preview.cagr)}</span>
        </span>
        <span>
          dd <span className="text-foreground">{fmtPct(preview.maxDrawdown)}</span>
        </span>
        <span>
          sharpe <span className="text-foreground">{fmtNum(preview.sharpe, 2)}</span>
        </span>
        <span>
          trades <span className="text-foreground">{preview.trades}</span>
        </span>
      </div>
    </div>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="contents">
      <dt className="py-1 text-muted-foreground">{k}</dt>
      <dd className="num py-1 text-foreground">{v}</dd>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      <span className="num text-xl leading-none text-foreground">{value}</span>
      {sub && <span className="font-mono text-[10px] text-[var(--night-faint)]">{sub}</span>}
    </div>
  );
}

export function StrategyLabSection() {
  const coder = runCoder();
  const bt = runBacktest(STRATEGY);
  const s = bt.summary;
  const recent = [...bt.tradeLog].slice(-8).reverse();
  const st = STRATEGY;

  return (
    <Section
      id="lab"
      index="02"
      title="Strategy Lab"
      subtitle="One sentence in. Three drafts and five replayed years later, a strategy object that survived its own debug loop."
    >
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* coder */}
        <div>
          <div className="label-caps mb-3">coder · in</div>
          <p className="mb-8 max-w-[36ch] text-lg leading-snug text-foreground">
            “{coder.sentence}”
          </p>

          <div className="mb-3 flex items-baseline justify-between">
            <span className="label-caps">debug loop</span>
            <span className="flex items-center gap-2 font-mono text-[10px] text-[var(--night-faint)]">
              sharpe by draft
              <Spark data={coder.trend_context} width={48} height={16} showZero />
            </span>
          </div>
          <div className="flex flex-col gap-6">
            {coder.drafts.map((d) => (
              <DraftBlock
                key={d.version}
                version={d.version}
                accepted={d.broke === null}
                broke={d.broke}
                fixed={d.fixed}
                preview={d.preview}
              />
            ))}
          </div>

          <div className="label-caps mb-3 mt-10">strategy object</div>
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-6 border-t border-border pt-2 font-mono text-[11px]">
            <SpecRow k="universe" v="biotech · small cap" />
            <SpecRow k="trigger" v="FDA calendar event" />
            <SpecRow
              k="entry"
              v={`fade the gap · ${fmtPctAbs(st.entry.minGap, 0)}–${fmtPctAbs(st.entry.maxGap!, 0)} at the open`}
            />
            <SpecRow
              k="exit"
              v={`t+${st.exit.holdingDays} open · ${fmtPctAbs(st.exit.stopPct!, 0)} stop`}
            />
            <SpecRow
              k="sizing"
              v={`${st.sizing.maxConcurrent} slots × ${st.sizing.grossTargetPct / st.sizing.maxConcurrent}% gross`}
            />
            <SpecRow
              k="costs"
              v={`${st.costs.perSideBps + st.costs.slippageBps}bps per side`}
            />
          </dl>
        </div>

        {/* backtester */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="label-caps">backtester · out</span>
            <span className="font-mono text-[10px] text-[var(--night-faint)]">
              1,255 sessions replayed in {(bt.elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-x-6 gap-y-6">
            <StatCell label="cagr" value={fmtPct(s.cagr)} />
            <StatCell label="sharpe" value={fmtNum(s.sharpe, 2)} />
            <StatCell label="max drawdown" value={fmtPct(s.maxDrawdown)} />
            <StatCell label="win rate" value={fmtPctAbs(s.winRate, 0)} sub={`${s.trades} trades`} />
            <StatCell label="avg hold" value={`${s.avgHoldingDays.toFixed(1)}d`} />
            <StatCell label="exposure" value={fmtPctAbs(s.exposure, 0)} sub="of sessions" />
          </div>

          <EquityCharts />

          <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            <div>
              <div className="label-caps mb-2">by regime</div>
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-[var(--night-faint)]">
                    <th className="py-1.5 text-left font-normal">regime</th>
                    <th className="py-1.5 text-right font-normal">n</th>
                    <th className="py-1.5 text-right font-normal">win</th>
                    <th className="py-1.5 text-right font-normal">total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRegimes(bt.regimeStats).map((r) => (
                    <tr key={r.regime} className="border-b border-border/60">
                      <td className="py-1.5 text-muted-foreground">
                        {r.regime.replace("_", " ")}
                      </td>
                      <td className="num py-1.5 text-foreground">{r.trades}</td>
                      <td className="num py-1.5 text-foreground">{fmtPctAbs(r.winRate, 0)}</td>
                      <td className="num py-1.5 text-foreground">{fmtPct(r.totalReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                The fade feasts on panic — corrections and crisis carry the book.
              </p>
            </div>

            <div>
              <div className="label-caps mb-2">recent trades</div>
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-[var(--night-faint)]">
                    <th className="py-1.5 text-left font-normal">entry</th>
                    <th className="py-1.5 text-left font-normal">sym</th>
                    <th className="py-1.5 text-center font-normal">dir</th>
                    <th className="py-1.5 text-right font-normal">gap</th>
                    <th className="py-1.5 text-right font-normal">net</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-1.5 text-muted-foreground">{fmtDate(t.entryDate)}</td>
                      <td className="py-1.5 text-foreground">{t.symbol}</td>
                      <td className="py-1.5 text-center text-foreground">
                        {t.direction === 1 ? "▲" : "▽"}
                      </td>
                      <td className="num py-1.5 text-muted-foreground">{fmtPct(t.gapAtEntry)}</td>
                      <td className="num py-1.5 text-foreground">{fmtPct(t.ret)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
