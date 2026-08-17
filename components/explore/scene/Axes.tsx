"use client";

/**
 * The scene's measuring instruments. Three pieces:
 *
 *  · ground rulers — tick stubs at every backtest cell, labeled at round
 *    values, along the two parameter axes; faint gridlines cross the
 *    waterline at the labeled positions (where the terrain is under water
 *    the grid shows through — it draws itself over the loss basins);
 *  · the return post — a vertical ladder at the far corner giving height
 *    its missing scale. Tick spacing is fixed (5%, labeled every 10%) so
 *    height never changes meaning as the scrubber moves; only the post's
 *    drawn extent adapts to the current surface. A hairline welds its 0%
 *    to the waterline frame: break-even as a place, not a value;
 *  · annotations — leaders naming the best and worst settings on the
 *    current surface.
 *
 * Rulers and post live on whichever edges face the camera, swapped by a
 * quadrant watcher with hysteresis so flat titles never read mirrored.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { SURFACE_AXES } from "@/lib/agents/backtester";
import { STRATEGY } from "@/lib/agents/coder";
import type { Surface } from "@/lib/agents/types";
import { INK3D } from "@/lib/explore/ink";
import {
  AXIS_OFFSET,
  HEIGHT_SCALE,
  HOLDING_TICKS,
  RETURN_LABEL_STEP,
  RETURN_TICK_STEP,
  SPAN,
  THRESHOLD_TICKS,
  paramToWorld,
} from "@/lib/explore/projection";
import { fmtPct, fmtPctAbs } from "@/lib/format";
import { SceneText } from "./SceneText";

/** Which terrain sides face the camera. Hysteresis: a side flips only when
 *  the camera is clearly across the boundary, so titles can't thrash. */
function useNearSides(): { sx: 1 | -1; sz: 1 | -1 } {
  const [sides, setSides] = useState<{ sx: 1 | -1; sz: 1 | -1 }>({ sx: 1, sz: 1 });
  useFrame(({ camera }) => {
    const { x, z } = camera.position;
    setSides((s) => {
      const sx = x > 1.2 ? 1 : x < -1.2 ? -1 : s.sx;
      const sz = z > 1.2 ? 1 : z < -1.2 ? -1 : s.sz;
      return sx === s.sx && sz === s.sz ? s : { sx, sz };
    });
  });
  return sides;
}

/** One lineSegments draw from a flat [x0,y0,z0, x1,y1,z1, …] array. */
export function Segs({ pts, color, opacity }: { pts: number[]; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [pts]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        fog={false}
      />
    </lineSegments>
  );
}

const xOf = (t: number) => paramToWorld(t, 1)[0];
const zOf = (h: number) => paramToWorld(0.01, h)[1];

/** Waterline gridlines at the labeled positions. Static — one draw call. */
function StaticGrid() {
  const pts = useMemo(() => {
    const p: number[] = [];
    for (const t of THRESHOLD_TICKS) p.push(xOf(t), 0.002, -SPAN, xOf(t), 0.002, SPAN);
    for (const h of HOLDING_TICKS) p.push(-SPAN, 0.002, zOf(h), SPAN, 0.002, zOf(h));
    return p;
  }, []);
  return <Segs pts={pts} color={INK3D.rule} opacity={0.35} />;
}

function GroundRulers({ sx, sz }: { sx: 1 | -1; sz: 1 | -1 }) {
  const ze = sz * SPAN;
  const xe = sx * SPAN;

  const pts = useMemo(() => {
    const p: number[] = [];
    // Minor stubs at every real backtest cell — the perimeter as a ruler.
    for (const t of SURFACE_AXES.thresholds) {
      p.push(xOf(t), 0, ze + sz * 0.15, xOf(t), 0, ze + sz * 0.45);
    }
    for (const h of SURFACE_AXES.holdings) {
      p.push(xe + sx * 0.15, 0, zOf(h), xe + sx * 0.45, 0, zOf(h));
    }
    // Longer ticks where a value is printed.
    for (const t of THRESHOLD_TICKS) p.push(xOf(t), 0, ze + sz * 0.15, xOf(t), 0, ze + sz * 0.75);
    for (const h of HOLDING_TICKS) p.push(xe + sx * 0.15, 0, zOf(h), xe + sx * 0.75, 0, zOf(h));
    return p;
  }, [sx, sz, xe, ze]);

  return (
    <group>
      <Segs pts={pts} color={INK3D.faint} opacity={0.55} />

      {THRESHOLD_TICKS.map((t) => (
        <SceneText key={`tx${t}`} billboard position={[xOf(t), 0.06, ze + sz * 1.15]}>
          {fmtPctAbs(t, 0)}
        </SceneText>
      ))}
      {HOLDING_TICKS.map((h) => (
        <SceneText key={`th${h}`} billboard position={[xe + sx * 1.15, 0.06, zOf(h)]}>
          {`${h}d`}
        </SceneText>
      ))}

      {/* Titles lie flat along their own axis — the direction is the label.
          They ride the near edge so they never read mirrored. */}
      <SceneText
        variant="title"
        position={[0, 0.02, ze + sz * 2.0]}
        rotation={[-Math.PI / 2, 0, sz > 0 ? 0 : Math.PI]}
      >
        entry threshold
      </SceneText>
      <SceneText
        variant="title"
        position={[xe + sx * 2.0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2]}
      >
        holding period
      </SceneText>
    </group>
  );
}

