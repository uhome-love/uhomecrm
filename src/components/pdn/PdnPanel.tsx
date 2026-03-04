import { useState, useMemo } from "react";
import { usePdn } from "@/hooks/usePdn";
import { useUserRole } from "@/hooks/useUserRole";
import PdnStats from "./PdnStats";
import PdnTable from "./PdnTable";
import IaCoreAction from "@/components/IaCoreAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, Download, Search, FileSpreadsheet, Sparkles } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthTabs() {
  const now = new Date();
  const tabs: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(d, "yyyy-MM");
    const label = `${MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
    tabs.push({ key, label });
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
  const [filterTemp, setFilterTemp] = useState("");
  const [filterDocs, setFilterDocs] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("");
  const [filterEquipe, setFilterEquipe] = useState("");

  const uniqueEmpreendimentos = [...new Set(entries.map(e => e.empreendimento).filter(Boolean))];
  const uniqueCorretores = [...new Set(entries.map(e => e.corretor).filter(Boolean))];
  const uniqueEquipes = [...new Set(entries.map(e => e.equipe).filter(Boolean))];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleExportCsv = () => {
    const headers = ["Nome", "UND", "Empreendimento", "Docs", "Temperatura", "Corretor", "Equipe", "Último Contato", "Data Visita"];
    const rows = entries.map(e => [e.nome, e.und, e.empreendimento, e.docs_status, e.temperatura, e.corretor, e.equipe, e.ultimo_contato, e.data_visita]);
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

      <PdnStats {...stats} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterTemp} onValueChange={v => setFilterTemp(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Temp." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="quente">Quente</SelectItem>
            <SelectItem value="morno">Morno</SelectItem>
            <SelectItem value="frio">Frio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDocs} onValueChange={v => setFilterDocs(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Docs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="doc_completa">Doc Completa</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="sem_docs">Sem Docs</SelectItem>
          </SelectContent>
        </Select>
        {uniqueEmpreendimentos.length > 0 && (
          <Select value={filterEmpreendimento} onValueChange={v => setFilterEmpreendimento(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Empreend." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueEmpreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {uniqueCorretores.length > 0 && (
          <Select value={filterCorretor} onValueChange={v => setFilterCorretor(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Corretor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {uniqueCorretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        {!isReadOnly && (
          <Button size="sm" className="gap-1 text-xs h-8" onClick={() => addEntry()}>
            <Plus className="h-3.5 w-3.5" /> Nova Linha
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando PDN...</div>
      ) : (
        <PdnTable
          entries={entries}
          readOnly={isReadOnly}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onUpdate={updateEntry}
          onDelete={deleteEntry}
          searchTerm={searchTerm}
          filterTemp={filterTemp}
          filterDocs={filterDocs}
          filterEmpreendimento={filterEmpreendimento}
          filterCorretor={filterCorretor}
          filterEquipe={filterEquipe}
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
