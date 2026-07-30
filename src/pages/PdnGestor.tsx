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

// ─── Status: opções fixas (com cores) + livre ─────────────────────────────────
const STATUS_OPTS: { grupo: string; items: string[] }[] = [
  { grupo: "Comercial", items: ["Aguardando docs", "Em aprovação", "Negociando", "Proposta", "Follow up"] },
  { grupo: "Contrato", items: ["Em confecção", "Gerado", "Assinado"] },
];
const STATUS_COLOR: Record<string, string> = {
  "Aguardando docs": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "Em aprovação": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "Negociando": "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "Proposta": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "Follow up": "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "Em confecção": "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "Gerado": "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "Assinado": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
function statusChipClass(s: string) {
  return STATUS_COLOR[s] || "bg-muted text-muted-foreground";
}

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

type SortKey = "nome" | "data" | "vgv" | "corretor" | "status";
type KpiFilter = null | "ganho" | "contrato" | "risco" | "negociacao";

// Regressão de etapa PDN: qual é a etapa anterior de cada grupo (null = não pode regredir)
const PREV_GRUPO: Record<PdnGrupo, PdnGrupo | null> = {
  pos_visita: null,
  em_negociacao: "pos_visita",
  contrato: "em_negociacao",
  ganho: "contrato",
  caidos: null,
};
const GRUPO_LABEL_UI: Record<PdnGrupo, string> = {
  pos_visita: "Pós-Visita",
  em_negociacao: "Em Negociação",
  contrato: "Contrato",
  ganho: "Ganho",
  caidos: "Caídos",
};

// ─── Célula editável simples (input com commit no blur) ───────────────────────
function EditableCell({
  value, onCommit, type = "text", placeholder, className = "",
}: {
  value: string | number;
  onCommit: (v: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
}) {
  const [local, setLocal] = useState(String(value ?? ""));
  useEffect(() => { setLocal(String(value ?? "")); }, [value]);
  return (
    <Input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== String(value ?? "")) onCommit(local); }}
      className={`h-8 border-transparent bg-transparent px-2 hover:border-border focus:border-primary ${className}`}
    />
  );
}

// ─── Guarda: evita que o clique/close de um popover inline (Status/Obs/Empr)
// vaze para a TableRow e abra o drawer sem querer. Ativa por 400ms após close.
let __pdnSuppressRowOpenUntil = 0;
function suppressPdnRowOpen() {
  __pdnSuppressRowOpenUntil = Date.now() + 400;
}
export function isPdnRowOpenSuppressed() {
  return Date.now() < __pdnSuppressRowOpenUntil;
}

