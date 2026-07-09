import { useMemo, useRef, useState } from "react";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Sparkles, Flame, CalendarClock } from "lucide-react";
import { PdnCardDrawer } from "./PdnCardDrawer";

const PRIORIDADE_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  media: { label: "Média", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  baixa: { label: "Baixa", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

export type PdnSavePatch = Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao" | "proximaAcaoData" | "prioridade" | "riscoManual" | "riscoMotivo" | "empreendimento" | "vgv">>;

interface PdnKanbanProps {
  rows: PdnRow[];
  onSave: (row: PdnRow, patch: PdnSavePatch) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onLimparEtapa: (row: PdnRow) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  onAdd: (grupo: PdnGrupo) => void;
}

export function PdnKanban({
  rows, onSave, onUpdateManual, onRemove, onQueda, onReativar, onMudarEtapa, onLimparEtapa, onAvisar, onAdd,
}: PdnKanbanProps) {
  const [selected, setSelected] = useState<PdnRow | null>(null);
  const [dragOver, setDragOver] = useState<PdnGrupo | null>(null);
  const dragRow = useRef<PdnRow | null>(null);

  const byGrupo = useMemo(() => {
    const map: Record<string, PdnRow[]> = {};
    for (const g of PDN_GRUPOS) map[g.key] = [];
    for (const r of rows) (map[r.grupo] ||= []).push(r);
    return map;
  }, [rows]);

  // Mantém a referência mais recente da linha selecionada após salvar
  const selectedLive = useMemo(
    () => (selected ? rows.find(r => r.id === selected.id) ?? selected : null),
    [rows, selected],
  );

  function handleDrop(target: PdnGrupo) {
    const r = dragRow.current;
    dragRow.current = null;
    setDragOver(null);
    if (!r || r.grupo === target) return;

    if (target === "caidos") { onQueda(r); return; }
    if (r.grupo === "caidos") { onReativar(r); return; }
    // Muda a etapa apenas no PDN (pipeline do corretor não é alterado).
    onMudarEtapa(r, target);
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PDN_GRUPOS.map(g => {
          const list = byGrupo[g.key] || [];
          const subtotal = list.reduce((s, r) => s + r.vgv, 0);
          const riscoCount = list.filter(r => r.emRisco).length;
          const novosCount = list.filter(r => r.novoDesdeOntem).length;
          const isCaidos = g.key === "caidos";
          if (isCaidos && list.length === 0) return null;
          return (
            <div
              key={g.key}
              className={`flex w-[290px] shrink-0 flex-col rounded-xl border bg-muted/30 transition ${
                dragOver === g.key ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(g.key); }}
              onDragLeave={() => setDragOver(prev => (prev === g.key ? null : prev))}
              onDrop={() => handleDrop(g.key)}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderTop: `3px solid ${g.cor}`, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isCaidos ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{g.label}</span>
                  <Badge variant={isCaidos ? "destructive" : "secondary"}>{list.length}</Badge>
                </div>
                {!isCaidos && (
                  <button
                    onClick={() => onAdd(g.key)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    title="Adicionar negócio manual"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100vh - 320px)" }}>
                {list.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Vazio</div>
                ) : list.map(r => (
                  <PdnCard
                    key={r.id}
                    r={r}
                    onClick={() => setSelected(r)}
                    onDragStart={() => { dragRow.current = r; }}
                    onDragEnd={() => { dragRow.current = null; setDragOver(null); }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Total </span>
                  <span className="font-semibold" style={{ color: g.cor }}>{fmtMoney(subtotal, "short")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {novosCount > 0 && <span className="text-primary">{novosCount} novo{novosCount > 1 ? "s" : ""}</span>}
                  {riscoCount > 0 && <span className="text-amber-600 dark:text-amber-400">{riscoCount} risco</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <PdnCardDrawer
        row={selectedLive}
        onClose={() => setSelected(null)}
        onSave={onSave}
        onUpdateManual={onUpdateManual}
        onRemove={onRemove}
        onQueda={onQueda}
        onReativar={onReativar}
      />
    </>
  );
}

function PdnCard({ r, onClick, onDragStart, onDragEnd }: {
  r: PdnRow;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const prio = r.prioridade ? PRIORIDADE_META[r.prioridade] : null;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border bg-card p-2.5 text-left shadow-sm transition hover:shadow-md ${
        r.emRisco ? "border-amber-500/40" : "border-border"
      } ${r.caiu ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium text-foreground">{r.nome}</span>
        {r.novoDesdeOntem && (
          <span title="Novo desde ontem"><Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" /></span>
        )}
      </div>
      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{fmtMoney(r.vgv, "short")}</span>
        {r.status && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.status}</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
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
