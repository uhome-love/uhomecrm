import { useMemo, useState, useEffect, useCallback } from "react";
import { usePdn, PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
import { usePdnLive } from "@/hooks/pdn/usePdnLive";

import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { fmtMoney } from "@/lib/fmtMoney";
import { formatBRT } from "@/lib/brtTime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Download, Plus, Trash2, AlertTriangle, TrendingUp, FileSignature,
  ClipboardList, Loader2, ChevronDown, ChevronRight, ArrowUp, ArrowDown,
  ArrowUpDown, TrendingDown, RotateCcw, Wallet, LayoutGrid, Table as TableIcon,
  RefreshCw, Users, Send, Copy, Megaphone, Archive, Undo2,
} from "lucide-react";
import { PdnKanban } from "@/components/pdn/PdnKanban";
import { PdnLeadDrawer } from "@/components/pdn/drawer/PdnLeadDrawer";
import { PdnToolbar } from "@/components/pdn/PdnToolbar";
import { PdnHeader, type PdnView } from "@/components/pdn/PdnHeader";
import { PdnMetaMes } from "@/components/pdn/PdnMetaMes";
import { PdnKpiCards } from "@/components/pdn/PdnKpiCards";
import { PdnResumoEquipes } from "@/components/pdn/PdnResumoEquipes";
import { MoneyInput } from "@/components/pdn/MoneyInput";
import { ColumnsMenu, PDN_DEFAULT_COLS, type PdnColKey } from "@/components/pdn/ColumnsMenu";
import { BulkActionBar } from "@/components/pdn/BulkActionBar";
import { PdnQuedaDialog, type QuedaAction } from "@/components/pdn/PdnQuedaDialog";
import { PdnRegredirDialog } from "@/components/pdn/PdnRegredirDialog";
import { ConferenciaVisitasMes } from "@/components/pdn/ConferenciaVisitasMes";
import { PdnDivergencias } from "@/components/pdn/PdnDivergencias";
import { usePdnDivergencias } from "@/hooks/pdn/usePdnDivergencias";
import { publicarNoLead } from "@/components/pdn/drawer/publish";
import { toast } from "sonner";
import { GrupoBloco } from "@/components/pdn/planilha/PdnGrupoBloco";
import { ArquivadosView } from "@/components/pdn/PdnArquivados";
import type { SortKey } from "@/components/pdn/planilha/constants";


// ─── Opções de mês (últimos 12) ───────────────────────────────────────────────
function buildMonthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

type KpiFilter = null | "ganho" | "contrato" | "risco" | "negociacao";



