/** Escolha da origem dos clientes na Arena — cartões grandes com a quantidade esperando. */
import { motion } from "framer-motion";
import { ListChecks, Hourglass, RefreshCcw } from "lucide-react";
import type { Porta } from "@/components/oferta-ativa/bolsao/PortasOfertaAtiva";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import { useTotalBolsao } from "@/hooks/useArenaLigacoes";
import { cn } from "@/lib/utils";

export default function ArenaPortas({ value, onChange }: { value: Porta | null; onChange: (p: Porta) => void }) {
  const est = useTotalBolsao("estagnados");
  const desc = useTotalBolsao("descartados");
  const { campanhas, statsMap } = useCampanhasDisponiveis();
  const listas = campanhas.reduce((s, c) => s + (statsMap[c.id]?.naFila ?? 0), 0);
  const portas = [
    { v: "listas" as Porta, icon: ListChecks, titulo: "Listas de leads", desc: `${campanhas.length} campanhas liberadas`, n: listas, erro: false },
    { v: "estagnados" as Porta, icon: Hourglass, titulo: "Estagnados", desc: "Clientes que pararam de andar", n: est.data, erro: est.isError },
    { v: "descartados" as Porta, icon: RefreshCcw, titulo: "Descartados", desc: "Uma segunda chance nos últimos 6 meses", n: desc.data, erro: desc.isError },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {portas.map((p, i) => {
        const ativo = value === p.v;
        return (
          <motion.button key={p.v} type="button" onClick={() => onChange(p.v)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cn("group flex flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-colors duration-fast",
              ativo ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40")}>
            <span className="flex items-center justify-between gap-2">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                <p.icon className="h-5 w-5" />
              </span>
              <span className="text-3xl font-black tabular-nums">{p.n === undefined ? (p.erro ? "—" : "…") : p.n.toLocaleString("pt-BR")}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold">{p.titulo}</span>
              <span className="block text-xs text-muted-foreground">{p.desc}</span>
            </span>
            <span className={cn("text-xs font-bold", ativo ? "text-primary" : "text-muted-foreground group-hover:text-primary")}>{ativo ? "Ligando daqui ✓" : "Ligar daqui →"}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
