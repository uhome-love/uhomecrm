// =============================================================================
// CorretorDashboard — Layout completo da Home do Corretor
// Combina identidade visual do CorretorHome com lógica corrigida.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Phone, MessageCircle, Trophy, CheckCircle, Zap, Bot,
  WifiOff, Target, ListTodo,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { useElegibilidadeRoleta } from "@/hooks/useElegibilidadeRoleta";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useDailyMotivation } from "@/hooks/useCorretorDailyStats";
import { useMissoesLeads } from "@/hooks/useMissoesLeads";
import { useCorretorHomeData } from "@/hooks/useCorretorHomeData";
import { useConquistas } from "@/hooks/useConquistas";

import OportunidadesLista from "@/components/corretor/OportunidadesLista";
import DailyProgressCard from "@/components/corretor/DailyProgressCard";
import MissoesDeHoje from "@/components/corretor/MissoesDeHoje";
import RankingGestaoLeads from "@/components/corretor/RankingGestaoLeads";
import MinhaAgendaWidget from "@/components/corretor/MinhaAgendaWidget";
import VisitasHojeCard from "@/components/corretor/VisitasHojeCard";
import MiniFunilPessoal from "@/components/corretor/MiniFunilPessoal";
import EvolucaoSemanal from "@/components/corretor/EvolucaoSemanal";
import LevelProgressBar from "@/components/corretor/LevelProgressBar";
import CelebrationOverlay from "@/components/corretor/CelebrationOverlay";
import OnboardingWidget from "@/components/corretor/OnboardingWidget";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { ACHIEVEMENTS } from "@/lib/gamification";

const ACHIEVEMENTS_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, { emoji: a.emoji, label: a.label }])
);

// ---------------------------------------------------------------------------
// Hook: status online / roleta (extraído do OportunidadesDoDia)
// ---------------------------------------------------------------------------
function useCorretorStatus() {
  const { user } = useAuth();
  const { podeFazerRoleta, leadsDesatualizados, recarregar: recarregarElegibilidade } = useElegibilidadeRoleta();
  const [statusOnline, setStatusOnline] = useState(false);
  const [naRoleta, setNaRoleta] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [roletaUpdating, setRoletaUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("corretor_disponibilidade")
      .select("status, na_roleta")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[useCorretorStatus] Erro:", error);
          return;
        }
        if (data) {
          setStatusOnline(data.status === "na_empresa");
          setNaRoleta(data.na_roleta ?? false);
        }
      });
  }, [user]);

  const alternarOnline = useCallback(async (novoStatus: boolean) => {
    if (!user) return;
    setStatusUpdating(true);
    setStatusOnline(novoStatus);
    const agora = new Date().toISOString();

    const payload: Record<string, unknown> = {
      user_id: user.id,
      status: novoStatus ? "na_empresa" : "offline",
      updated_at: agora,
    };
    if (novoStatus) payload.entrada_em = agora;
    else { payload.saida_em = agora; payload.na_roleta = false; }

    const { error } = await supabase
      .from("corretor_disponibilidade")
      .upsert(payload as any, { onConflict: "user_id" });

    setStatusUpdating(false);
    if (error) {
      console.error("[alternarOnline] Erro:", error);
      setStatusOnline(!novoStatus);
      toast.error("Erro ao atualizar status. Tente novamente.");
    } else {
      toast.success(novoStatus ? "Você está online na empresa" : "Você está offline");
      if (!novoStatus) setNaRoleta(false);
    }
  }, [user]);

  const alternarRoleta = useCallback(async () => {
    if (!user) return;
    if (!naRoleta && !podeFazerRoleta) {
      toast.error(
        `Você tem ${leadsDesatualizados} lead(s) sem tarefa pendente (máx: 10). Crie tarefas no pipeline para se desbloquear.`,
        { duration: 5000 }
      );
      return;
    }
    setRoletaUpdating(true);
    const novoEstado = !naRoleta;
    setNaRoleta(novoEstado);

    const { error } = await supabase
      .from("corretor_disponibilidade")
      .upsert(
        { user_id: user.id, na_roleta: novoEstado, status: "na_empresa", updated_at: new Date().toISOString() } as any,
        { onConflict: "user_id" }
      );

    setRoletaUpdating(false);
    if (error) {
      console.error("[alternarRoleta] Erro:", error);
      setNaRoleta(!novoEstado);
      toast.error("Erro ao atualizar roleta. Tente novamente.");
    } else {
      toast.success(novoEstado ? "Você está na roleta! Aguarde novos leads." : "Você saiu da roleta.");
    }
  }, [user, naRoleta, podeFazerRoleta, leadsDesatualizados]);

  return {
    statusOnline, naRoleta, podeFazerRoleta, leadsDesatualizados,
    statusUpdating, roletaUpdating,
    alternarOnline, alternarRoleta,
    recarregarElegibilidade,
  };
}