export default function PdnGestor() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [mes, setMes] = useState(monthOptions[0].value);
  const [filtroRisco, setFiltroRisco] = useState(false);
  const [filtroNovos, setFiltroNovos] = useState(false);
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [filtroEquipe, setFiltroEquipe] = useState<string>("todas");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("pdn:collapsed");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [quedaRow, setQuedaRow] = useState<PdnRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<PdnRow | null>(null);
  const [regredirRow, setRegredirRow] = useState<{ row: PdnRow; destino: PdnGrupo } | null>(null);
  // Padrão por dispositivo: mobile→kanban (foco em 1 coluna), desktop→planilha (densidade p/ gestão).
  // Preferência persistida separadamente para cada form factor.
  const [view, setView] = useState<PdnView>(() => {
    try {
      const isMob = typeof window !== "undefined" && window.innerWidth < 768;
      const key = `pdn:view:${isMob ? "mobile" : "desktop"}`;
      const saved = sessionStorage.getItem(key) as PdnView | null;
      return saved ?? (isMob ? "kanban" : "planilha");
    } catch { return "planilha"; }
  });

  const { isDiretor, isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  useEffect(() => {
    try { sessionStorage.setItem(`pdn:view:${isMobile ? "mobile" : "desktop"}`, view); } catch { /* ignore */ }
  }, [view, isMobile]);
  const { rows, scopeAuthIds, resumo, duplicados, loading, refreshAll, saveOverride, saveNegocioCampos, marcarQueda, mudarEtapa, avisarCorretor, descartarLead, inativarLead } = usePdn(mes);
  const { rows: divergencias } = usePdnDivergencias(scopeAuthIds);
  // PDN é espelho do pipeline: não existe mais "esconder" nem "reativar" só na planilha.
  const reativarQueda = useCallback((_row: PdnRow) => {
    toast.info("O PDN espelha o pipeline — reative o lead direto no pipeline.");
  }, []);
  const limparEtapaOverride = useCallback(async (_row: PdnRow) => { /* etapa vem sempre do pipeline */ }, []);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshAll(); } finally { setRefreshing(false); }
  };
  // Realtime: assina mudanças no pipeline e recarrega o PDN (debounced 800ms).
  usePdnLive(() => { refreshAll(); });

  // Wrapper: se for regressão (destino aparece antes do atual em PDN_GRUPOS) e não
  // for "caidos", abre o diálogo dedicado para capturar motivo antes de mover.
  // Progressões seguem direto pelo hook.
  const handleMudarEtapa = useCallback((row: PdnRow, destino: PdnGrupo) => {
    if (destino === "caidos") { mudarEtapa(row, destino); return; }
    const order = PDN_GRUPOS.map(g => g.key);
    const iAtual = order.indexOf(row.grupo);
    const iDest = order.indexOf(destino);
    if (iDest >= 0 && iAtual >= 0 && iDest < iAtual) {
      setRegredirRow({ row, destino });
      return;
    }
    mudarEtapa(row, destino);
  }, [mudarEtapa]);




  // Visibilidade de colunas (planilha) — persistida por device.
  const COLS_KEY = `pdn:cols:v1:${isMobile ? "mobile" : "desktop"}`;
  const [visibleCols, setVisibleCols] = useState<Record<PdnColKey, boolean>>(() => {
    try {
      const raw = sessionStorage.getItem(COLS_KEY);
      return raw ? { ...PDN_DEFAULT_COLS, ...JSON.parse(raw) } : { ...PDN_DEFAULT_COLS };
    } catch { return { ...PDN_DEFAULT_COLS }; }
  });
  useEffect(() => { try { sessionStorage.setItem(COLS_KEY, JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols, COLS_KEY]);

  // Seleção múltipla — invalida ao trocar mês/filtro (evita ação em set inconsistente).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSelectedIds(new Set()); }, [mes, filtroRisco, filtroNovos, filtroCorretor, filtroEquipe, kpiFilter]);
  const toggleSelected = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const setGroupSelected = (ids: string[], selected: boolean) => setSelectedIds(prev => {
    const next = new Set(prev);
    for (const id of ids) selected ? next.add(id) : next.delete(id);
    return next;
  });

  // Larguras de coluna redimensionáveis (planilha), persistidas por sessão
  const DEFAULT_COL_WIDTHS: Record<string, number> = {
    nome: 160, data: 88, empreendimento: 150, vgv: 110, corretor: 120, status: 130, obs: 200,
  };
  const COL_WIDTHS_KEY = "pdn:colWidths:v2";
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = sessionStorage.getItem(COL_WIDTHS_KEY);
      return raw ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(raw) } : DEFAULT_COL_WIDTHS;
    } catch { return DEFAULT_COL_WIDTHS; }
  });
  useEffect(() => { try { sessionStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths)); } catch { /* ignore */ } }, [colWidths]);
  const setColWidth = (key: string, w: number) => setColWidths(prev => ({ ...prev, [key]: Math.max(70, w) }));
  const colsCustomized = useMemo(
    () => Object.keys(DEFAULT_COL_WIDTHS).some(k => colWidths[k] !== DEFAULT_COL_WIDTHS[k]),
    [colWidths],
  );
  const resetColWidths = () => setColWidths({ ...DEFAULT_COL_WIDTHS });

  useEffect(() => {
    try { sessionStorage.setItem("pdn:collapsed", JSON.stringify([...collapsed])); } catch { /* ignore */ }
  }, [collapsed]);

  const toggleCollapse = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const equipes = useMemo(() => {
    const set = new Set(rows.map(r => r.equipe).filter(e => e && e !== "—"));
    return Array.from(set).sort();
  }, [rows]);
  const showEquipeFilter = isDiretor || isAdmin || equipes.length > 1;

  const corretores = useMemo(() => {
    const set = new Set(
      rows.filter(r => filtroEquipe === "todas" || r.equipe === filtroEquipe)
        .map(r => r.corretor).filter(c => c && c !== "—")
    );
    return Array.from(set).sort();
  }, [rows, filtroEquipe]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "nome" || key === "corretor" || key === "status" ? "asc" : "desc"); }
  }

  const filtered = useMemo(() => {
    let list = rows.filter(r => {
      if (filtroRisco && !r.emRisco) return false;
      if (filtroNovos && !r.novoDesdeOntem) return false;
      if (filtroEquipe !== "todas" && r.equipe !== filtroEquipe) return false;
      if (filtroCorretor !== "todos" && r.corretor !== filtroCorretor) return false;
      if (kpiFilter === "risco" && !r.emRisco) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av: string | number = "", bv: string | number = "";
      switch (sortKey) {
        case "nome": av = a.nome.toLowerCase(); bv = b.nome.toLowerCase(); break;
        case "vgv": av = a.vgv; bv = b.vgv; break;
        case "corretor": av = a.corretor.toLowerCase(); bv = b.corretor.toLowerCase(); break;
        case "status": av = a.status.toLowerCase(); bv = b.status.toLowerCase(); break;
        default: av = a.data || ""; bv = b.data || "";
      }
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return list;
  }, [rows, filtroRisco, filtroNovos, filtroEquipe, filtroCorretor, kpiFilter, sortKey, sortDir]);

  // Grupos visíveis conforme filtro de KPI
  const gruposVisiveis = useMemo<PdnGrupo[]>(() => {
    if (kpiFilter === "ganho") return ["ganho"];
    if (kpiFilter === "contrato") return ["contrato"];
    if (kpiFilter === "negociacao") return ["em_negociacao"];
    return PDN_GRUPOS.map(g => g.key);
  }, [kpiFilter]);

  const visitasMes = useMemo(() => rows.filter(r => r.grupoOrigem === "pos_visita").length, [rows]);

  function toggleKpi(k: Exclude<KpiFilter, null>) { setKpiFilter(prev => (prev === k ? null : k)); }

  function exportCSV() {
    const header = ["Grupo", "Nome", "Data", "Empreendimento", "VGV", "Status", "Corretor", "Equipe", "Observação", "Caiu", "Motivo queda"];
    const lines = filtered.map(r => [
      r.situacaoLabel, r.nome, r.data, r.empreendimento, r.vgv, r.status, r.corretor, r.equipe, r.observacoes, r.caiu ? "Sim" : "Não", r.motivoQueda,
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `PDN_${mes}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const handleSave = (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao" | "proximaAcaoData" | "prioridade" | "riscoManual" | "riscoMotivo" | "empreendimento" | "vgv">>) => {
    // saveOverride grava em pdn_entries por overrideId (manual) ou cria overlay (pipeline).
    saveOverride(row, patch);
  };

  // Não existe mais "remover da planilha": o PDN espelha o pipeline.
  // A saída de um negócio acontece via queda/descarte real no lead.
  const handleRemove = (row: PdnRow) => {
    setQuedaRow(row);
  };



  // Resumo por corretor, agrupado por equipe (ignora o filtro de corretor p/ manter todos clicáveis)
  const resumoEquipes = useMemo(() => {
    const base = rows.filter(r => {
      if (r.grupo === "caidos" || r.corretor === "—") return false;
      if (filtroRisco && !r.emRisco) return false;
      if (filtroEquipe !== "todas" && r.equipe !== filtroEquipe) return false;
      if (kpiFilter === "risco" && !r.emRisco) return false;
      return true;
    });
    const teamMap: Record<string, { equipe: string; count: number; vgv: number; corretores: Record<string, { count: number; vgv: number }> }> = {};
    for (const r of base) {
      const eq = r.equipe && r.equipe !== "—" ? r.equipe : "Sem equipe";
      const t = (teamMap[eq] ||= { equipe: eq, count: 0, vgv: 0, corretores: {} });
      t.count++; t.vgv += r.vgv;
      const c = (t.corretores[r.corretor] ||= { count: 0, vgv: 0 });
      c.count++; c.vgv += r.vgv;
    }
    return Object.values(teamMap)
      .map(t => ({
        ...t,
        corretores: Object.entries(t.corretores)
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.vgv - a.vgv),
      }))
      .sort((a, b) => b.vgv - a.vgv);
  }, [rows, filtroRisco, filtroEquipe, kpiFilter]);

  // ─── Ações em lote (seleção múltipla) ───────────────────────────────────────
  const selectedRows = useMemo(
    () => filtered.filter(r => selectedIds.has(r.id)),
    [filtered, selectedIds],
  );

  const bulkPublish = async () => {
    const alvos = selectedRows.filter(r => r.pipelineLeadId && (r.observacoes || "").trim().length > 0);
    if (alvos.length === 0) { toast.info("Nenhum selecionado tem observação para publicar"); return; }
    let ok = 0, skip = 0;
    for (const r of alvos) {
      const hash = await publicarNoLead(r.pipelineLeadId as string, "observacao", r.observacoes, r);
      if (hash) ok++; else skip++;
    }
    toast.success(`Publicado e avisado em ${ok} lead${ok !== 1 ? "s" : ""}${skip ? ` · ${skip} pulado(s)` : ""}`);
  };



  const bulkQueda = async (motivo: string) => {
    for (const r of selectedRows) {
      if (!r.caiu) marcarQueda(r, motivo);
    }
    toast.success(`${selectedRows.length} negócio(s) marcados como caiu`);
    setSelectedIds(new Set());
  };





  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      <PdnHeader
        mes={mes}
        monthOptions={monthOptions}
        onChangeMes={setMes}
        view={view}
        onChangeView={setView}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onExport={exportCSV}
      />

      {view !== "meta" && view !== "visitas" && (
        <PdnKpiCards resumo={resumo} kpiFilter={kpiFilter} onToggle={(k) => k === null ? setKpiFilter(null) : toggleKpi(k)} />
      )}

      {/* Toolbar unificada — só faz sentido em Planilha/Kanban (não em Meta/Visitas) */}
      {view !== "meta" && view !== "visitas" && (
        <PdnToolbar
          filters={{ soRisco: filtroRisco, soNovos: filtroNovos, equipe: filtroEquipe, corretor: filtroCorretor }}
          setFilters={(patch) => {
            if (patch.soRisco !== undefined) setFiltroRisco(patch.soRisco);
            if (patch.soNovos !== undefined) setFiltroNovos(patch.soNovos);
            if (patch.equipe !== undefined) { setFiltroEquipe(patch.equipe); setFiltroCorretor("todos"); }
            if (patch.corretor !== undefined) setFiltroCorretor(patch.corretor);
          }}
          showEquipeFilter={showEquipeFilter}
          equipes={equipes}
          corretores={corretores}
          hits={filtered.length}
          vgvHits={filtered.reduce((s, r) => s + r.vgv, 0)}
          total={rows.length}
          kpiFilter={kpiFilter}
          onClearKpi={() => setKpiFilter(null)}
          caidosCount={rows.filter(r => r.grupo === "caidos").length}
          onOpenArquivados={() => setView("arquivados")}
          view={view}
          showResetLarguras={!isMobile && colsCustomized}
          onResetLarguras={resetColWidths}
        />
      )}





      {/* Divergências entre PDN e Negócios (Fase 2) */}
      {!loading && (
        <PdnDivergencias
          rows={divergencias}
          onOpenLead={(leadId) => {
            const r = rows.find(x => x.pipelineLeadId === leadId);
            if (r) setSelectedRow(r);
          }}
        />
      )}

      {/* Possíveis duplicados no pipeline (só informativo — não apaga nada) */}
      {!loading && duplicados.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <Copy className="h-4 w-4" /> Possíveis duplicados ({duplicados.length})
          </div>
          <p className="mb-2 text-xs text-muted-foreground">O mesmo cliente/corretor aparece em mais de uma etapa do pipeline. Revise no pipeline — nada é apagado automaticamente.</p>
          <div className="space-y-1.5">
            {duplicados.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
                <span className="font-medium">{d.nome}</span>
                <span className="text-muted-foreground">· {d.corretor}</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {d.etapas.map((e, j) => (
                    <Badge key={j} variant="outline" className="text-[10px]">{e.etapa} · {fmtMoney(e.vgv, "short")}</Badge>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}




      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : view === "meta" ? (
        <PdnMetaMes mes={mes} rows={rows} />
      ) : view === "visitas" ? (
        <ConferenciaVisitasMes mes={mes} onOpenLead={(leadId) => {
          const r = rows.find(x => x.pipelineLeadId === leadId);
          if (r) setSelectedRow(r);
        }} />
      ) : view === "arquivados" ? (
        <ArquivadosView
          caidosRows={rows.filter(r => r.grupo === "caidos")}
          onRestaurar={reativarQueda}
          onReativar={reativarQueda}
          onOpen={setSelectedRow}
        />
      ) : view === "kanban" ? (
        <PdnKanban
          rows={filtered}
          onSave={handleSave}
          onRemove={handleRemove}
          onQueda={setQuedaRow}
          onReativar={reativarQueda}
          onMudarEtapa={handleMudarEtapa}
          onLimparEtapa={limparEtapaOverride}
          onAvisar={avisarCorretor}
          onAdd={undefined}
        />
      ) : (
        <div className="space-y-5">
          {PDN_GRUPOS.filter(g => gruposVisiveis.includes(g.key)).map(g => {
            const groupRows = filtered.filter(r => r.grupo === g.key);
            if (g.key === "caidos" && groupRows.length === 0) return null;
            return (
              <GrupoBloco
                key={g.key}
                grupo={g.key}
                label={g.label}
                cor={g.cor}
                rows={groupRows}
                collapsed={collapsed.has(g.key)}
                onToggleCollapse={() => toggleCollapse(g.key)}
                extraLabel={g.key === "pos_visita" ? `${visitasMes} no mês` : undefined}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                isMobile={isMobile}
                colWidths={colWidths}
                onColResize={setColWidth}
                onSave={handleSave}
                onSaveNegocio={saveNegocioCampos}
                      onRemove={handleRemove}
                onQueda={setQuedaRow}
                onReativar={reativarQueda}
                onMudarEtapa={handleMudarEtapa}
                onAvisar={avisarCorretor}
                onOpenRow={setSelectedRow}
                visibleCols={visibleCols}
                onChangeCols={setVisibleCols}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onGroupSelect={setGroupSelected}
              />

            );
          })}
        </div>
      )}

      {!loading && view !== "meta" && (
        <PdnResumoEquipes
          equipes={resumoEquipes}
          filtroCorretor={filtroCorretor}
          onChangeCorretor={setFiltroCorretor}
        />
      )}

      <PdnQuedaDialog
        row={quedaRow}
        onClose={() => setQuedaRow(null)}
        onConfirm={(action: QuedaAction, motivo: string) => {
          if (!quedaRow) return;
          if (action === "descartar") descartarLead(quedaRow, motivo);
          else if (action === "inativar") inativarLead(quedaRow, motivo);
          else marcarQueda(quedaRow, motivo);
          setQuedaRow(null);
        }}
      />

      <PdnRegredirDialog
        row={regredirRow?.row ?? null}
        onClose={() => setRegredirRow(null)}
        onConfirm={(destino, motivo) => {
          if (!regredirRow) return;
          mudarEtapa(regredirRow.row, destino, { motivo });
          setRegredirRow(null);
        }}
      />

      <PdnLeadDrawer
        row={selectedRow ? (filtered.find(r => r.id === selectedRow.id) ?? selectedRow) : null}
        onClose={() => setSelectedRow(null)}
        onSave={handleSave}
        onRemove={handleRemove}
        onQueda={setQuedaRow}
        onReativar={reativarQueda}
        onMudarEtapa={handleMudarEtapa}
        onLimparEtapa={limparEtapaOverride}
        onAvisar={avisarCorretor}
      />

      {view === "planilha" && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onPublish={bulkPublish}
          onQueda={bulkQueda}
        />
      )}

    </div>

  );
}

