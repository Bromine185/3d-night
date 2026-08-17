"use client";

/**
 * The terrain: the backtester's parameter grid as landscape. 21×21 cells are
 * bilinearly upsampled to an 85×85 mesh; contour lines come from a shader
 * patch on the standard material, so they ride the surface as it deforms.
 * Height changes never snap — a Float32Array of current heights eases toward
 * its target every frame, which is what makes the storm's craters and the
 * scrubber's growth legible as motion.
 */
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { STRATEGY } from "@/lib/agents/coder";
import type { Surface } from "@/lib/agents/types";
import {
  HEIGHT_SCALE,
  SPAN,
  STORM_SWEEP_SECONDS,
  paramToWorld,
  sampleSurface,
} from "@/lib/explore/projection";

const RES = 85; // vertices per side of the render mesh
const GHOST_RES = 21; // the ghost shows the raw grid — sparser, clearly a memory

export interface TerrainProps {
  /** The active landscape (base, or a moment in time from the scrubber). */
  surface: Surface;
  /** Morph target while the breaker sweeps. */
  stormSurface?: Surface | null;
  /** True while the storm is summoned; the front advances internally. */
  stormActive?: boolean;
  /** Pre-stress terrain kept visible as a wireframe memory. */
  ghostSurface?: Surface | null;
}

function heightsFrom(surface: Surface, res: number): Float32Array {
  const out = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const u = i / (res - 1);
      const v = j / (res - 1);
      out[j * res + i] = sampleSurface(surface, u, v) * HEIGHT_SCALE;
    }
  }
  return out;
}

