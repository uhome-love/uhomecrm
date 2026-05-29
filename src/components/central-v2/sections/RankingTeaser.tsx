import { Trophy, ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function RankingTeaser() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleClick = () => {
    const next = new URLSearchParams(params);
    next.set("secao", "ranking");
    navigate(`/central-relatorios?${next.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="central-card group flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Trophy className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <div className="font-display text-base text-foreground">
            Ranking da equipe
          </div>
          <div className="text-sm text-muted-foreground">
            Ver classificação completa por VGV, vendas e visitas.
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  );
}
