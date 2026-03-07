import { useState, useMemo } from "react";
import { usePdn } from "@/hooks/usePdn";
import { useUserRole } from "@/hooks/useUserRole";
import PdnStats from "./PdnStats";
import PdnTable from "./PdnTable";
import PdnKanban from "./PdnKanban";
import PdnAlertsPanel from "./PdnAlertsPanel";
import IaCoreAction from "@/components/IaCoreAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, Download, Search, FileSpreadsheet, Sparkles, FileDown, LayoutGrid, Table2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthTabs() {
  // Start from March 2026, go up to current month (and one future month for creation)
  const startDate = new Date(2026, 2, 1); // March 2026
  const now = new Date();
  const tabs: { key: string; label: string }[] = [];
  let d = new Date(startDate);
  while (d <= now) {
    const key = format(d, "yyyy-MM");
    const label = `${MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
    tabs.push({ key, label });
    d = addMonths(d, 1);
  }
  return tabs;
}

interface PdnPanelProps {
  filterGerenteId?: string;
  readOnly?: boolean;
}

export default function PdnPanel({ filterGerenteId, readOnly }: PdnPanelProps) {
  const monthTabs = useMemo(getMonthTabs, []);
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const [selectedMes, setSelectedMes] = useState(currentMonthKey);
  const { entries, loading, stats, addEntry, updateEntry, deleteEntry, copyToCurrentMonth, currentMes } = usePdn(selectedMes, filterGerenteId);
  const { isAdmin } = useUserRole();
  const isCurrentMonth = selectedMes === currentMonthKey;
  const isReadOnly = readOnly || (!isCurrentMonth);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("");
  const [alertFilter, setAlertFilter] = useState<string | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [viewMode, setViewMode] = useState<"table" | "kanban">(isMobile ? "kanban" : "table");

  const uniqueCorretores = [...new Set(entries.map(e => e.corretor).filter(Boolean))];


  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleExportCsv = () => {
    const headers = ["Nome", "Und", "Empreendimento", "Docs", "Temperatura", "Corretor", "Último Contato", "Data Visita"];
    const rows = entries.map(e => [e.nome, e.und, e.empreendimento, e.docs_status, e.temperatura, e.corretor, e.ultimo_contato, e.data_visita]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PDN_${selectedMes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const DOCS_LABELS: Record<string, string> = { doc_completa: "DOC COMPLETA", em_andamento: "EM ANDAMENTO", sem_docs: "SEM DOCS" };
  const TEMP_LABELS: Record<string, string> = { quente: "QUENTE", morno: "MORNO", frio: "FRIO" };

  const handleExportPdf = () => {
    const mesLabel = monthTabs.find(t => t.key === selectedMes)?.label || selectedMes;
    const html = `
      <html><head><title>PDN - ${mesLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 13px; color: #666; margin-bottom: 16px; }
        .stats { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; }
        .stat b { display: block; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .quente { color: #dc2626; font-weight: 600; }
        .morno { color: #ca8a04; font-weight: 600; }
        .frio { color: #2563eb; font-weight: 600; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>PDN — Planilha de Desenvolvimento de Negócios</h1>
      <h2>${mesLabel} · ${entries.length} registros</h2>
      <div class="stats">
        <div class="stat"><b>${stats.quente}</b>Quentes</div>
        <div class="stat"><b>${stats.morno}</b>Mornos</div>
        <div class="stat"><b>${stats.frio}</b>Frios</div>
        <div class="stat"><b>${stats.doc_completa}</b>Doc Completa</div>
        <div class="stat"><b>${stats.em_andamento}</b>Em Andamento</div>
        <div class="stat"><b>${stats.sem_docs}</b>Sem Docs</div>
      </div>
      <table>
        <thead><tr>
          <th>Nome</th><th>Und</th><th>Empreendimento</th><th>Docs</th><th>Temp.</th><th>Corretor</th><th>Último Contato</th><th>Data</th>
        </tr></thead>
        <tbody>
          ${entries.map(e => `<tr>
            <td>${e.nome || ""}</td><td>${e.und || ""}</td><td>${e.empreendimento || ""}</td>
            <td>${DOCS_LABELS[e.docs_status] || e.docs_status}</td>
            <td class="${e.temperatura}">${TEMP_LABELS[e.temperatura] || e.temperatura}</td>
            <td>${e.corretor || ""}</td>
            <td>${e.ultimo_contato || ""}</td><td>${e.data_visita || ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      </body></html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    toast.success("PDF pronto para impressão!");
  };

  const contextForIa = {
    mes: selectedMes,
    total_visitas: stats.total,
    quentes: stats.quente,
    mornos: stats.morno,
    frios: stats.frio,
    doc_completa: stats.doc_completa,
    sem_docs: stats.sem_docs,
    em_andamento: stats.em_andamento,
    negócios: entries.slice(0, 30).map(e => ({
      nome: e.nome,
      empreendimento: e.empreendimento,
      temperatura: e.temperatura,
      docs: e.docs_status,
      corretor: e.corretor,
      ultimo_contato: e.ultimo_contato,
      proxima_acao: e.proxima_acao,
      data_proxima_acao: e.data_proxima_acao,
    })),
  };

  return (
    <div className="space-y-4">
      {/* Month tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {monthTabs.map(t => (
          <Button
            key={t.key}
            variant={selectedMes === t.key ? "default" : "outline"}
            size="sm"
            className="text-xs shrink-0"
            onClick={() => { setSelectedMes(t.key); setSelectedIds(new Set()); }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {!isCurrentMonth && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
          📁 Histórico — somente leitura. Para editar, selecione o mês atual.
          {selectedIds.size > 0 && (
            <Button size="sm" variant="secondary" className="ml-3 gap-1 text-xs h-7" onClick={() => copyToCurrentMonth(Array.from(selectedIds))}>
              <Copy className="h-3 w-3" /> Copiar {selectedIds.size} linhas para mês atual
            </Button>
          )}
        </div>
      )}

      <PdnStats {...stats} entries={entries} />

      {/* Alerts Panel */}
      <PdnAlertsPanel entries={entries} onFilterChange={setAlertFilter} activeFilter={alertFilter} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[120px] sm:min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        {uniqueCorretores.length > 0 && (
          <Select value={filterCorretor} onValueChange={v => setFilterCorretor(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-28 sm:w-32 text-xs"><SelectValue placeholder="Corretor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueCorretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-7 w-7 p-0"
            onClick={() => setViewMode("table")}
            title="Tabela"
          >
            <Table2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "kanban" ? "default" : "ghost"}
            className="h-7 w-7 p-0"
            onClick={() => setViewMode("kanban")}
            title="Kanban"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 hidden sm:block" />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handleExportPdf}>
            <FileDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando PDN...</div>
      ) : viewMode === "kanban" ? (
        <PdnKanban
          entries={entries}
          readOnly={isReadOnly}
          onUpdate={updateEntry}
          searchTerm={searchTerm}
          filterCorretor={filterCorretor}
        />
      ) : (
        <PdnTable
          entries={entries}
          readOnly={isReadOnly}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUpdate={updateEntry}
          onDelete={deleteEntry}
          onAdd={(situacao) => addEntry({ situacao })}
          searchTerm={searchTerm}
          filterCorretor={filterCorretor}
        />
      )}

      {/* IA Actions */}
      <div className="flex flex-wrap gap-2">
        <IaCoreAction
          module="general"
          prompt={`Analise o PDN (Planilha de Desenvolvimento de Negócios) do mês e gere: A) Diagnóstico rápido B) Top 5 negócios mais quentes C) Top 5 travados por DOCS D) Lista do que fazer hoje E) Sugestão de repasse para corretores. Dados: ${JSON.stringify(contextForIa)}`}
          context={contextForIa}
          label="Gerar Análise IA do PDN"
          variant="default"
        />
        <IaCoreAction
          module="general"
          prompt={`Gere um relatório mensal do PDN com: resumo de visitas, distribuição por temperatura e docs, ranking por empreendimento, ranking por corretor, top 10 negócios promissores e plano de ação para o próximo mês. Dados: ${JSON.stringify(contextForIa)}`}
          context={contextForIa}
          label="Gerar Relatório Mensal"
        />
      </div>
    </div>
  );
}
