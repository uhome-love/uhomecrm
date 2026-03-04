import { useState, useEffect } from "react";
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
const DOCS_LABELS: Record<string, string> = { doc_completa: "COMPLETA", em_andamento: "ANDAMENTO", sem_docs: "SEM DOCS" };
const TIPO_VISITA_LABELS: Record<string, string> = { "1a_visita": "1ª Visita", retorno: "Retorno", visita_tecnica: "V. Técnica", plantao: "Plantão" };
const PROXIMA_ACAO_LABELS: Record<string, string> = { ligar: "Ligar", whatsapp: "WhatsApp", enviar_docs: "Enviar Docs", agendar_retorno: "Agendar Retorno", proposta: "Proposta" };

type SortKey = "nome" | "empreendimento" | "temperatura" | "docs_status" | "corretor" | "data_visita";

function EditableCell({ value, field, entryId, onUpdate, className, placeholder }: {
  value: string; field: string; entryId: string;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  className?: string; placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      className={`h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:bg-background ${className || ""}`}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onUpdate(entryId, { [field]: local }); }}
    />
  );
}

function EditableTextareaCell({ value, field, entryId, onUpdate, placeholder }: {
  value: string; field: string; entryId: string;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Textarea
      className="min-h-[32px] h-8 text-xs border-0 bg-transparent px-1 py-1 resize-none focus-visible:ring-1 focus-visible:bg-background focus-visible:min-h-[80px] transition-all"
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onUpdate(entryId, { [field]: local }); }}
    />
  );
}

