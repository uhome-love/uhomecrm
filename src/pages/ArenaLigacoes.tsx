/**
 * Arena de Ligações — porta principal da Oferta Ativa para o corretor.
 * Placar + metas do dia, escolha da origem (listas / estagnados / descartados) e ranking.
 * O registro das ligações usa os fluxos existentes (CorretorEntrada e BolsaoDiscador): nenhuma regra nova.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import ArenaPlacar from "@/components/arena/ArenaPlacar";
import ArenaRanking from "@/components/arena/ArenaRanking";
import ArenaPortas from "@/components/arena/ArenaPortas";
import CorretorEntrada from "@/components/oferta-ativa/CorretorEntrada";
import BolsaoDiscador from "@/components/oferta-ativa/bolsao/BolsaoDiscador";
import type { Porta } from "@/components/oferta-ativa/bolsao/PortasOfertaAtiva";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { foraDaRoleta } from "@/lib/arenaLigacoes";
import { fmtVisitas } from "@/lib/visitasRoleta";

const DICAS = [
  "Ligue em blocos de 25 minutos sem parar. Ritmo vence talento.",
  "Comece pelo nome e pelo empreendimento: o cliente lembra na hora.",
  "Não atendeu? Mande um WhatsApp curto e passe para o próximo.",
  "O objetivo da ligação é a visita. Ofereça dois horários.",
];

export default function ArenaLigacoes() {
  const navigate = useNavigate();
  const [porta, setPorta] = useState<Porta | null>(null);
  const { data: evo } = useMinhaEvolucao();
  const fora = evo ? foraDaRoleta(evo.semanaAnterior, evo.semanaAtual, evo.meta) : false;
  const faltam = evo ? Math.max(0, evo.meta - evo.semanaAtual) : 0;
  const dica = DICAS[new Date().getDate() % DICAS.length];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-3 py-3 md:px-5 md:py-5">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="arena-hero relative overflow-hidden rounded-2xl p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/corretor")} aria-label="Voltar ao painel" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black md:text-2xl">📞 Arena de Ligações</h1>
              <p className="text-xs opacity-80 md:text-sm">
                {fora ? <>Faltam <b className="arena-ouro">{fmtVisitas(faltam)}</b> {faltam === 1 ? "visita" : "visitas"} para você voltar à Roleta. Cada ligação te aproxima.</> : "Mínimo do dia: 30 ligações · 3 aproveitados · 1 visita agendada."}
              </p>
            </div>
          </div>
        </div>
        <ArenaPlacar />
      </motion.header>

      <div className="flex flex-col gap-4 xl:flex-row">
        <main className="min-w-0 flex-1 space-y-3">
          <ArenaPortas value={porta} onChange={setPorta} />
          {!porta ? (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning-500" />
              <div><p className="font-semibold">Escolha por onde começar ☝️</p><p className="text-muted-foreground">Dica do dia: {dica}</p></div>
            </div>
          ) : porta === "listas" ? (
            <CorretorEntrada onSair={() => setPorta(null)} />
          ) : (
            <BolsaoDiscador key={porta} porta={porta} />
          )}
        </main>
        <aside className="w-full shrink-0 space-y-3 xl:w-[340px]">
          <ArenaRanking />
        </aside>
      </div>
    </div>
  );
}
