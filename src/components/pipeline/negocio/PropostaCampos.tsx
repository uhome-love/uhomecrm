import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyInput, handleCurrencyChange } from "@/utils/currencyFormat";
import { EmpreendimentoVendaPicker } from "@/components/vendas/EmpreendimentoVendaPicker";
import type { EmpreendimentoVenda } from "@/hooks/useConfirmarVenda";

interface Props {
  empreendimentos: EmpreendimentoVenda[];
  empreendimentoId: string; onEmpreendimento: (id: string) => void;
  onCriado: (emp: EmpreendimentoVenda) => void;
  unidade: string; onUnidade: (value: string) => void;
  valor: string; onValor: (value: string) => void;
  disabled?: boolean;
}
export function PropostaCampos({ empreendimentos, empreendimentoId, onEmpreendimento, onCriado, unidade, onUnidade, valor, onValor, disabled }: Props) {
  const emp = empreendimentos.find(e => e.id === empreendimentoId);
  return <section className="space-y-3">
    <div className="space-y-1.5"><Label>Empreendimento ou imóvel</Label><EmpreendimentoVendaPicker value={empreendimentoId} onChange={onEmpreendimento} empreendimentos={empreendimentos} onCriado={onCriado} /></div>
    {emp?.construtora && <p className="text-xs text-muted-foreground">{emp.construtora}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="jornada-unidade">Unidade pretendida</Label><Input id="jornada-unidade" value={unidade} onChange={e => onUnidade(e.target.value)} maxLength={150} disabled={disabled} placeholder="Ex.: 321" /></div>
      <div className="space-y-1.5"><Label htmlFor="jornada-valor">Valor da proposta (R$)</Label><Input id="jornada-valor" inputMode="numeric" value={formatCurrencyInput(valor)} onChange={e => onValor(handleCurrencyChange(e.target.value))} disabled={disabled} /></div>
    </div>
  </section>;
}
