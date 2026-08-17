"use client";

/**
 * The breaker, summonable as weather. A low dark front sweeps across the
 * terrain left to right over six seconds; the surface craters beneath it
 * (Terrain handles the morph — this component is the sky). Amber lightning
 * flickers inside the front while it moves.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SPAN, STORM_SWEEP_SECONDS } from "@/lib/explore/projection";

export interface StormProps {
  active?: boolean;
}

interface CloudSpec {
  z: number;
  y: number;
  scale: number;
  drift: number;
  phase: number;
}

/** Deterministic pseudo-noise for the flicker — visual only. */
function flickerHash(t: number): number {
  const x = Math.sin(t * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function Storm({ active = false }: StormProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const front = useRef(0);

  const clouds = useMemo<CloudSpec[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        z: -SPAN + ((i + 0.5) / 7) * 2 * SPAN + (i % 2 === 0 ? 0.8 : -0.6),
        y: 7.6 + (i % 3) * 0.9,
        scale: 0.85 + (i % 4) * 0.18,
        drift: 0.85 + (i % 3) * 0.12,
        phase: i * 1.31,
      })),
    [],
  );

  const cloudGeometry = useMemo(() => new THREE.PlaneGeometry(11, 5.5), []);
  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#050507"),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(
    () => () => {
      cloudGeometry.dispose();
      cloudMaterial.dispose();
    },
    [cloudGeometry, cloudMaterial],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = active ? 1 : 0;
    if (front.current !== target) {
      const step = dt / STORM_SWEEP_SECONDS;
      front.current =
        front.current < target
          ? Math.min(target, front.current + step)
          : Math.max(target, front.current - step);
    }
    const f = front.current;
    const g = groupRef.current;
    if (!g) return;
    g.visible = f > 0.004;
    if (!g.visible) return;

    // The front's world x, same margins as the terrain's morph.
    const frontX = -SPAN - 3 + f * (2 * SPAN + 6);
    const t = clock.elapsedTime;

    g.children.forEach((child, i) => {
      if (child.type !== "Mesh") return;
      const spec = clouds[i];
      if (!spec) return;
      // Clouds trail a little behind the front, breathing sideways.
      child.position.x = frontX - 2.2 - (i % 3) * 1.4 + Math.sin(t * 0.5 + spec.phase) * 0.5;
      child.position.y = spec.y + Math.sin(t * 0.35 + spec.phase * 2) * 0.25;
      child.position.z = spec.z;
      child.rotation.x = -Math.PI / 2 + Math.sin(t * 0.2 + spec.phase) * 0.06;
      child.scale.setScalar(spec.scale * (1 + 0.05 * Math.sin(t * 0.7 + spec.phase)));
    });

    // Cloud opacity ramps with the sweep so arrival and dissipation read.
    cloudMaterial.opacity = 0.5 * Math.min(f / 0.12, 1) * (active ? 1 : Math.min(f * 1.4, 1));

    // Lightning: brief amber pulses inside the moving front, only mid-sweep.
    if (lightRef.current) {
      const sweeping = active && f > 0.06 && f < 0.98;
      const gate = flickerHash(Math.floor(t * 6.5));
      const within = t * 6.5 - Math.floor(t * 6.5);
      const flash = sweeping && gate > 0.72 && within < 0.35 ? (0.35 - within) / 0.35 : 0;
      lightRef.current.intensity = flash * 26;
      lightRef.current.position.set(frontX - 1.5, 6.2, Math.sin(t * 1.3) * 6);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {clouds.map((c, i) => (
        <mesh
          key={i}
          geometry={cloudGeometry}
          material={cloudMaterial}
          position={[0, c.y, c.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
      <pointLight ref={lightRef} color="#ffb224" intensity={0} distance={26} decay={1.6} />
    </group>
  );
}
