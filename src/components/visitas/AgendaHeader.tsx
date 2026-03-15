import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  key: string;
  label: string;
  emoji: string;
}

interface Corretor {
  id: string;
  nome: string;
}

interface AgendaHeaderProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  corretorFilter: string;
  onCorretorChange: (v: string) => void;
  corretores: Corretor[];
  empreendimentoFilter: string;
  onEmpreendimentoChange: (v: string) => void;
  empreendimentos: string[];
  teamFilter: string;
  onTeamChange: (v: string) => void;
  teams: Team[];
  agendaTipo: "lead" | "negocio";
  onTipoChange: (t: "lead" | "negocio") => void;
  leadCount: number;
  negocioCount: number;
  onNewVisita: () => void;
  hasFilters: boolean;
  onClearAll: () => void;
  showCorretor: boolean;
  showTeam: boolean;
}

export default function AgendaHeader({
  searchTerm, onSearchChange,
  corretorFilter, onCorretorChange, corretores,
  empreendimentoFilter, onEmpreendimentoChange, empreendimentos,
  teamFilter, onTeamChange, teams,
  agendaTipo, onTipoChange, leadCount, negocioCount,
  onNewVisita, hasFilters, onClearAll,
  showCorretor, showTeam,
}: AgendaHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, telefone ou corretor..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          className="text-xs h-9 pl-9 bg-card border-border/60"
        />
      </div>

      {showCorretor && corretores.length > 1 && (
        <Select value={corretorFilter} onValueChange={onCorretorChange}>
          <SelectTrigger className="h-9 w-[155px] text-xs bg-card border-border/60">
            <SelectValue placeholder="Todos corretores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos corretores</SelectItem>
            {corretores.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {empreendimentos.length > 1 && (
        <Select value={empreendimentoFilter} onValueChange={onEmpreendimentoChange}>
          <SelectTrigger className="h-9 w-[155px] text-xs bg-card border-border/60">
            <SelectValue placeholder="Todos empreend." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos empreend.</SelectItem>
            {empreendimentos.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showTeam && (
        <Select value={teamFilter} onValueChange={onTeamChange}>
          <SelectTrigger className="h-9 w-[140px] text-xs bg-card border-border/60">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas equipes</SelectItem>
            {teams.map(t => (
              <SelectItem key={t.key} value={t.key}>{t.emoji} {t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
        <button
          onClick={() => onTipoChange("lead")}
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all",
            agendaTipo === "lead"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          🏠 Visitas ({leadCount})
        </button>
        <button
          onClick={() => onTipoChange("negocio")}
          className={cn(
            "px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all",
            agendaTipo === "negocio"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          💼 Negócios ({negocioCount})
        </button>
      </div>

      <Button onClick={onNewVisita} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-9 text-xs ml-auto">
        <Plus className="h-3.5 w-3.5" /> Nova Visita
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-9 text-[11px] gap-1 text-destructive px-2">
          <X className="h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  );
}
