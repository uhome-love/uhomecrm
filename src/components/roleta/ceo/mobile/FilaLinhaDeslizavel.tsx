import { useRef, useState } from "react";
import { UserX } from "lucide-react";

interface Props {
  nome: string;
  detalhe: string;
  destaque?: boolean;
  onTirar: () => void;
}

const LARGURA = 96;

/** Linha da fila: deslizar para a esquerda revela "Tirar da fila". */
export function FilaLinhaDeslizavel({ nome, detalhe, destaque, onTirar }: Props) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<number | null>(null);
  const base = useRef(0);

  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "C";

  return (
    <div className="relative overflow-hidden border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={() => { setDx(0); onTirar(); }}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-destructive text-xs font-semibold text-destructive-foreground"
        style={{ width: LARGURA }}
        aria-label={`Tirar ${nome} da fila`}
      >
        <UserX className="h-4 w-4" /> Tirar
      </button>
      <div
        className="relative flex items-center justify-between bg-card px-4 py-3 transition-transform duration-150"
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        onTouchStart={(e) => { inicio.current = e.touches[0].clientX; base.current = dx; }}
        onTouchMove={(e) => {
          if (inicio.current == null) return;
          const d = e.touches[0].clientX - inicio.current + base.current;
          setDx(Math.max(-LARGURA, Math.min(0, d)));
        }}
        onTouchEnd={() => { inicio.current = null; setDx((v) => (v < -LARGURA / 2 ? -LARGURA : 0)); }}
      >
        <span className="flex min-w-0 items-center">
          <span className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${destaque ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
            {iniciais}
          </span>
          <span className="truncate text-[15px]">{nome}</span>
        </span>
        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{detalhe}</span>
      </div>
    </div>
  );
}