export default function PdnTable({ entries, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, searchTerm, filterTemp, filterDocs, filterEmpreendimento, filterCorretor }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("data_visita");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = entries.filter(e => {
    if (searchTerm && !e.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTemp && e.temperatura !== filterTemp) return false;
    if (filterDocs && e.docs_status !== filterDocs) return false;
    if (filterEmpreendimento && e.empreendimento !== filterEmpreendimento) return false;
    if (filterCorretor && e.corretor !== filterCorretor) return false;
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

  const colSpanTotal = readOnly ? 8 : 9;

  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {!readOnly && <col style={{ width: 32 }} />}
          <col style={{ width: "18%" }} /> {/* Nome */}
          <col style={{ width: 50 }} />  {/* Und */}
          <col style={{ width: "14%" }} /> {/* Empreendimento */}
          <col style={{ width: 100 }} /> {/* Docs */}
          <col style={{ width: 80 }} />  {/* Temp */}
          <col style={{ width: "10%" }} /> {/* Corretor */}
          <col style={{ width: "28%" }} /> {/* Último Contato */}
          <col style={{ width: 100 }} /> {/* Data */}
          {!readOnly && <col style={{ width: 56 }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {!readOnly && <th className="px-1 py-1.5 text-center border-r border-border" />}
            <th className="px-2 py-1.5 text-left font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("nome")}>
              <span className="flex items-center gap-1">Nome <SortIcon col="nome" /></span>
            </th>
            <th className="px-1 py-1.5 text-center font-semibold border-r border-border">Und</th>
            <th className="px-2 py-1.5 text-left font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("empreendimento")}>
              <span className="flex items-center gap-1">Empreend. <SortIcon col="empreendimento" /></span>
            </th>
            <th className="px-1 py-1.5 text-center font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("docs_status")}>
              <span className="flex items-center justify-center gap-1">Docs <SortIcon col="docs_status" /></span>
            </th>
            <th className="px-1 py-1.5 text-center font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("temperatura")}>
              <span className="flex items-center justify-center gap-1">Temp. <SortIcon col="temperatura" /></span>
            </th>
            <th className="px-2 py-1.5 text-left font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("corretor")}>
              <span className="flex items-center gap-1">Corretor <SortIcon col="corretor" /></span>
            </th>
            <th className="px-2 py-1.5 text-left font-semibold border-r border-border">Último Contato</th>
            <th className="px-1 py-1.5 text-center font-semibold cursor-pointer select-none border-r border-border" onClick={() => handleSort("data_visita")}>
              <span className="flex items-center justify-center gap-1">Data <SortIcon col="data_visita" /></span>
            </th>
            {!readOnly && <th className="px-1 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e, idx) => (
            <>
              <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group align-top ${idx % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                {!readOnly && (
                  <td className="px-1 py-1 text-center border-r border-border">
                    <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} />
                  </td>
                )}
                <td className="px-1 py-0.5 border-r border-border">
                  {readOnly ? <span className="px-1">{e.nome}</span> : (
                    <EditableCell value={e.nome} field="nome" entryId={e.id} onUpdate={onUpdate} placeholder="Nome do cliente" />
                  )}
                </td>
                <td className="px-1 py-0.5 text-center border-r border-border">
                  {readOnly ? <span>{e.und}</span> : (
                    <EditableCell value={e.und || ""} field="und" entryId={e.id} onUpdate={onUpdate} className="w-full text-center" placeholder="—" />
                  )}
                </td>
                <td className="px-1 py-0.5 border-r border-border">
                  {readOnly ? <span className="px-1">{e.empreendimento}</span> : (
                    <EditableCell value={e.empreendimento || ""} field="empreendimento" entryId={e.id} onUpdate={onUpdate} placeholder="Empreendimento" />
                  )}
                </td>
                <td className="px-1 py-0.5 text-center border-r border-border">
                  {readOnly ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${DOCS_COLORS[e.docs_status] || ""}`}>
                      {DOCS_LABELS[e.docs_status] || e.docs_status}
                    </span>
                  ) : (
                    <Select value={e.docs_status} onValueChange={v => onUpdate(e.id, { docs_status: v })}>
                      <SelectTrigger className={`h-7 text-[10px] border rounded px-1.5 w-full ${DOCS_COLORS[e.docs_status] || ""}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_docs">SEM DOCS</SelectItem>
                        <SelectItem value="em_andamento">EM ANDAMENTO</SelectItem>
                        <SelectItem value="doc_completa">COMPLETA</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-1 py-0.5 text-center border-r border-border">
                  {readOnly ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${TEMP_COLORS[e.temperatura] || ""}`}>
                      {TEMP_LABELS[e.temperatura] || e.temperatura}
                    </span>
                  ) : (
                    <Select value={e.temperatura} onValueChange={v => onUpdate(e.id, { temperatura: v })}>
                      <SelectTrigger className={`h-7 text-[10px] border rounded px-1.5 w-full ${TEMP_COLORS[e.temperatura] || ""}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="frio">FRIO</SelectItem>
                        <SelectItem value="morno">MORNO</SelectItem>
                        <SelectItem value="quente">QUENTE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-1 py-0.5 border-r border-border">
                  {readOnly ? <span className="px-1">{e.corretor}</span> : (
                    <EditableCell value={e.corretor || ""} field="corretor" entryId={e.id} onUpdate={onUpdate} placeholder="Corretor" />
                  )}
                </td>
                <td className="px-1 py-0.5 border-r border-border">
                  {readOnly ? <span className="text-[11px] whitespace-pre-wrap px-1">{e.ultimo_contato}</span> : (
                    <EditableTextareaCell value={e.ultimo_contato || ""} field="ultimo_contato" entryId={e.id} onUpdate={onUpdate} placeholder="Escreva aqui o status, objeções, próximos passos..." />
                  )}
                </td>
                <td className="px-1 py-0.5 text-center border-r border-border">
                  {readOnly ? <span className="text-[11px]">{e.data_visita}</span> : (
                    <Input type="date" className="h-7 text-[10px] border-0 bg-transparent px-0.5 focus-visible:ring-1 w-full" value={e.data_visita || ""} onChange={ev => onUpdate(e.id, { data_visita: ev.target.value })} />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-1 py-0.5">
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedId === e.id ? "rotate-180" : ""}`} />
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
                  <td colSpan={colSpanTotal} className="px-4 py-3">
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
            <tr><td colSpan={colSpanTotal} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
