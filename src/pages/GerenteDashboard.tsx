import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Phone, CheckCircle, CalendarDays, Building2, Flame, AlertTriangle,
  Trophy, Users, ArrowRight, Clock, Loader2, Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

function MetaBar({ value, meta, label }: { value: number; meta: number; label: string }) {
  const pct = meta > 0 ? Math.min(100, Math.round((value / meta) * 100)) : 0;
  const color = pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground mt-1">{label} · meta {meta}</p>
    </div>
  );
}

interface CorretorRow {
  user_id: string;
  nome: string;
  avatar_url: string | null;
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
  const [nome, setNome] = useState("");
  const [drawerCorretor, setDrawerCorretor] = useState<CorretorDrawerData | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setNome(data.nome.split(" ")[0]);
    });
  }, [user]);

  const { start, end, startTs, endTs } = getPeriodRange(period);
  const today = format(new Date(), "yyyy-MM-dd");
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
      if (teamUserIds.length === 0) return { ligacoes: 0, metaLigacoes: 150, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", dias: 0 }, leadsParados: 0 };

      // Ligações OA
      const { count: ligacoes } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs);

      // Aproveitados
      const { count: aproveitados } = await supabase.from("oferta_ativa_tentativas").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).eq("resultado", "com_interesse").gte("created_at", startTs).lte("created_at", endTs);

      // Visitas hoje
      const { count: visitasHoje } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).eq("data_visita", today);

      // Visitas semana
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { count: visitasSemana } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("gerente_id", user!.id).gte("data_visita", weekStart).lte("data_visita", weekEnd);

      // Negócios ativos + VGV
      const { data: negocios } = await supabase.from("negocios").select("fase, vgv_estimado").eq("gerente_id", user!.id).not("fase", "in", '("assinado","distrato","cancelado")');
      const negociosAtivos = negocios?.length || 0;
      const vgvTotal = (negocios || []).reduce((s, n) => s + Number(n.vgv_estimado || 0), 0);

      // Leads parados (>3 dias sem ação)
      const threshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { count: leadsParados } = await supabase.from("pipeline_leads").select("id", { count: "exact", head: true }).in("corretor_id", teamUserIds).lt("updated_at", threshold);

      const lig = ligacoes || 0;
      const apr = aproveitados || 0;
      const taxa = lig > 0 ? Math.round((apr / lig) * 100) : 0;

      return {
        ligacoes: lig,
        metaLigacoes: teamUserIds.length * (period === "dia" ? 30 : period === "semana" ? 150 : 600),
        aproveitados: apr,
        taxa,
        visitasHoje: visitasHoje || 0,
        visitasSemana: visitasSemana || 0,
        negociosAtivos,
        vgvTotal,
        melhorStreak: { nome: "-", dias: 0 },
        leadsParados: leadsParados || 0,
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

      // Get profiles for avatars
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, avatar_url").in("user_id", teamUserIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

      // Get OA stats
      const { data: tentativas } = await supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, pontos").in("corretor_id", teamUserIds).gte("created_at", startTs).lte("created_at", endTs);

      // Get visitas
      const { data: visitas } = await supabase.from("visitas").select("corretor_id").eq("gerente_id", user!.id).gte("data_visita", start).lte("data_visita", end);

      // Get disponibilidade
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
        if (fases[f]) {
          fases[f].count++;
          fases[f].vgv += Number(n.vgv_estimado || 0);
        }
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
      if (teamUserIds.length === 0) return { pctCompleted: 0, total: teamUserIds.length };
      const { data } = await supabase.from("academia_progresso").select("corretor_id, status").in("corretor_id", teamUserIds);
      const completedSet = new Set((data || []).filter(d => d.status === "concluida").map(d => d.corretor_id));
      return { pctCompleted: Math.round((completedSet.size / teamUserIds.length) * 100), total: teamUserIds.length, withProgress: completedSet.size };
    },
    enabled: teamUserIds.length > 0,
  });

  const k = kpis || { ligacoes: 0, metaLigacoes: 150, aproveitados: 0, taxa: 0, visitasHoje: 0, visitasSemana: 0, negociosAtivos: 0, vgvTotal: 0, melhorStreak: { nome: "-", dias: 0 }, leadsParados: 0 };
  const pipe = pipelineSummary || { fases: { proposta: { count: 0, vgv: 0 }, negociacao: { count: 0, vgv: 0 }, documentacao: { count: 0, vgv: 0 }, assinado: { count: 0, vgv: 0 } }, totalVgv: 0 };

  const statusColors: Record<string, string> = {
    marcada: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    confirmada: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    realizada: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    no_show: "bg-red-500/15 text-red-600 border-red-500/30",
    reagendada: "bg-primary/15 text-primary border-primary/30",
    cancelada: "bg-muted text-muted-foreground border-border",
  };

  const statusIcons: Record<string, string> = {
    marcada: "🟡", confirmada: "🟢", realizada: "✅", no_show: "🔴", reagendada: "🔄", cancelada: "⬛",
  };

  if (roleLoading || kpisLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, {nome}! 👋</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Semana {weekNum}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["dia", "semana", "mes"] as Period[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="h-8 text-xs" onClick={() => setPeriod(p)}>
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* FAIXA 1 — KPIs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Phone className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">Ligações</span>
              </div>
              <MetaBar value={k.ligacoes} meta={k.metaLigacoes} label={periodLabels[period]} />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Aproveitados</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.aproveitados}</p>
              <p className="text-xs text-muted-foreground">{k.taxa}% conversão</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Visitas</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.visitasHoje} <span className="text-sm font-normal text-muted-foreground">hoje</span></p>
              <p className="text-xs text-muted-foreground">{k.visitasSemana} esta semana</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">Negócios</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.negociosAtivos}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(k.vgvTotal)}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">Melhor Streak</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.melhorStreak.dias > 0 ? `${k.melhorStreak.dias}🔥` : "-"}</p>
              <p className="text-xs text-muted-foreground truncate">{k.melhorStreak.nome}</p>
            </CardContent>
          </Card>

          <Card className={`border-border/60 ${k.leadsParados > 10 ? "border-red-500/40" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className={`h-4 w-4 ${k.leadsParados > 10 ? "text-red-500" : "text-amber-500"}`} />
                <span className="text-xs font-medium text-muted-foreground">Leads Parados</span>
              </div>
              <p className={`text-2xl font-bold ${k.leadsParados > 10 ? "text-red-500" : "text-foreground"}`}>{k.leadsParados}</p>
              <p className="text-xs text-muted-foreground">sem ação &gt;3 dias</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* FAIXA 2 — Ranking em Tempo Real */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">Ranking do Time — {periodLabels[period]}</h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="h-3 w-3 mr-1" /> Atualiza a cada 60s
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">#</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Corretor</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Ligações</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Aprov.</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Taxa</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Visitas</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Pts</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranking || []).map((r, i) => (
                    <tr
                      key={r.user_id}
                      className="border-b border-border/20 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setDrawerCorretor({ user_id: r.user_id, nome: r.nome, avatar_url: r.avatar_url })}
                    >
                      <td className="py-2.5 px-2 font-bold text-muted-foreground">
                        {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                              {r.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground truncate max-w-[120px]">{r.nome.split(" ")[0]}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold">{r.ligacoes}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-emerald-600">{r.aproveitados}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-xs font-semibold ${r.taxa >= 15 ? "text-emerald-500" : r.taxa >= 8 ? "text-amber-500" : "text-muted-foreground"}`}>{r.taxa}%</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">{r.visitas}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-primary">{r.pontos}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${r.status === "online" ? "bg-emerald-500" : r.status === "paused" ? "bg-amber-500" : "bg-neutral-400"}`} title={r.status} />
                      </td>
                    </tr>
                  ))}
                  {(!ranking || ranking.length === 0) && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">Nenhum corretor ativo no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* FAIXA 3 — Pipeline de Negócios */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Pipeline de Negócios</h2>
              </div>
              <Button size="sm" variant="ghost" className="text-xs gap-1 text-primary" onClick={() => navigate("/meus-negocios")}>
                Ver completo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {([
                { key: "proposta", label: "Proposta", color: "bg-amber-500" },
                { key: "negociacao", label: "Negociação", color: "bg-primary" },
                { key: "documentacao", label: "Documentação", color: "bg-purple-500" },
                { key: "assinado", label: "Assinado", color: "bg-emerald-500" },
              ] as const).map(col => {
                const f = pipe.fases[col.key] || { count: 0, vgv: 0 };
                return (
                  <div key={col.key} className="text-center p-3 rounded-xl bg-accent/50 border border-border/40">
                    <div className={`h-1.5 w-12 rounded-full mx-auto mb-2 ${col.color}`} />
                    <p className="text-xl font-bold text-foreground">{f.count}</p>
                    <p className="text-[10px] text-muted-foreground">{col.label}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-1">{formatCurrency(f.vgv)}</p>
                  </div>
                );
              })}
            </div>
            {pipe.totalVgv > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-muted-foreground">🎯 Forecast:</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(pipe.totalVgv)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* FAIXA 4 + 5 — Grid: Academia + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Academia */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🎓</span>
                <h2 className="text-sm font-bold text-foreground">Academia do Time</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{academiaStats?.pctCompleted || 0}%</p>
                  <p className="text-[10px] text-muted-foreground">do time estudou</p>
                </div>
                <div className="flex-1">
                  <Progress value={academiaStats?.pctCompleted || 0} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {academiaStats?.withProgress || 0} de {academiaStats?.total || 0} corretores
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs gap-1" onClick={() => navigate("/academia/gerenciar")}>
                Gerenciar trilhas <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agenda do Time */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">Agenda de Hoje</h2>
                </div>
                <Button size="sm" variant="ghost" className="text-xs gap-1 text-primary" onClick={() => navigate("/agenda-visitas")}>
                  Ver completa <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {(todayVisitas || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma visita agendada hoje</p>
                )}
                {(todayVisitas || []).map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/30 border border-border/30">
                    <span className="text-sm font-mono font-semibold text-foreground w-12">{v.hora_visita?.slice(0, 5) || "--:--"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{v.nome_cliente}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[v.status] || ""}`}>
                      {statusIcons[v.status] || "⚪"} {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/checkpoint")}>
            📋 Checkpoint
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/meu-time")}>
            👥 Meu Time
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/relatorios")}>
            📊 Relatórios 1:1
          </Button>
          <Button variant="outline" className="h-12 gap-2 text-sm rounded-xl" onClick={() => navigate("/homi-gerente")}>
            🤖 HOMI Gerente
          </Button>
        </div>
      </motion.div>

      {/* Corretor Detail Drawer */}
      <Sheet open={!!drawerCorretor} onOpenChange={() => setDrawerCorretor(null)}>
        <SheetContent className="w-[400px] sm:w-[440px]">
          {drawerCorretor && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {drawerCorretor.avatar_url && <AvatarImage src={drawerCorretor.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {drawerCorretor.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
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
      const today = format(new Date(), "yyyy-MM-dd");
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
