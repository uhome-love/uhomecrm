import { AlertTriangle, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface KanbanFilters {
  soRisco: boolean;
  soNovos: boolean;
  corretor: string; // "" = todos
}

interface Props {
  filters: KanbanFilters;
  setFilters: (f: KanbanFilters) => void;
  corretores: { id: string; nome: string }[];
  hits: number;
  total: number;
}

/**
 * Mini-toolbar do Kanban do PDN. Filtros locais (não afeta a planilha).
 * Visualmente distinta (fundo muted, tag "Kanban") para não confundir com o header global.
 */
export function KanbanToolbar({ filters, setFilters, corretores, hits, total }: Props) {
  const active = filters.soRisco || filters.soNovos || !!filters.corretor;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
      <Badge variant="outline" className="h-6 rounded-md text-[10px] font-semibold uppercase tracking-wide">
        Kanban
      </Badge>

      <Button
        size="sm"
        variant={filters.soRisco ? "default" : "outline"}
        className="h-7 gap-1 text-xs"
        onClick={() => setFilters({ ...filters, soRisco: !filters.soRisco })}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Em risco
      </Button>

      <Button
        size="sm"
        variant={filters.soNovos ? "default" : "outline"}
        className="h-7 gap-1 text-xs"
        onClick={() => setFilters({ ...filters, soNovos: !filters.soNovos })}
      >
        <Sparkles className="h-3.5 w-3.5" /> Novos desde ontem
      </Button>

      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filters.corretor || "__all__"} onValueChange={(v) => setFilters({ ...filters, corretor: v === "__all__" ? "" : v })}>
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue placeholder="Todos os corretores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os corretores</SelectItem>
            {corretores.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {active && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setFilters({ soRisco: false, soNovos: false, corretor: "" })}
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}

      <div className="ml-auto text-[11px] text-muted-foreground">
        {active ? `${hits} de ${total}` : `${total} negócios`}
      </div>
    </div>
  );
}