function buildGridGeometry(res: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(res * res * 3);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const k = (j * res + i) * 3;
      positions[k] = -SPAN + (2 * SPAN * i) / (res - 1);
      positions[k + 1] = 0;
      positions[k + 2] = -SPAN + (2 * SPAN * j) / (res - 1);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i;
      const b = a + 1;
      const c = a + res;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Contour shader patch: iso-lines every 1.5% of return, zero line brighter,
 *  a barely-warm accent tint on profitable ground. */
function makeTerrainMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#101014"),
    roughness: 0.94,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vVal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvVal = transformed.y / ${HEIGHT_SCALE.toFixed(1)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vVal;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float w = fwidth(vVal) + 1e-6;
  float g = abs(fract(vVal / 0.015 + 0.5) - 0.5) * 0.015 / w;
  float contour = 1.0 - smoothstep(0.0, 1.1, g);
  float zero = 1.0 - smoothstep(0.0, 1.6, abs(vVal) / w);
  float profit = clamp(vVal / 0.12, 0.0, 1.0);
  vec3 shade = mix(diffuseColor.rgb, vec3(1.0, 0.698, 0.141), profit * 0.13);
  shade = mix(shade, vec3(0.333, 0.333, 0.369), contour * 0.5);
  shade = mix(shade, vec3(0.604, 0.604, 0.639), zero * 0.55);
  diffuseColor.rgb = shade;
}`,
      );
  };
  return mat;
}

export function Terrain({ surface, stormSurface, stormActive = false, ghostSurface }: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Group>(null);
  const ghostMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(() => buildGridGeometry(RES), []);
  const material = useMemo(() => makeTerrainMaterial(), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // Height state: rises from the flat on first load, eases everywhere after.
  const current = useRef<Float32Array>(new Float32Array(RES * RES));
  const settled = useRef(false);
  const front = useRef(0); // storm sweep, 0 → 1 across x

  const baseHeights = useMemo(() => heightsFrom(surface, RES), [surface]);
  const stormHeights = useMemo(
    () => (stormSurface ? heightsFrom(stormSurface, RES) : null),
    [stormSurface],
  );
  useEffect(() => {
    settled.current = false;
  }, [baseHeights, stormHeights]);

  const [markerX, markerZ] = useMemo(
    () => paramToWorld(STRATEGY.entry.minGap, STRATEGY.exit.holdingDays),
    [],
  );
  const markerI = Math.round(((markerX + SPAN) / (2 * SPAN)) * (RES - 1));
  const markerJ = Math.round(((markerZ + SPAN) / (2 * SPAN)) * (RES - 1));

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    // The breaker's front: advances while summoned, retreats when cleared.
    const frontTarget = stormActive ? 1 : 0;
    if (front.current !== frontTarget) {
      const step = dt / STORM_SWEEP_SECONDS;
      front.current =
        front.current < frontTarget
          ? Math.min(frontTarget, front.current + step)
          : Math.max(frontTarget, front.current - step);
      settled.current = false;
    }

    const mesh = meshRef.current;
    if (mesh && !settled.current) {
      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const cur = current.current;
      const ease = 1 - Math.exp(-dt * 3.2);
      // Front position in world x, with margin so 1.0 means fully swept.
      const frontX = -SPAN - 3 + front.current * (2 * SPAN + 6);
      let maxDelta = 0;
      for (let k = 0; k < cur.length; k++) {
        const x = arr[k * 3];
        let goal = baseHeights[k];
        if (stormHeights && front.current > 0) {
          const mix = smoothstep(0, 3.2, frontX - x);
          goal = goal * (1 - mix) + stormHeights[k] * mix;
        }
        const d = goal - cur[k];
        if (Math.abs(d) > maxDelta) maxDelta = Math.abs(d);
        cur[k] += d * ease;
        arr[k * 3 + 1] = cur[k];
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      if (maxDelta < 5e-4 && front.current === frontTarget) settled.current = true;
    }

    // The strategy's own flag rides the deforming surface.
    if (markerRef.current) {
      markerRef.current.position.y = current.current[markerJ * RES + markerI];
    }

    // Ghost fades in as a memory, out as the sky clears.
    if (ghostMatRef.current) {
      const target = ghostSurface ? 0.13 : 0;
      ghostMatRef.current.opacity += (target - ghostMatRef.current.opacity) * Math.min(1, dt * 2.5);
    }
  });

  // Ghost geometry: raw 21×21 grid of the remembered surface.
  const ghostGeometry = useMemo(() => {
    if (!ghostSurface) return null;
    const geo = buildGridGeometry(GHOST_RES);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const h = heightsFrom(ghostSurface, GHOST_RES);
    for (let k = 0; k < h.length; k++) arr[k * 3 + 1] = h[k];
    pos.needsUpdate = true;
    return geo;
  }, [ghostSurface]);
  useEffect(() => () => ghostGeometry?.dispose(), [ghostGeometry]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material} />

      {/* the waterline: everything below this plane loses money */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2 * SPAN + 0.8, 2 * SPAN + 0.8]} />
        <meshBasicMaterial
          color="#e6e6ea"
          transparent
          opacity={0.03}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* frame at the waterline */}
      <Line
        points={[
          [-SPAN, 0, -SPAN],
          [SPAN, 0, -SPAN],
          [SPAN, 0, SPAN],
          [-SPAN, 0, SPAN],
          [-SPAN, 0, -SPAN],
        ]}
        color="#55555e"
        lineWidth={1}
        transparent
        opacity={0.4}
      />

      {/* pre-stress ghost */}
      {ghostGeometry && (
        <mesh geometry={ghostGeometry}>
          <meshBasicMaterial
            ref={ghostMatRef}
            color="#e6e6ea"
            wireframe
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* the strategy's own coordinates */}
      <group ref={markerRef} position={[markerX, 0, markerZ]}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 1.5, 6]} />
          <meshBasicMaterial color="#ffb224" transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#ffb224" />
        </mesh>
        <Html position={[0, 1.78, 0]} center distanceFactor={16} zIndexRange={[30, 0]}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              whiteSpace: "nowrap",
              color: "#9a9aa3",
              pointerEvents: "none",
            }}
          >
            you are here · 5% × 5d
          </div>
        </Html>
      </group>

      {/* axis labels */}
      <Html position={[0, 0.1, SPAN + 1.6]} center distanceFactor={20} zIndexRange={[30, 0]}>
        <div style={axisLabelStyle}>entry threshold 1% → 15%</div>
      </Html>
      <Html position={[SPAN + 1.9, 0.1, 0]} center distanceFactor={20} zIndexRange={[30, 0]}>
        <div style={axisLabelStyle}>holding period 1 → 21d</div>
      </Html>
      <Html position={[-SPAN - 1.4, 1.6, -SPAN - 0.6]} center distanceFactor={20} zIndexRange={[30, 0]}>
        <div style={axisLabelStyle}>height = realized return · waterline = 0</div>
      </Html>
    </group>
  );
}

const axisLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  whiteSpace: "nowrap",
  color: "#55555e",
  pointerEvents: "none",
  userSelect: "none",
};