// ---------------------------------------------------------------------------
// Componente Principal
// ---------------------------------------------------------------------------
export default function CorretorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Profile
  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_preview_url?: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_preview_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const avatarSrc = profile?.avatar_url || profile?.avatar_preview_url;
  const primeiroNome = (profile?.nome || "Corretor").split(" ")[0];
  const initials = (profile?.nome || "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  // Status
  const {
    statusOnline, naRoleta, podeFazerRoleta, leadsDesatualizados,
    statusUpdating, roletaUpdating,
    alternarOnline, alternarRoleta,
  } = useCorretorStatus();

  // Data hooks
  const { progress, goals, saveGoals } = useCorretorProgress();
  const motivation = useDailyMotivation();
  const { missoes, missaoGeral, ranking, rankingLoading, userId } = useMissoesLeads();
  const { followUps, followUpsLoading, visitasHoje, visitasLoading, funil, funilLoading, totalLeads, evolucao, evolucaoLoading } = useCorretorHomeData();
  const { newlyUnlocked, dismissCelebration, unlocked } = useConquistas();

  // Date
  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto pb-10">
      <CelebrationOverlay achievement={newlyUnlocked} onDismiss={dismissCelebration} />
      <OnboardingWidget />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. BANNER GRADIENTE                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-2xl p-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED, #2563EB)" }}
        >
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile?.nome || "Avatar"}
                className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-white/30"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white font-black text-xl select-none border-2 border-white/30"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                {initials || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold truncate">
                Olá, {primeiroNome}! 👋
              </p>
              <p className="text-sm text-white/80 italic leading-snug mt-0.5">
                "{motivation}"
              </p>
              <p className="text-xs text-white/60 mt-1 capitalize">{dataFormatada}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. LINHA DE STATUS COMPACTA                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <div className="flex items-center gap-4 px-1">
          {/* Na Empresa */}
          <div className="flex items-center gap-2">
            {statusOnline ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs font-medium text-foreground">
              {statusOnline ? "Na Empresa" : "Offline"}
            </span>
            <Switch
              checked={statusOnline}
              disabled={statusUpdating}
              onCheckedChange={alternarOnline}
              className="scale-75"
            />
          </div>

          <span className="text-muted-foreground/40">•</span>

          {/* Roleta */}
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {naRoleta ? "Na Roleta" : !podeFazerRoleta ? "Roleta 🔒" : "Fora da Roleta"}
            </span>
            <Switch
              checked={naRoleta}
              disabled={roletaUpdating}
              onCheckedChange={alternarRoleta}
              className="scale-75"
            />
          </div>

          {!podeFazerRoleta && !naRoleta && (
            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive ml-auto">
              {leadsDesatualizados} sem tarefa
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. KPI CARDS — 4 em linha                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <KpiGrid cols={4}>
          <KpiCard
            label="TOTAL LEADS"
            value={totalLeads}
            icon={<Zap className="h-4 w-4" />}
            variant="highlight"
          />
          <KpiCard
            label="LIGAÇÕES HOJE"
            value={progress.ligacoes}
            icon={<Phone className="h-4 w-4" />}
            variant="success"
          />
          <KpiCard
            label="WHATSAPPS"
            value={progress.whatsapps}
            icon={<MessageCircle className="h-4 w-4" />}
            variant="success"
          />
          <KpiCard
            label="TAXA APROV."
            value={`${progress.taxaAproveitamento}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="highlight"
          />
        </KpiGrid>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. BOTÕES DE AÇÃO                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-14 gap-2 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_20px_hsl(152_60%_42%/0.3)]"
            onClick={() => navigate("/oferta-ativa")}
          >
            <Phone className="h-5 w-5" />
            CALL / Oferta Ativa
          </Button>
          <Button
            size="lg"
            className="h-14 gap-2 text-sm font-bold rounded-xl"
            onClick={() => navigate("/pipeline-leads")}
          >
            <ListTodo className="h-5 w-5" />
            Pipeline
          </Button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. OPORTUNIDADES DO DIA                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <OportunidadesLista />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. AGENDA + VISITAS (lado a lado)                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MinhaAgendaWidget />
          {visitasHoje.length > 0 ? (
            <VisitasHojeCard visitas={visitasHoje} loading={visitasLoading} />
          ) : (
            <div />
          )}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. MINI FUNIL + EVOLUÇÃO                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MiniFunilPessoal funil={funil} totalLeads={totalLeads} loading={funilLoading} />
          <EvolucaoSemanal evolucao={evolucao} loading={evolucaoLoading} />
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 7. META DO DIA                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <DailyProgressCard
          progress={progress}
          goals={goals}
          saveGoals={saveGoals}
          variant="full"
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 8. MISSÕES DE HOJE                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <MissoesDeHoje
          missoes={missoes}
          missaoGeral={missaoGeral}
          pontos={progress.pontos}
          todasCompletas={progress.todasMissoesCumpridas}
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 9. RANKING                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}>
        <RankingGestaoLeads
          ranking={ranking}
          loading={rankingLoading}
          userId={userId}
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 14. GAMIFICAÇÃO (Level + Conquistas)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
        <Card className="border-primary/10 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <LevelProgressBar points={progress.pontos} />
            {unlocked.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <p className="text-[10px] text-muted-foreground font-medium shrink-0">Recentes:</p>
                {unlocked.slice(0, 5).map(u => {
                  const def = ACHIEVEMENTS_MAP[u.conquista_id];
                  return def ? (
                    <span key={u.conquista_id} className="text-sm" title={def.label}>{def.emoji}</span>
                  ) : null;
                })}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary ml-auto" onClick={() => navigate("/conquistas")}>
                  Ver todas →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 15. QUICK ACCESS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/oferta-ativa?tab=aproveitados")}>
            <CheckCircle className="h-4 w-4" /> Aproveitados
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/oferta-ativa?tab=ranking")}>
            <Trophy className="h-4 w-4" /> Ranking
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/homi")}>
            <Bot className="h-4 w-4" /> Homi AI
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
