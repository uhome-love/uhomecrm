/** Botões de resultado da ligação. No celular fica fixa no rodapé, com botões grandes para o polegar. */
import { motion } from "framer-motion";
import { PhoneMissed, XCircle, PhoneOff, CheckCircle2, CalendarCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROTULO_RESULTADO, resultadosDaOrigem, type OrigemOA, type ResultadoOA } from "./tipos";

const VISUAL: Record<ResultadoOA, { icon: typeof PhoneMissed; classe: string; atalho: string }> = {
  nao_atendeu: { icon: PhoneMissed, classe: "border-border bg-card hover:bg-muted", atalho: "1" },
  sem_interesse: { icon: XCircle, classe: "border-border bg-card text-destructive hover:bg-destructive/10", atalho: "2" },
  numero_errado: { icon: PhoneOff, classe: "border-border bg-card text-muted-foreground hover:bg-muted", atalho: "3" },
  aproveitar: { icon: CheckCircle2, classe: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90", atalho: "4" },
  visita: { icon: CalendarCheck, classe: "border-transparent bg-success text-primary-foreground hover:bg-success-600", atalho: "5" },
};

interface Props { origem: OrigemOA; gravando: boolean; fixo: boolean; destacar: boolean; ultimo: ResultadoOA | null; onResultado: (r: ResultadoOA) => void }

export default function ResultadoBarra({ origem, gravando, fixo, destacar, ultimo, onResultado }: Props) {
  const lista = resultadosDaOrigem(origem);
  const botoes = lista.map((r) => {
    const v = VISUAL[r];
    const Icon = v.icon;
    return (
      <motion.button key={r} type="button" whileTap={{ scale: 0.95 }} disabled={gravando} onClick={() => onResultado(r)}
        className={cn("relative flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition-colors duration-fast disabled:opacity-60",
          "flex-row", v.classe, fixo && r === "numero_errado" && "hidden")}>
        {gravando && ultimo === r ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="leading-tight">{ROTULO_RESULTADO[r] === "Aproveitado" ? "Aproveitar" : ROTULO_RESULTADO[r]}</span>
        {!fixo && <kbd className="absolute right-1.5 top-1 hidden text-[10px] font-normal opacity-50 xl:block">{v.atalho}</kbd>}
      </motion.button>
    );
  });

  if (fixo) {
    return (
      <div className={cn("fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-3 pt-2 backdrop-blur", destacar && "ring-2 ring-primary")}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {destacar && <p className="pb-1.5 text-center text-xs font-semibold text-primary">Como foi a ligação?</p>}
        <div className="grid grid-cols-2 gap-2">{botoes}</div>
      </div>
    );
  }

  return (
    <section className={cn("mt-4 rounded-xl border-t border-border pt-3 transition-shadow duration-medium", destacar && "rounded-xl p-2 ring-2 ring-primary")} aria-label="Resultado da ligação">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como foi a ligação?</p>
      <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">{botoes}</div>
    </section>
  );
}
