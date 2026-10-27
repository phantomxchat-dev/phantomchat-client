import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface TextParticlesProps {
  text: string;
  color?: string;
}

/* ------------------------------------------------------------------ */
/* Landing hero text-to-particles effect                              */
/* ------------------------------------------------------------------ */
/* Renders the hero heading as Three.js particles that continuously   */
/* form from a scatter, hold the text shape, then dissolve again.     */
/* The HTML <h1> is always visible (accessibility fallback). The      */
/* canvas is aria-hidden and sits behind the heading.                 */
/* ------------------------------------------------------------------ */

export function TextParticles({ text, color = "#00b4d4" }: TextParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;
    let particles: THREE.Points | null = null;
    let animFrameId = -1;
    let width = 0;
    let height = 0;
    let startTime = 0;
    let removeResize: (() => void) | null = null;

    const tearDown = () => {
      if (removeResize) {
        removeResize();
        removeResize = null;
      }
      if (animFrameId !== -1) {
        cancelAnimationFrame(animFrameId);
        animFrameId = -1;
      }
      if (particles) {
        particles.geometry.dispose();
        if (Array.isArray(particles.material)) particles.material.forEach((material) => material.dispose());
        else particles.material.dispose();
        particles = null;
      }
      if (renderer) {
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
        renderer = null;
      }
      scene = null;
      camera = null;
    };

    const setUp = () => {
      tearDown();

      const w = container.clientWidth || 600;
      const h = container.clientHeight || 160;
      width = w;
      height = h;
      startTime = performance.now();

      try {
        scene = new THREE.Scene();

        camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, -1, 1000);
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        /* ---- Sample text pixels from an offscreen canvas ---- */
        const offscreen = document.createElement("canvas");
        const ctx = offscreen.getContext("2d");
        if (!ctx) throw new Error("No 2D context");

        const fontSize = Math.min(w / (text.length * 0.55), h * 0.85, 110);
        offscreen.width = w;
        offscreen.height = h;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, w / 2, h / 2);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const textPx: number[] = [];
        const step = Math.max(1, Math.floor(Math.sqrt(w * h / 2500)));
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const idx = (y * w + x) * 4;
            if (data[idx + 3] > 128) {
              textPx.push(x - w / 2, -(y - h / 2), 0);
            }
          }
        }

        const baseCount = textPx.length / 3 || w * h / 900;
        const particleCount = Math.min(Math.max(Math.floor(baseCount), 300), 3500);

        const positions = new Float32Array(particleCount * 3);
        const textPositions = new Float32Array(particleCount * 3);
        const seeds = new Float32Array(particleCount);

        if (textPx.length > 0) {
          for (let i = 0; i < particleCount; i++) {
            const src = Math.floor(Math.random() * (textPx.length / 3)) * 3;
            positions[i * 3] = textPx[src];
            positions[i * 3 + 1] = textPx[src + 1];
            positions[i * 3 + 2] = textPx[src + 2];
            textPositions[i * 3] = textPx[src];
            textPositions[i * 3 + 1] = textPx[src + 1];
            textPositions[i * 3 + 2] = textPx[src + 2];
            seeds[i] = Math.random();
          }
        } else {
          for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * w;
            positions[i * 3 + 1] = (Math.random() - 0.5) * h;
            positions[i * 3 + 2] = 0;
            textPositions[i * 3] = positions[i * 3];
            textPositions[i * 3 + 1] = positions[i * 3 + 1];
            textPositions[i * 3 + 2] = 0;
            seeds[i] = Math.random();
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("textPos", new THREE.BufferAttribute(textPositions, 3));
        geo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));

        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uReduceMotion: { value: prefersReduced ? 1 : 0 },
            uColor: { value: new THREE.Color(color) },
            uOpacity: { value: 0.92 },
          },
          vertexShader: `
            uniform float uTime;
            uniform float uReduceMotion;
            attribute vec3 textPos;
            attribute float seed;
            varying float vAlpha;
            void main() {
              vec3 pos = position;
              if (uReduceMotion < 0.5) {
                float cycle = mod(uTime * 0.22, 6.0);
                vec2 scatterDir = vec2(cos(seed * 6.28318), sin(seed * 6.28318));
                vec3 scattered = vec3(textPos.xy + scatterDir * 150.0, 0.0);

                if (cycle < 2.0) {
                  float t = cycle / 2.0;
                  pos = mix(textPos, scattered, t * t);
                  pos.z += sin(uTime * 4.0 + seed * 4.0) * 35.0;
                } else if (cycle < 4.0) {
                  pos = scattered;
                  pos.z += sin(uTime * 2.0 + seed * 3.0) * 25.0;
                  pos.xy += scatterDir * 0.4 * sin(uTime * 0.6 + seed);
                } else {
                  float t = (cycle - 4.0) / 2.0;
                  pos = mix(scattered, textPos, t * t);
                }
              }
              vec4 mv = modelViewMatrix * vec4(pos, 1.0);
              gl_Position = projectionMatrix * mv;
              gl_PointSize = 3.5 * (1.0 + 0.25 * sin(uTime * 5.0 + seed * 6.0));
              vAlpha = 0.85 + 0.15 * sin(uTime * 0.35 + seed);
            }
          `,
          fragmentShader: `
            uniform vec3 uColor;
            uniform float uOpacity;
            varying float vAlpha;
            void main() {
              vec2 c = gl_PointCoord - vec2(0.5);
              float d = length(c);
              float a = smoothstep(0.55, 0.0, d);
              if (a < 0.02) discard;
              a *= uOpacity * vAlpha;
              gl_FragColor = vec4(uColor, a);
            }
          `,
          transparent: true,
          depthWrite: false,
        });

        particles = new THREE.Points(geo, mat);
        scene.add(particles);

        const animate = () => {
          if (!prefersReduced && mat) {
            const elapsed = (performance.now() - startTime) / 1000;
            mat.uniforms.uTime.value = elapsed;
          }
          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
          animFrameId = requestAnimationFrame(animate);
        };
        animFrameId = requestAnimationFrame(animate);

        const handleResize = () => {
          const nw = container.clientWidth || 600;
          const nh = container.clientHeight || 160;
          if (nw === width && nh === height) return;
          setUp();
        };
        window.addEventListener("resize", handleResize);
        removeResize = () => window.removeEventListener("resize", handleResize);
      } catch (err) {
        console.warn("[TextParticles] WebGL initialization skipped:", err);
        setWebglFailed(true);
      }
    };

    setUp();

    return () => {
      tearDown();
    };
  }, [text, color, prefersReduced]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden"
      aria-hidden="true"
    />
  );
}
