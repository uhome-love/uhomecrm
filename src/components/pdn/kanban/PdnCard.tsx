import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle, Sparkles, Flame, CalendarClock, TrendingDown, MoreVertical,
  RotateCcw, ArrowRight,
} from "lucide-react";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";

interface Props {
  r: PdnRow;
  etapaLabel: string;
  selected: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onQueda: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  /** Move o card de etapa (mesmo caminho do drag & drop) — usado pelo menu de 1 toque. */
  onMoverPara?: (row: PdnRow, grupo: PdnGrupo) => void;
  onReativar?: (row: PdnRow) => void;
}

export function PdnCard({
  r, selected, onToggleSelected, onClick, onDragStart, onDragEnd, onQueda,
  onMoverPara, onReativar,
}: Props) {
  const handleQueda = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQueda(r);
  };

  return (
    <div
      draggable={!selected}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-lg border bg-card p-2.5 text-left shadow-sm transition hover:shadow-md ${
        r.emRisco ? "border-amber-500/40" : "border-border"
      } ${r.caiu ? "opacity-70" : ""} ${selected ? "ring-2 ring-primary/60" : ""}`}
    >
      <div
        className={`absolute left-1.5 top-1.5 z-10 rounded-md bg-background/95 p-0.5 shadow-sm transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelected}
          className="h-3.5 w-3.5"
          aria-label="Selecionar"
        />
      </div>

      <div
        className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {!r.caiu && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-600"
            onClick={handleQueda}
            title="Marcar como caiu"
          >
            <TrendingDown className="h-3 w-3" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Ações"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Mover para
            </DropdownMenuLabel>
            {PDN_GRUPOS.filter(g => g.key !== r.grupo).map(g => (
              <DropdownMenuItem
                key={g.key}
                className="text-sm"
                onSelect={() => onMoverPara?.(r, g.key)}
                disabled={!onMoverPara}
              >
                <ArrowRight className="mr-2 h-3.5 w-3.5" style={{ color: g.cor }} />
                {g.label}
              </DropdownMenuItem>
            ))}
            {r.caiu && onReativar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-sm" onSelect={() => onReativar(r)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reativar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      <div className="flex items-start justify-between gap-2 pr-8 pl-5">
        <span className="line-clamp-1 text-sm font-medium text-foreground">{r.nome}</span>
        {r.novoDesdeOntem && (
          <span title="Novo desde ontem"><Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" /></span>
        )}
      </div>
      <div className="mt-0.5 line-clamp-1 pl-5 text-xs text-muted-foreground">
        {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"}
      </div>
      <div className="mt-1.5 flex items-center justify-between pl-5">
        <span className="text-sm font-semibold text-foreground">{r.vgv > 0 ? fmtMoney(r.vgv, "short") : "—"}</span>
        {r.status && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.status}</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5 text-[11px] text-muted-foreground">
        <span className="line-clamp-1">{r.corretor}</span>
        {r.emRisco && <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" />Risco</span>}
      </div>
    </div>
  );
}
