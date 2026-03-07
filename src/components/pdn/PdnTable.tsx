import { useState, useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type PdnEntry, type PdnSituacao } from "@/hooks/usePdn";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowRightLeft, Check, AlertTriangle, Target } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calcProbabilidade, calcRisco, OBJECAO_OPTIONS, PROXIMA_ACAO_OPTIONS, type RiscoNivel } from "@/lib/pdnScoring";
import { differenceInDays } from "date-fns";

interface Props {
  entries: PdnEntry[];
  readOnly?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onAdd: (situacao: PdnSituacao) => void;
  searchTerm: string;
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

const RISCO_BADGE: Record<RiscoNivel, { emoji: string; class: string }> = {
  seguro: { emoji: "🟢", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  atencao: { emoji: "🟡", class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  risco: { emoji: "🔴", class: "bg-red-500/10 text-red-600 border-red-500/30" },
};

function Cell({ value, field, id, onUpdate, className, placeholder }: {
  value: string; field: string; id: string;
  onUpdate: (id: string, u: Record<string, any>) => void;
  className?: string; placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const isDirty = local !== value;
  useEffect(() => { setLocal(value); }, [value]);
  const save = () => { if (isDirty) { onUpdate(id, { [field]: local }); toast.success("Salvo!"); } };
  return (
    <div className="relative flex items-center gap-0.5">
      <Input
        className={`h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:bg-background ${isDirty ? "ring-1 ring-primary/50 bg-primary/5" : ""} ${className || ""}`}
        value={local} placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
      />
      {isDirty && (
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={save} className="shrink-0 h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/80" title="Salvar">
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function TextCell({ value, field, id, onUpdate, placeholder }: {
  value: string; field: string; id: string;
  onUpdate: (id: string, u: Record<string, any>) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const isDirty = local !== value;
  useEffect(() => { setLocal(value); }, [value]);
  const save = () => { if (isDirty) { onUpdate(id, { [field]: local }); toast.success("Salvo!"); } };
  return (
    <div className="relative">
      <Textarea
        className={`min-h-[32px] h-8 text-xs border-0 bg-transparent px-1 py-1 resize-none focus-visible:ring-1 focus-visible:bg-background focus-visible:min-h-[80px] transition-all ${isDirty ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
        value={local} placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={save}
      />
      {isDirty && (
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={save} className="absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/80 z-10" title="Salvar">
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function formatBRL(v: number | null) {
  if (!v) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatNumber(v: number | null) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR");
}

function parseFormattedNumber(s: string): number | null {
  if (!s.trim()) return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function CurrencyCell({ value, field, id, onUpdate }: {
  value: number | null; field: string; id: string;
  onUpdate: (id: string, u: Record<string, any>) => void;
}) {
  const [local, setLocal] = useState(formatNumber(value));
  const isDirty = parseFormattedNumber(local) !== value;
  useEffect(() => { setLocal(formatNumber(value)); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, "");
    setLocal(raw);
  };

  const save = () => {
    const parsed = parseFormattedNumber(local);
    if (parsed !== value) {
      onUpdate(id, { [field]: parsed });
      toast.success("Salvo!");
    }
    setLocal(formatNumber(parsed));
  };

  return (
    <div className="relative flex items-center gap-0.5">
      <Input
        className={`h-7 text-xs border-0 bg-transparent px-1 text-right focus-visible:ring-1 focus-visible:bg-background ${isDirty ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
        value={local}
        onChange={handleChange}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
        placeholder="0"
      />
      {isDirty && (
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={save} className="shrink-0 h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/80" title="Salvar">
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const SITUACAO_OPTIONS: { key: PdnSituacao; label: string; emoji: string }[] = [
  { key: "visita", label: "Negócios", emoji: "📋" },
  { key: "gerado", label: "Gerado", emoji: "📄" },
  { key: "assinado", label: "Assinado", emoji: "✅" },
  { key: "caiu", label: "Caiu", emoji: "❌" },
];

function MoverPara({ currentSituacao, id, onUpdate }: { currentSituacao: PdnSituacao; id: string; onUpdate: (id: string, u: Record<string, any>) => void }) {
  const options = SITUACAO_OPTIONS.filter(o => o.key !== currentSituacao);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" title="Mover para...">
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {options.map(o => (
          <DropdownMenuItem key={o.key} onClick={() => onUpdate(id, { situacao: o.key })} className="text-xs gap-2">
            {o.emoji} {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProbBar({ entry }: { entry: PdnEntry }) {
  const prob = calcProbabilidade(entry);
  return (
    <div className="flex items-center gap-1" title={`Probabilidade: ${prob}%`}>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${prob >= 70 ? "bg-emerald-500" : prob >= 40 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${prob}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground w-7 text-right">{prob}%</span>
    </div>
  );
}

function RiscoBadge({ entry }: { entry: PdnEntry }) {
  const risco = calcRisco(entry);
  const conf = RISCO_BADGE[risco.nivel];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border cursor-default ${conf.class}`}
          >
            {conf.emoji}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[200px]">
          <p className="font-semibold mb-0.5">
            {risco.nivel === "seguro" ? "✅ Seguro" : risco.nivel === "atencao" ? "⚠️ Atenção" : "🚨 Risco"}
          </p>
          {risco.motivos.length > 0 ? (
            <ul className="space-y-0.5">
              {risco.motivos.map((m, i) => <li key={i}>• {m}</li>)}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nenhum problema detectado</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProximaAcaoAlert({ entry }: { entry: PdnEntry }) {
  if (entry.situacao === "caiu" || entry.situacao === "assinado") return null;
  if (entry.proxima_acao && entry.proxima_acao.trim()) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 bg-amber-500/10 rounded px-1 py-0.5">
      <AlertTriangle className="h-2.5 w-2.5" /> Sem ação
    </span>
  );
}

function ParadoAlert({ entry }: { entry: PdnEntry }) {
  if (entry.situacao === "caiu" || entry.situacao === "assinado") return null;
  const dias = differenceInDays(new Date(), new Date(entry.updated_at));
  if (dias < 3) return null;
  const isCritical = dias >= 7;
  const isWarning = dias >= 5;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] rounded px-1 py-0.5 font-semibold ${
        isCritical ? "text-red-700 bg-red-500/20" :
        isWarning ? "text-red-600 bg-red-500/10" :
        "text-amber-600 bg-amber-500/10"
      }`}
      title={`Último update: ${dias} dias atrás`}
    >
      {isCritical ? "⛔" : isWarning ? "🔴" : "🟡"} {dias}d {isCritical ? "PARADO" : isWarning ? "PARADO" : "sem atualização"}
    </span>
  );
}

const thClass = "px-2 py-1.5 text-left font-semibold border-r border-border text-xs";
const tdClass = "px-1 py-0.5 border-r border-border";

// ─── NEGÓCIOS (Visita) ───
function VisitaSection({ rows, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, onAdd }: {
  rows: PdnEntry[]; readOnly?: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onUpdate: (id: string, u: Record<string, any>) => void;
  onDelete: (id: string) => void; onAdd: () => void;
}) {
  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <div className="flex items-center justify-between bg-primary/10 border-b border-border px-3 py-2">
        <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">📋 NEGÓCIOS
          {rows.some(r => (r as any).created_from_visit) && (
            <span className="text-[10px] font-normal text-muted-foreground ml-1">({rows.filter(r => (r as any).created_from_visit).length} da Agenda)</span>
          )}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{rows.length} registros</span>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={onAdd}>
              <Plus className="h-3 w-3" /> Linha
            </Button>
          )}
        </div>
      </div>
      <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {!readOnly && <col style={{ width: 30 }} />}
          <col style={{ width: "15%" }} />
          <col style={{ width: 45 }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: 85 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 55 }} />
          <col style={{ width: 30 }} />
          <col style={{ width: "15%" }} />
          {!readOnly && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {!readOnly && <th className="px-1 py-1.5 border-r border-border" />}
            <th className={thClass}>Nome</th>
            <th className={`${thClass} text-center`}>Und</th>
            <th className={thClass}>Empreend.</th>
            <th className={`${thClass} text-center`}>Docs</th>
            <th className={`${thClass} text-center`}>Temp.</th>
            <th className={thClass}>Corretor</th>
            <th className={thClass}>Próxima Ação</th>
            <th className={thClass}>Objeção</th>
            <th className={`${thClass} text-center`}>Prob.</th>
            <th className={`${thClass} text-center`}>⚡</th>
            <th className={thClass}>Último Contato</th>
            {!readOnly && <th className="px-1 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group align-top ${i % 2 ? "bg-muted/5" : ""}`}>
              {!readOnly && <td className="px-1 py-1 text-center border-r border-border"><Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} /></td>}
              <td className={tdClass}>
                <div className="space-y-0.5">
                  {(e as any).created_from_visit && <span title="Originado da Agenda de Visitas" className="text-[10px] mr-0.5">📅</span>}
                  {readOnly ? <span className="px-1">{e.nome}</span> : <Cell value={e.nome} field="nome" id={e.id} onUpdate={onUpdate} placeholder="Nome" />}
                  <div className="flex flex-wrap gap-0.5">
                    <ProximaAcaoAlert entry={e} />
                    <ParadoAlert entry={e} />
                  </div>
                </div>
              </td>
              <td className={`${tdClass} text-center`}>{readOnly ? e.und : <Cell value={e.und || ""} field="und" id={e.id} onUpdate={onUpdate} className="text-center" placeholder="—" />}</td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.empreendimento}</span> : <Cell value={e.empreendimento || ""} field="empreendimento" id={e.id} onUpdate={onUpdate} placeholder="Empreend." />}</td>
              <td className={`${tdClass} text-center`}>
                {readOnly ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${DOCS_COLORS[e.docs_status] || ""}`}>{DOCS_LABELS[e.docs_status] || e.docs_status}</span>
                ) : (
                  <Select value={e.docs_status} onValueChange={v => onUpdate(e.id, { docs_status: v })}>
                    <SelectTrigger className={`h-7 text-[10px] border rounded px-1 w-full ${DOCS_COLORS[e.docs_status] || ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_docs">SEM DOCS</SelectItem>
                      <SelectItem value="em_andamento">EM ANDAMENTO</SelectItem>
                      <SelectItem value="doc_completa">COMPLETA</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={`${tdClass} text-center`}>
                {readOnly ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${TEMP_COLORS[e.temperatura] || ""}`}>{TEMP_LABELS[e.temperatura] || e.temperatura}</span>
                ) : (
                  <Select value={e.temperatura} onValueChange={v => onUpdate(e.id, { temperatura: v })}>
                    <SelectTrigger className={`h-7 text-[10px] border rounded px-1 w-full ${TEMP_COLORS[e.temperatura] || ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frio">FRIO</SelectItem>
                      <SelectItem value="morno">MORNO</SelectItem>
                      <SelectItem value="quente">QUENTE</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.corretor}</span> : <Cell value={e.corretor || ""} field="corretor" id={e.id} onUpdate={onUpdate} placeholder="Corretor" />}</td>
              <td className={tdClass}>
                {readOnly ? (
                  <span className="px-1 text-[10px]">{e.proxima_acao}</span>
                ) : (
                  <Select value={e.proxima_acao || ""} onValueChange={v => onUpdate(e.id, { proxima_acao: v })}>
                    <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent px-1 w-full"><SelectValue placeholder="Definir..." /></SelectTrigger>
                    <SelectContent>
                      {PROXIMA_ACAO_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={tdClass}>
                {readOnly ? (
                  <span className="px-1 text-[10px]">{OBJECAO_OPTIONS.find(o => o.value === e.objecao_cliente)?.label || e.objecao_cliente || "—"}</span>
                ) : (
                  <Select value={e.objecao_cliente || ""} onValueChange={v => onUpdate(e.id, { objecao_cliente: v })}>
                    <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent px-1 w-full"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {OBJECAO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={`${tdClass} text-center`}><ProbBar entry={e} /></td>
              <td className={`${tdClass} text-center`}><RiscoBadge entry={e} /></td>
              <td className={tdClass}>{readOnly ? <span className="whitespace-pre-wrap px-1">{e.ultimo_contato}</span> : <TextCell value={e.ultimo_contato || ""} field="ultimo_contato" id={e.id} onUpdate={onUpdate} placeholder="Status..." />}</td>
              {!readOnly && (
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <MoverPara currentSituacao="visita" id={e.id} onUpdate={onUpdate} />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={readOnly ? 11 : 13} className="text-center py-6 text-muted-foreground">Nenhum negócio registrado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── GERADOS ───
function GeradoSection({ rows, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, onAdd }: {
  rows: PdnEntry[]; readOnly?: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onUpdate: (id: string, u: Record<string, any>) => void;
  onDelete: (id: string) => void; onAdd: () => void;
}) {
  const totalVgv = rows.reduce((s, e) => s + (e.vgv || 0), 0);
  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <div className="flex items-center justify-between bg-warning/10 border-b border-border px-3 py-2">
        <h3 className="text-sm font-bold text-warning">📄 GERADOS</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{rows.length} registros</span>
          <span className="font-semibold text-foreground">VGV: {formatBRL(totalVgv)}</span>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={onAdd}>
              <Plus className="h-3 w-3" /> Linha
            </Button>
          )}
        </div>
      </div>
      <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {!readOnly && <col style={{ width: 30 }} />}
          <col style={{ width: "16%" }} />
          <col style={{ width: 45 }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 55 }} />
          <col style={{ width: 30 }} />
          <col style={{ width: "18%" }} />
          {!readOnly && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {!readOnly && <th className="px-1 py-1.5 border-r border-border" />}
            <th className={thClass}>Nome</th>
            <th className={`${thClass} text-center`}>Und</th>
            <th className={thClass}>Empreend.</th>
            <th className={`${thClass} text-right`}>VGV (R$)</th>
            <th className={`${thClass} text-center`}>Situação</th>
            <th className={thClass}>Corretor</th>
            <th className={thClass}>Próxima Ação</th>
            <th className={thClass}>Objeção</th>
            <th className={`${thClass} text-center`}>Prob.</th>
            <th className={`${thClass} text-center`}>⚡</th>
            <th className={thClass}>Quando Assina</th>
            {!readOnly && <th className="px-1 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group align-top ${i % 2 ? "bg-muted/5" : ""}`}>
              {!readOnly && <td className="px-1 py-1 text-center border-r border-border"><Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} /></td>}
              <td className={tdClass}>
                <div className="space-y-0.5">
                  {readOnly ? <span className="px-1">{e.nome}</span> : <Cell value={e.nome} field="nome" id={e.id} onUpdate={onUpdate} placeholder="Nome" />}
                  <div className="flex flex-wrap gap-0.5">
                    <ProximaAcaoAlert entry={e} />
                    <ParadoAlert entry={e} />
                  </div>
                </div>
              </td>
              <td className={`${tdClass} text-center`}>{readOnly ? e.und : <Cell value={e.und || ""} field="und" id={e.id} onUpdate={onUpdate} className="text-center" placeholder="—" />}</td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.empreendimento}</span> : <Cell value={e.empreendimento || ""} field="empreendimento" id={e.id} onUpdate={onUpdate} placeholder="Empreend." />}</td>
              <td className={`${tdClass} text-right`}>
                {readOnly ? <span className="px-1">{formatBRL(e.vgv)}</span> : (
                  <CurrencyCell value={e.vgv} field="vgv" id={e.id} onUpdate={onUpdate} />
                )}
              </td>
              <td className={`${tdClass} text-center`}>
                {readOnly ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${TEMP_COLORS[e.temperatura] || ""}`}>{TEMP_LABELS[e.temperatura] || e.temperatura}</span>
                ) : (
                  <Select value={e.temperatura} onValueChange={v => onUpdate(e.id, { temperatura: v })}>
                    <SelectTrigger className={`h-7 text-[10px] border rounded px-1 w-full ${TEMP_COLORS[e.temperatura] || ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frio">FRIO</SelectItem>
                      <SelectItem value="morno">MORNO</SelectItem>
                      <SelectItem value="quente">QUENTE</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.corretor}</span> : <Cell value={e.corretor || ""} field="corretor" id={e.id} onUpdate={onUpdate} placeholder="Corretor" />}</td>
              <td className={tdClass}>
                {readOnly ? (
                  <span className="px-1 text-[10px]">{e.proxima_acao}</span>
                ) : (
                  <Select value={e.proxima_acao || ""} onValueChange={v => onUpdate(e.id, { proxima_acao: v })}>
                    <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent px-1 w-full"><SelectValue placeholder="Definir..." /></SelectTrigger>
                    <SelectContent>
                      {PROXIMA_ACAO_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={tdClass}>
                {readOnly ? (
                  <span className="px-1 text-[10px]">{OBJECAO_OPTIONS.find(o => o.value === e.objecao_cliente)?.label || e.objecao_cliente || "—"}</span>
                ) : (
                  <Select value={e.objecao_cliente || ""} onValueChange={v => onUpdate(e.id, { objecao_cliente: v })}>
                    <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent px-1 w-full"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {OBJECAO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={`${tdClass} text-center`}><ProbBar entry={e} /></td>
              <td className={`${tdClass} text-center`}><RiscoBadge entry={e} /></td>
              <td className={tdClass}>{readOnly ? <span className="whitespace-pre-wrap px-1">{e.quando_assina}</span> : <TextCell value={e.quando_assina || ""} field="quando_assina" id={e.id} onUpdate={onUpdate} placeholder="Previsão de assinatura..." />}</td>
              {!readOnly && (
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <MoverPara currentSituacao="gerado" id={e.id} onUpdate={onUpdate} />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={readOnly ? 11 : 13} className="text-center py-6 text-muted-foreground">Nenhum negócio gerado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── ASSINADOS ───
function AssinadoSection({ rows, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, onAdd }: {
  rows: PdnEntry[]; readOnly?: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onUpdate: (id: string, u: Record<string, any>) => void;
  onDelete: (id: string) => void; onAdd: () => void;
}) {
  const totalVgv = rows.reduce((s, e) => s + (e.vgv || 0), 0);
  const PAGAMENTO_COLORS: Record<string, string> = {
    pago: "bg-green-500/10 text-green-600 border-green-500/30",
    falta_pagar: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  };
  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <div className="flex items-center justify-between bg-success/10 border-b border-border px-3 py-2">
        <h3 className="text-sm font-bold text-success">✅ ASSINADOS</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{rows.length} registros</span>
          <span className="font-semibold text-foreground">VGV: {formatBRL(totalVgv)}</span>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={onAdd}>
              <Plus className="h-3 w-3" /> Linha
            </Button>
          )}
        </div>
      </div>
      <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {!readOnly && <col style={{ width: 30 }} />}
          <col style={{ width: "20%" }} />
          <col style={{ width: 55 }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "22%" }} />
          {!readOnly && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {!readOnly && <th className="px-1 py-1.5 border-r border-border" />}
            <th className={thClass}>Nome</th>
            <th className={`${thClass} text-center`}>Und</th>
            <th className={thClass}>Produto</th>
            <th className={`${thClass} text-right`}>VGV (R$)</th>
            <th className={`${thClass} text-center`}>Pagamento</th>
            <th className={thClass}>Corretor</th>
            <th className={thClass}>Situação</th>
            {!readOnly && <th className="px-1 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group align-top ${i % 2 ? "bg-muted/5" : ""}`}>
              {!readOnly && <td className="px-1 py-1 text-center border-r border-border"><Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} /></td>}
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.nome}</span> : <Cell value={e.nome} field="nome" id={e.id} onUpdate={onUpdate} placeholder="Nome" />}</td>
              <td className={`${tdClass} text-center`}>{readOnly ? e.und : <Cell value={e.und || ""} field="und" id={e.id} onUpdate={onUpdate} className="text-center" placeholder="—" />}</td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.empreendimento}</span> : <Cell value={e.empreendimento || ""} field="empreendimento" id={e.id} onUpdate={onUpdate} placeholder="Produto" />}</td>
              <td className={`${tdClass} text-right`}>
                {readOnly ? <span className="px-1">{formatBRL(e.vgv)}</span> : (
                  <CurrencyCell value={e.vgv} field="vgv" id={e.id} onUpdate={onUpdate} />
                )}
              </td>
              <td className={`${tdClass} text-center`}>
                {readOnly ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${PAGAMENTO_COLORS[e.status_pagamento || ""] || ""}`}>{e.status_pagamento === "pago" ? "PAGO" : e.status_pagamento === "falta_pagar" ? "FALTA PAGAR" : "—"}</span>
                ) : (
                  <Select value={e.status_pagamento || ""} onValueChange={v => onUpdate(e.id, { status_pagamento: v })}>
                    <SelectTrigger className={`h-7 text-[10px] border rounded px-1 w-full ${PAGAMENTO_COLORS[e.status_pagamento || ""] || ""}`}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">PAGO</SelectItem>
                      <SelectItem value="falta_pagar">FALTA PAGAR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.corretor}</span> : <Cell value={e.corretor || ""} field="corretor" id={e.id} onUpdate={onUpdate} placeholder="Corretor" />}</td>
              <td className={tdClass}>{readOnly ? <span className="whitespace-pre-wrap px-1">{e.ultimo_contato}</span> : <TextCell value={e.ultimo_contato || ""} field="ultimo_contato" id={e.id} onUpdate={onUpdate} placeholder="Situação do contrato..." />}</td>
              {!readOnly && (
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <MoverPara currentSituacao="assinado" id={e.id} onUpdate={onUpdate} />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={readOnly ? 7 : 9} className="text-center py-6 text-muted-foreground">Nenhum negócio assinado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── CAIU ───
function CaiuSection({ rows, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, onAdd }: {
  rows: PdnEntry[]; readOnly?: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onUpdate: (id: string, u: Record<string, any>) => void;
  onDelete: (id: string) => void; onAdd: () => void;
}) {
  const totalVgv = rows.reduce((s, e) => s + (e.vgv || 0), 0);
  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <div className="flex items-center justify-between bg-destructive/10 border-b border-border px-3 py-2">
        <h3 className="text-sm font-bold text-destructive">❌ CAIU</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{rows.length} registros</span>
          <span className="font-semibold text-foreground">VGV perdido: {formatBRL(totalVgv)}</span>
          {!readOnly && (
            <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={onAdd}>
              <Plus className="h-3 w-3" /> Linha
            </Button>
          )}
        </div>
      </div>
      <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {!readOnly && <col style={{ width: 30 }} />}
          <col style={{ width: "20%" }} />
          <col style={{ width: 55 }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: 110 }} />
          <col style={{ width: "30%" }} />
          {!readOnly && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {!readOnly && <th className="px-1 py-1.5 border-r border-border" />}
            <th className={thClass}>Nome</th>
            <th className={`${thClass} text-center`}>Und</th>
            <th className={thClass}>Produto</th>
            <th className={`${thClass} text-right`}>VGV (R$)</th>
            <th className={thClass}>Motivo da Queda</th>
            {!readOnly && <th className="px-1 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={e.id} className={`border-b border-border hover:bg-muted/20 group align-top ${i % 2 ? "bg-muted/5" : ""}`}>
              {!readOnly && <td className="px-1 py-1 text-center border-r border-border"><Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => onToggleSelect(e.id)} /></td>}
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.nome}</span> : <Cell value={e.nome} field="nome" id={e.id} onUpdate={onUpdate} placeholder="Nome" />}</td>
              <td className={`${tdClass} text-center`}>{readOnly ? e.und : <Cell value={e.und || ""} field="und" id={e.id} onUpdate={onUpdate} className="text-center" placeholder="—" />}</td>
              <td className={tdClass}>{readOnly ? <span className="px-1">{e.empreendimento}</span> : <Cell value={e.empreendimento || ""} field="empreendimento" id={e.id} onUpdate={onUpdate} placeholder="Produto" />}</td>
              <td className={`${tdClass} text-right`}>
                {readOnly ? <span className="px-1">{formatBRL(e.vgv)}</span> : (
                  <CurrencyCell value={e.vgv} field="vgv" id={e.id} onUpdate={onUpdate} />
                )}
              </td>
              <td className={tdClass}>{readOnly ? <span className="whitespace-pre-wrap px-1">{e.motivo_queda}</span> : <TextCell value={(e as any).motivo_queda || ""} field="motivo_queda" id={e.id} onUpdate={onUpdate} placeholder="Motivo da queda..." />}</td>
              {!readOnly && (
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <MoverPara currentSituacao="caiu" id={e.id} onUpdate={onUpdate} />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={readOnly ? 5 : 7} className="text-center py-6 text-muted-foreground">Nenhum negócio perdido.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───
export default function PdnTable({ entries, readOnly, selectedIds, onToggleSelect, onUpdate, onDelete, onAdd, searchTerm, filterCorretor }: Props) {
  const filtered = entries.filter(e => {
    if (searchTerm && !e.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCorretor && e.corretor !== filterCorretor) return false;
    return true;
  });

  const visitas = filtered.filter(e => e.situacao === "visita");
  const gerados = filtered.filter(e => e.situacao === "gerado");
  const assinados = filtered.filter(e => e.situacao === "assinado");
  const caidos = filtered.filter(e => e.situacao === "caiu");

  return (
    <div className="space-y-6">
      <VisitaSection rows={visitas} readOnly={readOnly} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onUpdate={onUpdate} onDelete={onDelete} onAdd={() => onAdd("visita")} />
      <GeradoSection rows={gerados} readOnly={readOnly} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onUpdate={onUpdate} onDelete={onDelete} onAdd={() => onAdd("gerado")} />
      <AssinadoSection rows={assinados} readOnly={readOnly} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onUpdate={onUpdate} onDelete={onDelete} onAdd={() => onAdd("assinado")} />
      <CaiuSection rows={caidos} readOnly={readOnly} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onUpdate={onUpdate} onDelete={onDelete} onAdd={() => onAdd("caiu")} />
    </div>
  );
}
