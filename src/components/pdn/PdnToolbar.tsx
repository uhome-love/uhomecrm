import { AlertTriangle, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney } from "@/lib/fmtMoney";

export interface PdnFilterState {
  soRisco: boolean;
  soNovos: boolean;
  equipe: string; // "todas" | equipe
  corretor: string; // "todos" | nome
}

interface Props {
  filters: PdnFilterState;
  setFilters: (patch: Partial<PdnFilterState>) => void;
  showEquipeFilter: boolean;
  equipes: string[];
  corretores: string[];
  hits: number;
  vgvHits: number;
  total: number;
  kpiFilter: string | null;
  onClearKpi: () => void;
  caidosCount?: number;
  /** Toggle "mostrar caídos" na planilha (a antiga aba Arquivados). */
  caidosAtivo?: boolean;
  onOpenArquivados?: () => void;
  view: "planilha" | "kanban" | "meta";
  showResetLarguras: boolean;
  onResetLarguras: () => void;
}

/**
 * Toolbar unificada da página PDN. Substitui os filtros duplicados
 * (bloco global da Planilha + `KanbanToolbar`). Ambas as views consomem
 * o mesmo estado, então trocar de view preserva o recorte do gestor.
 */
export function PdnToolbar({
  filters, setFilters, showEquipeFilter, equipes, corretores,
  hits, vgvHits, total, kpiFilter, onClearKpi,
  caidosCount = 0, caidosAtivo = false, onOpenArquivados,
  view, showResetLarguras, onResetLarguras,
}: Props) {
  const anyFilter = filters.soRisco || filters.soNovos || filters.equipe !== "todas" || filters.corretor !== "todos" || !!kpiFilter;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2">
      <Button
        variant={filters.soRisco ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => setFilters({ soRisco: !filters.soRisco })}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Em risco
      </Button>

      <Button
        variant={filters.soNovos ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => setFilters({ soNovos: !filters.soNovos })}
      >
        <Sparkles className="h-3.5 w-3.5" /> Novos desde ontem
      </Button>

      {showEquipeFilter && (
        <Select
          value={filters.equipe}
          onValueChange={(v) => setFilters({ equipe: v, corretor: "todos" })}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as equipes</SelectItem>
            {equipes.map(e => <SelectItem key={e} value={e}>Equipe {e}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filters.corretor} onValueChange={(v) => setFilters({ corretor: v })}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Corretor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os corretores</SelectItem>
            {corretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {kpiFilter && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClearKpi}>
          Limpar recorte
        </Button>
      )}

      {anyFilter && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => setFilters({ soRisco: false, soNovos: false, equipe: "todas", corretor: "todos" })}
        >
          <X className="h-3.5 w-3.5" /> Limpar tudo
        </Button>
      )}

      {caidosCount > 0 && onOpenArquivados && (
        <Button
          variant={caidosAtivo ? "secondary" : "outline"}
          size="sm"
          className="h-8 border-red-500/40 text-xs text-red-600 dark:text-red-400"
          onClick={onOpenArquivados}
          title="Mostrar/ocultar os negócios marcados como caiu neste mês"
        >
          {caidosAtivo ? "Ocultar" : "Mostrar"} {caidosCount} caído{caidosCount > 1 ? "s" : ""}
        </Button>
      )}

      {view === "planilha" && showResetLarguras && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onResetLarguras}>
          Redefinir larguras
        </Button>
      )}

      <div className="ml-auto text-[11px] text-muted-foreground">
        {anyFilter ? `${hits} de ${total} · ${fmtMoney(vgvHits, "short")}` : `${total} negócios · ${fmtMoney(vgvHits, "short")}`}
      </div>
    </div>
  );
}
