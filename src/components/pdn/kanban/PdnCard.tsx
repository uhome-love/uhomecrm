import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, Sparkles, Flame, CalendarClock, TrendingDown,
} from "lucide-react";
import type { PdnRow } from "@/hooks/usePdn";

const PRIORIDADE_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  media: { label: "Média", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  baixa: { label: "Baixa", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

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
}

export function PdnCard({
  r, selected, onToggleSelected, onClick, onDragStart, onDragEnd, onQueda,
}: Props) {
  const prio = r.prioridade ? PRIORIDADE_META[r.prioridade] : null;

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
      {/* Checkbox — no hover ou quando selecionado */}
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

      {/* Ação única — marcar como caiu */}
      {!r.caiu && (
        <div
          className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-600"
            onClick={handleQueda}
            title="Marcar como caiu"
          >
            <TrendingDown className="h-3 w-3" />
          </Button>
        </div>
      )}

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
        <span className="text-sm font-semibold text-foreground">{fmtMoney(r.vgv, "short")}</span>
        {r.status && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.status}</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5 text-[11px] text-muted-foreground">
        <span className="line-clamp-1">{r.corretor}</span>
        {prio && <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 ${prio.cls}`}><Flame className="h-2.5 w-2.5" />{prio.label}</span>}
        {r.emRisco && <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" />Risco</span>}
        {r.proximaAcaoData && (
          <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 ${r.proximaAcaoVencida ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted"}`}>
            <CalendarClock className="h-2.5 w-2.5" />{formatBRT(r.proximaAcaoData, "dd/MM")}
          </span>
        )}
      </div>
    </div>
  );
}


const PRIORIDADE_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  media: { label: "Média", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  baixa: { label: "Baixa", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

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
}

export function PdnCard({
  r, etapaLabel, selected, onToggleSelected, onClick, onDragStart, onDragEnd, onQueda, onAvisar,
}: Props) {
  const prio = r.prioridade ? PRIORIDADE_META[r.prioridade] : null;
  const [publishing, setPublishing] = useState(false);

  const canPublish = !!r.pipelineLeadId && !!(r.observacoes || "").trim();

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPublish || !r.pipelineLeadId) return;
    setPublishing(true);
    try {
      const hash = await publicarNoLead(r.pipelineLeadId, "observacao", r.observacoes);
      if (hash) toast.success("Observação publicada no lead");
      else toast.info("Nada novo para publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleQueda = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQueda(r);
  };

  const handleAvisar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (r.isManual || !r.corretorAuthId || r.caiu) {
      toast.info("Corretor não pode ser avisado neste card");
      return;
    }
    onAvisar(r, `Atualize o pipeline de ${r.nome} para "${etapaLabel}".`);
    toast.success("Corretor avisado");
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
      {/* Checkbox — no hover ou quando selecionado */}
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

      {/* Ações — hover no desktop, sempre visíveis no mobile via touch */}
      <div
        className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 md:group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          disabled={!canPublish || publishing}
          onClick={handlePublish}
          title={canPublish ? "Publicar obs. no lead" : "Sem observação para publicar"}
        >
          {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
        </Button>
        {!r.isManual && !r.caiu && r.corretorAuthId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={handleAvisar}
            title="Avisar corretor"
          >
            <Send className="h-3 w-3" />
          </Button>
        )}
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
      </div>

      <div className="flex items-start justify-between gap-2 pr-14 pl-5">
        <span className="line-clamp-1 text-sm font-medium text-foreground">{r.nome}</span>
        {r.novoDesdeOntem && (
          <span title="Novo desde ontem"><Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" /></span>
        )}
      </div>
      <div className="mt-0.5 line-clamp-1 pl-5 text-xs text-muted-foreground">
        {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"}
      </div>
      <div className="mt-1.5 flex items-center justify-between pl-5">
        <span className="text-sm font-semibold text-foreground">{fmtMoney(r.vgv, "short")}</span>
        {r.status && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.status}</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5 text-[11px] text-muted-foreground">
        <span className="line-clamp-1">{r.corretor}</span>
        {prio && <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 ${prio.cls}`}><Flame className="h-2.5 w-2.5" />{prio.label}</span>}
        {r.emRisco && <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" />Risco</span>}
        {r.proximaAcaoData && (
          <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 ${r.proximaAcaoVencida ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted"}`}>
            <CalendarClock className="h-2.5 w-2.5" />{formatBRT(r.proximaAcaoData, "dd/MM")}
          </span>
        )}
      </div>
    </div>
  );
}
