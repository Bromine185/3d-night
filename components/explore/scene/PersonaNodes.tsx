"use client";

/**
 * The fifty, floating over the terrain as a weather layer of opinion.
 * Position is the view itself: bearish drifts left, bullish right, conviction
 * lifts. Clusters form and dissolve as the signals move — with the scrubber,
 * visibly. Each node can drag a comet tail of its last forty sessions: the
 * trend context, made spatial.
 */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PERSONAS, personaSignal, personaView } from "@/lib/agents/personas";
import { LATEST_INDEX } from "@/lib/fixtures";
import { familyIndexOf, personaToWorld, withinFamilyOf } from "@/lib/explore/projection";

type Persona = (typeof PERSONAS)[number];

const MUTED = new THREE.Color("#9a9aa3");
const ACCENT = new THREE.Color("#ffb224");
const BG = new THREE.Color("#0a0a0c");

export interface PersonaNodesProps {
  /** Session the layer reads — the scrubber moves it. */
  timeIndex?: number;
  /** Render the forty-session comet tails. */
  showTrails?: boolean;
}

function targetOf(p: Persona, idx: number): [number, number, number] {
  const s = personaSignal(p, idx);
  return personaToWorld(s, familyIndexOf(p.id), withinFamilyOf(p.id), Math.abs(s));
}

export function PersonaNodes({ timeIndex = LATEST_INDEX, showTrails = false }: PersonaNodesProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const meshRefs = useRef<Array<THREE.Mesh | null>>(new Array(PERSONAS.length).fill(null));
  const lerped = useRef<Float32Array | null>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.14, 16, 16), []);
  const materials = useMemo(
    () =>
      PERSONAS.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: MUTED.clone(),
            emissive: new THREE.Color("#000000"),
            roughness: 0.6,
          }),
      ),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
    [geometry, materials],
  );

  const signals = useMemo(() => PERSONAS.map((p) => personaSignal(p, timeIndex)), [timeIndex]);
  const targets = useMemo(() => {
    const arr = new Float32Array(PERSONAS.length * 3);
    for (const p of PERSONAS) {
      const [x, y, z] = targetOf(p, timeIndex);
      arr[p.id * 3] = x;
      arr[p.id * 3 + 1] = y;
      arr[p.id * 3 + 2] = z;
    }
    return arr;
  }, [timeIndex]);

  // Strong views glow; the rest stay monochrome. Snap on time change is fine —
  // the motion carries the transition.
  useEffect(() => {
    for (const p of PERSONAS) {
      const s = signals[p.id];
      const strong = Math.abs(s) > 0.5;
      const m = materials[p.id];
      if (strong) {
        m.color.copy(MUTED).lerp(ACCENT, 0.55);
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 0.18 + Math.abs(s) * 0.45;
      } else {
        m.color.copy(MUTED);
        m.emissiveIntensity = 0;
      }
    }
  }, [signals, materials]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!lerped.current) lerped.current = targets.slice();
    const cur = lerped.current;
    const k = 1 - Math.exp(-dt * 4);
    const t = clock.elapsedTime;
    for (let i = 0; i < PERSONAS.length; i++) {
      cur[i * 3] += (targets[i * 3] - cur[i * 3]) * k;
      cur[i * 3 + 1] += (targets[i * 3 + 1] - cur[i * 3 + 1]) * k;
      cur[i * 3 + 2] += (targets[i * 3 + 2] - cur[i * 3 + 2]) * k;
      const mesh = meshRefs.current[i];
      if (mesh) {
        mesh.position.set(
          cur[i * 3],
          cur[i * 3 + 1] + Math.sin(t * 0.6 + i * 1.7) * 0.1,
          cur[i * 3 + 2],
        );
        const targetScale = hoveredId === i ? 1.65 : 1;
        const s = mesh.scale.x + (targetScale - mesh.scale.x) * Math.min(1, dt * 8);
        mesh.scale.setScalar(s);
      }
    }
  });

  const hoveredValue = useMemo(
    () => (hoveredId === null ? null : personaView(PERSONAS[hoveredId], timeIndex)),
    [hoveredId, timeIndex],
  );

  return (
    <group>
      {PERSONAS.map((p) => (
        <mesh
          key={p.id}
          ref={(m) => {
            meshRefs.current[p.id] = m;
          }}
          geometry={geometry}
          material={materials[p.id]}
          position={[targets[p.id * 3], targets[p.id * 3 + 1], targets[p.id * 3 + 2]]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredId(p.id);
          }}
          onPointerOut={() => setHoveredId((h) => (h === p.id ? null : h))}
        />
      ))}

      {hoveredId !== null && hoveredValue && (
        <Html
          position={[
            targets[hoveredId * 3],
            targets[hoveredId * 3 + 1] + 0.55,
            targets[hoveredId * 3 + 2],
          ]}
          center
          distanceFactor={12}
          zIndexRange={[40, 0]}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1.5,
              width: 220,
              padding: "8px 10px",
              background: "rgba(16,16,20,0.92)",
              border: "1px solid #232329",
              color: "#e6e6ea",
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{hoveredValue.name}</span>
              <span style={{ color: "#ffb224" }}>
                {hoveredValue.direction > 0 ? "long" : hoveredValue.direction < 0 ? "short" : "flat"}{" "}
                {hoveredValue.asset}
              </span>
            </div>
            <div style={{ color: "#55555e" }}>
              {hoveredValue.family.replace("_", " ")} · conviction{" "}
              {hoveredValue.conviction.toFixed(2)}
            </div>
            <div style={{ color: "#9a9aa3", marginTop: 4 }}>{hoveredValue.rationale}</div>
          </div>
        </Html>
      )}

      {showTrails && <Trails timeIndex={timeIndex} />}
    </group>
  );
}

/** Forty sessions of where each reader stood — the trend behind tonight's dot. */
export function Trails({ timeIndex = LATEST_INDEX }: { timeIndex?: number }) {
  const trails = useMemo(() => {
    const back = 39;
    return PERSONAS.map((p) => {
      const points: [number, number, number][] = [];
      const colors: THREE.Color[] = [];
      const sNow = personaSignal(p, timeIndex);
      const headColor = MUTED.clone().lerp(ACCENT, Math.abs(sNow) > 0.5 ? 0.55 : 0.12);
      for (let t = Math.max(0, timeIndex - back); t <= timeIndex; t++) {
        const s = personaSignal(p, t);
        const [x, y, z] = personaToWorld(
          s,
          familyIndexOf(p.id),
          withinFamilyOf(p.id),
          Math.abs(s),
        );
        const age = (timeIndex - t) / back; // 0 = now, 1 = oldest
        points.push([x, y - age * 1.15, z]);
        colors.push(BG.clone().lerp(headColor, Math.pow(1 - age, 1.6)));
      }
      return { id: p.id, points, colors };
    });
  }, [timeIndex]);

  return (
    <group>
      {trails.map((tr) =>
        tr.points.length > 1 ? (
          <Line
            key={tr.id}
            points={tr.points}
            vertexColors={tr.colors}
            lineWidth={1}
            transparent
            opacity={0.8}
          />
        ) : null,
      )}
    </group>
  );
}
