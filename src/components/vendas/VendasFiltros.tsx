import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTROS_VENDAS, type FiltrosVendas, type VendaRelatorio } from "@/lib/vendasRelatorio";
interface Props { value: FiltrosVendas; onChange: (v: FiltrosVendas) => void; vendas: VendaRelatorio[]; start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }
export function VendasFiltros({ value, onChange, vendas, start, end, onStart, onEnd }: Props) {
  const construtoras = [...new Set(vendas.map(v => v.construtora || "Não informada"))].sort();
  const empreendimentos = [...new Map(vendas.map(v => [v.empreendimento_canonico_id || v.empreendimento || "sem", v.empreendimento || "Não informado"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const corretores = [...new Map(vendas.flatMap(v => v.rateios.flatMap(r => r.corretor_auth_id ? [[r.corretor_auth_id, r.corretor_nome || "Não identificado"] as const] : []))).entries()].sort((a,b) => a[1].localeCompare(b[1]));
  const equipes = [...new Set(vendas.flatMap(v => v.rateios.map(r => r.equipe || "Sem equipe")))].sort();
  const select = (key: keyof FiltrosVendas, label: string, options: [string, string][] | readonly (readonly [string, string])[]) => <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label><Select value={value[key]} onValueChange={v => onChange({ ...value, [key]: v })}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">{label === "Construtora" ? "Todas" : "Todos"}</SelectItem>{options.map(([id,nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}</SelectContent></Select></div>;
  return <section className="space-y-4 border-y border-border py-4">
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><div className="space-y-1.5"><Label className="text-xs" htmlFor="vendas-de">De</Label><Input id="vendas-de" type="date" value={start} onChange={e => onStart(e.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs" htmlFor="vendas-ate">Até</Label><Input id="vendas-ate" type="date" value={end} min={start} onChange={e => onEnd(e.target.value)} /></div>{select("construtora", "Construtora", construtoras.map(c => [c,c]))}{select("empreendimento", "Empreendimento", empreendimentos)}{select("corretor", "Corretor", corretores)}{select("equipe", "Equipe", equipes.map(c => [c,c]))}</div>
    <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar vendas" placeholder="Cliente, unidade, empreendimento ou corretor" className="pl-9" value={value.busca} onChange={e => onChange({ ...value, busca: e.target.value })} /></div><Button variant="ghost" size="icon" title="Limpar filtros" aria-label="Limpar filtros" onClick={() => onChange({ ...FILTROS_VENDAS })}><RotateCcw /></Button></div>
  </section>;
}