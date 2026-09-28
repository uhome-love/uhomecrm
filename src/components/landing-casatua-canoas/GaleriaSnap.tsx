import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GALERIA } from "@/config/landingCasaTuaCanoas";

function Card({ legenda, src }: { legenda: string; src?: string }) {
  const [ok, setOk] = useState(Boolean(src));
  return (
    <div className="relative h-[200px] flex-[0_0_82%] snap-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[hsl(var(--lp-ph-1))] to-[hsl(var(--lp-ph-2))]">
      {ok && src && (
        <img src={src} alt={legenda} loading="lazy" draggable={false} className="h-full w-full object-cover" onError={() => setOk(false)} />
      )}
      <span className="absolute bottom-2.5 left-3 rounded-full bg-[hsl(var(--lp-white)/0.88)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--lp-ink))]">
        {legenda}
      </span>
    </div>
  );
}

/** Galeria deslizável (dedo/trackpad) + bolinhas indicadoras + setas em telas maiores. */
export default function GaleriaSnap() {
  const ref = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const passo = card ? card.offsetWidth + 10 : el.clientWidth;
    setAtual(Math.min(GALERIA.length - 1, Math.round(el.scrollLeft / passo)));
  };

  const ir = (i: number) => {
    const el = ref.current;
    const alvo = el?.children[Math.max(0, Math.min(GALERIA.length - 1, i))] as HTMLElement | undefined;
    if (el && alvo) el.scrollTo({ left: alvo.offsetLeft - 18, behavior: "smooth" });
  };

  const seta = "absolute top-[100px] z-10 hidden -translate-y-1/2 place-items-center rounded-full bg-[hsl(var(--lp-white)/0.92)] p-1.5 text-[hsl(var(--lp-ink))] shadow-md sm:grid disabled:opacity-0";

  return (
    <div className="relative pb-[14px]">
      <div ref={ref} onScroll={onScroll} className="lp-noscroll flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-[18px] pb-2 pt-1">
        {GALERIA.map((g) => <Card key={g.legenda} {...g} />)}
      </div>
      <button type="button" aria-label="Foto anterior" onClick={() => ir(atual - 1)} disabled={atual === 0} className={`${seta} left-2`}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" aria-label="Próxima foto" onClick={() => ir(atual + 1)} disabled={atual === GALERIA.length - 1} className={`${seta} right-2`}>
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="flex justify-center gap-1.5">
        {GALERIA.map((g, i) => (
          <button
            key={g.legenda}
            type="button"
            aria-label={`Ver foto ${i + 1}: ${g.legenda}`}
            onClick={() => ir(i)}
            className={`h-1.5 rounded-full transition-all ${i === atual ? "w-5 bg-[hsl(var(--lp-blue))]" : "w-1.5 bg-[hsl(var(--lp-line))]"}`}
          />
        ))}
      </div>
    </div>
  );
}
