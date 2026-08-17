"use client";

/**
 * The critic follows the camera. Two regions of the terrain are flagged from
 * the journal; when the viewer's gaze (the screen-center ray) rests inside one
 * for most of a second, the whisper fades in at the bottom of the screen and
 * lingers a couple of seconds after they look away. The regions themselves are
 * outlined faintly on the ground — something to find, not a billboard.
 */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { runCritic } from "@/lib/agents/critic";
import type { Surface } from "@/lib/agents/types";
import { paramToWorld, sampleSurface, HEIGHT_SCALE, T_MIN, T_MAX, H_MIN, H_MAX } from "@/lib/explore/projection";

export interface CriticGhostProps {
  /** Active landscape, used only to float the outlines above the ground. */
  surface?: Surface | null;
}

interface Region {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  whisper: string;
  y: number;
}

const DWELL_SECONDS = 0.8;
const LINGER_SECONDS = 2.2;

export function CriticGhost({ surface }: CriticGhostProps) {
  const [whisper, setWhisper] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const dwell = useRef(0);
  const linger = useRef(0);
  const insideRegion = useRef<Region | null>(null);

  const regions = useMemo<Region[]>(() => {
    const out: Region[] = [];
    for (const r of runCritic().flaggedRegions) {
      const [x0, z0] = paramToWorld(r.minGap[0], r.holdingDays[0]);
      const [x1, z1] = paramToWorld(r.minGap[1], r.holdingDays[1]);
      let y = 0.6;
      if (surface) {
        let maxV = -Infinity;
        for (let a = 0; a <= 4; a++) {
          for (let b = 0; b <= 4; b++) {
            const u =
              ((r.minGap[0] + (a / 4) * (r.minGap[1] - r.minGap[0])) - T_MIN) / (T_MAX - T_MIN);
            const v =
              ((r.holdingDays[0] + (b / 4) * (r.holdingDays[1] - r.holdingDays[0])) - H_MIN) /
              (H_MAX - H_MIN);
            maxV = Math.max(maxV, sampleSurface(surface, u, v));
          }
        }
        y = maxV * HEIGHT_SCALE + 0.25;
      }
      out.push({ x0, x1, z0, z1, whisper: r.whisper, y });
    }
    return out;
  }, [surface]);

  const origin = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // Gaze point: the screen-center ray dropped onto the waterline plane.
    camera.getWorldPosition(origin.current);
    camera.getWorldDirection(direction.current);
    let inside: Region | null = null;
    if (direction.current.y < -0.05) {
      const t = -origin.current.y / direction.current.y;
      const gx = origin.current.x + direction.current.x * t;
      const gz = origin.current.z + direction.current.z * t;
      for (const r of regions) {
        if (
          gx >= Math.min(r.x0, r.x1) &&
          gx <= Math.max(r.x0, r.x1) &&
          gz >= Math.min(r.z0, r.z1) &&
          gz <= Math.max(r.z0, r.z1)
        ) {
          inside = r;
          break;
        }
      }
    }

    if (inside) {
      if (insideRegion.current !== inside) {
        insideRegion.current = inside;
        dwell.current = 0;
      }
      dwell.current += dt;
      linger.current = LINGER_SECONDS;
      if (dwell.current >= DWELL_SECONDS && (!visible || whisper !== inside.whisper)) {
        setWhisper(inside.whisper);
        setVisible(true);
      }
    } else {
      insideRegion.current = null;
      dwell.current = 0;
      if (visible) {
        linger.current -= dt;
        if (linger.current <= 0) setVisible(false);
      }
    }
  });

  return (
    <group>
      {regions.map((r, i) => (
        <Line
          key={i}
          points={[
            [r.x0, r.y, r.z0],
            [r.x1, r.y, r.z0],
            [r.x1, r.y, r.z1],
            [r.x0, r.y, r.z1],
            [r.x0, r.y, r.z0],
          ]}
          color="#9a9aa3"
          lineWidth={1}
          dashed
          dashSize={0.28}
          gapSize={0.2}
          transparent
          opacity={0.16}
        />
      ))}

      <Html fullscreen zIndexRange={[45, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            bottom: 104,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: visible ? 1 : 0,
            transition: "opacity 900ms ease",
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center", padding: "0 24px" }}>
            <div
              style={{
                fontStyle: "italic",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#9a9aa3",
              }}
            >
              {whisper}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#ffb224",
                opacity: 0.85,
              }}
            >
              — the critic
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
