import { useEffect, useRef } from "react";
import { useNatal } from "./useNatal";

/** Neve leve em canvas (máx. 30 flocos). O pai precisa ser `relative`. */
export function NeveSuave({ altura = 180, flocos = 30, fundoClaro = false }: { altura?: number; flocos?: number; fundoClaro?: boolean }) {
  const { movimento } = useNatal();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!movimento || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const n = Math.min(30, flocos);
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    const fl = Array.from({ length: n }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: 1 + Math.random() * 2, v: 0.2 + Math.random() * 0.5, o: 0.2 + Math.random() * 0.3,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const f of fl) {
        f.y += f.v; f.x += Math.sin(f.y / 30) * 0.3;
        if (f.y > c.height) { f.y = -4; f.x = Math.random() * c.width; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = fundoClaro ? `rgba(73,105,255,${f.o * 0.7})` : `rgba(255,255,255,${f.o})`; ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [movimento, flocos, fundoClaro]);

  if (!movimento) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 w-full" style={{ height: altura }} />;
}
