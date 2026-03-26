import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGerenteDashboard, Period, formatCurrency } from "@/hooks/useGerenteDashboard";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayBRT, formatBRLCompact } from "@/lib/utils";
import {
  Phone, Users, Send, CalendarDays, MapPin, Briefcase,
  Loader2, Bot, Clock, ChevronRight, X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: "bg-emerald-500" },
  disponivel: { label: "Disponível", color: "bg-emerald-500" },
  na_empresa: { label: "Na empresa", color: "bg-emerald-500" },
  em_visita: { label: "Em visita", color: "bg-blue-500" },
  em_pausa: { label: "Em pausa", color: "bg-amber-500" },
  pausa: { label: "Em pausa", color: "bg-amber-500" },
  offline: { label: "Offline", color: "bg-muted-foreground" },
};

type SheetType = "presenca" | "ligacoes" | "distribuidos" | "visitas" | "vgv" | null;

export default function GerenteDashboard() {
  const { isGestor, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { period: globalPeriod } = useDateFilter();
  const period: Period = globalPeriod === "semana" ? "semana" : globalPeriod === "mes" || globalPeriod === "ultimos_30d" ? "mes" : "dia";
  const [lastUpdate] = useState(() => format(new Date(), "HH:mm"));
  const [activeTab, setActiveTab] = useState("agora");
  const [openSheet, setOpenSheet] = useState<SheetType>(null);

  const {
    user, profile, teamUserIds, teamNameMap, kpis: k, kpisLoading,
    funnel, negociosPorFase, agendaHoje, startTs, endTs,
  } = useGerenteDashboard(period);

  const today = todayBRT();

  // Presence KPI
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

  // === SHEET DATA QUERIES ===

  // Sheet: Presença detail
  const { data: presencaDetail } = useQuery({
    queryKey: ["sheet-presenca", teamUserIds.join(",")],
    queryFn: async () => {
      const [{ data: disps }, { data: profs }] = await Promise.all([
        supabase.from("corretor_disponibilidade").select("user_id, status, updated_at").in("user_id", teamUserIds),
        supabase.from("profiles").select("user_id, nome, avatar_url").in("user_id", teamUserIds),
      ]);
      const dispMap: Record<string, any> = {};
      (disps || []).forEach(d => { dispMap[d.user_id] = d; });
      return (profs || []).map(p => {
        const d = dispMap[p.user_id];
        return { user_id: p.user_id, nome: p.nome, avatar_url: p.avatar_url, status: d?.status || "offline", updated_at: d?.updated_at || null };
      }).sort((a, b) => {
        const aOn = ["online", "disponivel", "na_empresa", "em_visita"].includes(a.status) ? 1 : 0;
        const bOn = ["online", "disponivel", "na_empresa", "em_visita"].includes(b.status) ? 1 : 0;
        return bOn - aOn;
      });
    },
    enabled: openSheet === "presenca" && teamUserIds.length > 0,
  });

  // Sheet: Ligações detail
  const { data: ligacoesDetail } = useQuery({
    queryKey: ["sheet-ligacoes", teamUserIds.join(","), today],
    queryFn: async () => {
      const [{ data: tent }, { data: profs }] = await Promise.all([
        supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado").in("corretor_id", teamUserIds).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
        supabase.from("profiles").select("user_id, nome, avatar_url").in("user_id", teamUserIds),
      ]);
      const stats: Record<string, { lig: number; apr: number }> = {};
      teamUserIds.forEach(id => { stats[id] = { lig: 0, apr: 0 }; });
      (tent || []).forEach(t => { if (stats[t.corretor_id]) { stats[t.corretor_id].lig++; if (t.resultado === "com_interesse") stats[t.corretor_id].apr++; } });
      const profMap = Object.fromEntries((profs || []).map(p => [p.user_id, p]));
      return teamUserIds.map(uid => ({
        user_id: uid,
        nome: profMap[uid]?.nome || teamNameMap[uid] || "Corretor",
        avatar_url: profMap[uid]?.avatar_url || null,
        ligacoes: stats[uid].lig,
        aproveitados: stats[uid].apr,
        taxa: stats[uid].lig > 0 ? Math.round((stats[uid].apr / stats[uid].lig) * 100) : 0,
      })).sort((a, b) => b.ligacoes - a.ligacoes);
    },
    enabled: openSheet === "ligacoes" && teamUserIds.length > 0,
  });

  // Sheet: Visitas detail
  const { data: visitasDetail } = useQuery({
    queryKey: ["sheet-visitas", user?.id, today],
    queryFn: async () => {
      const { data } = await supabase.from("visitas").select("id, nome_cliente, empreendimento, hora_visita, status, corretor_id").eq("gerente_id", user!.id).eq("data_visita", today).order("hora_visita");
      return (data || []).map(v => ({ ...v, corretor_nome: teamNameMap[v.corretor_id || ""] || "Corretor" }));
    },
    enabled: openSheet === "visitas" && !!user,
  });

  // Sheet: VGV detail
  const profileId = useMemo(() => {
    // We get profileId from the hook indirectly; fetch it here for sheet queries
    return null as string | null;
  }, []);
  const [sheetProfileId, setSheetProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setSheetProfileId(data.id);
    });
  }, [user]);

  const { data: vgvDetail } = useQuery({
    queryKey: ["sheet-vgv", sheetProfileId],
    queryFn: async () => {
      const { data } = await supabase.from("negocios").select("id, nome_cliente, empreendimento, vgv_estimado, fase, corretor_id, unidade").eq("gerente_id", sheetProfileId!).not("fase", "in", '("perdido","cancelado","distrato")').order("vgv_estimado", { ascending: false });
      if (!data) return [];
      const corrIds = [...new Set(data.map(n => n.corretor_id).filter(Boolean))];
      const { data: profs } = corrIds.length > 0 ? await supabase.from("profiles").select("user_id, nome").in("user_id", corrIds as string[]) : { data: [] };
      const nameMap = Object.fromEntries((profs || []).map(p => [p.user_id, p.nome]));
      return data.map(n => ({ ...n, vgv: Number(n.vgv_estimado || 0), corretor_nome: n.corretor_id ? (nameMap[n.corretor_id] || "Corretor") : "—" }));
    },
    enabled: openSheet === "vgv" && !!sheetProfileId,
  });

  // Sheet: Distribuídos detail  
  const { data: distribuidosDetail } = useQuery({
    queryKey: ["sheet-distribuidos", teamUserIds.join(","), today],
    queryFn: async () => {
      const [{ data: hist }, { data: profs }] = await Promise.all([
        supabase.from("distribuicao_historico").select("corretor_id, acao, tempo_resposta_seg, created_at").in("corretor_id", teamUserIds).gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`),
        supabase.from("profiles").select("user_id, nome, avatar_url").in("user_id", teamUserIds),
      ]);
      const stats: Record<string, { dist: number; aceitos: number; rejeitados: number; tempos: number[] }> = {};
      teamUserIds.forEach(id => { stats[id] = { dist: 0, aceitos: 0, rejeitados: 0, tempos: [] }; });
      (hist || []).forEach(h => {
        if (!stats[h.corretor_id]) return;
        stats[h.corretor_id].dist++;
        if (h.acao === "aceito") { stats[h.corretor_id].aceitos++; if (h.tempo_resposta_seg) stats[h.corretor_id].tempos.push(h.tempo_resposta_seg); }
        if (h.acao === "rejeitado" || h.acao === "timeout") stats[h.corretor_id].rejeitados++;
      });
      const profMap = Object.fromEntries((profs || []).map(p => [p.user_id, p]));
      return teamUserIds.map(uid => {
        const s = stats[uid];
        const avgTempo = s.tempos.length > 0 ? Math.round(s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length) : 0;
        return { user_id: uid, nome: profMap[uid]?.nome || teamNameMap[uid] || "Corretor", avatar_url: profMap[uid]?.avatar_url || null, distribuidos: s.dist, aceitos: s.aceitos, rejeitados: s.rejeitados, tempo_medio_seg: avgTempo };
      }).sort((a, b) => b.distribuidos - a.distribuidos);
    },
    enabled: openSheet === "distribuidos" && teamUserIds.length > 0,
  });

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

  const VISIT_STATUS: Record<string, { label: string; color: string }> = {
    marcada: { label: "Marcada", color: "bg-blue-500" },
    realizada: { label: "Realizada", color: "bg-emerald-500" },
    cancelada: { label: "Cancelada", color: "bg-destructive" },
  };

  const FASE_LABELS: Record<string, string> = {
    proposta: "Proposta", negociacao: "Negociação", documentacao: "Documentação",
    gerado: "Gerado", visita: "Visita", assinado: "Assinado", vendido: "Vendido",
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
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

      {/* 5 KPI Cards — clickable */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Presença */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            onClick={() => setOpenSheet("presenca")}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">Presença</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-3xl font-black leading-none text-primary">
              <AnimatedNumber value={presenca.online} /><span className="text-lg text-muted-foreground font-normal"> / {presenca.total}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">corretores online</p>
          </motion.div>

          {/* Ligações */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            onClick={() => setOpenSheet("ligacoes")}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">Ligações hoje</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-3xl font-black leading-none text-primary">
              <AnimatedNumber value={k.ligacoes} />
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Meta: {k.metaTime} · {ligPct}%</p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ transformOrigin: "left" }}>
              <Progress value={ligPct} className="h-1 mt-2" />
            </motion.div>
          </motion.div>

          {/* Distribuídos */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            onClick={() => setOpenSheet("distribuidos")}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Send className="h-4 w-4" style={{ color: "hsl(25, 90%, 55%)" }} />
                <span className="text-[11px] font-medium text-muted-foreground">Distribuídos</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <LeadsDistribuidosPanel teamUserIds={teamUserIds} period="dia" compact showPeriodSelector={false} />
          </motion.div>

          {/* Visitas */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            onClick={() => setOpenSheet("visitas")}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} />
                <span className="text-[11px] font-medium text-muted-foreground">Visitas hoje</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-3xl font-black leading-none" style={{ color: "hsl(var(--warning))" }}>
              <AnimatedNumber value={k.visitasMarcadas ?? k.visitasHoje} />
              <span className="text-lg text-muted-foreground font-normal"> / <AnimatedNumber value={k.visitasRealizadas ?? 0} /></span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">marcadas / realizadas</p>
          </motion.div>

          {/* VGV */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
            onClick={() => setOpenSheet("vgv")}
            className="rounded-2xl p-4 bg-card border border-border/60 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" style={{ color: "hsl(270, 60%, 55%)" }} />
                <span className="text-[11px] font-medium text-muted-foreground">VGV em negociação</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
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
          <TabProducao teamUserIds={teamUserIds} teamNameMap={teamNameMap} profileId={sheetProfileId} />
        </TabsContent>
        <TabsContent value="pipeline">
          <TabPipeline funnel={funnel} negociosPorFase={negociosPorFase} agendaHoje={agendaHoje} />
        </TabsContent>
        <TabsContent value="metas">
          <TabMetas teamUserIds={teamUserIds} teamNameMap={teamNameMap} />
        </TabsContent>
      </Tabs>

      {/* ═══ SHEETS ═══ */}

      {/* Presença Sheet */}
      <Sheet open={openSheet === "presenca"} onOpenChange={open => !open && setOpenSheet(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Presença do Time</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <div className="space-y-2">
              {(presencaDetail || []).map(p => {
                const st = STATUS_LABELS[p.status] || STATUS_LABELS.offline;
                const isOnline = ["online", "disponivel", "na_empresa", "em_visita"].includes(p.status);
                return (
                  <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback style={{ background: hashColor(p.nome) }} className="text-white text-xs font-bold">{getInitials(p.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium`}>
                          <span className={`h-2 w-2 rounded-full ${st.color}`} />
                          {st.label}
                        </span>
                        {p.updated_at && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(p.updated_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Ligações Sheet */}
      <Sheet open={openSheet === "ligacoes"} onOpenChange={open => !open && setOpenSheet(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Ligações Hoje</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <div className="space-y-2">
              {(ligacoesDetail || []).map(c => (
                <div key={c.user_id} className={`flex items-center gap-3 p-3 rounded-xl border bg-card ${c.ligacoes === 0 ? "border-destructive/30 bg-destructive/5" : "border-border/40"}`}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={c.avatar_url || undefined} />
                    <AvatarFallback style={{ background: hashColor(c.nome) }} className="text-white text-xs font-bold">{getInitials(c.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.aproveitados} aproveitados · {c.taxa}% taxa
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${c.ligacoes === 0 ? "text-destructive" : "text-foreground"}`}>{c.ligacoes}</p>
                    <p className="text-[10px] text-muted-foreground">ligações</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Distribuídos Sheet */}
      <Sheet open={openSheet === "distribuidos"} onOpenChange={open => !open && setOpenSheet(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Send className="h-5 w-5" style={{ color: "hsl(25, 90%, 55%)" }} /> Leads Distribuídos Hoje</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <div className="space-y-2">
              {(distribuidosDetail || []).map(c => (
                <div key={c.user_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={c.avatar_url || undefined} />
                    <AvatarFallback style={{ background: hashColor(c.nome) }} className="text-white text-xs font-bold">{getInitials(c.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="text-emerald-600 font-medium">{c.aceitos} aceitos</span>
                      <span>·</span>
                      <span className="text-destructive font-medium">{c.rejeitados} rejeitados</span>
                      {c.tempo_medio_seg > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{c.tempo_medio_seg}s</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-foreground">{c.distribuidos}</p>
                    <p className="text-[10px] text-muted-foreground">total</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Visitas Sheet */}
      <Sheet open={openSheet === "visitas"} onOpenChange={open => !open && setOpenSheet(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" style={{ color: "hsl(var(--warning))" }} /> Visitas Hoje</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <div className="space-y-2">
              {(visitasDetail || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita hoje</p>}
              {(visitasDetail || []).map((v: any) => {
                const vs = VISIT_STATUS[v.status] || { label: v.status, color: "bg-muted" };
                return (
                  <div key={v.id} className="p-3 rounded-xl border border-border/40 bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{v.hora_visita || "—"}</span>
                      <Badge className={`text-[10px] h-5 ${vs.color} text-white`}>{vs.label}</Badge>
                    </div>
                    <p className="text-xs text-foreground">{v.nome_cliente || "Cliente"}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{v.empreendimento || "—"}</span>
                      <span>{v.corretor_nome}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* VGV Sheet */}
      <Sheet open={openSheet === "vgv"} onOpenChange={open => !open && setOpenSheet(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" style={{ color: "hsl(270, 60%, 55%)" }} /> VGV em Negociação</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
            <div className="space-y-2">
              {(vgvDetail || []).map((n: any) => (
                <div key={n.id} className="p-3 rounded-xl border border-border/40 bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground truncate flex-1">{n.nome_cliente}</span>
                    <span className="text-sm font-black" style={{ color: "hsl(270, 60%, 55%)" }}>{formatBRLCompact(n.vgv)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{n.empreendimento}{n.unidade ? ` · ${n.unidade}` : ""}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{FASE_LABELS[n.fase] || n.fase}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Corretor: {n.corretor_nome}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

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
