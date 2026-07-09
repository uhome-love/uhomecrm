import { useMemo, useState, useEffect } from "react";
import { usePdn, PDN_GRUPOS, type PdnGrupo, type PdnRow } from "@/hooks/usePdn";
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Download, Plus, Trash2, AlertTriangle, TrendingUp, FileSignature,
  ClipboardList, Loader2, ChevronDown, ChevronRight, ArrowUp, ArrowDown,
  ArrowUpDown, TrendingDown, RotateCcw, Wallet, LayoutGrid, Table as TableIcon,
} from "lucide-react";
import { PdnKanban } from "@/components/pdn/PdnKanban";

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

// ─── Seletor de Status (presets + livre) ──────────────────────────────────────
function StatusSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full text-left">
          {value
            ? <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusChipClass(value)}`}>{value}</span>
            : <span className="text-sm text-muted-foreground">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          {STATUS_OPTS.map(g => (
            <div key={g.grupo}>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map(s => (
                  <button
                    key={s}
                    onClick={() => { onChange(s); setOpen(false); }}
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
              onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChange(custom.trim()); setCustom(""); setOpen(false); } }}
              className="h-8"
            />
          </div>
          {value && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { onChange(""); setOpen(false); }}>
              Limpar status
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Observação multilinha (popover com textarea) ─────────────────────────────
function ObsSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => { if (local !== (value ?? "")) onChange(local); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) commit(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <button className="line-clamp-2 w-full whitespace-pre-wrap text-left text-sm text-muted-foreground hover:text-foreground">
          {value ? value : <span className="text-muted-foreground/60">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Textarea
          autoFocus
          value={local}
          placeholder="Anotações do gestor (uso interno)…"
          onChange={(e) => setLocal(e.target.value)}
          className="min-h-[120px] resize-y text-sm"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={commit}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PdnGestor() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [mes, setMes] = useState(monthOptions[0].value);
  const [filtroRisco, setFiltroRisco] = useState(false);
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
  const [view, setView] = useState<"planilha" | "kanban">(() => {
    try { return (sessionStorage.getItem("pdn:view") as "planilha" | "kanban") || "planilha"; } catch { return "planilha"; }
  });
  useEffect(() => { try { sessionStorage.setItem("pdn:view", view); } catch { /* ignore */ } }, [view]);

  const { isDiretor, isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const { rows, hiddenRows, resumo, loading, saveOverride, marcarQueda, reativarQueda, ocultarRow, restaurarRow, addManualRow, updateManualRow, deleteRow } = usePdn(mes);
  const [showOcultos, setShowOcultos] = useState(false);

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
  }, [rows, filtroRisco, filtroEquipe, filtroCorretor, kpiFilter, sortKey, sortDir]);

  // Grupos visíveis conforme filtro de KPI
  const gruposVisiveis = useMemo<PdnGrupo[]>(() => {
    if (kpiFilter === "ganho") return ["ganho"];
    if (kpiFilter === "contrato") return ["contrato"];
    if (kpiFilter === "negociacao") return ["em_negociacao"];
    return PDN_GRUPOS.map(g => g.key);
  }, [kpiFilter]);

  const visitasMes = useMemo(() => rows.filter(r => r.grupoOrigem === "visita_realizada").length, [rows]);

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

  // Remover da planilha: linha manual = exclui de vez; negócio do pipeline = oculta (overlay), sem tocar no pipeline.
  const handleRemove = (row: PdnRow) => {
    if (row.isManual && row.overrideId) deleteRow(row.overrideId);
    else ocultarRow(row);
  };

  const moveManual = (overrideId: string, grupo: PdnGrupo) => {
    updateManualRow(overrideId, { situacao: grupo });
  };

  // Resumo por corretor (VGV e nº de negócios, exclui caídos)
  const resumoCorretor = useMemo(() => {
    const map: Record<string, { count: number; vgv: number }> = {};
    for (const r of filtered) {
      if (r.grupo === "caidos" || r.corretor === "—") continue;
      (map[r.corretor] ||= { count: 0, vgv: 0 });
      map[r.corretor].count++;
      map[r.corretor].vgv += r.vgv;
    }
    return Object.entries(map).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.vgv - a.vgv);
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <ClipboardList className="h-5 w-5 text-primary" /> PDN — Plano de Negócios
          </h1>
          <p className="text-sm text-muted-foreground">Planilha de gestão do mês, integrada ao pipeline. Status e observações são internos (não aparecem para o corretor).</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-lg border p-0.5">
            <Button variant={view === "planilha" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => setView("planilha")}>
              <TableIcon className="mr-1.5 h-4 w-4" /> Planilha
            </Button>
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="h-8 px-2.5" onClick={() => setView("kanban")}>
              <LayoutGrid className="mr-1.5 h-4 w-4" /> Kanban
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1.5 h-4 w-4" /> Exportar</Button>
        </div>
      </div>

      {/* Resumo — KPIs clicáveis */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="VGV Total" value={fmtMoney(resumo.vgvTotal, "short")} accent="text-foreground" icon={<Wallet className="h-4 w-4" />} active={kpiFilter === null} onClick={() => setKpiFilter(null)} />
        <SummaryCard label="Ganhos" value={fmtMoney(resumo.byGrupo.ganho.vgv, "short")} sub={`${resumo.byGrupo.ganho.count} negócios`} accent="text-emerald-500" icon={<FileSignature className="h-4 w-4" />} active={kpiFilter === "ganho"} onClick={() => toggleKpi("ganho")} />
        <SummaryCard label="Contrato" value={fmtMoney(resumo.byGrupo.contrato.vgv, "short")} sub={`${resumo.byGrupo.contrato.count} contratos`} accent="text-cyan-500" active={kpiFilter === "contrato"} onClick={() => toggleKpi("contrato")} />
        <SummaryCard label="Forecast ponderado" value={fmtMoney(resumo.forecast, "short")} accent="text-primary" icon={<TrendingUp className="h-4 w-4" />} active={kpiFilter === "negociacao"} onClick={() => toggleKpi("negociacao")} />
        <SummaryCard label="Em risco" value={String(resumo.emRisco)} sub="parados +7d" accent="text-amber-500" icon={<AlertTriangle className="h-4 w-4" />} active={kpiFilter === "risco"} onClick={() => toggleKpi("risco")} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filtroRisco ? "default" : "outline"} size="sm" onClick={() => setFiltroRisco(v => !v)}>
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Em risco
        </Button>
        {showEquipeFilter && (
          <Select value={filtroEquipe} onValueChange={(v) => { setFiltroEquipe(v); setFiltroCorretor("todos"); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Equipe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as equipes</SelectItem>
              {equipes.map(e => <SelectItem key={e} value={e}>Equipe {e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os corretores</SelectItem>
            {corretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {kpiFilter && (
          <Button variant="ghost" size="sm" onClick={() => setKpiFilter(null)}>Limpar recorte</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : view === "kanban" ? (
        <PdnKanban
          rows={filtered}
          onSave={handleSave}
          onUpdateManual={updateManualRow}
          onDelete={deleteRow}
          onQueda={setQuedaRow}
          onReativar={reativarQueda}
          onMoveManual={moveManual}
          onAdd={addManualRow}
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
                extraLabel={g.key === "visita_realizada" ? `${visitasMes} no mês` : undefined}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                isMobile={isMobile}
                onAdd={() => addManualRow(g.key)}
                onSave={handleSave}
                onUpdateManual={updateManualRow}
                onDelete={deleteRow}
                onQueda={setQuedaRow}
                onReativar={reativarQueda}
              />
            );
          })}
        </div>
      )}

      {/* Resumo por corretor */}
      {!loading && resumoCorretor.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">Resumo por corretor</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resumoCorretor.map(c => (
              <div key={c.nome} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{c.count} negócio{c.count > 1 ? "s" : ""}</div>
                </div>
                <div className="text-sm font-semibold text-primary">{fmtMoney(c.vgv, "short")}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <QuedaDialog
        row={quedaRow}
        onClose={() => setQuedaRow(null)}
        onConfirm={(motivo) => { if (quedaRow) marcarQueda(quedaRow, motivo); setQuedaRow(null); }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, icon, active, onClick }: {
  label: string; value: string; sub?: string; accent: string; icon?: React.ReactNode; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 text-left transition hover:shadow-sm ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon && <span className={accent}>{icon}</span>}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </button>
  );
}

function SortHeader({ label, active, dir, onClick, className = "" }: {
  label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string;
}) {
  return (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );
}

function GrupoBloco({
  grupo, label, cor, rows, collapsed, onToggleCollapse, extraLabel, sortKey, sortDir, onSort,
  isMobile, onAdd, onSave, onUpdateManual, onDelete, onQueda, onReativar,
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
  onAdd: () => void;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao">>) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onDelete: (overrideId: string) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
}) {
  const isCaidos = grupo === "caidos";
  const subtotal = rows.reduce((s, r) => s + r.vgv, 0);

  return (
    <Card className={`overflow-hidden ${isCaidos ? "border-red-500/40" : ""}`}>
      <button
        onClick={onToggleCollapse}
        className={`flex w-full items-center justify-between px-4 py-2.5 ${isCaidos ? "bg-red-500/5" : ""}`}
        style={{ borderLeft: `3px solid ${cor}` }}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${isCaidos ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{label}</span>
          <Badge variant={isCaidos ? "destructive" : "secondary"}>{rows.length}</Badge>
          {extraLabel && <span className="text-xs text-muted-foreground">· {extraLabel}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: cor }}>{fmtMoney(subtotal, "exact")}</span>
          {!isCaidos && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        isMobile ? (
          <div className="divide-y">
            {rows.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</div>
            ) : rows.map(r => (
              <MobileCard key={r.id} r={r} onSave={onSave} onUpdateManual={onUpdateManual} onDelete={onDelete} onQueda={onQueda} onReativar={onReativar} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader label="Nome" active={sortKey === "nome"} dir={sortDir} onClick={() => onSort("nome")} className="min-w-[150px]" />
                  <SortHeader label="Data" active={sortKey === "data"} dir={sortDir} onClick={() => onSort("data")} className="w-[110px]" />
                  <TableHead className="min-w-[140px]">Empreendimento</TableHead>
                  <SortHeader label="VGV" active={sortKey === "vgv"} dir={sortDir} onClick={() => onSort("vgv")} className="w-[120px]" />
                  <SortHeader label="Corretor" active={sortKey === "corretor"} dir={sortDir} onClick={() => onSort("corretor")} className="min-w-[120px]" />
                  <SortHeader label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => onSort("status")} className="min-w-[130px]" />
                  <TableHead className="min-w-[200px]">Observação</TableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio neste grupo.</TableCell></TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} className={`${r.emRisco ? "bg-amber-500/5" : ""} ${r.caiu ? "opacity-70" : ""}`}>
                    <TableCell className="font-medium">
                      {r.isManual ? (
                        <EditableCell value={r.nome} onCommit={(v) => r.overrideId && onUpdateManual(r.overrideId, { nome: v })} />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          {r.nome}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.isManual
                        ? <EditableCell type="date" value={r.data} onCommit={(v) => r.overrideId && onUpdateManual(r.overrideId, { data_visita: v })} />
                        : (r.data ? formatBRT(r.data, "dd/MM/yy") : "—")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.isManual
                        ? <EditableCell value={r.empreendimento === "—" ? "" : r.empreendimento} onCommit={(v) => r.overrideId && onUpdateManual(r.overrideId, { empreendimento: v })} />
                        : r.empreendimento}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {r.isManual
                        ? <EditableCell type="number" value={r.vgv || ""} onCommit={(v) => r.overrideId && onUpdateManual(r.overrideId, { vgv: Number(v) || 0 })} />
                        : fmtMoney(r.vgv, "exact")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.isManual
                        ? <EditableCell value={r.corretor === "—" ? "" : r.corretor} onCommit={(v) => r.overrideId && onUpdateManual(r.overrideId, { corretor: v })} />
                        : r.corretor}
                    </TableCell>
                    <TableCell>
                      <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
                    </TableCell>
                    <TableCell>
                      {r.caiu && r.motivoQueda
                        ? <div className="text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
                        : <ObsSelector value={r.observacoes} onChange={(v) => onSave(r, { observacoes: v })} />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {r.caiu ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-600" title="Reativar" onClick={() => onReativar(r)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" title="Marcar como caiu" onClick={() => onQueda(r)}>
                            <TrendingDown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {r.isManual && r.overrideId && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(r.overrideId!)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </Card>
  );
}

function MobileCard({ r, onSave, onUpdateManual, onDelete, onQueda, onReativar }: {
  r: PdnRow;
  onSave: (row: PdnRow, patch: Partial<Pick<PdnRow, "status" | "observacoes" | "proximaAcao">>) => void;
  onUpdateManual: (overrideId: string, patch: Record<string, any>) => void;
  onDelete: (overrideId: string) => void;
  onQueda: (row: PdnRow) => void;
  onReativar: (row: PdnRow) => void;
}) {
  return (
    <div className={`space-y-2 p-3 ${r.emRisco ? "bg-amber-500/5" : ""} ${r.caiu ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {r.emRisco && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            <span className="truncate">{r.nome}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {r.empreendimento !== "—" ? r.empreendimento : "Sem empreendimento"} · {r.data ? formatBRT(r.data, "dd/MM/yy") : "—"}
          </div>
        </div>
        <div className="text-right text-sm font-semibold">{fmtMoney(r.vgv, "short")}</div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{r.corretor}{r.equipe !== "—" ? ` · ${r.equipe}` : ""}</span>
        <StatusSelector value={r.status} onChange={(v) => onSave(r, { status: v })} />
      </div>
      {r.caiu && r.motivoQueda ? (
        <div className="rounded-md bg-red-500/5 px-2 py-1 text-xs"><span className="font-medium text-red-600 dark:text-red-400">Queda:</span> {r.motivoQueda}</div>
      ) : (
        <ObsSelector value={r.observacoes} onChange={(v) => onSave(r, { observacoes: v })} />
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
        {r.isManual && r.overrideId && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(r.overrideId!)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function QuedaDialog({ row, onClose, onConfirm }: {
  row: PdnRow | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { setMotivo(""); }, [row]);
  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar negócio como caiu</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Isso move <span className="font-medium text-foreground">{row?.nome}</span> para a seção "Caídos" apenas no PDN. O pipeline do corretor não é alterado.
        </p>
        <Textarea
          autoFocus
          value={motivo}
          placeholder="Motivo da queda (ex.: desistiu, sem crédito, comprou em outro lugar)…"
          onChange={(e) => setMotivo(e.target.value)}
          className="min-h-[90px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => onConfirm(motivo.trim())}>Confirmar queda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
