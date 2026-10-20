import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MotivoFila } from "@/hooks/useFilaDoDia";
import { MOTIVO_META, MOTIVO_ORDEM, type FocoAgenda } from "./agendaMeta";

interface Props {
  foco: FocoAgenda;
  onChange: (foco: FocoAgenda) => void;
  contagem: Partial<Record<MotivoFila, number>>;
  pendentes: number;
  feitos: number;
  loading: boolean;
}

function FocoChip({ ativo, onClick, label, count }: { ativo: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <Button variant="ghost" aria-pressed={ativo} onClick={onClick} className={cn("h-auto gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium", ativo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
      {label}<span className="opacity-70">{count}</span>{ativo && label !== "Pendentes" && <X />}
    </Button>
  );
}

export default function AgendaFiltros({ foco, onChange, contagem, pendentes, feitos, loading }: Props) {
  const motivos = MOTIVO_ORDEM.filter((k) => (contagem[k] ?? 0) > 0);
  const temFiltro = foco !== "pendentes" && foco !== "feitos";
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2 md:hidden" aria-label="Filtros das prioridades">
        <div className="flex min-w-0 gap-1.5">
          <Button variant="ghost" aria-pressed={foco !== "feitos"} onClick={() => onChange("pendentes")} className={cn("h-11 rounded-full px-3 text-xs", foco !== "feitos" ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : "bg-muted text-muted-foreground")}>
            Pendentes<span className="tabular-nums">{pendentes}</span>
          </Button>
          <Button variant="ghost" aria-pressed={foco === "feitos"} onClick={() => onChange("feitos")} className={cn("h-11 rounded-full px-3 text-xs", foco === "feitos" ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background" : "bg-muted text-muted-foreground")}>
            Feitos hoje<span className="tabular-nums">{feitos}</span>
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={loading} aria-label="Filtrar prioridades" className={cn("relative h-11 w-11 shrink-0 rounded-lg p-0", temFiltro && "border-primary text-primary")}><SlidersHorizontal />{temFiltro && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel>Filtrar prioridades</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={temFiltro ? foco : "pendentes"} onValueChange={(v) => { if (v === "pendentes" || MOTIVO_ORDEM.some((k) => k === v)) onChange(v as FocoAgenda); }}>
              <DropdownMenuRadioItem value="pendentes" className="min-h-11">Todas as prioridades<span className="ml-auto tabular-nums text-muted-foreground">{pendentes}</span></DropdownMenuRadioItem>
              {motivos.map((k) => <DropdownMenuRadioItem key={k} value={k} className="min-h-11">{MOTIVO_META[k].label}<span className="ml-auto tabular-nums text-muted-foreground">{contagem[k]}</span></DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {temFiltro && <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground md:hidden"><span>{MOTIVO_META[foco].label} · {contagem[foco] ?? 0}</span><Button variant="ghost" size="sm" className="h-11 px-2 text-xs" onClick={() => onChange("pendentes")}><X />Limpar</Button></div>}
      {!loading && (motivos.length > 1 || feitos > 0) && (
        <div className="mb-3 hidden flex-wrap gap-1.5 md:flex">
          <FocoChip ativo={foco === "pendentes"} onClick={() => onChange("pendentes")} label="Pendentes" count={pendentes} />
          {motivos.map((k) => <FocoChip key={k} ativo={foco === k} onClick={() => onChange(foco === k ? "pendentes" : k)} label={MOTIVO_META[k].label} count={contagem[k] ?? 0} />)}
          {feitos > 0 && <><span className="mx-0.5 h-6 w-px self-center bg-border" aria-hidden /><FocoChip ativo={foco === "feitos"} onClick={() => onChange(foco === "feitos" ? "pendentes" : "feitos")} label="Feitos hoje" count={feitos} /></>}
        </div>
      )}
    </>
  );
}