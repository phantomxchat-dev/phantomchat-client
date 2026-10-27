import React, { useEffect, useRef } from "react";
import * as THREE from "three";

declare global {
  interface Window {
    triggerParticleRipple?: (e?: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent | any) => void;
  }
}

/* ------------------------------------------------------------------ */
/* Design: restrained, premium 3D particle/mesh backdrop              */
/* ------------------------------------------------------------------ */
/* Particles are distributed through a true 3D depth field (not a flat  */
/* plane) and continuously drift in X/Y/Z with gentle depth oscillation, */
/* creating a perceptible sense of depth and motion on desktop and      */
/* mobile. Colors stay in PhantomChat's cyan/teal identity, low-contrast */
/* so they never compete with text, cards, or chat.                     */
/* ------------------------------------------------------------------ */

const POINT_COLOR = new THREE.Color(0x00b4d4); // bright cyan/teal
const LINE_COLOR = new THREE.Color(0x006b80);  // deeper teal for faint mesh
const BASE_OPACITY_POINTS = 0.95;              // clearly discernible dots
const BASE_OPACITY_LINES = 0.35;               // visible connected texture

type ParticleRole = "desktop" | "tablet" | "mobile";

function getRole(): ParticleRole {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function isLowPower(): boolean {
  try {
    const hc = (navigator as any).hardwareConcurrency;
    const mem = (navigator as any).deviceMemory;
    if (typeof hc === "number" && hc <= 4) return true;
    if (typeof mem === "number" && mem <= 4) return true;
  } catch {}
  return false;
}

function particleBudget(role: ParticleRole): number {
  const base = { desktop: 12000, tablet: 4500, mobile: 2200 }[role];
  return isLowPower() ? Math.round(base * 0.5) : base;
}

function dprCap(role: ParticleRole): number {
  if (isLowPower() || role === "mobile") return 1;
  return 1.5;
}

export const ParticleBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const role = getRole();
    const numParticles = particleBudget(role);
    const ratio = Math.min(window.devicePixelRatio || 1, dprCap(role));
    const boxSize = role === "desktop" ? 180 : role === "tablet" ? 160 : 120;
    const halfBox = boxSize / 2;

    console.log(
      `[ParticleBackground] Mounting WebGL canvas role=${role} particles=${numParticles} boxSize=${boxSize} dprCap=${ratio} reducedMotion=${prefersReduced}`
    );

    let renderer: THREE.WebGLRenderer | null = null;
    let points: THREE.Points | null = null;
    let lines: THREE.LineSegments | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.Camera | null = null;
    let pointMat: THREE.ShaderMaterial | null = null;
    let lineMat: THREE.ShaderMaterial | null = null;
    let animFrameId = -1;
    let visibilityPaused = false;
    let frameCount = 0;
    const startTime = performance.now();

    try {
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        0.1,
        400
      );
      camera.position.set(0, 0, 110);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: false,
      });
      const gl = renderer.getContext();
      if (gl) {
        console.log(
          `[ParticleBackground] WebGL context OK: ${gl.getParameter(gl.VERSION)}`
        );
      }
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(ratio);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      /* ------------------------------------------------------------------ */
      /* 3D particle positions: distributed through a depth volume          */
      /* ------------------------------------------------------------------ */
      const positions = new Float32Array(numParticles * 3);
      for (let i = 0; i < numParticles; i++) {
        positions[i * 3] = (Math.random() - 0.5) * boxSize; // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * (boxSize * 0.5); // y
        positions[i * 3 + 2] = (Math.random() - 0.5) * boxSize; // z (depth)
      }

      /* ------------------------------------------------------------------ */
      /* Faint connected mesh via a uniform spatial grid (O(n)).              */
      /* Each particle connects only to a few nearby neighbours. No all-to-all */
      /* O(n²) line generation.                                               */
      /* ------------------------------------------------------------------ */
      const connectRadius = boxSize * 0.18;
      const cellSize = connectRadius;
      const cellOf = (v: number) => Math.floor(v / cellSize);
      const grid = new Map<string, number[]>();
      for (let i = 0; i < numParticles; i++) {
        const key = `${cellOf(positions[i * 3])},${cellOf(positions[i * 3 + 1])},${cellOf(positions[i * 3 + 2])}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      }

      const maxConnectionsPerParticle = 3;
      const maxEdges = numParticles * maxConnectionsPerParticle;
      const edgeIndices: number[] = [];
      const radiusSq = connectRadius * connectRadius;
      const offsets = [-1, 0, 1];

      for (let i = 0; i < numParticles && edgeIndices.length < maxEdges * 2; i++) {
        const cx = cellOf(positions[i * 3]);
        const cy = cellOf(positions[i * 3 + 1]);
        const cz = cellOf(positions[i * 3 + 2]);
        const xi = positions[i * 3];
        const yi = positions[i * 3 + 1];
        const zi = positions[i * 3 + 2];

        const candidates: { j: number; d: number }[] = [];
        for (const ox of offsets) {
          for (const oy of offsets) {
            for (const oz of offsets) {
              const bucket = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                const dx = positions[j * 3] - xi;
                const dy = positions[j * 3 + 1] - yi;
                const dz = positions[j * 3 + 2] - zi;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < radiusSq) candidates.push({ j, d });
              }
            }
          }
        }
        candidates.sort((a, b) => a.d - b.d);
        for (
          let k = 0;
          k < Math.min(candidates.length, maxConnectionsPerParticle) &&
          edgeIndices.length < maxEdges * 2;
          k++
        ) {
          edgeIndices.push(i, candidates[k].j);
        }
      }

      const linePositions = new Float32Array(edgeIndices.length * 3);
      for (let e = 0; e < edgeIndices.length / 2; e++) {
        const a = edgeIndices[e * 2];
        const b = edgeIndices[e * 2 + 1];
        linePositions[e * 6] = positions[a * 3];
        linePositions[e * 6 + 1] = positions[a * 3 + 1];
        linePositions[e * 6 + 2] = positions[a * 3 + 2];
        linePositions[e * 6 + 3] = positions[b * 3];
        linePositions[e * 6 + 4] = positions[b * 3 + 1];
        linePositions[e * 6 + 5] = positions[b * 3 + 2];
      }

      /* ---------------------------------------------------------------- */
      /* Points: visible cyan dots drifting through 3D depth              */
      /* ---------------------------------------------------------------- */
      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      pointGeo.setAttribute("originalZ", new THREE.BufferAttribute(positions.slice(), 3));
      pointMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uReduceMotion: { value: prefersReduced ? 1 : 0 },
          uBoxSize: { value: boxSize },
          uColor: { value: POINT_COLOR },
          uOpacity: { value: BASE_OPACITY_POINTS },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uReduceMotion;
          uniform float uBoxSize;
          uniform vec3 uColor;
          uniform float uOpacity;
          attribute float originalZ;
          varying float vAlpha;
          varying float vDepth;
          void main() {
            vec3 pos = position;
            float drift = uReduceMotion > 0.5 ? 0.0 :
              // Faster, clearly perceptible continuous drift in X and Y
              (sin(pos.x * 0.04 + uTime * 0.14) * 0.7 +
               cos(pos.z * 0.05 + uTime * 0.10) * 0.6 +
               sin(pos.y * 0.04 + uTime * 0.18) * 0.5);
            pos.x += drift * 0.7;
            pos.y += drift;

            // Faster depth oscillation: particles pulse toward/away from camera
            float depthPulse = sin(pos.x * 0.03 + uTime * 0.10 + pos.z * 0.03) * 8.0 +
                               cos(pos.y * 0.03 + uTime * 0.08) * 7.0;
            pos.z += depthPulse;

            // Wrap Z within the depth box so the field never depletes
            float halfZ = uBoxSize * 0.5;
            if (pos.z > halfZ) pos.z -= uBoxSize;
            if (pos.z < -halfZ) pos.z += uBoxSize;

            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mv;

            // Size scales with depth (farther = smaller), never sub-pixel
            float depthSize = 180.0 / -mv.z;
            gl_PointSize = max(3.0, depthSize) * (1.0 + 0.25 * sin(uTime * 0.6 + pos.x * 0.15));

            vAlpha = 0.85 + 0.15 * sin(uTime * 0.4 + position.x * 0.05 + position.z * 0.05);
            vDepth = -mv.z;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          varying float vDepth;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            float a = smoothstep(0.55, 0.0, d);
            if (a < 0.02) discard;
            // Slightly brighter for nearer particles
            float depthBoost = 1.0 + smoothstep(120.0, 60.0, vDepth) * 0.3;
            a *= uOpacity * vAlpha * depthBoost;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        depthWrite: false,
      });
      points = new THREE.Points(pointGeo, pointMat);
      scene.add(points);

      /* ---------------------------------------------------------------- */
      /* Lines: faint connected-mesh, animated with the same drift         */
      /* ---------------------------------------------------------------- */
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      lineGeo.setAttribute("originalZ", new THREE.BufferAttribute(linePositions.slice(), 3));
      lineMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uReduceMotion: { value: prefersReduced ? 1 : 0 },
          uBoxSize: { value: boxSize },
          uColor: { value: LINE_COLOR },
          uOpacity: { value: BASE_OPACITY_LINES },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uReduceMotion;
          uniform float uBoxSize;
          attribute float originalZ;
          void main() {
            vec3 pos = position;
            float drift = uReduceMotion > 0.5 ? 0.0 :
              (sin(pos.x * 0.04 + uTime * 0.14) * 0.7 +
               cos(pos.z * 0.05 + uTime * 0.10) * 0.6 +
               sin(pos.y * 0.04 + uTime * 0.18) * 0.5);
            pos.x += drift * 0.4;
            pos.y += drift;

            float depthPulse = sin(pos.x * 0.03 + uTime * 0.10 + pos.z * 0.03) * 8.0 +
                               cos(pos.y * 0.03 + uTime * 0.08) * 7.0;
            pos.z += depthPulse;

            float halfZ = uBoxSize * 0.5;
            if (pos.z > halfZ) pos.z -= uBoxSize;
            if (pos.z < -halfZ) pos.z += uBoxSize;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            gl_FragColor = vec4(uColor, uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
      });
      lines = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lines);

      /* ---------------------------------------------------------------- */
      /* Kept for compatibility: subtle ripple on message send, etc.      */
      /* ---------------------------------------------------------------- */
      window.triggerParticleRipple = () => {
        const start = performance.now();
        const duration = 700;
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / duration);
          if (t < 1) {
            const lift = Math.sin(t * Math.PI);
            if (pointMat) (pointMat.uniforms as any).uOpacity.value = BASE_OPACITY_POINTS + 0.1 * lift;
            if (lineMat) (lineMat.uniforms as any).uOpacity.value = BASE_OPACITY_LINES * (1 - 0.5 * lift);
            requestAnimationFrame(tick);
          } else {
            if (pointMat) (pointMat.uniforms as any).uOpacity.value = BASE_OPACITY_POINTS;
            if (lineMat) (lineMat.uniforms as any).uOpacity.value = BASE_OPACITY_LINES;
          }
        };
        requestAnimationFrame(tick);
      };

      /* ---------------------------------------------------------------- */
      /* Render loop: pauses when the page is hidden                       */
      /* ---------------------------------------------------------------- */
      const animate = () => {
        if (!visibilityPaused) {
          const elapsed = (performance.now() - startTime) / 1000;
          if (pointMat) (pointMat.uniforms as any).uTime.value = elapsed;
          if (lineMat) (lineMat.uniforms as any).uTime.value = elapsed;
          if (renderer && scene && camera) renderer.render(scene, camera);
          frameCount++;
          if (frameCount % 180 === 0) {
            console.log(`[ParticleBackground] Rendered ${frameCount} frames`);
          }
        }
        animFrameId = requestAnimationFrame(animate);
      };
      animFrameId = requestAnimationFrame(animate);

      const handleResize = () => {
        if (!renderer || !camera) return;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap(role)));
      };
      window.addEventListener("resize", handleResize);

      const onVisibilityChange = () => {
        visibilityPaused = document.hidden;
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      return () => {
        visibilityPaused = true;
        cancelAnimationFrame(animFrameId);
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.triggerParticleRipple = undefined;
        if (renderer && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        if (renderer) renderer.dispose();
        if (points) {
          points.geometry.dispose();
          if (Array.isArray(points.material)) points.material.forEach((material) => material.dispose());
          else points.material.dispose();
        }
        if (lines) {
          lines.geometry.dispose();
          if (Array.isArray(lines.material)) lines.material.forEach((material) => material.dispose());
          else lines.material.dispose();
        }
      };
    } catch (err) {
      console.warn("[ParticleBackground] WebGL initialization skipped or unsupported:", err);
      if (renderer) {
        try {
          if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
          renderer.dispose();
        } catch {}
      }
      return () => {
        window.triggerParticleRipple = undefined;
      };
    }
  }, []);

  return (
    <div
      ref={containerRef}
      id="wave-particle-canvas-container"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none select-none overflow-hidden"
    />
  );
};
