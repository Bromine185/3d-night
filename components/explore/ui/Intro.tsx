"use client";

/**
 * The first-visit walkthrough. Five steps, one card, bottom-left where the
 * legend normally sits (the legend hides while this is up — they say the
 * same things, and this says them better). No scrim and no camera moves:
 * the scene stays live and orbitable the whole time; steps that point at
 * a control ring the control itself instead.
 */
import { useEffect } from "react";
import { STRATEGY } from "@/lib/agents";
import { fmtPctAbs } from "@/lib/format";

export const INTRO_STEPS = 5;

const STEPS: Array<{ label: string; body: string }> = [
  {
    label: "the landscape",
    body: "Every point on this ground is one version of the strategy — a different entry threshold, a different holding period. Height is what five replayed years returned. Above the waterline is profit.",
  },
  {
    label: "you are here",
    body: `The amber flag is the strategy the coder shipped — ${fmtPctAbs(STRATEGY.entry.minGap, 0)} gap, ${STRATEGY.exit.holdingDays}-day hold. Its dropline measures that setting's return against the ladder at the corner.`,
  },
  {
    label: "the fifty",
    body: "The dots overhead are the fifty readers, not the terrain — different axes up there. Left is short, right is long, each band is one slice they read, height is conviction.",
  },
  {
    label: "the breaker",
    body: "Summon it. A front sweeps the ground and craters the peaks that only stood in calm. The wireframe it leaves behind is the terrain you had.",
  },
  {
    label: "five years",
    body: "The scrubber replays everything below. Watch the ridge move — where the edge lived two years ago is not where it lives tonight.",
  },
];

export function Intro({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(Math.min(step + 1, INTRO_STEPS - 1));
      else if (e.key === "ArrowLeft") onStep(Math.max(step - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onStep, onClose]);

  const s = STEPS[step];
  const last = step === INTRO_STEPS - 1;

  return (
    <div
      role="dialog"
      aria-label="scene introduction"
      className="pointer-events-auto absolute bottom-[92px] left-5 z-40 w-[300px] border border-[#232329] bg-[#0a0a0c]/95 p-4 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffb224]">
          {s.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[#55555e]">
          {step + 1} / {INTRO_STEPS}
        </span>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-[#9a9aa3]">{s.body}</p>
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em]">
        <button
          onClick={onClose}
          className="text-[#55555e] transition-colors hover:text-[#9a9aa3]"
        >
          SKIP
        </button>
        <div className="flex gap-4">
          {step > 0 && (
            <button
              onClick={() => onStep(step - 1)}
              className="text-[#9a9aa3] transition-colors hover:text-[#e6e6ea]"
            >
              ← BACK
            </button>
          )}
          <button
            onClick={() => (last ? onClose() : onStep(step + 1))}
            className="text-[#ffb224] transition-colors hover:text-[#e6e6ea]"
          >
            {last ? "DONE" : "NEXT →"}
          </button>
        </div>
      </div>
    </div>
  );
}