// ─── Seletor de Status (presets + livre) ──────────────────────────────────────
function StatusSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) suppressPdnRowOpen(); }}>
      <PopoverTrigger asChild>
        <button className="w-full text-left" onClick={(e) => e.stopPropagation()}>
          {value
            ? <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusChipClass(value)}`}>{value}</span>
            : <span className="text-sm text-muted-foreground">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          {STATUS_OPTS.map(g => (
            <div key={g.grupo}>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map(s => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onChange(s); suppressPdnRowOpen(); setOpen(false); }}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${value === s ? "ring-2 ring-primary " : ""}${statusChipClass(s)}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-2">
            <Input
              value={custom}
              placeholder="Status personalizado…"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChange(custom.trim()); setCustom(""); suppressPdnRowOpen(); setOpen(false); } }}
              className="h-8"
            />
          </div>
          {value && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={(e) => { e.stopPropagation(); onChange(""); suppressPdnRowOpen(); setOpen(false); }}>
              Limpar status
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Observação multilinha (popover com textarea + salvar/publicar) ───────────
function ObsSelector({
  value, onChange, pipelineLeadId, row,
}: {
  value: string;
  onChange: (v: string) => void;
  pipelineLeadId?: string | null;
  row?: PdnRow;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  const [publishing, setPublishing] = useState(false);
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => { if (local !== (value ?? "")) onChange(local); suppressPdnRowOpen(); setOpen(false); };
  const commitAndPublish = async () => {
    if (!pipelineLeadId) return;
    const clean = local.trim();
    if (!clean) { toast.info("Escreva algo antes de publicar"); return; }
    setPublishing(true);
    try {
      if (local !== (value ?? "")) onChange(local);
      await publicarNoLead(pipelineLeadId, "observacao", clean, row);
      suppressPdnRowOpen();
      setOpen(false);
    } finally { setPublishing(false); }
  };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o && !publishing) commit(); else if (o) setOpen(true); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-4 w-full whitespace-pre-wrap break-words text-left text-sm text-muted-foreground hover:text-foreground"
        >
          {value ? value : <span className="text-muted-foreground/60">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Textarea
          autoFocus
          value={local}
          placeholder="Anotações do gestor…"
          onChange={(e) => setLocal(e.target.value)}
          className="min-h-[120px] resize-y text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {pipelineLeadId ? "Publicar também avisa o corretor no histórico do lead." : "Sem lead vinculado — só grava no PDN."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); commit(); }} disabled={publishing}>Salvar</Button>
            {pipelineLeadId && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); commitAndPublish(); }} disabled={publishing || !local.trim()}>
                {publishing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Megaphone className="mr-1 h-3 w-3" />}
                Salvar e publicar
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


// ─── Célula editável com quebra de linha (empreendimento) ─────────────────────
function EditableWrapCell({ value, onCommit, placeholder }: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => { if (local !== (value ?? "")) onCommit(local); suppressPdnRowOpen(); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) commit(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-full whitespace-pre-wrap break-words text-left text-sm hover:text-foreground"
        >
          {value ? value : <span className="text-muted-foreground/60">{placeholder || "—"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Textarea
          autoFocus
          value={local}
          placeholder={placeholder || "Empreendimento…"}
          onChange={(e) => setLocal(e.target.value)}
          className="min-h-[70px] resize-y text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); commit(); }}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


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
  const [showOcultos, setShowOcultos] = useState(false);

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
          showOcultos={showOcultos}
          onToggleOcultos={() => setShowOcultos(v => !v)}
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
          hiddenRows={[]}
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


function ResizableHead({ colKey, width, onResize, label, sortActive, dir, onSort }: {
  colKey: string;
  width: number;
  onResize: (key: string, w: number) => void;
  label: string;
  sortActive?: boolean;
  dir?: "asc" | "desc";
  onSort?: () => void;
}) {
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => onResize(colKey, startW + (ev.clientX - startX));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };
  return (
    <TableHead className="relative select-none">
      {onSort ? (
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onSort}>
          {label}
          {sortActive ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      ) : (
        <span>{label}</span>
      )}
      <span
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
        title="Arraste para redimensionar"
      />
    </TableHead>
  );
}



function GrupoBloco({
  grupo, label, cor, rows, collapsed, onToggleCollapse, extraLabel, sortKey, sortDir, onSort,
  isMobile, colWidths, onColResize, onSave, onUpdateManual, onRemove, onQueda, onReativar,
  onMudarEtapa, onAvisar, onOpenRow,
  visibleCols, onChangeCols, selectedIds, onToggleSelected, onGroupSelect,
}: {
  grupo: PdnGrupo;
  label: string;
  cor: string;
  rows: PdnRow[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  extraLabel?: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  isMobile: boolean;
  colWidths: Record<string, number>;
  onColResize: (key: string, w: number) => void;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao" | "empreendimento" | "vgv">>) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  onOpenRow: (row: PdnRow) => void;
  visibleCols: Record<PdnColKey, boolean>;
  onChangeCols: (cols: Record<PdnColKey, boolean>) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onGroupSelect: (ids: string[], selected: boolean) => void;
}) {
  const isCaidos = grupo === "caidos";
  const subtotal = rows.reduce((s, r) => s + r.vgv, 0);
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
  const someSelected = rows.some(r => selectedIds.has(r.id));

  // Abre o drawer se o clique não veio de um campo editável ou ação (marcados com data-no-row-open).
  const handleRowClick = (r: PdnRow, e: React.MouseEvent) => {
    if (isPdnRowOpenSuppressed()) return;
    if ((e.target as HTMLElement).closest("[data-no-row-open]")) return;
    onOpenRow(r);
  };

  // Ordem das colunas: nome (fixo), data, empreendimento, vgv, corretor, status, obs, ações (fixo).
  const cols: PdnColKey[] = ["data", "empreendimento", "vgv", "corretor", "status", "obs"];
  const visibleColCount = 1 + cols.filter(c => visibleCols[c]).length + 1; // nome + ações
  const emptyColSpan = 1 /*checkbox*/ + visibleColCount;

  return (
    <Card className={`overflow-hidden ${isCaidos ? "border-red-500/40" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapse}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleCollapse(); } }}
        className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 ${isCaidos ? "bg-red-500/5" : ""}`}
        style={{ borderLeft: `3px solid ${cor}` }}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${isCaidos ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{label}</span>
          <Badge variant={isCaidos ? "destructive" : "secondary"}>{rows.length}</Badge>
          {extraLabel && <span className="text-xs text-muted-foreground">· {extraLabel}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: cor }}>{fmtMoney(subtotal, "exact")}</span>
          {!isMobile && (
            <span onClick={(e) => e.stopPropagation()}>
              <ColumnsMenu cols={visibleCols} onChange={onChangeCols} />
            </span>
          )}


        </div>
      </div>


      {!collapsed && (
        isMobile ? (
          <div className="divide-y">
            {rows.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</div>
            ) : rows.map(r => (
              <MobileCard
                key={r.id}
                r={r}
                onSave={onSave}
                onUpdateManual={onUpdateManual}
                onRemove={onRemove}
                onQueda={onQueda}
                onReativar={onReativar}
                onMudarEtapa={onMudarEtapa}
                onAvisar={onAvisar}
                onOpenRow={onOpenRow}
                selected={selectedIds.has(r.id)}
                onToggleSelected={() => onToggleSelected(r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: "fixed", width: "100%", minWidth: 980 }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: colWidths.nome }} />
                {visibleCols.data && <col style={{ width: colWidths.data }} />}
                {visibleCols.empreendimento && <col style={{ width: colWidths.empreendimento }} />}
                {visibleCols.vgv && <col style={{ width: colWidths.vgv }} />}
                {visibleCols.corretor && <col style={{ width: colWidths.corretor }} />}
                {visibleCols.status && <col style={{ width: colWidths.status }} />}
                {visibleCols.obs && <col style={{ width: colWidths.obs }} />}
                <col style={{ width: 120 }} />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected ? true : (someSelected ? "indeterminate" : false)}
                      onCheckedChange={(v) => onGroupSelect(rows.map(r => r.id), v === true)}
                      aria-label="Selecionar todos deste grupo"
                    />
                  </TableHead>
                  <ResizableHead colKey="nome" width={colWidths.nome} onResize={onColResize} label="Nome" sortActive={sortKey === "nome"} dir={sortDir} onSort={() => onSort("nome")} />
                  {visibleCols.data && <ResizableHead colKey="data" width={colWidths.data} onResize={onColResize} label="Data" sortActive={sortKey === "data"} dir={sortDir} onSort={() => onSort("data")} />}
                  {visibleCols.empreendimento && <ResizableHead colKey="empreendimento" width={colWidths.empreendimento} onResize={onColResize} label="Empreendimento" />}
                  {visibleCols.vgv && <ResizableHead colKey="vgv" width={colWidths.vgv} onResize={onColResize} label="VGV" sortActive={sortKey === "vgv"} dir={sortDir} onSort={() => onSort("vgv")} />}
                  {visibleCols.corretor && <ResizableHead colKey="corretor" width={colWidths.corretor} onResize={onColResize} label="Corretor" sortActive={sortKey === "corretor"} dir={sortDir} onSort={() => onSort("corretor")} />}
                  {visibleCols.status && <ResizableHead colKey="status" width={colWidths.status} onResize={onColResize} label="Status" sortActive={sortKey === "status"} dir={sortDir} onSort={() => onSort("status")} />}
                  {visibleCols.obs && <ResizableHead colKey="obs" width={colWidths.obs} onResize={onColResize} label="Observação" />}
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={emptyColSpan} className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</TableCell></TableRow>
                ) : rows.map(r => {
                  const selected = selectedIds.has(r.id);
                  return (

                  <TableRow
                    key={r.id}
                    onClick={(e) => handleRowClick(r, e)}
                    className={`group cursor-pointer ${r.emRisco ? "bg-amber-500/5" : ""} ${selected ? "bg-primary/5" : ""} ${r.caiu ? "opacity-70" : ""} even:bg-muted/10 hover:bg-muted/30`}
                  >
                    <TableCell data-no-row-open>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelected(r.id)}
                        aria-label="Selecionar linha"
                      />
                    </TableCell>
                    <TableCell className="py-2 font-medium">
                      <div className="flex w-full items-center gap-1.5 text-left hover:text-primary" title="Abrir detalhes">
                        {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className="truncate underline-offset-2 group-hover:underline">{r.nome}</span>
                      </div>
                      <div className="mt-1" data-no-row-open>
                        <Select value={r.grupo} onValueChange={(v) => onMudarEtapa(r, v as PdnGrupo)}>
                          <SelectTrigger className="h-6 border-transparent bg-transparent px-1 text-[11px] text-muted-foreground hover:border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key} className="text-xs">{g.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>

                    {visibleCols.data && (
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {r.data ? formatBRT(r.data, "dd/MM/yy") : "—"}
                      </TableCell>
                    )}
                    {visibleCols.empreendimento && (
                      <TableCell className="py-2 text-sm" data-no-row-open>
                        {r.negocioId ? (
                          <EditableWrapCell
                            value={r.empreendimento === "—" ? "" : r.empreendimento}
                            placeholder="Empreendimento…"
                            onCommit={(v) => onSaveNegocio(r, { empreendimento: v })}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground/70" title="Sem negócio vinculado — abra o lead para criar o negócio">
                            {r.empreendimento === "—" ? "—" : r.empreendimento}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.vgv && (
                      <TableCell className="py-2 text-sm font-medium" data-no-row-open>
                        {r.negocioId ? (
                          <MoneyInput value={r.vgv || 0} onCommit={(v) => onSaveNegocio(r, { vgv: v })} />
                        ) : (
                          <span className="tabular-nums text-muted-foreground/70" title="Sem negócio vinculado — abra o lead para criar o negócio">
                            {r.vgv > 0 ? fmtMoney(r.vgv, "short") : "—"}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {visibleCols.corretor && (
                      <TableCell className="py-2 text-sm text-muted-foreground">{r.corretor}</TableCell>
                    )}
                    {visibleCols.status && (
                      <TableCell className="py-2" data-no-row-open>
                        <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
                      </TableCell>
                    )}
                    {visibleCols.obs && (
                      <TableCell className="py-2" data-no-row-open>
                        {r.caiu && r.motivoQueda
                          ? <div className="text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
                          : <ObsSelector value={r.observacoes} pipelineLeadId={r.pipelineLeadId} row={r} onChange={(v) => onSave(r, { observacoes: v })} />}
                      </TableCell>
                    )}
                    <TableCell data-no-row-open>
                      <div className="flex items-center justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                        {r.caiu ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-600" title="Reativar" onClick={() => onReativar(r)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" title="Marcar como caiu" onClick={() => onQueda(r)}>
                            <TrendingDown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(() => {
                          const prev = PREV_GRUPO[r.grupo];
                          const canRegress = !r.caiu && prev && (r.pipelineLeadId || r.negocioId);
                          if (canRegress) {
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                                title={`Regredir para ${GRUPO_LABEL_UI[prev!]} (avisa o corretor)`}
                                onClick={() => onMudarEtapa(r, prev!)}
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            );
                          }
                          return (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Marcar como caiu / descartar" onClick={() => onRemove(r)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          );
                        })()}
                      </div>
                    </TableCell>

                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </Card>
  );
}





function MobileCard({ r, onSave, onUpdateManual, onRemove, onQueda, onReativar, onMudarEtapa, onAvisar, onOpenRow, selected, onToggleSelected }: {
  r: PdnRow;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao" | "empreendimento" | "vgv">>) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onRemove: (row: PdnRow) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
  onMudarEtapa: (row: PdnRow, grupo: PdnGrupo) => void;
  onAvisar: (row: PdnRow, mensagem: string) => void;
  onOpenRow: (row: PdnRow) => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  return (
    <div className={`space-y-2 p-3 ${r.emRisco ? "bg-amber-500/5" : ""} ${selected ? "bg-primary/5" : ""} ${r.caiu ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Checkbox className="mt-0.5" checked={selected} onCheckedChange={onToggleSelected} aria-label="Selecionar" />
          <div className="min-w-0">
            <button type="button" onClick={() => onOpenRow(r)} className="flex items-center gap-1.5 text-left font-medium hover:text-primary">
              {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span className="truncate underline-offset-2 hover:underline">{r.nome}</span>
            </button>
            <div className="text-xs text-muted-foreground">
              {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"} · {r.data ? formatBRT(r.data, "dd/MM/yy") : "—"}
            </div>
          </div>
        </div>
        <div className="text-right text-sm font-semibold">{r.vgv > 0 ? fmtMoney(r.vgv, "short") : "—"}</div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{r.corretor}{r.equipe !== "—" ? ` · ${r.equipe}` : ""}</span>
        <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
      </div>
      <div className="flex items-center gap-2">
        <Select value={r.grupo} onValueChange={(v) => onMudarEtapa(r, v as PdnGrupo)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PDN_GRUPOS.map(g => <SelectItem key={g.key} value={g.key} className="text-xs">{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {r.caiu && r.motivoQueda ? (
        <div className="rounded-md bg-red-500/5 px-2 py-1 text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
      ) : (
        <ObsSelector value={r.observacoes} pipelineLeadId={r.pipelineLeadId} row={r} onChange={(v) => onSave(r, { observacoes: v })} />
      )}
      <div className="flex items-center justify-end gap-1">
        {r.caiu ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onReativar(r)}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reativar
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => onQueda(r)}>
            <TrendingDown className="mr-1 h-3 w-3" /> Caiu
          </Button>
        )}
        {(() => {
          const prev = PREV_GRUPO[r.grupo];
          if (!r.caiu && prev) {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                title={`Regredir para ${GRUPO_LABEL_UI[prev]}`}
                onClick={() => onMudarEtapa(r, prev)}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            );
          }
          return (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Marcar como caiu / descartar" onClick={() => onRemove(r)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          );
        })()}
      </div>
    </div>
  );
}





function ArquivadosView({
  hiddenRows, caidosRows, onRestaurar, onReativar, onOpen,
}: {
  hiddenRows: PdnRow[];
  caidosRows: PdnRow[];
  onRestaurar: (r: PdnRow) => void;
  onReativar: (r: PdnRow) => void;
  onOpen: (r: PdnRow) => void;
}) {
  const groups = [
    { title: "Caídos / Descartados / Inativados", rows: caidosRows, action: "reativar" as const },
    { title: "Removidos da planilha", rows: hiddenRows, action: "restaurar" as const },
  ];
  const total = caidosRows.length + hiddenRows.length;
  if (total === 0) {
    return (
      <Card className="border-dashed py-16 text-center text-sm text-muted-foreground">
        <Archive className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Nenhum negócio arquivado neste mês.
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {groups.map(g => g.rows.length > 0 && (
        <Card key={g.title} className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Archive className="h-4 w-4" /> {g.title} <Badge variant="outline">{g.rows.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {g.rows.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <button className="min-w-0 text-left hover:text-primary" onClick={() => onOpen(r)}>
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-muted-foreground"> · {r.empreendimento !== "—" ? r.empreendimento : "sem empreendimento"} · {fmtMoney(r.vgv, "short")} · {r.corretor}</span>
                  {r.motivoQueda && <div className="text-xs text-red-600 dark:text-red-400">Motivo: {r.motivoQueda}</div>}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => g.action === "reativar" ? onReativar(r) : onRestaurar(r)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {g.action === "reativar" ? "Reativar" : "Restaurar"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

