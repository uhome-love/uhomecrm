/** Meta de ligações do dia, preenchida pelo próprio corretor (nunca abaixo do mínimo de 30). */
import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useCorretorDailyGoals } from "@/hooks/useCorretorDailyStats";
import { ARENA_MINIMO } from "@/lib/arenaLigacoes";
import PlacarCompacto from "./PlacarCompacto";
import { META_MIN_LIGACOES, metaValida } from "./tipos";

export default function MetaDoDia() {
  const { metaEfetiva, saveGoals } = useCorretorDailyGoals();
  const atual = Math.max(META_MIN_LIGACOES, metaEfetiva.meta_ligacoes);
  const [valor, setValor] = useState(String(atual));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setValor(String(atual)), [atual]);

  const salvar = async () => {
    const n = metaValida(Number(valor));
    setValor(String(n));
    if (n === atual) return;
    setSalvando(true);
    try {
      await saveGoals(n, Math.max(ARENA_MINIMO.aproveitados, metaEfetiva.meta_aproveitados), Math.max(ARENA_MINIMO.visitas, metaEfetiva.meta_visitas_marcadas));
      toast.success(`Meta de hoje: ${n} ligações. Bora! 💪`);
    } catch {
      toast.error("Não consegui salvar a meta. Tente de novo.");
      setValor(String(atual));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <label className="flex shrink-0 items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-5 w-5" aria-hidden /></span>
        <span>
          <span className="block text-xs font-medium text-muted-foreground">Minha meta de hoje</span>
          <span className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" min={META_MIN_LIGACOES} max={500} value={valor} disabled={salvando}
              onChange={(e) => setValor(e.target.value)} onBlur={salvar} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              aria-label="Meta de ligações de hoje" className="h-10 w-20 text-center text-lg font-bold tabular-nums" />
            <span className="text-sm text-muted-foreground">ligações <span className="hidden sm:inline">· mínimo {META_MIN_LIGACOES}</span></span>
          </span>
        </span>
      </label>
      <div className="min-w-0 flex-1"><PlacarCompacto variante="barras" /></div>
    </section>
  );
}
