"use client";

/**
 * The time control. A thin scrubber along the bottom moves the whole scene
 * through the five years — terrain morphs, persona clusters reconfigure,
 * trails grow and shrink. Play advances four steps a second.
 */
import { useEffect, useRef, useState } from "react";
import { DATES, LATEST_INDEX } from "@/lib/fixtures";
import { MIN_TIME_INDEX, quantizeIndex } from "@/lib/explore/surfaces";
import { fmtDateYear } from "@/lib/format";

export interface TimeScrubberProps {
  value: number;
  onChange: (idx: number) => void;
  /** True while a surface for this moment is still being replayed. */
  computing?: boolean;
  /** The intro's "five years" step rings the control it's describing. */
  highlight?: boolean;
}

export function TimeScrubber({
  value,
  onChange,
  computing = false,
  highlight = false,
}: TimeScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(playing);
  playRef.current = playing;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (!playRef.current) return;
      const next = quantizeIndex(valueRef.current + 10);
      if (next >= LATEST_INDEX) {
        onChangeRef.current(LATEST_INDEX);
        setPlaying(false);
      } else {
        onChangeRef.current(next);
      }
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  const atEnd = value >= LATEST_INDEX;

  return (
    <div
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-30 border-t bg-[#0a0a0c]/85 backdrop-blur-sm transition-colors duration-500 ${
        highlight ? "border-[#ffb224]" : "border-[#232329]"
      }`}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-5 px-6 py-4">
        <button
          onClick={() => {
            if (atEnd && !playing) onChange(MIN_TIME_INDEX);
            setPlaying((p) => !p);
          }}
          className="w-14 shrink-0 text-left font-mono text-[11px] tracking-[0.18em] text-[#9a9aa3] transition-colors hover:text-[#e6e6ea]"
          aria-label={playing ? "pause" : "play"}
        >
          {playing ? "PAUSE" : atEnd ? "REPLAY" : "PLAY"}
        </button>

        <input
          type="range"
          min={MIN_TIME_INDEX}
          max={LATEST_INDEX}
          step={1}
          value={value}
          onChange={(e) => onChange(quantizeIndex(Number(e.target.value)))}
          className="night-range w-full"
          aria-label="scrub through time"
        />

        <div className="w-32 shrink-0 text-right">
          <span className="font-mono text-[11px] tabular-nums text-[#e6e6ea]">
            {fmtDateYear(DATES[Math.min(Math.max(value, 0), LATEST_INDEX)])}
          </span>
          <div className="h-3 font-mono text-[9px] tracking-[0.14em] text-[#55555e]">
            {computing ? "replaying…" : value >= LATEST_INDEX ? "last night" : " "}
          </div>
        </div>
      </div>

      <style>{`
        .night-range {
          appearance: none;
          -webkit-appearance: none;
          height: 18px;
          background: transparent;
          cursor: pointer;
        }
        .night-range::-webkit-slider-runnable-track {
          height: 2px;
          background: #232329;
        }
        .night-range::-moz-range-track {
          height: 2px;
          background: #232329;
        }
        .night-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          margin-top: -5px;
          width: 4px;
          height: 12px;
          border-radius: 1px;
          background: #ffb224;
          border: none;
        }
        .night-range::-moz-range-thumb {
          width: 4px;
          height: 12px;
          border-radius: 1px;
          background: #ffb224;
          border: none;
        }
      `}</style>
    </div>
  );
}
