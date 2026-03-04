import { useState, useRef } from "react";
import { type PdnEntry } from "@/hooks/usePdn";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  entries: PdnEntry[];
  readOnly?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  searchTerm: string;
  filterTemp: string;
  filterDocs: string;
  filterEmpreendimento: string;
  filterCorretor: string;
  filterEquipe: string;
}

const TEMP_COLORS: Record<string, string> = {
  quente: "bg-red-500/10 text-red-600 border-red-500/30",
  morno: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  frio: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const DOCS_COLORS: Record<string, string> = {
  doc_completa: "bg-green-500/10 text-green-600 border-green-500/30",
  em_andamento: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  sem_docs: "bg-muted text-muted-foreground border-border",
};

const TEMP_LABELS: Record<string, string> = { quente: "QUENTE", morno: "MORNO", frio: "FRIO" };
const DOCS_LABELS: Record<string, string> = { doc_completa: "DOC COMPLETA", em_andamento: "EM ANDAMENTO", sem_docs: "SEM DOCS" };
const TIPO_VISITA_LABELS: Record<string, string> = { "1a_visita": "1ª Visita", retorno: "Retorno", visita_tecnica: "V. Técnica", plantao: "Plantão" };
const PROXIMA_ACAO_LABELS: Record<string, string> = { ligar: "Ligar", whatsapp: "WhatsApp", enviar_docs: "Enviar Docs", agendar_retorno: "Agendar Retorno", proposta: "Proposta" };

type SortKey = "nome" | "empreendimento" | "temperatura" | "docs_status" | "corretor" | "equipe" | "data_visita";

export default function PdnTable({ entries, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, searchTerm, filterTemp, filterDocs, filterEmpreendimento, filterCorretor, filterEquipe }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("data_visita");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = entries.filter(e => {
    if (searchTerm && !e.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTemp && e.temperatura !== filterTemp) return false;
    if (filterDocs && e.docs_status !== filterDocs) return false;
    if (filterEmpreendimento && e.empreendimento !== filterEmpreendimento) return false;
    if (filterCorretor && e.corretor !== filterCorretor) return false;
    if (filterEquipe && e.equipe !== filterEquipe) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = (a as any)[sortKey] || "";
    const vb = (b as any)[sortKey] || "";
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {!readOnly && <th className="px-2 py-2 w-8"><Checkbox /></th>}
            <th className="px-2 py-2 text-left cursor-pointer select-none" onClick={() => handleSort("nome")}>
              <span className="flex items-center gap-1">Nome <SortIcon col="nome" /></span>
            </th>
            <th className="px-2 py-2 text-left w-16">UND</th>
            <th className="px-2 py-2 text-left cursor-pointer select-none" onClick={() => handleSort("empreendimento")}>
              <span className="flex items-center gap-1">Empreend. <SortIcon col="empreendimento" /></span>
            </th>
            <th className="px-2 py-2 text-center cursor-pointer select-none" onClick={() => handleSort("docs_status")}>
              <span className="flex items-center justify-center gap-1">Docs <SortIcon col="docs_status" /></span>
            </th>
            <th className="px-2 py-2 text-center cursor-pointer select-none" onClick={() => handleSort("temperatura")}>
              <span className="flex items-center justify-center gap-1">Temp. <SortIcon col="temperatura" /></span>
            </th>
            <th className="px-2 py-2 text-left cursor-pointer select-none" onClick={() => handleSort("corretor")}>
              <span className="flex items-center gap-1">Corretor <SortIcon col="corretor" /></span>
            </th>
            <th className="px-2 py-2 text-left cursor-pointer select-none" onClick={() => handleSort("equipe")}>
              <span className="flex items-center gap-1">Equipe <SortIcon col="equipe" /></span>
            </th>
            <th className="px-2 py-2 text-left w-48">Último Contato</th>
            <th className="px-2 py-2 text-center cursor-pointer select-none w-24" onClick={() => handleSort("data_visita")}>
              <span className="flex items-center justify-center gap-1">Data <SortIcon col="data_visita" /></span>
            </th>
            {!readOnly && <th className="px-2 py-2 w-10" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <>
              <tr key={e.id} className="border-b border-border hover:bg-muted/10 group">
                {!readOnly && (
                  <td className="px-2 py-1.5">
                    <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  {readOnly ? <span>{e.nome}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-1" value={e.nome} onChange={ev => onUpdate(e.id, { nome: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? <span>{e.und}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 w-14 focus-visible:ring-1" value={e.und || ""} onChange={ev => onUpdate(e.id, { und: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? <span>{e.empreendimento}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-1" value={e.empreendimento || ""} onChange={ev => onUpdate(e.id, { empreendimento: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {readOnly ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${DOCS_COLORS[e.docs_status] || ""}`}>
                      {DOCS_LABELS[e.docs_status] || e.docs_status}
                    </span>
                  ) : (
                    <Select value={e.docs_status} onValueChange={v => onUpdate(e.id, { docs_status: v })}>
                      <SelectTrigger className={`h-7 text-[10px] border rounded-full px-2 ${DOCS_COLORS[e.docs_status] || ""}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_docs">SEM DOCS</SelectItem>
                        <SelectItem value="em_andamento">EM ANDAMENTO</SelectItem>
                        <SelectItem value="doc_completa">DOC COMPLETA</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {readOnly ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TEMP_COLORS[e.temperatura] || ""}`}>
                      {TEMP_LABELS[e.temperatura] || e.temperatura}
                    </span>
                  ) : (
                    <Select value={e.temperatura} onValueChange={v => onUpdate(e.id, { temperatura: v })}>
                      <SelectTrigger className={`h-7 text-[10px] border rounded-full px-2 ${TEMP_COLORS[e.temperatura] || ""}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="frio">FRIO</SelectItem>
                        <SelectItem value="morno">MORNO</SelectItem>
                        <SelectItem value="quente">QUENTE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? <span>{e.corretor}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-1" value={e.corretor || ""} onChange={ev => onUpdate(e.id, { corretor: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? <span>{e.equipe}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-1" value={e.equipe || ""} onChange={ev => onUpdate(e.id, { equipe: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? <span className="text-[11px]">{e.ultimo_contato}</span> : (
                    <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-1" value={e.ultimo_contato || ""} onChange={ev => onUpdate(e.id, { ultimo_contato: ev.target.value })} />
                  )}
                </td>
                <td className="px-2 py-1.5 text-center text-[11px]">
                  {readOnly ? e.data_visita : (
                    <Input type="date" className="h-7 text-[10px] border-0 bg-transparent p-0 focus-visible:ring-1" value={e.data_visita || ""} onChange={ev => onUpdate(e.id, { data_visita: ev.target.value })} />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100" onClick={() => onDelete(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
              {expandedId === e.id && !readOnly && (
                <tr key={`${e.id}-expand`} className="border-b border-border bg-muted/20">
                  <td colSpan={11} className="px-4 py-3">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Tipo de Visita</label>
                        <Select value={e.tipo_visita || ""} onValueChange={v => onUpdate(e.id, { tipo_visita: v })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_VISITA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Próxima Ação</label>
                        <Select value={e.proxima_acao || ""} onValueChange={v => onUpdate(e.id, { proxima_acao: v })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(PROXIMA_ACAO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Data Próxima Ação</label>
                        <Input type="date" className="h-8 text-xs mt-1" value={e.data_proxima_acao || ""} onChange={ev => onUpdate(e.id, { data_proxima_acao: ev.target.value || null })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Valor Potencial (R$)</label>
                        <Input type="number" className="h-8 text-xs mt-1" value={e.valor_potencial ?? ""} onChange={ev => onUpdate(e.id, { valor_potencial: ev.target.value ? Number(ev.target.value) : null })} />
                      </div>
                      <div className="col-span-2 lg:col-span-4">
                        <label className="text-[10px] text-muted-foreground font-medium">Observações</label>
                        <Textarea className="text-xs mt-1 min-h-[60px]" value={e.observacoes || ""} onChange={ev => onUpdate(e.id, { observacoes: ev.target.value })} />
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
