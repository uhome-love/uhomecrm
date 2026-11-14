// ─────────────────────────────────────────────────────────────────
// useSwipeEtapa — arrastar a lista de cards para o lado troca de etapa no celular.
//   • Só toque e caneta (no mouse não faz nada).
//   • Rolagem vertical continua normal: `touch-action: pan-y` deixa o navegador
//     cuidar do vertical; o gesto só "trava" no horizontal quando ele domina.
//   • A lista acompanha o dedo e volta com mola; na troca, a etapa nova entra
//     deslizando (sem animação se o celular pedir menos movimento).
//   • Depois de um arrasto lateral, o clique que viria no card é ignorado,
//     para não abrir a ficha sem querer.
// Uso:
//   const swipe = useSwipeEtapa({ podeAnterior, podeProxima, onAnterior, onProxima });
//   <div {...swipe.handlers} style={swipe.style}>…cards da etapa ativa…</div>
// ─────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { decidirSwipe, resistenciaSwipe } from "@/lib/pipelineV2/swipe";

interface Opcoes {
  podeAnterior: boolean;
  podeProxima: boolean;
  onAnterior: () => void;
  onProxima: () => void;
}

interface Toque {
  id: number;
  x: number;
  y: number;
  t: number;
  largura: number;
  trava: "h" | "v" | null;
}

const menosMovimento = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useSwipeEtapa({ podeAnterior, podeProxima, onAnterior, onProxima }: Opcoes) {
  const [dx, setDx] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const toque = useRef<Toque | null>(null);
  const engolirClique = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const entrar = useCallback((lado: 1 | -1, largura: number) => {
    setArrastando(false);
    if (menosMovimento()) {
      setDx(0);
      return;
    }
    // A etapa nova começa um pouco deslocada e desliza até o lugar.
    setArrastando(true);
    setDx(lado * Math.round(largura * 0.3));
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setArrastando(false);
        setDx(0);
      });
    });
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    toque.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), largura: e.currentTarget.clientWidth || 360, trava: null };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const t = toque.current;
      if (!t || e.pointerId !== t.id) return;
      const mx = e.clientX - t.x;
      const my = e.clientY - t.y;
      if (!t.trava) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        t.trava = Math.abs(mx) > Math.abs(my) ? "h" : "v";
        if (t.trava === "h") {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setArrastando(true);
        }
      }
      if (t.trava !== "h") return;
      setDx(resistenciaSwipe(mx, podeAnterior, podeProxima));
    },
    [podeAnterior, podeProxima],
  );

  const terminar = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const t = toque.current;
      toque.current = null;
      if (!t || e.pointerId !== t.id) return;
      if (t.trava !== "h") return;
      engolirClique.current = true;
      window.setTimeout(() => {
        engolirClique.current = false;
      }, 350);
      const lado = decidirSwipe({ dx: e.clientX - t.x, dy: e.clientY - t.y, largura: t.largura, ms: performance.now() - t.t });
      if (lado === 1 && podeProxima) {
        onProxima();
        entrar(1, t.largura);
        return;
      }
      if (lado === -1 && podeAnterior) {
        onAnterior();
        entrar(-1, t.largura);
        return;
      }
      setArrastando(false);
      setDx(0);
    },
    [podeAnterior, podeProxima, onAnterior, onProxima, entrar],
  );

  const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!engolirClique.current) return;
    engolirClique.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const style: CSSProperties = {
    transform: dx ? `translate3d(${dx}px, 0, 0)` : undefined,
    transition: arrastando ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    touchAction: "pan-y",
  };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: terminar, onPointerCancel: terminar, onClickCapture },
    style,
    arrastando,
  };
}
