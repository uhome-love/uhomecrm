import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyInput, handleCurrencyChange } from "@/utils/currencyFormat";

interface Props {
  empreendimentos: { id: string; nome: string; construtora: string | null }[];
  empreendimentoId: string; onEmpreendimento: (id: string) => void;
  unidade: string; onUnidade: (value: string) => void;
  valor: string; onValor: (value: string) => void;
  disabled?: boolean;
}
export function PropostaCampos({ empreendimentos, empreendimentoId, onEmpreendimento, unidade, onUnidade, valor, onValor, disabled }: Props) {
  const emp = empreendimentos.find(e => e.id === empreendimentoId);
  return <section className="space-y-3">
    <div className="space-y-1.5"><Label>Empreendimento</Label><Select value={empreendimentoId} onValueChange={onEmpreendimento} disabled={disabled}><SelectTrigger aria-label="Empreendimento da proposta"><SelectValue placeholder="Selecionar empreendimento" /></SelectTrigger><SelectContent>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent></Select></div>
    {emp?.construtora && <p className="text-xs text-muted-foreground">{emp.construtora}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="jornada-unidade">Unidade pretendida</Label><Input id="jornada-unidade" value={unidade} onChange={e => onUnidade(e.target.value)} maxLength={150} disabled={disabled} placeholder="Ex.: 321" /></div>
      <div className="space-y-1.5"><Label htmlFor="jornada-valor">Valor da proposta (R$)</Label><Input id="jornada-valor" inputMode="numeric" value={formatCurrencyInput(valor)} onChange={e => onValor(handleCurrencyChange(e.target.value))} disabled={disabled} /></div>
    </div>
  </section>;
}