function ReturnPost({ sx, sz, surface }: { sx: 1 | -1; sz: 1 | -1; surface: Surface }) {
  // The ladder lives at the FAR corner: always inside the default framing,
  // scaled down by distance instead of looming over the near edge. ox/oz
  // point outboard (away from the terrain) at that corner.
  const ox = -sx;
  const oz = -sz;
  const cx = ox * (SPAN + AXIS_OFFSET);
  const cz = oz * (SPAN + AXIS_OFFSET);

  // Drawn extent hugs the current surface, rounded out to the tick grid,
  // always spanning zero. Tick *spacing* never adapts.
  const { lo, hi } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of surface.cells) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return {
      lo: Math.min(0, Math.floor(min / RETURN_TICK_STEP) * RETURN_TICK_STEP),
      hi: Math.max(RETURN_TICK_STEP, Math.ceil(max / RETURN_TICK_STEP) * RETURN_TICK_STEP),
    };
  }, [surface]);

  const { pts, labels } = useMemo(() => {
    const p: number[] = [
      // the post itself
      cx, lo * HEIGHT_SCALE, cz, cx, hi * HEIGHT_SCALE, cz,
      // break-even: weld the post's zero to the waterline frame corner
      cx, 0, cz, -sx * SPAN, 0, -sz * SPAN,
    ];
    const out: Array<{ r: number; major: boolean }> = [];
    const n0 = Math.round(lo / RETURN_TICK_STEP);
    const n1 = Math.round(hi / RETURN_TICK_STEP);
    for (let n = n0; n <= n1; n++) {
      const r = n * RETURN_TICK_STEP;
      const y = r * HEIGHT_SCALE;
      const major = Math.abs(r % RETURN_LABEL_STEP) < 1e-9;
      const len = major ? 0.3 : 0.16;
      // tick nubs point inboard, toward the terrain
      p.push(cx, y, cz, cx - ox * len, y, cz - oz * len);
      if (major) out.push({ r, major });
    }
    return { pts: p, labels: out };
  }, [cx, cz, ox, oz, sx, sz, lo, hi]);

  return (
    <group>
      <Segs pts={pts} color={INK3D.faint} opacity={0.8} />
      {labels.map(({ r }) =>
        r === 0 ? (
          <SceneText
            key="r0"
            billboard
            variant="accent"
            depthTest={false}
            position={[cx + ox * 0.55, 0, cz + oz * 0.55]}
          >
            0% · break even
          </SceneText>
        ) : (
          <SceneText
            key={`r${r}`}
            billboard
            depthTest={false}
            position={[cx + ox * 0.55, r * HEIGHT_SCALE, cz + oz * 0.55]}
          >
            {fmtPct(r, 0)}
          </SceneText>
        ),
      )}
      <SceneText variant="title" billboard position={[cx, hi * HEIGHT_SCALE + 0.8, cz]}>
        realized return
      </SceneText>
    </group>
  );
}

/** Leaders naming the best and worst settings on the current surface. */
function Annotations({ surface }: { surface: Surface }) {
  const marks = useMemo(() => {
    let bi = 0;
    let bj = 0;
    let wi = 0;
    let wj = 0;
    for (let i = 0; i < surface.thresholds.length; i++) {
      for (let j = 0; j < surface.holdings.length; j++) {
        if (surface.cells[i][j] > surface.cells[bi][bj]) {
          bi = i;
          bj = j;
        }
        if (surface.cells[i][j] < surface.cells[wi][wj]) {
          wi = i;
          wj = j;
        }
      }
    }
    const mk = (i: number, j: number, kind: "best" | "worst") => {
      const t = surface.thresholds[i];
      const h = surface.holdings[j];
      const [x, z] = paramToWorld(t, h);
      const v = surface.cells[i][j];
      return { x, z, v, kind, text: `${kind} · ${fmtPctAbs(t, 1)} × ${h}d · ${fmtPct(v)}` };
    };
    const best = mk(bi, bj, "best");
    const worst = mk(wi, wj, "worst");
    // The shipped strategy has its own flag — if the peak sits on it, one
    // marker is enough.
    const [mx, mz] = paramToWorld(STRATEGY.entry.minGap, STRATEGY.exit.holdingDays);
    const nearFlag = Math.hypot(best.x - mx, best.z - mz) < 1.4;
    return nearFlag ? [worst] : [best, worst];
  }, [surface]);

  const pts = useMemo(() => {
    const p: number[] = [];
    for (const m of marks) {
      const yTop = m.kind === "best" ? m.v * HEIGHT_SCALE + 1.05 : 0.9;
      p.push(m.x, m.v * HEIGHT_SCALE + 0.12, m.z, m.x, yTop, m.z);
    }
    return p;
  }, [marks]);

  return (
    <group>
      <Segs pts={pts} color={INK3D.muted} opacity={0.5} />
      {marks.map((m) => (
        <SceneText
          key={m.kind}
          billboard
          variant="micro"
          position={[m.x, (m.kind === "best" ? m.v * HEIGHT_SCALE + 1.05 : 0.9) + 0.3, m.z]}
        >
          {m.text}
        </SceneText>
      ))}
    </group>
  );
}

export function Axes({ surface }: { surface: Surface }) {
  const { sx, sz } = useNearSides();
  return (
    <group>
      <StaticGrid />
      <GroundRulers sx={sx} sz={sz} />
      <ReturnPost sx={sx} sz={sz} surface={surface} />
      <Annotations surface={surface} />
    </group>
  );
}
