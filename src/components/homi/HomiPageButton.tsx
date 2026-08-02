import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowUpRight } from "lucide-react";
import { getHomiContexto } from "@/lib/homiContextos";
import { cn } from "@/lib/utils";

interface HomiPageButtonProps {
  /** Sugestões específicas da tela (sobrescrevem o mapa por rota) */
  sugestoes?: string[];
  area?: string;
  className?: string;
}

/**
 * Botão contextual do HOMI presente em cada página do CRM.
 * Abre atalhos da tela e leva para o workspace (/homi) já com a pergunta.
 */
export function HomiPageButton({ sugestoes, area, className }: HomiPageButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  if (location.pathname.startsWith("/homi")) return null;

  const ctx = getHomiContexto(location.pathname);
  const lista = sugestoes?.length ? sugestoes : ctx.sugestoes;
  const rotulo = area ?? ctx.area;

  const abrir = (prompt?: string) => {
    setAberto(false);
    // sessionStorage garante o envio mesmo se o sistema de abas descartar a query
    if (prompt) sessionStorage.setItem("homi:prompt-pendente", prompt);
    navigate(prompt ? `/homi?p=${encodeURIComponent(prompt)}` : "/homi");
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 h-9 px-2.5", className)}
          aria-label="Falar com o HOMI sobre esta página"
        >
          <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
            <img
              src="/images/homi-mascot-official.png"
              alt=""
              className="h-4 w-4 object-contain"
            />
          </span>
          <span className="hidden text-[13px] font-medium sm:inline">HOMI</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          HOMI · {rotulo}
        </p>
        <div className="flex flex-col">
          {lista.map((s) => (
            <button
              key={s}
              onClick={() => abrir(s)}
              className="rounded-md px-2 py-2 text-left text-[13px] leading-snug text-foreground transition-colors hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => abrir()}
          className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-[12px] font-medium text-primary transition-colors hover:bg-muted"
        >
          Abrir conversa completa <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default HomiPageButton;
