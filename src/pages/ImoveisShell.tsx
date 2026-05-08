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
      <div className="flex items-center gap-1 border-b border-border bg-background px-4 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setView("buscar")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            view === "buscar"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Home size={14} /> Buscar Imóveis
        </button>
        <button
          type="button"
          onClick={() => setView("links")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            view === "links"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Link2 size={14} /> Meus Links
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {view === "links" ? <LinksSite /> : <ImoveisPage />}
      </div>
    </div>
  );
}
