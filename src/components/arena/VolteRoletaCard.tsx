/** Cartão do painel do corretor: caminho para voltar à Roleta via Oferta Ativa. Só lê — não credencia. */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Phone, Handshake, CalendarPlus, CheckCircle2, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMinhaEvolucao } from "@/hooks/useMinhaEvolucao";
import { useCorretorDailyStats } from "@/hooks/useCorretorDailyStats";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import { useRankingLigacoes, useTotalBolsao } from "@/hooks/useArenaLigacoes";
import { ARENA_MINIMO, foraDaRoleta, pct } from "@/lib/arenaLigacoes";
import { fmtVisitas } from "@/lib/visitasRoleta";
import { cn } from "@/lib/utils";

function Passo({ icon: Icon, titulo, valor, meta, ativo }: { icon: typeof Phone; titulo: string; valor: number; meta: number; ativo?: boolean }) {
  const ok = valor >= meta;
  return (
    <div className={cn("arena-vidro rounded-xl p-2.5", ativo && !ok && "arena-brilho ring-1 ring-primary-foreground/50")}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-85">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success-500" /> : <Icon className="h-3.5 w-3.5" />}{titulo}
      </div>
      <div className="mt-0.5 text-lg font-black tabular-nums">{fmtVisitas(valor)}<span className="text-xs font-semibold opacity-60">/{meta}</span></div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-primary-foreground/15"><div className="arena-barra h-full rounded-full" style={{ width: `${pct(valor, meta)}%` }} /></div>
    </div>
  );
}

export default function VolteRoletaCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: evo } = useMinhaEvolucao();
  const { stats } = useCorretorDailyStats();
  const { data: ranking = [] } = useRankingLigacoes("semana");
  const est = useTotalBolsao("estagnados");
  const desc = useTotalBolsao("descartados");
  const { campanhas, statsMap } = useCampanhasDisponiveis();
  if (!evo) return null;

  const fora = foraDaRoleta(evo.semanaAnterior, evo.semanaAtual, evo.meta);
  const faltamVis = Math.max(0, evo.meta - evo.semanaAtual);
  const eu = ranking.find((l) => l.user_id === user?.id);
  const listas = campanhas.reduce((s, c) => s + (statsMap[c.id]?.naFila ?? 0), 0);
  const portas = [
    { label: "📋 Listas", n: listas as number | undefined },
    { label: "⏳ Estagnados", n: est.data },
    { label: "♻️ Descartados", n: desc.data },
  ];
  const ir = () => navigate("/arena-ligacoes");

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="arena-hero relative overflow-hidden rounded-2xl p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-lg font-black leading-tight md:text-xl">
              {fora ? "🎯 Volte pra Roleta pela Oferta Ativa" : "📞 Arena de Ligações"}
            </h2>
            <p className="text-sm opacity-85">
              {fora
                ? <>Você está fora da Roleta esta semana. Faltam <b className="arena-ouro">{fmtVisitas(faltamVis)} {faltamVis === 1 ? "visita realizada" : "visitas realizadas"}</b>. O caminho começa no telefone.</>
                : "Você está na Roleta. Bata o mínimo de ligações e suba no ranking!"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Passo icon={Phone} titulo="Ligar" valor={stats.ligacoes} meta={ARENA_MINIMO.ligacoes} ativo />
            <Passo icon={Handshake} titulo="Aproveitar" valor={stats.aproveitados} meta={ARENA_MINIMO.aproveitados} />
            <Passo icon={CalendarPlus} titulo="Marcar visita" valor={stats.visitas_marcadas} meta={ARENA_MINIMO.visitas} />
            <Passo icon={CheckCircle2} titulo="Visitas na semana" valor={evo.semanaAtual} meta={evo.meta} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {portas.map((p) => (
              <button key={p.label} type="button" onClick={ir} className="arena-vidro rounded-full px-3 py-1 text-xs font-semibold transition-transform duration-fast hover:scale-105">
                {p.label} <span className="tabular-nums">{p.n === undefined ? "…" : p.n.toLocaleString("pt-BR")}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 lg:w-[220px] lg:flex-col lg:text-center">
          <div className="arena-vidro flex flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 lg:w-full lg:flex-col lg:justify-center lg:py-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-75"><Trophy className="h-3 w-3" /> Ranking da semana</p>
            <p className="flex items-baseline gap-2 lg:flex-col lg:items-center lg:gap-0">
              <span className="arena-ouro text-2xl font-black lg:text-3xl">{eu ? `#${eu.posicao}` : "—"}</span>
              <span className="text-xs opacity-75">{eu ? `${eu.ligacoes} ligações` : "faça a 1ª ligação"}</span>
            </p>
          </div>
          <Button size="lg" onClick={ir} className="h-12 w-full flex-1 gap-2 rounded-xl text-base font-black lg:w-full">
            <Play className="h-4 w-4 fill-current" /> Começar a ligar
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
