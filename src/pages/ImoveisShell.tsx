import { useSearchParams } from "react-router-dom";
import { Home, Link2 } from "lucide-react";
import ImoveisPage from "./ImoveisPage";
import LinksSite from "./LinksSite";
import { cn } from "@/lib/utils";

/**
 * Wrapper que apresenta a página /imoveis com duas abas:
 * - Buscar Imóveis (default)
 * - Meus Links (link personalizado do corretor)
 */
export default function ImoveisShell() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "links" ? "links" : "buscar";

  const setView = (v: "buscar" | "links") => {
    const next = new URLSearchParams(params);
    if (v === "links") next.set("view", "links");
    else next.delete("view");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-2 md:py-3 shrink-0">
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Home size={17} strokeWidth={1.6} /></span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-foreground">Imóveis</h1>
            <p className="truncate text-xs text-muted-foreground">Busque, selecione e compartilhe imóveis com o cliente</p>
          </div>
        </div>
        <div role="tablist" aria-label="Seções de Imóveis" className="md:ml-auto inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted/70 p-1">
          {([["buscar", "Buscar imóveis", Home], ["links", "Meus links", Link2]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                view === v ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {view === "links" ? <LinksSite /> : <ImoveisPage />}
      </div>
    </div>
  );
}
