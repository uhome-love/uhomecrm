import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGerenteDashboard, Period, periodLabels, formatCurrency, getInitials, hashColor } from "@/hooks/useGerenteDashboard";
import type { CorretorRow } from "@/hooks/useGerenteDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayBRT } from "@/lib/utils";
import {
  Phone, CheckCircle, CalendarDays, Building2, Flame,
  Trophy, ArrowRight, Clock, Loader2, Send, RefreshCw,
  AlertTriangle, Zap, Target, Eye, MessageCircle, ChevronDown,
  TrendingUp,
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
  const [drawerCorretor, setDrawerCorretor] = useState<CorretorDrawerData | null>(null);
  const [lastUpdate] = useState(() => format(new Date(), "HH:mm"));

  const {
    user, profile, teamUserIds, kpis: k, kpisLoading, ranking,
    radarAlerts, funnel, negociosAcao, negociosQuentes, agendaHoje, oaResumo, alertasOp,
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

  const FRASES = [
    "O gerente que acompanha, o time que entrega.",
    "Gestão é arte. Execução é disciplina.",
    "Quem desenvolve pessoas, multiplica resultados.",
    "Liderar é servir com propósito.",
    "Seu time é reflexo da sua liderança.",
  ];
  const fraseIdx = Math.floor(Date.now() / 86_400_000) % FRASES.length;

  const statusIcons: Record<string, string> = { marcada: "🟡", confirmada: "🟢", realizada: "✅", no_show: "🔴", reagendada: "🔄", cancelada: "⬛" };
  const faseLabels: Record<string, string> = { visita: "Visita", gerado: "Gerado", proposta: "Proposta", negociacao: "Negociação", documentacao: "Documentação", assinado: "Assinado" };
  const faseColors: Record<string, string> = { visita: "text-blue-600", gerado: "text-indigo-600", proposta: "text-amber-600", negociacao: "text-orange-600", documentacao: "text-purple-600", assinado: "text-emerald-600" };

  const activityStatusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    produzindo: { label: "Produzindo", dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
    baixa: { label: "Baixa atividade", dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-600" },
    sem_atividade: { label: "Sem atividade", dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-600" },
    offline: { label: "Offline", dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-500" },
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ═══ 1. HEADER HERO ═══ */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 md:p-6" style={{ background: "#0f172a" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img src={avatarSrc} alt={nome} className="h-14 w-14 rounded-full object-cover border-2 border-white shrink-0" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shrink-0 font-black text-xl text-white" style={{ background: "hsl(var(--primary-500))" }}>
                {getInitials(profile?.nome || "G")}
              </div>
            )}
            <div>
              <h1 className="text-[22px] font-bold text-white">{greeting}, {nome}! 👋</h1>
              <p className="text-xs italic text-slate-400 mt-0.5">{FRASES[fraseIdx]}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · Semana {weekNum} do mês
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0 mt-1">
            <RefreshCw className="h-3 w-3" /> Atualizado {lastUpdate}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {(["dia", "semana", "mes"] as Period[]).map(p => (
            <button key={p} className="text-sm px-4 py-1.5 rounded-full font-medium transition-all duration-200"
              style={{ background: period === p ? "#1e293b" : "transparent", color: period === p ? "#FFFFFF" : "#94A3B8", border: period === p ? "1px solid hsl(var(--primary-500))" : "1px solid transparent" }}
              onClick={() => setPeriod(p)}>{periodLabels[p]}</button>
          ))}
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

      {/* ═══ 2. KPI CARDS ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px -5px hsl(var(--primary-500) / 0.15)" }} className="rounded-2xl p-4 bg-card border border-border/60 transition-all">
            <div className="flex items-center gap-1.5 mb-2">
              <Phone className="h-4 w-4" style={{ color: "hsl(var(--primary-500))" }} />
              <span className="text-xs font-medium text-muted-foreground">Ligações</span>
            </div>
            <p className="text-3xl font-black" style={{ color: "hsl(var(--primary-500))" }}><AnimatedNumber value={k.ligacoes} /></p>
            <p className="text-xs text-muted-foreground mt-0.5">Meta: {k.metaTime} · {ligPct}%</p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ transformOrigin: "left" }}>
              <Progress value={ligPct} className="h-1.5 mt-2" />
            </motion.div>
          </motion.div>

          <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px -5px hsl(var(--success-500) / 0.15)" }} className="rounded-2xl p-4 bg-card border border-border/60 transition-all">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="h-4 w-4" style={{ color: "hsl(var(--success-500))" }} />
              <span className="text-xs font-medium text-muted-foreground">Aproveitados</span>
            </div>
            <p className="text-3xl font-black" style={{ color: "hsl(var(--success-500))" }}><AnimatedNumber value={k.aproveitados} /></p>
            <p className="text-xs text-muted-foreground">{k.taxa}% conversão</p>
          </motion.div>

          <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px -5px hsl(var(--warning-500) / 0.15)" }} className="rounded-2xl p-4 bg-card border border-border/60 transition-all">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-4 w-4" style={{ color: "hsl(var(--warning-500))" }} />
              <span className="text-xs font-medium text-muted-foreground">Visitas</span>
            </div>
            <p className="text-3xl font-black" style={{ color: "hsl(var(--warning-500))" }}><AnimatedNumber value={k.visitasHoje} /></p>
            <p className="text-xs text-muted-foreground">Hoje: {k.visitasHoje} · Semana: {k.visitasSemana}</p>
          </motion.div>

          <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px -5px hsl(var(--purple-500) / 0.15)" }} className="rounded-2xl p-4 bg-card border border-border/60 transition-all">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="h-4 w-4" style={{ color: "hsl(var(--purple-500))" }} />
              <span className="text-xs font-medium text-muted-foreground">Negócios</span>
            </div>
            <p className="text-3xl font-black" style={{ color: "hsl(var(--purple-500))" }}><AnimatedNumber value={k.negociosAtivos} /></p>
            <p className="text-xs text-muted-foreground">Pipeline: {formatCurrency(k.vgvTotal)}</p>
          </motion.div>

          <motion.div whileHover={{ y: -2, boxShadow: "0 8px 25px -5px rgba(249,115,22,0.15)" }} className="rounded-2xl p-4 bg-card border border-border/60 transition-all">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Melhor Streak</span>
            </div>
            {k.melhorStreak.count > 0 ? (
              <>
                <p className="text-3xl font-black text-orange-500"><AnimatedNumber value={k.melhorStreak.count} />🔥</p>
                <p className="text-xs text-muted-foreground truncate">{k.melhorStreak.nome}</p>
              </>
            ) : (
              <p className="text-3xl font-black text-orange-500">🏆</p>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ═══ 3. RADAR DO GERENTE ═══ */}
      {radarAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="border-border/60 overflow-hidden" style={{ borderLeft: "4px solid hsl(var(--danger-500))" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4.5 w-4.5" style={{ color: "hsl(var(--danger-500))" }} />
                <h2 className="text-sm font-bold text-foreground">🚨 Radar do Gerente</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {radarAlerts.map(alert => (
                  <motion.button key={alert.id} whileHover={{ scale: 1.02 }} onClick={() => navigate(alert.route)}
                    className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all hover:bg-accent/60 border border-border/40 hover:border-border">
                    <span className="text-lg">{alert.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{alert.count}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{alert.label}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ 4. FUNIL COMERCIAL HORIZONTAL ═══ */}
      {funnel.length > 0 && (() => {
        const maxCount = Math.max(...funnel.map(s => s.count), 1);
        const funnelColors = [
          { bg: "from-violet-500 to-violet-600", light: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/20", ring: "ring-violet-400/30" },
          { bg: "from-slate-400 to-slate-500", light: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/20", ring: "ring-slate-400/30" },
          { bg: "from-blue-500 to-blue-600", light: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20", ring: "ring-blue-400/30" },
          { bg: "from-amber-400 to-amber-500", light: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20", ring: "ring-amber-400/30" },
          { bg: "from-orange-400 to-orange-500", light: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20", ring: "ring-orange-400/30" },
          { bg: "from-cyan-500 to-cyan-600", light: "bg-cyan-500/10", text: "text-cyan-600", border: "border-cyan-500/20", ring: "ring-cyan-400/30" },
          { bg: "from-teal-500 to-teal-600", light: "bg-teal-500/10", text: "text-teal-600", border: "border-teal-500/20", ring: "ring-teal-400/30" },
          { bg: "from-indigo-500 to-indigo-600", light: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/20", ring: "ring-indigo-400/30" },
          { bg: "from-yellow-500 to-amber-600", light: "bg-yellow-500/10", text: "text-yellow-700", border: "border-yellow-500/20", ring: "ring-yellow-400/30" },
          { bg: "from-emerald-500 to-emerald-600", light: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20", ring: "ring-emerald-400/30" },
        ];
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-foreground">📊 Funil Comercial da Equipe</h2>
                  <p className="text-[10px] text-muted-foreground">{funnel[0]?.count || 0} leads totais → {funnel[funnel.length - 1]?.count || 0} assinados</p>
                </div>

                {/* Horizontal funnel */}
                <div className="overflow-x-auto -mx-1 px-1 pb-2">
                  <div className="flex items-stretch gap-0 min-w-max">
                    {funnel.map((stage, i) => {
                      const colors = funnelColors[i % funnelColors.length];
                      const heightPct = Math.max(30, (stage.count / maxCount) * 100);
                      const convColor = stage.pct >= 50 ? "text-emerald-600 bg-emerald-500/10" : stage.pct >= 20 ? "text-amber-600 bg-amber-500/10" : "text-red-500 bg-red-500/10";

                      return (
                        <div key={stage.key} className="flex items-stretch">
                          {/* Stage card */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.08 + i * 0.04, duration: 0.35, ease: "easeOut" }}
                            className="flex flex-col items-center w-[90px]"
                          >
                            {/* Visual bar (inverted: tallest = most leads) */}
                            <div className="relative flex flex-col items-center justify-end h-[110px] w-full mb-2">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${heightPct}%` }}
                                transition={{ delay: 0.15 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                                className={`w-12 rounded-t-xl bg-gradient-to-t ${colors.bg} shadow-sm relative group cursor-default`}
                              >
                                {/* Count bubble on top */}
                                <div className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${colors.light} ${colors.text} text-xs font-bold whitespace-nowrap ring-1 ${colors.ring}`}>
                                  <AnimatedNumber value={stage.count} />
                                </div>
                              </motion.div>
                            </div>

                            {/* Label */}
                            <p className="text-[10px] font-medium text-muted-foreground text-center leading-tight h-7 flex items-center">
                              {stage.label}
                            </p>
                          </motion.div>

                          {/* Conversion arrow between stages */}
                          {i < funnel.length - 1 && (
                            <div className="flex flex-col items-center justify-center w-[38px] -mt-4">
                              <ArrowRight className="h-3 w-3 text-muted-foreground/40 mb-0.5" />
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${convColor}`}>
                                {funnel[i + 1]?.pct ?? 0}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {/* ═══ 4.5 NEGÓCIOS QUENTES ═══ */}
      {negociosQuentes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <Card className="border-border/60" style={{ borderLeft: "4px solid hsl(var(--warning-500))" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground">🔥 Negócios Próximos de Fechamento</h2>
                <button className="text-xs text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-negocios")}>
                  Ver pipeline <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {negociosQuentes.map(n => (
                  <motion.div key={n.id} whileHover={{ scale: 1.005 }}
                    className="p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => navigate("/pipeline-negocios")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{n.nome_cliente}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${faseColors[n.fase] || "text-muted-foreground"}`}>
                            {faseLabels[n.fase] || n.fase}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{n.empreendimento}</span>
                          {n.unidade && <><span className="text-border">·</span><span>Un. {n.unidade}</span></>}
                          <span className="text-border">·</span>
                          <span className="font-semibold text-foreground">{formatCurrency(n.vgv)}</span>
                          {n.proposta_valor > 0 && <><span className="text-border">·</span><span>Proposta: {formatCurrency(n.proposta_valor)}</span></>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-accent/60 font-medium">👤 {n.corretor_nome}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {n.horas_desde_update < 1 ? "agora" : n.horas_desde_update < 24 ? `${n.horas_desde_update}h atrás` : `${Math.floor(n.horas_desde_update / 24)}d atrás`}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ 5. NEGÓCIOS QUE PEDEM AÇÃO ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">⚠️ Negócios que Pedem Ação</h2>
              <button className="text-xs text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/pipeline-negocios")}>
                Ver pipeline <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {negociosAcao.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">Nenhum negócio ativo ainda. As visitas de hoje vão mudar isso! 🎯</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/agenda-visitas")}>Ver agenda</Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {negociosAcao.map(n => (
                  <motion.div key={n.id} whileHover={{ scale: 1.005 }}
                    className="p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => navigate("/pipeline-negocios")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{n.nome_cliente}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${faseColors[n.fase] || "text-muted-foreground"}`}>
                            {faseLabels[n.fase] || n.fase}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{n.empreendimento}</span>
                          {n.unidade && <><span className="text-border">·</span><span>Un. {n.unidade}</span></>}
                          <span className="text-border">·</span>
                          <span className="font-semibold text-foreground">{formatCurrency(n.vgv)}</span>
                          {n.proposta_valor > 0 && <><span className="text-border">·</span><span>Proposta: {formatCurrency(n.proposta_valor)}</span></>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-accent/60 font-medium">👤 {n.corretor_nome}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {n.dias_parado >= 2 ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--danger-50))", color: "hsl(var(--danger-500))" }}>
                            {n.dias_parado}d parado
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">atualizado hoje</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 6. AGENDA DE HOJE ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">📅 Agenda de Hoje</h2>
              <button className="text-xs text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/agenda-visitas")}>
                Ver completa <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {agendaHoje.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-lg">😴</p>
                <p className="text-sm text-muted-foreground">Nenhuma visita hoje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agendaHoje.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/30 border border-border/30">
                    <span className="text-sm font-mono font-semibold text-foreground w-12">{v.hora_visita?.slice(0, 5) || "--:--"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{v.nome_cliente}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}{v.corretor_nome ? ` · ${v.corretor_nome}` : ""}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${v.status === "realizada" ? "border-emerald-300 text-emerald-600" : v.status === "confirmada" ? "border-green-300 text-green-600" : "border-amber-300 text-amber-600"}`}>
                      {statusIcons[v.status] || "⚪"} {v.status}
                    </Badge>
                  </div>
                ))}
                {agendaHoje.length > 5 && (
                  <button className="text-xs text-primary hover:underline font-medium w-full text-center" onClick={() => navigate("/agenda-visitas")}>
                    Ver mais {agendaHoje.length - 5} visitas →
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 7. RANKING DO TIME ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: "hsl(var(--warning-500))" }} />
                <h2 className="text-sm font-bold text-foreground">🏆 Ranking do Time — {periodLabels[period]}</h2>
              </div>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Atualiza a cada 60s</span>
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
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Negócios</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Pts</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const aStatus = activityStatusConfig[r.activityStatus];
                    return (
                      <motion.tr key={r.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 * i }}
                        className="border-b border-border/20 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setDrawerCorretor({ user_id: r.user_id, nome: r.nome, avatar_url: r.avatar_url })}>
                        <td className="py-2.5 px-2 font-bold">
                          {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            {(r.avatar_gamificado_url || r.avatar_url) ? (
                              <img src={r.avatar_gamificado_url || r.avatar_url!} alt={r.nome} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold text-xs" style={{ background: hashColor(r.nome) }}>
                                {getInitials(r.nome)}
                              </div>
                            )}
                            <span className="font-medium text-foreground truncate max-w-[110px]">{r.nome.split(" ")[0]}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold" style={{ color: "hsl(var(--primary-500))" }}>{r.ligacoes}</td>
                        <td className="py-2.5 px-2 text-center font-bold" style={{ color: "hsl(var(--success-500))" }}>{r.aproveitados}</td>
                        <td className="py-2.5 px-2 text-center font-semibold" style={{ color: "hsl(var(--purple-500))" }}>{r.taxa}%</td>
                        <td className="py-2.5 px-2 text-center font-semibold" style={{ color: "hsl(var(--warning-500))" }}>{r.visitas}</td>
                        <td className="py-2.5 px-2 text-center font-semibold" style={{ color: "hsl(var(--purple-500))" }}>{r.negocios}</td>
                        <td className="py-2.5 px-2 text-center font-black" style={{ color: "hsl(var(--primary-600))" }}>{r.pontos}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${aStatus.bg} ${aStatus.text}`}>
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

      {/* ═══ 8. RESUMO OFERTA ATIVA ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">📞 Resumo da Oferta Ativa</h2>
              <button className="text-xs text-primary hover:underline font-medium flex items-center gap-1" onClick={() => navigate("/oferta-ativa")}>
                Abrir OA <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Leads disponíveis", value: oaResumo.leadsDisponiveis, color: "hsl(var(--primary-500))" },
                { label: "Tentativas hoje", value: oaResumo.tentativasHoje, color: "hsl(var(--primary-500))" },
                { label: "Aproveitados", value: oaResumo.aproveitados, color: "hsl(var(--success-500))" },
                { label: "Conversão", value: `${oaResumo.taxa}%`, color: "hsl(var(--success-500))" },
                { label: "Corretores ativos", value: oaResumo.corretoresAtivos, color: "hsl(var(--primary-500))" },
                { label: "Parados >20min", value: oaResumo.corretoresParados, color: oaResumo.corretoresParados > 0 ? "hsl(var(--danger-500))" : "hsl(var(--success-500))" },
                { label: "Tempo médio", value: `${oaResumo.tempoMedioMinutos}min`, color: "hsl(var(--warning-500))" },
                { label: "Top conversão", value: oaResumo.taxaPorCorretor[0] ? `${oaResumo.taxaPorCorretor[0].nome} ${oaResumo.taxaPorCorretor[0].taxa}%` : "—", color: "hsl(var(--success-500))" },
              ].map(item => (
                <motion.div key={item.label} whileHover={{ scale: 1.03 }} className="rounded-xl p-3 bg-accent/30 border border-border/30 text-center">
                  <p className="text-lg font-black truncate" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ 9. ALERTAS OPERACIONAIS ═══ */}
      {alertasOp.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <h2 className="text-sm font-bold text-foreground mb-3">⚡ Alertas Operacionais</h2>
              <div className="space-y-1.5">
                {alertasOp.map((a, i) => (
                  <motion.button key={i} whileHover={{ x: 4 }} onClick={() => navigate(a.route)}
                    className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 px-2 rounded-lg hover:bg-accent/40 w-full text-left transition-colors">
                    <span>{a.icon}</span>
                    <span className="text-foreground font-medium flex-1">{a.msg}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ 10. PULSE / FEED ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <PulseFeed />
      </motion.div>

      {/* ═══ ATALHOS ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { emoji: "📋", label: "Checkpoint", desc: "Presença e produtividade", to: "/checkpoint" },
            { emoji: "👥", label: "Meu Time", desc: "Gestão dos corretores", to: "/meu-time" },
            { emoji: "📊", label: "Relatórios 1:1", desc: "Reuniões individuais", to: "/relatorios" },
            { emoji: "🤖", label: "HOMI Gerente", desc: "IA para gestão", to: "/homi-gerente" },
          ].map(item => (
            <motion.button key={item.label} whileHover={{ y: -2 }}
              className="rounded-xl p-4 text-left transition-all duration-200 hover:bg-accent/50 cursor-pointer border border-border/60"
              onClick={() => navigate(item.to)}>
              <p className="text-sm font-semibold text-foreground">{item.emoji} {item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
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
