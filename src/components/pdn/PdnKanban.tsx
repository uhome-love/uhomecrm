import { useMemo, useRef, useState } from "react";
import { PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { fmtMoney } from "@/lib/fmtMoney";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PdnLeadDrawer } from "./drawer/PdnLeadDrawer";
import { PdnCard } from "./kanban/PdnCard";
import { BulkActionBar } from "./BulkActionBar";
import { publicarNoLead } from "./drawer/publish";

// Probabilidade ponderada por grupo (mesmo peso usado em usePdn — mantém consistência).
const PROB_POR_GRUPO: Record<PdnGrupo, number> = {
  visita_realizada: 0.2,
  em_negociacao: 0.5,
  contrato: 0.8,
  ganho: 1,
  caidos: 0,
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

  // Seleção múltipla.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Rows já vêm filtradas (toolbar unificada no PdnGestor).
  const filteredRows = rows;

  // Limpa seleção quando o conjunto de linhas muda.
  const filteredIds = useMemo(() => new Set(filteredRows.map(r => r.id)), [filteredRows]);
  const effectiveSelected = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) if (filteredIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, filteredIds]);

  const byGrupo = useMemo(() => {
    const map: Record<string, PdnRow[]> = {};
    for (const g of PDN_GRUPOS) map[g.key] = [];
    for (const r of filteredRows) (map[r.grupo] ||= []).push(r);
    return map;
  }, [filteredRows]);

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
    if (r.grupo === "caidos") {
      onReativar(r);
      toast.success(`Reativado`);
      return;
    }
    onMudarEtapa(r, target);
    const label = PDN_GRUPOS.find(g => g.key === target)?.label || target;
    toast.success(`Movido para ${label}`);
  }

  // Ações em lote — reutilizam o BulkActionBar da Fase 2.
  const selectedRows = useMemo(
    () => filteredRows.filter(r => effectiveSelected.has(r.id)),
    [filteredRows, effectiveSelected],
  );

  const bulkPublish = async () => {
    const alvos = selectedRows.filter(r => r.pipelineLeadId && (r.observacoes || "").trim().length > 0);
    if (alvos.length === 0) { toast.info("Nenhum selecionado tem observação para publicar"); return; }
    let ok = 0, skip = 0;
    for (const r of alvos) {
      const hash = await publicarNoLead(r.pipelineLeadId as string, "observacao", r.observacoes);
      if (hash) ok++; else skip++;
    }
    toast.success(`Publicado em ${ok} lead${ok !== 1 ? "s" : ""}${skip ? ` · ${skip} pulado(s)` : ""}`);
  };

  const bulkAvisar = async () => {
    const alvos = selectedRows.filter(r => !r.isManual && r.corretorAuthId && !r.caiu);
    if (alvos.length === 0) { toast.info("Nenhum selecionado pode ser avisado"); return; }
    for (const r of alvos) {
      const etapa = PDN_GRUPOS.find(g => g.key === r.grupo)?.label || "";
      onAvisar(r, `Atualize o pipeline de ${r.nome} para "${etapa}".`);
    }
    toast.success(`${alvos.length} corretor(es) avisados`);
  };

  const bulkQueda = async (motivo: string) => {
    for (const r of selectedRows) {
      if (!r.caiu) onQueda(r);
    }
    toast.success(`${selectedRows.length} negócio(s) marcados como caiu`);
    setSelectedIds(new Set());
  };

  return (
    <>
      <KanbanToolbar
        filters={filters}
        setFilters={(f) => { setFilters(f); setSelectedIds(new Set()); }}
        corretores={corretores}
        hits={filteredRows.length}
        total={rows.length}
      />

      <div className="flex gap-3 overflow-x-auto pb-2">
        {PDN_GRUPOS.map(g => {
          const list = byGrupo[g.key] || [];
          const subtotal = list.reduce((s, r) => s + r.vgv, 0);
          const ponderado = list.reduce((s, r) => s + r.vgv * PROB_POR_GRUPO[g.key], 0);
          const riscoCount = list.filter(r => r.emRisco).length;
          const novosCount = list.filter(r => r.novoDesdeOntem).length;
          const isCaidos = g.key === "caidos";
          if (isCaidos && list.length === 0) return null;
          return (
            <div
              key={g.key}
              className={`flex w-[290px] shrink-0 flex-col rounded-xl border bg-muted/30 transition ${
                dragOver === g.key ? "border-primary ring-2 ring-primary/40 shadow-inner" : "border-border"
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

              {/* Contadores extras */}
              {(novosCount > 0 || riscoCount > 0) && (
                <div className="flex items-center gap-1 px-3 pb-1">
                  {novosCount > 0 && (
                    <Badge variant="outline" className="h-5 gap-0.5 border-primary/30 bg-primary/10 px-1.5 text-[10px] text-primary">
                      {novosCount} novo{novosCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {riscoCount > 0 && (
                    <Badge variant="outline" className="h-5 gap-0.5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                      {riscoCount} em risco
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100vh - 340px)" }}>
                {list.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
                    <span>Sem negócios nesta etapa</span>
                    {!isCaidos && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onAdd(g.key)}>
                        <Plus className="h-3 w-3" /> Adicionar manual
                      </Button>
                    )}
                  </div>
                ) : list.map(r => (
                  <PdnCard
                    key={r.id}
                    r={r}
                    etapaLabel={g.label}
                    selected={effectiveSelected.has(r.id)}
                    onToggleSelected={() => toggleSelected(r.id)}
                    onClick={() => setSelected(r)}
                    onDragStart={() => { dragRow.current = r; }}
                    onDragEnd={() => { dragRow.current = null; setDragOver(null); }}
                    onQueda={onQueda}
                    onAvisar={onAvisar}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold" style={{ color: g.cor }}>{fmtMoney(subtotal, "short")}</span>
                  {!isCaidos && ponderado > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Pond.: {fmtMoney(ponderado, "short")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <PdnLeadDrawer
        row={selectedLive}
        onClose={() => setSelected(null)}
        onSave={onSave}
        onUpdateManual={onUpdateManual}
        onRemove={onRemove}
        onQueda={onQueda}
        onReativar={onReativar}
        onMudarEtapa={onMudarEtapa}
        onLimparEtapa={onLimparEtapa}
        onAvisar={onAvisar}
      />

      <BulkActionBar
        count={effectiveSelected.size}
        onClear={() => setSelectedIds(new Set())}
        onPublish={bulkPublish}
        onAvisar={bulkAvisar}
        onQueda={bulkQueda}
      />
    </>
  );
}
