import { useState, useEffect, useRef, useMemo } from "react";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGerenteDashboard, Period, periodLabels, formatCurrency } from "@/hooks/useGerenteDashboard";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { todayBRT } from "@/lib/utils";
import {
  Phone, Users, Send, CalendarDays, MapPin, Briefcase,
  Loader2, Bot, Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import LeadsDistribuidosPanel from "@/components/distribuicao/LeadsDistribuidosPanel";
import TabAgora from "@/components/gerente/TabAgora";
import TabProducao from "@/components/gerente/TabProducao";
import TabPipeline from "@/components/gerente/TabPipeline";
import TabMetas from "@/components/gerente/TabMetas";

// ── Animated counter ──
function AnimatedNumber({ value, duration = 0.6 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;
    if (from === to) { node.textContent = String(to); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <span ref={ref}>{value}</span>;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 55%, 50%)`;
}

export default function GerenteDashboard() {
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { period: globalPeriod } = useDateFilter();
  const period: Period = globalPeriod === "semana" ? "semana" : globalPeriod === "mes" || globalPeriod === "ultimos_30d" ? "mes" : "dia";
  const [lastUpdate] = useState(() => format(new Date(), "HH:mm"));
  const [homiOpen, setHomiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agora");

  const {
    user, profile, teamUserIds, teamNameMap, kpis: k, kpisLoading,
    funnel, negociosPorFase, agendaHoje, startTs, endTs,
  } = useGerenteDashboard(period);

  // Presence KPI: corretores online vs total
  const { data: presencaData } = useQuery({
    queryKey: ["gerente-presenca-kpi", teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return { online: 0, total: 0 };
      const { data } = await supabase.from("corretor_disponibilidade").select("user_id, status").in("user_id", teamUserIds);
      const online = (data || []).filter(d => ["online", "disponivel", "na_empresa", "em_visita"].includes(d.status)).length;
      return { online, total: teamUserIds.length };
    },
    enabled: teamUserIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  // Profile ID for queries that need it
  const [profileId, setProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfileId(data.id);
    });
  }, [user]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  if (roleLoading || kpisLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const avatarSrc = profile?.avatar_gamificado_url || profile?.avatar_url;
  const ligPct = k.metaTime > 0 ? Math.min(100, Math.round((k.ligacoes / k.metaTime) * 100)) : 0;
  const presenca = presencaData || { online: 0, total: teamUserIds.length };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* GreetingBar */}
      <GreetingBar
        name={profile?.nome || "Gerente"}
        avatarUrl={avatarSrc}
        onRefresh={() => window.location.reload()}
        refreshTime={lastUpdate}
      />

      {teamUserIds.length === 0 && !kpisLoading && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum corretor ativo no time</p>
            <p className="text-xs text-muted-foreground">Quando seus corretores forem adicionados, os KPIs aparecerão aqui.</p>
          </div>
        </div>
      )}

      {/* 5 KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Presença */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground">Presença</span>
            </div>
            <p className="text-3xl font-black leading-none text-primary">
              <AnimatedNumber value={presenca.online} /><span className="text-lg text-muted-foreground font-normal"> / {presenca.total}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">corretores online</p>
          </motion.div>

          {/* Ligações */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1.5 mb-2">
              <Phone className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Ligações hoje</span>
            </div>
            <p className="text-3xl font-black leading-none" style={{ color: "hsl(var(--primary))" }}>
              <AnimatedNumber value={k.ligacoes} />
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Meta: {k.metaTime} · {ligPct}%</p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ transformOrigin: "left" }}>
              <Progress value={ligPct} className="h-1 mt-2" />
            </motion.div>
          </motion.div>

          {/* Distribuídos */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1.5 mb-2">
              <Send className="h-4 w-4" style={{ color: "hsl(25, 90%, 55%)" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Distribuídos</span>
            </div>
            <LeadsDistribuidosPanel teamUserIds={teamUserIds} period="dia" compact showPeriodSelector={false} />
          </motion.div>

          {/* Visitas */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Visitas hoje</span>
            </div>
            <p className="text-3xl font-black leading-none" style={{ color: "hsl(var(--warning))" }}>
              <AnimatedNumber value={k.visitasMarcadas ?? k.visitasHoje} />
              <span className="text-lg text-muted-foreground font-normal"> / <AnimatedNumber value={k.visitasRealizadas ?? 0} /></span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">marcadas / realizadas</p>
          </motion.div>

          {/* VGV */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase className="h-4 w-4" style={{ color: "hsl(270, 60%, 55%)" }} />
              <span className="text-[11px] font-medium text-muted-foreground">VGV em negociação</span>
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: "hsl(270, 60%, 55%)" }}>
              {formatCurrency(k.vgvTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{k.negociosAtivos} negócios ativos</p>
          </motion.div>
        </div>
      </motion.div>

      {/* 4 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 h-10">
          <TabsTrigger value="agora" className="text-xs font-semibold">Agora</TabsTrigger>
          <TabsTrigger value="producao" className="text-xs font-semibold">Produção</TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs font-semibold">Pipeline</TabsTrigger>
          <TabsTrigger value="metas" className="text-xs font-semibold">Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="agora">
          <TabAgora teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        </TabsContent>

        <TabsContent value="producao">
          <TabProducao teamUserIds={teamUserIds} teamNameMap={teamNameMap} profileId={profileId} />
        </TabsContent>

        <TabsContent value="pipeline">
          <TabPipeline funnel={funnel} negociosPorFase={negociosPorFase} agendaHoje={agendaHoje} />
        </TabsContent>

        <TabsContent value="metas">
          <TabMetas teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        </TabsContent>
      </Tabs>

      {/* HOMI Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/homi-gerente")}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        title="HOMI Gerente"
      >
        <Bot className="h-6 w-6" />
      </motion.button>
    </div>
  );
}
