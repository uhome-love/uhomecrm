import { useState } from "react";
import { GALERIA } from "@/config/landingCasaTuaCanoas";

function Card({ legenda, src }: { legenda: string; src?: string }) {
  const [ok, setOk] = useState(Boolean(src));
  return (
    <div className="relative h-[200px] flex-[0_0_82%] snap-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[hsl(var(--lp-ph-1))] to-[hsl(var(--lp-ph-2))]">
      {ok && src && (
        <img src={src} alt={legenda} loading="lazy" className="h-full w-full object-cover" onError={() => setOk(false)} />
      )}
      <span className="absolute bottom-2.5 left-3 rounded-full bg-[hsl(var(--lp-white)/0.88)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--lp-ink))]">
        {legenda}
      </span>
    </div>
  );
}

export default function GaleriaSnap() {
  return (
    <div className="lp-noscroll flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-[18px] pb-[18px] pt-1">
      {GALERIA.map((g) => <Card key={g.legenda} {...g} />)}
    </div>
  );
}
