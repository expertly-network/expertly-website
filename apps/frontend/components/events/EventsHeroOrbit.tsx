'use client';

import { useEffect, useRef } from 'react';

const MINT_LINE = (a: number) => `rgba(0,201,158,${a})`;
const MINT_DOT = (a: number) => `rgba(139,252,216,${a})`;

type Ring = { r: number; speed: number; dots: number[] };

// Ported 1:1 from design/static_html/assets/hero-mesh.js's `orbit` motif — the events hero's
// ambient canvas: concentric rings with dots moving at their own pace.
export function EventsHeroOrbit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const host = canvas?.closest('section');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    let cx = 0;
    let cy = 0;
    let rings: Ring[] = [];
    let raf = 0;

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      canvas!.width = w;
      canvas!.height = h;
      cx = w * 0.78;
      cy = h * 0.5;
      rings = [
        { r: 46, speed: 0.018, dots: [0] },
        { r: 82, speed: -0.012, dots: [0, Math.PI] },
        { r: 118, speed: 0.008, dots: [0, Math.PI * 0.66, Math.PI * 1.33] },
      ];
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const ring of rings) {
        ctx!.strokeStyle = MINT_LINE(0.16);
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx!.stroke();
        ring.dots = ring.dots.map((a) => a + ring.speed);
        for (const a of ring.dots) {
          const x = cx + Math.cos(a) * ring.r;
          const y = cy + Math.sin(a) * ring.r;
          ctx!.beginPath();
          ctx!.fillStyle = MINT_DOT(0.9);
          ctx!.arc(x, y, 3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.beginPath();
      ctx!.fillStyle = MINT_DOT(0.5);
      ctx!.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx!.fill();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full max-[900px]:hidden"
    />
  );
}
