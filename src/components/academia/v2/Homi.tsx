/**
 * Homi na Academia: ele é o professor, não é enfeite.
 * Regra combinada com o Lucas: Homi só fala quando tem algo tirado do dado.
 * Se não há número para citar, não renderize a fala.
 */
import { cn } from "@/lib/utils";

export type PoseHomi =
  | "neutro"
  | "apontando"
  | "comemorando"
  | "pensando"
  | "aprovando"
  | "preocupado"
  | "dormindo";

const ARQUIVO: Record<PoseHomi, string> = {
  neutro: "/images/academia/neutro.webp",
  apontando: "/images/academia/apontando.webp",
  comemorando: "/images/academia/comemorando.webp",
  pensando: "/images/academia/pensando.webp",
  aprovando: "/images/academia/aprovando.webp",
  preocupado: "/images/academia/preocupado.webp",
  dormindo: "/images/academia/dormindo.webp",
};

interface HomiProps {
  pose?: PoseHomi;
  /** largura em px; a altura acompanha */
  tamanho?: number;
  pula?: boolean;
  className?: string;
}

export function Homi({ pose = "neutro", tamanho = 64, pula, className }: HomiProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("uac-homi", pula && "pula", className)}
      style={{
        backgroundImage: `url(${ARQUIVO[pose]})`,
        width: tamanho,
        height: Math.round(tamanho * 1.45),
      }}
    />
  );
}

interface FalaProps {
  children: React.ReactNode;
  pose?: PoseHomi;
  /** rótulo acima da fala. "Homi" por padrão. */
  quem?: string;
  /** sobre foto: inverte as cores do balão */
  escuro?: boolean;
  tamanho?: number;
  className?: string;
}

export function FalaHomi({ children, pose = "neutro", quem = "Homi", escuro, tamanho = 64, className }: FalaProps) {
  return (
    <div className={cn("uac-fala", escuro && "escuro", className)}>
      <Homi pose={pose} tamanho={tamanho} />
      <div className="uac-balao">
        <span className="uac-quem">{quem}</span>
        {children}
      </div>
    </div>
  );
}
