import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { periodoMesAno } from "@/lib/periodoMesAno";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Props { start: string; end: string; onChange: (start: string, end: string) => void }

/** Atalho: escolhe mês/ano e preenche De/Até. Mostra a seleção quando o período bate exatamente. */
export function AtalhoMesAno({ start, end, onChange }: Props) {
  const anoAtual = Number(start.slice(0, 4)) || new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const mesAtual = Array.from({ length: 12 }, (_, i) => i + 1).find(m => {
    const p = periodoMesAno(anoAtual, m); return p.start === start && p.end === end;
  });
  const anoInteiro = periodoMesAno(anoAtual, 0);
  const mesValue = mesAtual ? String(mesAtual) : anoInteiro.start === start && anoInteiro.end === end ? "0" : "";
  const aplicar = (ano: number, mes: number) => { const p = periodoMesAno(ano, mes); onChange(p.start, p.end); };
  return <div className="grid grid-cols-2 gap-2">
    <div className="space-y-1.5 min-w-0"><Label className="text-xs">Mês</Label>
      <Select value={mesValue} onValueChange={v => aplicar(anoAtual, Number(v))}>
        <SelectTrigger aria-label="Mês"><SelectValue placeholder="Escolher" /></SelectTrigger>
        <SelectContent><SelectItem value="0">Ano inteiro</SelectItem>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
      </Select></div>
    <div className="space-y-1.5 min-w-0"><Label className="text-xs">Ano</Label>
      <Select value={String(anoAtual)} onValueChange={v => aplicar(Number(v), mesValue === "" ? 0 : Number(mesValue))}>
        <SelectTrigger aria-label="Ano"><SelectValue /></SelectTrigger>
        <SelectContent>{(anos.includes(String(anoAtual)) ? anos : [String(anoAtual), ...anos]).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
      </Select></div>
  </div>;
}
