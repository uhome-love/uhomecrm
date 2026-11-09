/** Três cartões iguais para escolher de onde ligar, com a quantidade de clientes esperando. */
import { motion } from "framer-motion";
import { ListChecks, Hourglass, RefreshCcw, ArrowRight } from "lucide-react";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import { useTotalBolsao } from "@/hooks/useArenaLigacoes";
import { ORIGEM_INFO, type OrigemOA } from "./tipos";

const ICONES = { listas: ListChecks, estagnados: Hourglass, descartados: RefreshCcw } as const;

export default function EscolhaOrigem({ onEscolher }: { onEscolher: (o: OrigemOA) => void }) {
  const est = useTotalBolsao("estagnados");
  const desc = useTotalBolsao("descartados");
  const { campanhas, statsMap, isLoading } = useCampanhasDisponiveis();
  const naFila = campanhas.reduce((s, c) => s + (statsMap[c.id]?.naFila ?? 0), 0);
  const itens: { o: OrigemOA; n: number | undefined; erro: boolean; extra?: string }[] = [
    { o: "listas", n: isLoading ? undefined : naFila, erro: false, extra: `${campanhas.length} ${campanhas.length === 1 ? "campanha" : "campanhas"}` },
    { o: "estagnados", n: est.data, erro: est.isError },
    { o: "descartados", n: desc.data, erro: desc.isError },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {itens.map(({ o, n, erro, extra }, i) => {
        const Icon = ICONES[o];
        const info = ORIGEM_INFO[o];
        const semClientes = n === 0;
        return (
          <motion.button key={o} type="button" onClick={() => onEscolher(o)} disabled={semClientes}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={semClientes ? undefined : { y: -3 }} whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors duration-fast hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:flex-col sm:items-stretch sm:gap-3 sm:p-5">
            <span className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-fast group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-2xl font-bold tabular-nums sm:text-3xl">{n === undefined ? (erro ? "—" : "…") : n.toLocaleString("pt-BR")}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{info.titulo}</span>
              <span className="block text-sm text-muted-foreground">{extra ? `${extra} · ` : ""}{info.desc}</span>
            </span>
            <span className="hidden items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:flex">
              {semClientes ? "Sem clientes agora" : "Ligar daqui"} {!semClientes && <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden />}
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
          </motion.button>
        );
      })}
    </div>
  );
}
