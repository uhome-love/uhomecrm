import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGerenteDashboard, Period, periodLabels, formatCurrency, getInitials, hashColor } from "@/hooks/useGerenteDashboard";
import type { CorretorRow } from "@/hooks/useGerenteDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayBRT } from "@/lib/utils";
import {
  Phone, CheckCircle, CalendarDays, Building2, Flame,
  Trophy, ArrowRight, Clock, Loader2, Send, RefreshCw,
  AlertTriangle, Zap, Target, Eye, MessageCircle, ChevronDown,
  TrendingUp, Users, MapPin, Briefcase, ClipboardList, CalendarX,
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

interface CorretorDrawerData { user_id: string; nome: string; avatar_url: string | null; }

export default function GerenteDashboard() {
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("dia");
  const [negFaseTab, setNegFaseTab] = useState<"proposta" | "negociacao" | "documentacao">("proposta");
  const [drawerCorretor, setDrawerCorretor] = useState<CorretorDrawerData | null>(null);
  const [lastUpdate] = useState(() => format(new Date(), "HH:mm"));

  const {
    user, profile, teamUserIds, kpis: k, kpisLoading, ranking,
    radarAlerts, funnel, negociosAcao, negociosQuentes, negociosPorFase, agendaHoje, oaResumo, alertasOp,
    startTs, endTs,
  } = useGerenteDashboard(period);

  useEffect(() => {
    if (roleLoading) return;
    if (!isGestor && !isAdmin) navigate("/corretor", { replace: true });
  }, [isGestor, isAdmin, roleLoading, navigate]);

  if (roleLoading || kpisLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const nome = profile?.nome?.split(" ")[0] || "";
  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";
  const weekNum = Math.ceil((new Date().getDate()) / 7);
  const avatarSrc = profile?.avatar_gamificado_url || profile?.avatar_url;
  const ligPct = k.metaTime > 0 ? Math.min(100, Math.round((k.ligacoes / k.metaTime) * 100)) : 0;

  const statusIcons: Record<string, string> = { marcada: "🟡", confirmada: "🟢", realizada: "✅", no_show: "🔴", reagendada: "🔄", cancelada: "⬛" };
  const faseLabels: Record<string, string> = { visita: "Visita", gerado: "Gerado", proposta: "Proposta", negociacao: "Negociação", documentacao: "Documentação", assinado: "Assinado" };
  const faseColors: Record<string, string> = { visita: "text-blue-600", gerado: "text-indigo-600", proposta: "text-amber-600", negociacao: "text-orange-600", documentacao: "text-purple-600", assinado: "text-emerald-600" };

  const activityStatusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    produzindo: { label: "Produzindo", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
    baixa: { label: "Baixa atividade", dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-600" },
    sem_atividade: { label: "Sem atividade", dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-600" },
    offline: { label: "Offline", dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-500" },
  };

  // Radar items - 3 specific alerts
  const radarLeadsSemContato = radarAlerts.find(a => a.id === "leads_sem_contato");
  const radarLeadsSemTarefa = radarAlerts.find(a => a.id === "leads_sem_tarefa");
  const radarVisitasPendentes = radarAlerts.find(a => a.id === "visitas_pendentes");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* ═══ 1. HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="flex items-center gap-3.5">
          {avatarSrc ? (
            <img src={avatarSrc} alt={nome} className="h-11 w-11 rounded-full object-cover border-2 border-white/20 shrink-0" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/20 shrink-0 font-black text-base text-white bg-primary/60">
              {getInitials(profile?.nome || "G")}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{greeting}, {nome}! 👋</h1>
            <p className="text-[11px] text-slate-400">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Semana {weekNum}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 rounded-full p-0.5 gap-0.5">
            {(["dia", "semana", "mes"] as Period[]).map(p => (
              <button key={p} className="text-xs px-4 py-1.5 rounded-full font-semibold transition-all duration-200"
                style={{
                  background: period === p ? "hsl(var(--primary))" : "transparent",
                  color: period === p ? "#FFFFFF" : "#94A3B8",
                }}
                onClick={() => setPeriod(p)}>{periodLabels[p]}</button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
            <RefreshCw className="h-3 w-3" /> {lastUpdate}
          </span>
        </div>
      </motion.div>

      {teamUserIds.length === 0 && !kpisLoading && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum corretor ativo no time ainda</p>
            <p className="text-xs text-muted-foreground">Quando seus corretores forem adicionados, os KPIs aparecerão aqui.</p>
          </div>
        </div>
      )}

      {/* ═══ 2. KPI CARDS — 5 columns ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: Phone, label: "Ligações", value: k.ligacoes, sub: `Meta: ${k.metaTime} · ${ligPct}%`, color: "hsl(var(--primary))", showProgress: true, pct: ligPct },
            { icon: Users, label: "Leads", value: k.totalLeads ?? 0, sub: `ativos no pipeline`, color: "hsl(210, 80%, 55%)" },
            { icon: CalendarDays, label: "Visitas Marcadas", value: k.visitasMarcadas ?? k.visitasHoje, sub: `${periodLabels[period].toLowerCase()}`, color: "hsl(var(--warning))" },
            { icon: MapPin, label: "Visitas Realizadas", value: k.visitasRealizadas ?? 0, sub: `${periodLabels[period].toLowerCase()}`, color: "hsl(160, 60%, 42%)" },
            { icon: Briefcase, label: "Negócios Ativos", value: k.negociosAtivos, sub: `VGV: ${formatCurrency(k.vgvTotal)}`, color: "hsl(270, 60%, 55%)" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
              className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-1.5 mb-2">
                <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                <span className="text-[11px] font-medium text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-3xl font-black leading-none" style={{ color: kpi.color }}>
                <AnimatedNumber value={typeof kpi.value === "number" ? kpi.value : 0} />
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
              {kpi.showProgress && (
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ transformOrigin: "left" }}>
                  <Progress value={kpi.pct} className="h-1 mt-2" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══ 3. RADAR + AGENDA — side by side ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Radar do Gerente */}
          <Card className="border-border/60 overflow-hidden" style={{ borderLeft: "4px solid hsl(var(--destructive))" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-bold text-foreground">Radar do Gerente</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Leads sem contato", count: radarLeadsSemContato?.count || 0, icon: "🔴", route: "/pipeline-leads", color: "bg-destructive/10 text-destructive border-destructive/20" },
                  { label: "Leads sem tarefa", count: radarLeadsSemTarefa?.count || 0, icon: "📝", route: "/pipeline-leads", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
                  { label: "Visitas pendentes", count: radarVisitasPendentes?.count || 0, icon: "📅", route: "/agenda-visitas", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
                ].map(item => (
                  <motion.button key={item.label} whileHover={{ scale: 1.03 }} onClick={() => navigate(item.route)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${item.color}`}>
                    <span className="text-2xl font-black">{item.count}</span>
                    <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Agenda de Hoje */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground">📅 Agenda de Hoje</h2>
                <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                  Ver completa <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {agendaHoje.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <span className="text-lg mr-2">😴</span>
                  <span className="text-sm">Nenhuma visita hoje</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {agendaHoje.slice(0, 4).map(v => (
                    <div key={v.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-accent/30 border border-border/30">
                      <span className="text-xs font-mono font-semibold text-foreground w-11 shrink-0">{v.hora_visita?.slice(0, 5) || "--:--"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{v.nome_cliente}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{v.empreendimento}{v.corretor_nome ? ` · ${v.corretor_nome}` : ""}</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${v.status === "realizada" ? "border-emerald-300 text-emerald-600" : v.status === "confirmada" ? "border-green-300 text-green-600" : "border-amber-300 text-amber-600"}`}>
                        {statusIcons[v.status] || "⚪"} {v.status}
                      </Badge>
                    </div>
                  ))}
                  {agendaHoje.length > 4 && (
                    <button className="text-[10px] text-primary hover:underline font-medium w-full text-center pt-1" onClick={() => navigate("/agenda-visitas")}>
                      +{agendaHoje.length - 4} visitas →
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ═══ 4. FUNIL COMERCIAL ═══ */}
      {funnel.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground">📊 Funil Comercial</h2>
                <span className="text-[10px] text-muted-foreground">
                  {funnel[0]?.count || 0} leads → {funnel[funnel.length - 1]?.count || 0} assinados
                </span>
              </div>

              {/* Modern horizontal funnel */}
              <div className="relative">
                {/* Background track */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-border/30 rounded-full" />
                
                <div className="relative flex items-center justify-between gap-1">
                  {funnel.map((stage, i) => {
                    const maxCount = Math.max(...funnel.map(s => s.count), 1);
                    const intensity = Math.max(0.15, stage.count / maxCount);
                    const colors = [
                      "bg-violet-500", "bg-slate-500", "bg-blue-500", "bg-sky-500",
                      "bg-amber-500", "bg-orange-500", "bg-cyan-500", "bg-teal-500",
                      "bg-yellow-500", "bg-emerald-500",
                    ];
                    const bgColor = colors[i % colors.length];
                    const size = Math.max(36, 36 + (intensity * 20));

                    return (
                      <div key={stage.key} className="flex items-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 + i * 0.04, type: "spring", stiffness: 200 }}
                          className="flex flex-col items-center relative"
                        >
                          {/* Circle node */}
                          <div
                            className={`${bgColor} rounded-full flex items-center justify-center text-white font-black shadow-lg`}
                            style={{ width: size, height: size, fontSize: size > 44 ? 16 : 13 }}
                          >
                            {stage.count}
                          </div>
                          {/* Label */}
                          <p className="text-[9px] font-medium text-muted-foreground text-center mt-1.5 leading-tight max-w-[70px]">
                            {stage.label}
                          </p>
                          {/* Conversion % */}
                          {i > 0 && stage.pct > 0 && (
                            <span className={`absolute -top-5 text-[8px] font-bold px-1 py-0.5 rounded-full ${
                              stage.pct >= 50 ? "text-emerald-600 bg-emerald-500/10" : stage.pct >= 20 ? "text-amber-600 bg-amber-500/10" : "text-destructive bg-destructive/10"
                            }`}>{stage.pct}%</span>
                          )}
                        </motion.div>
                        {/* Connector arrow */}
                        {i < funnel.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ 5. NEGÓCIOS (2 tabs) ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-foreground">💼 Negócios</h2>
                <div className="flex bg-accent/50 rounded-lg p-0.5">
                  <button
                    className={`text-[11px] font-medium px-3 py-1 rounded-md transition-all ${negTab === "quentes" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setNegTab("quentes")}>
                    🔥 Próximos de Fechamento
                  </button>
                  <button
                    className={`text-[11px] font-medium px-3 py-1 rounded-md transition-all ${negTab === "acao" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                    onClick={() => setNegTab("acao")}>
                    ⚠️ Pedem Ação
                  </button>
                </div>
              </div>
              <button className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-negocios")}>
                Ver pipeline <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {negTab === "quentes" ? (
              negociosQuentes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum negócio próximo de fechamento</p>
              ) : (
                <div className="space-y-2">
                  {negociosQuentes.map(n => (
                    <NegocioRow key={n.id} nome={n.nome_cliente} empreendimento={n.empreendimento} vgv={n.vgv}
                      fase={n.fase} corretor={n.corretor_nome} faseLabels={faseLabels} faseColors={faseColors}
                      rightLabel={n.horas_desde_update < 1 ? "agora" : n.horas_desde_update < 24 ? `${n.horas_desde_update}h atrás` : `${Math.floor(n.horas_desde_update / 24)}d atrás`}
                      unidade={n.unidade} proposta={n.proposta_valor}
                      onClick={() => navigate("/pipeline-negocios")} />
                  ))}
                </div>
              )
            ) : (
              negociosAcao.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">Nenhum negócio precisa de ação agora 🎯</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {negociosAcao.map(n => (
                    <NegocioRow key={n.id} nome={n.nome_cliente} empreendimento={n.empreendimento} vgv={n.vgv}
                      fase={n.fase} corretor={n.corretor_nome} faseLabels={faseLabels} faseColors={faseColors}
                      rightLabel={n.dias_parado >= 2 ? `${n.dias_parado}d parado` : "atualizado hoje"}
                      rightDanger={n.dias_parado >= 2} unidade={n.unidade} proposta={n.proposta_valor}
                      onClick={() => navigate("/pipeline-negocios")} />
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 6. RANKING DO TIME ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground">🏆 Ranking — {periodLabels[period]}</h2>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Auto-refresh 60s</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 px-2 text-[10px] text-muted-foreground font-medium w-8">#</th>
                    <th className="text-left py-2 px-2 text-[10px] text-muted-foreground font-medium">Corretor</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Lig</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Aprov</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Taxa</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Vis</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Neg</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Pts</th>
                    <th className="text-center py-2 px-2 text-[10px] text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const aStatus = activityStatusConfig[r.activityStatus];
                    return (
                      <motion.tr key={r.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 * i }}
                        className="border-b border-border/20 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setDrawerCorretor({ user_id: r.user_id, nome: r.nome, avatar_url: r.avatar_url })}>
                        <td className="py-2 px-2 font-bold text-xs">
                          {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {(r.avatar_gamificado_url || r.avatar_url) ? (
                              <img src={r.avatar_gamificado_url || r.avatar_url!} alt={r.nome} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full text-white font-bold text-[10px]" style={{ background: hashColor(r.nome) }}>
                                {getInitials(r.nome)}
                              </div>
                            )}
                            <span className="font-medium text-foreground truncate max-w-[100px] text-xs">{r.nome.split(" ")[0]}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-xs" style={{ color: "hsl(var(--primary))" }}>{r.ligacoes}</td>
                        <td className="py-2 px-2 text-center font-bold text-xs text-emerald-600">{r.aproveitados}</td>
                        <td className="py-2 px-2 text-center font-semibold text-xs text-purple-600">{r.taxa}%</td>
                        <td className="py-2 px-2 text-center font-semibold text-xs text-amber-600">{r.visitas}</td>
                        <td className="py-2 px-2 text-center font-semibold text-xs text-purple-600">{r.negocios}</td>
                        <td className="py-2 px-2 text-center font-black text-xs" style={{ color: "hsl(var(--primary))" }}>{r.pontos}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${aStatus.bg} ${aStatus.text}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${aStatus.dot}`} />
                            {aStatus.label}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {ranking.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">Nenhum corretor ativo no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 7. ATALHOS ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { emoji: "📋", label: "Central", desc: "Presença e produtividade", to: "/central-do-gerente" },
            { emoji: "👥", label: "Meu Time", desc: "Gestão dos corretores", to: "/meu-time" },
            { emoji: "📊", label: "Relatórios 1:1", desc: "Reuniões individuais", to: "/relatorios" },
            { emoji: "🤖", label: "HOMI Gerente", desc: "IA para gestão", to: "/homi-gerente" },
          ].map(item => (
            <motion.button key={item.label} whileHover={{ y: -2 }}
              className="rounded-xl p-3.5 text-left transition-all hover:bg-accent/50 cursor-pointer border border-border/60"
              onClick={() => navigate(item.to)}>
              <p className="text-sm font-semibold text-foreground">{item.emoji} {item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ═══ DRAWER CORRETOR ═══ */}
      <Sheet open={!!drawerCorretor} onOpenChange={() => setDrawerCorretor(null)}>
        <SheetContent className="w-[400px] sm:w-[440px]">
          {drawerCorretor && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {drawerCorretor.avatar_url && <AvatarImage src={drawerCorretor.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(drawerCorretor.nome)}</AvatarFallback>
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

// ── Reusable Negocio Row ──
function NegocioRow({ nome, empreendimento, vgv, fase, corretor, rightLabel, rightDanger, unidade, proposta, faseLabels, faseColors, onClick }: {
  nome: string; empreendimento: string; vgv: number; fase: string; corretor: string;
  rightLabel: string; rightDanger?: boolean; unidade: string; proposta: number;
  faseLabels: Record<string, string>; faseColors: Record<string, string>;
  onClick: () => void;
}) {
  return (
    <motion.div whileHover={{ scale: 1.003 }} onClick={onClick}
      className="p-3 rounded-xl border border-border/40 hover:bg-accent/40 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-foreground truncate">{nome}</p>
            <Badge variant="outline" className={`text-[9px] shrink-0 ${faseColors[fase] || "text-muted-foreground"}`}>
              {faseLabels[fase] || fase}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{empreendimento}</span>
            {unidade && <><span className="text-border">·</span><span>Un. {unidade}</span></>}
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{formatCurrency(vgv)}</span>
            {proposta > 0 && <><span className="text-border">·</span><span>Proposta: {formatCurrency(proposta)}</span></>}
          </div>
          <span className="text-[9px] text-muted-foreground mt-0.5 inline-block">👤 {corretor}</span>
        </div>
        <div className="shrink-0">
          {rightDanger ? (
            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{rightLabel}</span>
          ) : (
            <span className="text-[9px] text-muted-foreground">{rightLabel}</span>
          )}
        </div>
      </div>
    </motion.div>
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
      return { ligacoes: lig, aproveitados: apr, pontos: pts, taxa: lig > 0 ? Math.round((apr / lig) * 100) : 0 };
    },
  });
  const d = data || { ligacoes: 0, aproveitados: 0, pontos: 0, taxa: 0 };
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Ligações", value: d.ligacoes, icon: "📞" },
        { label: "Aproveitados", value: d.aproveitados, icon: "✅" },
        { label: "Taxa", value: `${d.taxa}%`, icon: "📊" },
        { label: "Pontos", value: d.pontos, icon: "⭐" },
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
