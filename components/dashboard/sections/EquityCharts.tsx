"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STRATEGY, runBacktest } from "@/lib/agents";
import { fmtDateYear, fmtPct } from "@/lib/format";
import { INK, NightTooltip, TICK, thin, yearTicks } from "./chartTheme";

/** Equity as the hero, drawdown as the shadow under it. */
export function EquityCharts() {
  const bt = runBacktest(STRATEGY);
  const equity = thin(bt.equity);
  const drawdown = thin(bt.drawdown);
  const ticks = yearTicks(equity.map((p) => p.date));

  return (
    <div className="flex flex-col gap-1">
      <div className="label-caps mb-1">equity · 1.00 at the start</div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={equity} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={INK.grid} vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={(d: string) => `’${d.slice(2, 4)}`}
            tick={TICK}
            axisLine={{ stroke: INK.grid }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            width={38}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <ReferenceLine y={1} stroke={INK.faint} strokeDasharray="2 4" strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: INK.faint, strokeWidth: 1 }}
            content={
              <NightTooltip format={(v) => `${v.toFixed(3)}×`} formatLabel={fmtDateYear} />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={INK.accent}
            fillOpacity={0.07}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={INK.accent}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="label-caps mb-1 mt-4">drawdown</div>
      <ResponsiveContainer width="100%" height={80}>
        <ComposedChart data={drawdown} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis
            width={38}
            domain={["auto", 0]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickCount={2}
          />
          <Tooltip
            cursor={{ stroke: INK.faint, strokeWidth: 1 }}
            content={<NightTooltip format={(v) => fmtPct(v)} formatLabel={fmtDateYear} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={INK.gray}
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={INK.gray}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
