import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { todayBRT } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import {
  Phone, CheckCircle, CalendarDays, Building2, Flame,
  Trophy, ArrowRight, Clock, Loader2, Send, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import PulseFeed from "@/components/pulse/PulseFeed";

type Period = "dia" | "semana" | "mes";
const periodLabels: Record<Period, string> = { dia: "Hoje", semana: "Esta Semana", mes: "Este Mês" };

function getPeriodRange(period: Period) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  if (period === "dia") return { start: todayStr, end: todayStr, startTs: `${todayStr}T00:00:00-03:00`, endTs: `${todayStr}T23:59:59.999-03:00` };
  if (period === "semana") {
    const s = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const e = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
  }
  const s = format(startOfMonth(now), "yyyy-MM-dd");
  const e = format(endOfMonth(now), "yyyy-MM-dd");
  return { start: s, end: e, startTs: `${s}T00:00:00-03:00`, endTs: `${e}T23:59:59.999-03:00` };
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
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

interface CorretorRow {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  avatar_gamificado_url: string | null;
  ligacoes: number;
  aproveitados: number;
  taxa: number;
  visitas: number;
  pontos: number;
  streak: number;
  status: "online" | "paused" | "offline";
}

interface CorretorDrawerData {
  user_id: string;
  nome: string;
  avatar_url: string | null;
}

export default function GerenteDashboard() {
  const { user } = useAuth();
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("dia");
  const [profile, setProfile] = useState<{ nome?: string; avatar_url?: string; avatar_gamificado_url?: string } | null>(null);
  const [lastUpdate] = useState(() => format(new Date(), "HH:mm"));
  const [drawerCorretor, setDrawerCorretor] = useState<CorretorDrawerData | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome, avatar_url, avatar_gamificado_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const nome = profile?.nome?.split(" ")[0] || "";
  const { start, end, startTs, endTs } = getPeriodRange(period);
  const today = todayBRT();
  const weekNum = Math.ceil((new Date().getDate()) / 7);

  // ── Team members ──
  const { data: teamMembers } = useQuery({
    queryKey: ["gerente-team", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, user_id, nome, equipe, status").eq("gerente_id", user!.id).eq("status", "ativo");
      return data || [];
    },
    enabled: !!user,
  });

  const teamUserIds = (teamMembers || []).map(t => t.user_id).filter(Boolean) as string[];

  // ── KPIs ──
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["gerente-kpis", user?.id, period, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return { ligacoes: 0, metaLigacoesPorCorretor: 30, metaLigacoesTime: 0, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", dias: 0 } };

      const { count: ligacoes } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs);
      const { count: aproveitados } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).eq("resultado", "com_interesse").gte("created_at", startTs).lte("created_at", endTs);
      const { count: visitasHoje } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).eq("data_visita", today);
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { count: visitasSemana } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).gte("data_visita", weekStart).lte("data_visita", weekEnd);
      const { data: negocios } = await supabase.from("negocios").select("fase, vgv_estimado").eq("gerente_id", user!.id).not("fase", "in", '("assinado","distrato","cancelado")');
      const negociosAtivos = negocios?.length || 0;
      const vgvTotal = (negocios || []).reduce((s, n) => s + Number(n.vgv_estimado || 0), 0);

      const lig = ligacoes || 0;
      const apr = aproveitados || 0;
      const taxa = lig > 0 ? Math.round((apr / lig) * 100) : 0;

      const metaPorCorretor = period === "dia" ? 30 : period === "semana" ? 150 : 600;
      const metaTime = teamUserIds.length * metaPorCorretor;

      // Best streak historical
      const { data: streakData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id")
        .in("corretor_id", teamUserIds)
        .gte("created_at", startTs)
        .lte("created_at", endTs);
      // Count per corretor to find top performer
      const streakCounts: Record<string, number> = {};
      (streakData || []).forEach(s => { streakCounts[s.corretor_id] = (streakCounts[s.corretor_id] || 0) + 1; });
      const topStreakId = Object.entries(streakCounts).sort((a, b) => b[1] - a[1])[0];
      const { data: profilesAll } = await supabase.from("profiles").select("user_id, nome").in("user_id", teamUserIds);
      const nameMap = Object.fromEntries((profilesAll || []).map(p => [p.user_id, p.nome]));

      return {
        ligacoes: lig,
        metaLigacoesPorCorretor: metaPorCorretor,
        metaLigacoesTime: metaTime,
        aproveitados: apr,
        taxa,
        visitasHoje: visitasHoje || 0,
        visitasSemana: visitasSemana || 0,
        negociosAtivos,
        vgvTotal,
        melhorStreak: topStreakId ? { nome: nameMap[topStreakId[0]]?.split(" ")[0] || "Corretor", dias: topStreakId[1] } : { nome: "-", dias: 0 },
      };
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 30_000,
  });

  // ── Ranking Table ──
  const { data: ranking } = useQuery({
    queryKey: ["gerente-ranking", user?.id, period, teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, avatar_url, avatar_gamificado_url").in("user_id", teamUserIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      const { data: tentativas } = await supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs);
      const { data: visitas } = await supabase.from("visitas").select("corretor_id").eq("gerente_id", user!.id).gte("data_visita", start).lte("data_visita", end);
      const { data: disps } = await supabase.from("corretor_disponibilidade").select("user_id, status").in("user_id", teamUserIds);
      const dispMap = Object.fromEntries((disps || []).map(d => [d.user_id, d.status]));

      const stats: Record<string, { lig: number; apr: number; pts: number; vis: number }> = {};
      teamUserIds.forEach(id => { stats[id] = { lig: 0, apr: 0, pts: 0, vis: 0 }; });
      (tentativas || []).forEach(t => {
        if (!stats[t.corretor_id]) return;
        stats[t.corretor_id].lig++;
        if (t.resultado === "com_interesse") stats[t.corretor_id].apr++;
        stats[t.corretor_id].pts += t.pontos || 0;
      });
      (visitas || []).forEach(v => {
        if (v.corretor_id && stats[v.corretor_id]) stats[v.corretor_id].vis++;
      });

      const rows: CorretorRow[] = teamUserIds.map(uid => {
        const p = profileMap[uid];
        const s = stats[uid];
        const disp = dispMap[uid];
        return {
          user_id: uid,
          nome: p?.nome || teamMembers?.find(t => t.user_id === uid)?.nome || "Corretor",
          avatar_url: p?.avatar_url || null,
          avatar_gamificado_url: (p as any)?.avatar_gamificado_url || null,
          ligacoes: s.lig,
          aproveitados: s.apr,
          taxa: s.lig > 0 ? Math.round((s.apr / s.lig) * 100) : 0,
          visitas: s.vis,
          pontos: s.pts,
          streak: 0,
          status: disp === "disponivel" ? "online" : disp === "pausa" ? "paused" : "offline",
        };
      });
      return rows.sort((a, b) => b.pontos - a.pontos);
    },
    enabled: !!user && teamUserIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── Pipeline Summary ──
  const { data: pipelineSummary } = useQuery({
    queryKey: ["gerente-pipeline", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("negocios").select("fase, vgv_estimado").eq("gerente_id", user!.id);
      const fases: Record<string, { count: number; vgv: number }> = { proposta: { count: 0, vgv: 0 }, negociacao: { count: 0, vgv: 0 }, documentacao: { count: 0, vgv: 0 }, assinado: { count: 0, vgv: 0 } };
      (data || []).forEach(n => {
        const f = n.fase || "proposta";
        if (fases[f]) { fases[f].count++; fases[f].vgv += Number(n.vgv_estimado || 0); }
      });
      const totalVgv = Object.values(fases).reduce((s, f) => s + f.vgv, 0);
      return { fases, totalVgv };
    },
    enabled: !!user,
  });

  // ── Today's Visits ──
  const { data: todayVisitas } = useQuery({
    queryKey: ["gerente-visitas-hoje", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("visitas").select("id, nome_cliente, empreendimento, hora_visita, status, corretor_id").eq("gerente_id", user!.id).eq("data_visita", today).order("hora_visita");
      return data || [];
    },
    enabled: !!user,
  });

  // ── Academia Stats ──
  const { data: academiaStats } = useQuery({
    queryKey: ["gerente-academia", teamUserIds.join(",")],
    queryFn: async () => {
      if (teamUserIds.length === 0) return { pctCompleted: 0, total: teamUserIds.length, withProgress: 0 };
      const { data } = await supabase.from("academia_progresso").select("corretor_id, status").in("corretor_id", teamUserIds);
      const completedSet = new Set((data || []).filter(d => d.status === "concluida").map(d => d.corretor_id));
      return { pctCompleted: Math.round((completedSet.size / teamUserIds.length) * 100), total: teamUserIds.length, withProgress: completedSet.size };
    },
    enabled: teamUserIds.length > 0,
  });

  const k = kpis || { ligacoes: 0, metaLigacoesPorCorretor: 30, metaLigacoesTime: 0, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", dias: 0 } };
  const pipe = pipelineSummary || { fases: { proposta: { count: 0, vgv: 0 }, negociacao: { count: 0, vgv: 0 }, documentacao: { count: 0, vgv: 0 }, assinado: { count: 0, vgv: 0 } }, totalVgv: 0 };

  const statusIcons: Record<string, string> = {
    marcada: "🟡", confirmada: "🟢", realizada: "✅", no_show: "🔴", reagendada: "🔄", cancelada: "⬛",
  };

  if (roleLoading || kpisLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";
  const ligPct = k.metaLigacoesTime > 0 ? Math.min(100, Math.round((k.ligacoes / k.metaLigacoesTime) * 100)) : 0;
  const totalPipeCount = Object.values(pipe.fases).reduce((s, f) => s + f.count, 0);
  const visitas3 = (todayVisitas || []).slice(0, 3);
  const visitasExtra = (todayVisitas || []).length - 3;

  const GERENTE_FRASES = [
    "Seu time é reflexo da sua liderança.",
    "Quem desenvolve pessoas, multiplica resultados.",
    "Gestão é arte. Execução é disciplina.",
    "O gerente que acompanha, o time que entrega.",
    "Liderar é servir com propósito.",
  ];
  const fraseIdx = Math.floor(Date.now() / 86_400_000) % GERENTE_FRASES.length;
  const avatarSrc = profile?.avatar_gamificado_url || profile?.avatar_url;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ─── 1. HEADER DARK (CEO-STYLE) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 md:p-6"
        style={{ background: "#0f172a" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img src={avatarSrc} alt={nome} className="h-14 w-14 rounded-full object-cover border-2 border-white shrink-0" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shrink-0 font-black text-xl text-white" style={{ background: "#3b82f6" }}>
                {getInitials(profile?.nome || "G")}
              </div>
            )}
            <div>
              <h1 className="text-[22px] font-bold text-white">{greeting}, {nome}! 👋</h1>
              <p className="text-xs italic text-slate-400 mt-0.5">{GERENTE_FRASES[fraseIdx]}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Semana {weekNum} do mês
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0 mt-1">
            <RefreshCw className="h-3 w-3" />
            <span>Atualizado {lastUpdate}</span>
          </div>
        </div>

        {/* Period pills */}
        <div className="flex items-center gap-2 mt-4">
          {(["dia", "semana", "mes"] as Period[]).map(p => (
            <button
              key={p}
              className="text-sm px-4 py-1.5 rounded-full font-medium transition-all duration-200"
              style={{
                background: period === p ? "#1e293b" : "transparent",
                color: period === p ? "#FFFFFF" : "#94A3B8",
                border: period === p ? "1px solid #3B82F6" : "1px solid transparent",
              }}
              onMouseEnter={e => { if (period !== p) e.currentTarget.style.color = "#FFFFFF"; }}
              onMouseLeave={e => { if (period !== p) e.currentTarget.style.color = "#94A3B8"; }}
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Empty state when team has no activity */}
      {teamUserIds.length > 0 && k.ligacoes === 0 && k.aproveitados === 0 && k.visitasHoje === 0 && k.negociosAtivos === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma atividade registrada ainda ({periodLabels[period].toLowerCase()})</p>
            <p className="text-xs text-muted-foreground">Quando seus corretores começarem a ligar e registrar visitas, os KPIs aparecerão aqui.</p>
          </div>
        </motion.div>
      )}

      {teamUserIds.length === 0 && !kpisLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum corretor ativo no time ainda</p>
            <p className="text-xs text-muted-foreground">Quando seus corretores forem adicionados e receberem leads, os KPIs aparecerão aqui.</p>
          </div>
        </motion.div>
      )}

      {/* ─── 2. KPI CARDS — 6 em linha ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Ligações */}
          <div className="rounded-2xl p-4 bg-card border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-muted-foreground">Ligações</span>
            </div>
            <p className="text-4xl font-black text-blue-600">{k.ligacoes}</p>
            <p className={`text-sm font-semibold ${ligPct > 0 ? "text-blue-600" : "text-red-500"}`}>{ligPct}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{periodLabels[period]} · meta {k.metaLigacoesPorCorretor}/corretor</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Time: {k.ligacoes}/{k.metaLigacoesTime}</p>
            <Progress value={ligPct} className="h-1 mt-2" />
          </div>

          {/* Aproveitados */}
          <div className="rounded-2xl p-4 bg-card border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-muted-foreground">Aproveitados</span>
            </div>
            <p className="text-4xl font-black text-green-600">{k.aproveitados}</p>
            <p className="text-sm text-muted-foreground">{k.taxa}% conversão</p>
          </div>

          {/* Visitas */}
          <div className="rounded-2xl p-4 bg-card border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-muted-foreground">Visitas</span>
            </div>
            <p className="text-4xl font-black text-amber-600">{k.visitasHoje}</p>
            <p className="text-sm text-muted-foreground">{k.visitasHoje} hoje · {k.visitasSemana} esta semana</p>
          </div>

          {/* Negócios */}
          <div className="rounded-2xl p-4 bg-card border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-muted-foreground">Negócios</span>
            </div>
            <p className="text-4xl font-black text-purple-600">{k.negociosAtivos}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(k.vgvTotal)}</p>
          </div>

          {/* Melhor Streak */}
          <div className="rounded-2xl p-4 bg-card border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Melhor Streak</span>
            </div>
            {k.melhorStreak.dias > 0 ? (
              <>
                <p className="text-4xl font-black text-orange-500">{k.melhorStreak.dias}🔥</p>
                <p className="text-sm text-muted-foreground truncate">{k.melhorStreak.nome}</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black text-orange-500">🏆</p>
                <p className="text-sm text-muted-foreground">Aguardando atividade</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Primeiro a ligar ganha destaque!</p>
              </>
            )}
          </div>

        </div>
      </motion.div>

      {/* ─── 3. RANKING DO TIME ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-foreground">🏆 Ranking do Time — {periodLabels[period]}</h2>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> 🔄 Atualiza a cada 60s
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">#</th>
                    <th className="text-left py-2.5 px-2 text-xs text-muted-foreground font-medium">Corretor</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Ligações</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Aprov.</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Taxa</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Visitas</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Pts</th>
                    <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranking || []).map((r, i) => {
                    const initials = getInitials(r.nome);
                    return (
                      <tr
                        key={r.user_id}
                        className="border-b border-border/20 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setDrawerCorretor({ user_id: r.user_id, nome: r.nome, avatar_url: r.avatar_url })}
                      >
                        <td className="py-3 px-2 font-bold">
                          {i === 0 ? <span className="text-amber-500">👑</span> :
                           i === 1 ? <span>🥈</span> :
                           i === 2 ? <span>🥉</span> :
                           <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                    <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            {(r.avatar_gamificado_url || r.avatar_url) ? (
                              <img src={r.avatar_gamificado_url || r.avatar_url!} alt={r.nome} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full text-white font-bold text-xs" style={{ background: hashColor(r.nome) }}>
                                {initials}
                              </div>
                            )}
                            <span className="font-medium text-foreground truncate max-w-[120px]">{r.nome.split(" ")[0]}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-blue-600">{r.ligacoes}</td>
                        <td className="py-3 px-2 text-center font-bold text-green-600">{r.aproveitados}</td>
                        <td className="py-3 px-2 text-center text-purple-600 font-semibold">{r.taxa}%</td>
                        <td className="py-3 px-2 text-center text-amber-600 font-semibold">{r.visitas}</td>
                        <td className="py-3 px-2 text-center font-black text-blue-700">{r.pontos}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            r.status === "online"
                              ? "bg-green-500/10 text-green-600"
                              : r.status === "paused"
                              ? "bg-yellow-500/10 text-yellow-600"
                              : "bg-red-500/10 text-red-600"
                          }`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                              r.status === "online" ? "bg-green-500" :
                              r.status === "paused" ? "bg-yellow-400" : "bg-red-400"
                            }`} />
                            {r.status === "online" ? "Ativo" : r.status === "paused" ? "Parado" : "Ausente"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!ranking || ranking.length === 0) && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">Nenhum corretor ativo no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 4. PIPELINE DE NEGÓCIOS ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">💼 Pipeline de Negócios</h2>
              <button className="text-sm text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/meus-negocios")}>
                Ver completo <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {totalPipeCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-muted/30">
                <p className="text-lg font-semibold text-muted-foreground">🎯 Nenhum negócio ainda</p>
                <p className="text-sm text-muted-foreground mt-1">As visitas de hoje vão mudar isso!</p>
                <button className="text-sm text-primary hover:underline font-medium mt-3 inline-flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                  Ver agenda de hoje <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                  { key: "proposta", label: "Proposta", borderColor: "#F59E0B" },
                  { key: "negociacao", label: "Negociação", borderColor: "#3B82F6" },
                  { key: "documentacao", label: "Documentação", borderColor: "#8B5CF6" },
                  { key: "assinado", label: "Assinado", borderColor: "#22C55E" },
                ] as const).map(col => {
                  const f = pipe.fases[col.key] || { count: 0, vgv: 0 };
                  return (
                    <div key={col.key} className="rounded-2xl p-4 bg-card border border-border/60 text-center" style={{ borderTop: `3px solid ${col.borderColor}` }}>
                      <p className="text-2xl font-black text-foreground">{f.count}</p>
                      <p className="text-xs text-muted-foreground font-medium">{col.label}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{formatCurrency(f.vgv)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 5. ROW INFERIOR — Academia + Agenda ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Academia */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-base font-bold text-foreground">🎓 Academia do Time</h2>
              {(academiaStats?.pctCompleted || 0) === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">0 de {academiaStats?.total || 0} corretores estudou esta semana</p>
                  <Progress value={0} className="h-2" />
                  <p className="text-red-500 text-xs">Nenhum progresso registrado</p>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => toast.info("Funcionalidade em breve!")}>
                    📢 Incentivar o time
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{academiaStats?.pctCompleted}%</p>
                      <p className="text-[10px] text-muted-foreground">do time estudou</p>
                    </div>
                    <div className="flex-1">
                      <Progress value={academiaStats?.pctCompleted || 0} className="h-2" />
                      <p className="text-[10px] text-muted-foreground mt-1">{academiaStats?.withProgress || 0} de {academiaStats?.total || 0} corretores</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => navigate("/academia/gerenciar")}>
                    Gerenciar trilhas <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Agenda de Hoje */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">📅 Agenda de Hoje</h2>
                <button className="text-sm text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                  Ver completa <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {(todayVisitas || []).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-lg">😴 Nenhuma visita hoje</p>
                  <button className="text-sm text-primary hover:underline font-medium mt-2 inline-flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                    Que tal agendar algumas? <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {visitas3.map(v => {
                    const corretorName = ranking?.find(r => r.user_id === v.corretor_id)?.nome?.split(" ")[0] || "";
                    return (
                      <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/30 border border-border/30">
                        <span className="text-sm font-mono font-semibold text-foreground w-12">{v.hora_visita?.slice(0, 5) || "--:--"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{v.nome_cliente}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}{corretorName ? ` · ${corretorName}` : ""}</p>
                        </div>
                        <span className="text-xs">{statusIcons[v.status] || "⚪"} {v.status}</span>
                      </div>
                    );
                  })}
                  {visitasExtra > 0 && (
                    <button className="text-sm text-primary hover:underline font-medium w-full text-center" onClick={() => navigate("/agenda-visitas")}>
                      Ver mais {visitasExtra} visitas →
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── 5b. PULSE FEED ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <PulseFeed />
      </motion.div>

      {/* ─── 6. ATALHOS ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { emoji: "📋", label: "Checkpoint", desc: "Presença e produtividade", to: "/checkpoint" },
            { emoji: "👥", label: "Meu Time", desc: "Gestão dos corretores", to: "/meu-time" },
            { emoji: "📊", label: "Relatórios 1:1", desc: "Reuniões individuais", to: "/relatorios" },
            { emoji: "🤖", label: "HOMI Gerente", desc: "IA para gestão", to: "/homi-gerente" },
          ].map(item => (
            <button
              key={item.label}
              className="rounded-xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/50 cursor-pointer border border-border/60"
              onClick={() => navigate(item.to)}
            >
              <p className="text-sm font-semibold text-foreground">{item.emoji} {item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ─── DRAWER DO CORRETOR ─── */}
      <Sheet open={!!drawerCorretor} onOpenChange={() => setDrawerCorretor(null)}>
        <SheetContent className="w-[400px] sm:w-[440px]">
          {drawerCorretor && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {drawerCorretor.avatar_url && <AvatarImage src={drawerCorretor.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {getInitials(drawerCorretor.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{drawerCorretor.nome}</SheetTitle>
                    <p className="text-xs text-muted-foreground">Detalhes do corretor</p>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="performance" className="mt-2">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="performance" className="text-xs">📊 Performance</TabsTrigger>
                  <TabsTrigger value="leads" className="text-xs">📋 Leads</TabsTrigger>
                  <TabsTrigger value="agenda" className="text-xs">📅 Agenda</TabsTrigger>
                </TabsList>
                <TabsContent value="performance" className="mt-4 space-y-3">
                  <CorretorPerformanceTab userId={drawerCorretor.user_id} period={period} startTs={startTs} endTs={endTs} />
                </TabsContent>
                <TabsContent value="leads" className="mt-4">
                  <CorretorLeadsTab userId={drawerCorretor.user_id} />
                </TabsContent>
                <TabsContent value="agenda" className="mt-4">
                  <CorretorAgendaTab userId={drawerCorretor.user_id} />
                </TabsContent>
              </Tabs>

              <div className="mt-6">
                <Button className="w-full gap-2" variant="outline" onClick={() => toast.info("Funcionalidade em breve!")}>
                  <Send className="h-4 w-4" /> Enviar mensagem para {drawerCorretor.nome.split(" ")[0]}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Drawer sub-components ──

function CorretorPerformanceTab({ userId, period, startTs, endTs }: { userId: string; period: Period; startTs: string; endTs: string }) {
  const { data } = useQuery({
    queryKey: ["corretor-perf-drawer", userId, period],
    queryFn: async () => {
      const { data: tent } = await supabase.from("oferta_ativa_tentativas").select("resultado, pontos, canal").eq("corretor_id", userId).gte("created_at", startTs).lte("created_at", endTs);
      const lig = tent?.length || 0;
      const apr = tent?.filter(t => t.resultado === "com_interesse").length || 0;
      const pts = tent?.reduce((s, t) => s + (t.pontos || 0), 0) || 0;
      const whats = tent?.filter(t => t.canal === "whatsapp").length || 0;
      const emails = tent?.filter(t => t.canal === "email").length || 0;
      return { ligacoes: lig, aproveitados: apr, pontos: pts, whatsapps: whats, emails, taxa: lig > 0 ? Math.round((apr / lig) * 100) : 0 };
    },
  });
  const d = data || { ligacoes: 0, aproveitados: 0, pontos: 0, whatsapps: 0, emails: 0, taxa: 0 };
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Ligações", value: d.ligacoes, icon: "📞" },
        { label: "Aproveitados", value: d.aproveitados, icon: "✅" },
        { label: "Taxa", value: `${d.taxa}%`, icon: "📊" },
        { label: "Pontos", value: d.pontos, icon: "⭐" },
        { label: "WhatsApps", value: d.whatsapps, icon: "💬" },
        { label: "E-mails", value: d.emails, icon: "📧" },
      ].map(item => (
        <div key={item.label} className="p-3 rounded-xl bg-accent/50 border border-border/30 text-center">
          <p className="text-lg font-bold text-foreground">{item.value}</p>
          <p className="text-[10px] text-muted-foreground">{item.icon} {item.label}</p>
        </div>
      ))}
    </div>
  );
}

function CorretorLeadsTab({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["corretor-leads-drawer", userId],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_leads").select("id, nome, empreendimento, prioridade_lead, updated_at").eq("corretor_id", userId).order("updated_at", { ascending: false }).limit(10);
      return data || [];
    },
  });
  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem leads ativos</p>}
      {(data || []).map(l => (
        <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border/30">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{l.nome}</p>
            <p className="text-[10px] text-muted-foreground">{l.empreendimento}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{l.prioridade_lead || "novo"}</Badge>
        </div>
      ))}
    </div>
  );
}

function CorretorAgendaTab({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["corretor-agenda-drawer", userId],
    queryFn: async () => {
      const today = todayBRT();
      const { data } = await supabase.from("visitas").select("id, nome_cliente, empreendimento, data_visita, hora_visita, status").eq("corretor_id", userId).gte("data_visita", today).order("data_visita").order("hora_visita").limit(10);
      return data || [];
    },
  });
  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem visitas futuras</p>}
      {(data || []).map(v => (
        <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/30 border border-border/30">
          <div className="text-center">
            <p className="text-xs font-mono font-semibold text-foreground">{v.hora_visita?.slice(0, 5)}</p>
            <p className="text-[9px] text-muted-foreground">{v.data_visita}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{v.nome_cliente}</p>
            <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
        </div>
      ))}
    </div>
  );
}
