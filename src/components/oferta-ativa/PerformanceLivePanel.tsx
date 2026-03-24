import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Activity, Users, Phone, ThumbsUp, AlertTriangle, TrendingUp, Zap, Flame, Target, Timer } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
interface CorretorLive {
  corretor_id: string;
  nome: string;
  tentativas: number;
  aproveitados: number;
  ultima_tentativa: string | null;
  status: "discando" | "ativo" | "parado";
  minutos_parado: number;
  ligacoes: number;
  whatsapps: number;
}

interface ListaProgress {
  lista_id: string;
  nome: string;
  empreendimento: string;
  campanha: string | null;
  total: number;
  na_fila: number;
  aproveitados: number;
  descartados: number;
  em_cooldown: number;
  percent_complete: number;
}

interface CampanhaProgress {
  campanha: string;
  listas: ListaProgress[];
  total: number;
  na_fila: number;
  aproveitados: number;
  descartados: number;
  em_cooldown: number;
  percent_complete: number;
}

interface Props {
  teamOnly?: boolean;
}

function getTodayStart() {
  const d = new Date();
  d.setHours(3, 0, 0, 0);
  if (d > new Date()) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export default function PerformanceLivePanel({ teamOnly = false }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const todayStartRef = useRef(getTodayStart());

  // Refresh "now" every 30s for status calculations
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to realtime changes on tentativas for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("oa-live-tentativas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "oferta_ativa_tentativas" },
        () => {
          // Invalidate live data on any new attempt
          queryClient.invalidateQueries({ queryKey: ["oa-performance-live"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Fetch team member user_ids when teamOnly
  const { data: teamMemberUserIds } = useQuery({
    queryKey: ["oa-team-members", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", user!.id)
        .eq("status", "ativo");
      return (data || []).map(t => t.user_id).filter(Boolean) as string[];
    },
    enabled: !!user && teamOnly,
    staleTime: 60000,
  });

  const teamFilter = teamOnly ? teamMemberUserIds : null;
  const ready = !teamOnly || (teamFilter && teamFilter.length > 0);

  const { data: liveData, isLoading } = useQuery({
    queryKey: ["oa-performance-live", todayStartRef.current, teamFilter?.join(",") ?? "all"],
    queryFn: async () => {
      const todayStart = todayStartRef.current;
      const currentNow = new Date();

      // Helper to fetch ALL rows with pagination (bypasses 1000-row limit)
      async function fetchAllTentativas() {
        const PAGE_SIZE = 1000;
        let allRows: Array<{ corretor_id: string; canal: string; resultado: string; created_at: string }> = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let q = supabase
            .from("oferta_ativa_tentativas")
            .select("corretor_id, canal, resultado, created_at")
            .gte("created_at", todayStart)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (teamFilter && teamFilter.length > 0) {
            q = q.in("corretor_id", teamFilter);
          }

          const { data } = await q;
          const rows = data || [];
          allRows = allRows.concat(rows);
          hasMore = rows.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }

        return allRows;
      }

      // 2. Fetch active locks
      const locksQuery = supabase
        .from("oferta_ativa_leads")
        .select("em_atendimento_por, em_atendimento_ate")
        .not("em_atendimento_por", "is", null)
        .gt("em_atendimento_ate", currentNow.toISOString());

      // 3. Fetch listas
      const listasQuery = supabase
        .from("oferta_ativa_listas")
        .select("id, nome, empreendimento, campanha, total_leads, status")
        .eq("status", "liberada");

      // Run all in parallel
      const [tentativas, locksRes, listasRes] = await Promise.all([
        fetchAllTentativas(),
        locksQuery,
        listasQuery,
      ]);

      let activeLocks = locksRes.data || [];
      const listas = listasRes.data || [];

      if (teamFilter) {
        activeLocks = activeLocks.filter(l => teamFilter.includes(l.em_atendimento_por!));
      }
      const activeCorretorIds = new Set(activeLocks.map(l => l.em_atendimento_por as string));

      // Group by corretor
      const byCorretor: Record<string, {
        corretor_id: string; tentativas: number; aproveitados: number;
        ultima_tentativa: string | null; ligacoes: number; whatsapps: number;
      }> = {};

      for (const t of tentativas) {
        if (!byCorretor[t.corretor_id]) {
          byCorretor[t.corretor_id] = {
            corretor_id: t.corretor_id, tentativas: 0, aproveitados: 0,
            ultima_tentativa: null, ligacoes: 0, whatsapps: 0,
          };
        }
        const c = byCorretor[t.corretor_id];
        c.tentativas++;
        if (t.resultado === "com_interesse") c.aproveitados++;
        if (t.canal === "ligacao") c.ligacoes++;
        if (t.canal === "whatsapp") c.whatsapps++;
        if (!c.ultima_tentativa || t.created_at > c.ultima_tentativa) {
          c.ultima_tentativa = t.created_at;
        }
      }

      // Fetch profiles for all relevant IDs
      const allIds = new Set([...Object.keys(byCorretor), ...activeCorretorIds].filter(Boolean) as string[]);
      const profileMap: Record<string, string> = {};
      if (allIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", [...allIds]);
        for (const p of (profiles as any[] || [])) profileMap[(p as any).user_id] = (p as any).nome;
      }

      // Add locked corretors without attempts
      for (const cid of activeCorretorIds) {
        if (cid && !byCorretor[cid as string]) {
          byCorretor[cid as string] = {
            corretor_id: cid as string, tentativas: 0, aproveitados: 0,
            ultima_tentativa: null, ligacoes: 0, whatsapps: 0,
          };
        }
      }

      const corretores: CorretorLive[] = Object.values(byCorretor).map(c => {
        const minutosParado = c.ultima_tentativa
          ? differenceInMinutes(currentNow, new Date(c.ultima_tentativa))
          : 999;
        let status: CorretorLive["status"] = "parado";
        if (activeCorretorIds.has(c.corretor_id)) status = "discando";
        else if (minutosParado <= 15) status = "ativo";
        return { ...c, nome: profileMap[c.corretor_id] || "Corretor", status, minutos_parado: minutosParado };
      });

      const statusOrder = { discando: 0, ativo: 1, parado: 2 };
      corretores.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.tentativas - a.tentativas);

      // 4. Fetch ALL leads for active listas in ONE query instead of N queries
      const listaIds = listas.map(l => l.id);
      let listaProgress: ListaProgress[] = [];

      if (listaIds.length > 0) {
        const { data: allLeads } = await supabase
          .from("oferta_ativa_leads")
          .select("lista_id, status")
          .in("lista_id", listaIds);

        const leadsByLista: Record<string, Array<{ status: string }>> = {};
        for (const lead of allLeads || []) {
          if (!leadsByLista[lead.lista_id]) leadsByLista[lead.lista_id] = [];
          leadsByLista[lead.lista_id].push(lead);
        }

        listaProgress = listas.map(lista => {
          const all = leadsByLista[lista.id] || [];
          const na_fila = all.filter(l => l.status === "na_fila").length;
          const aproveitados = all.filter(l => l.status === "aproveitado" || l.status === "concluido").length;
          const descartados = all.filter(l => l.status === "descartado").length;
          const em_cooldown = all.filter(l => l.status === "em_cooldown").length;
          const total = all.length;
          const worked = aproveitados + descartados;
          return {
            lista_id: lista.id, nome: lista.nome, empreendimento: (lista as any).empreendimento,
            campanha: (lista as any).campanha || null,
            total, na_fila, aproveitados, descartados, em_cooldown,
            percent_complete: total > 0 ? Math.round((worked / total) * 100) : 0,
          };
        });
      }

      const totalTentativas = tentativas.length;
      const totalAproveitados = tentativas.filter(t => t.resultado === "com_interesse").length;
      const taxaConversao = totalTentativas > 0 ? Math.round((totalAproveitados / totalTentativas) * 100) : 0;
      const corretoresAtivos = corretores.filter(c => c.status !== "parado").length;
      const corretoresParados = corretores.filter(c => c.status === "parado" && c.minutos_parado > 20).length;

      return {
        corretores, listaProgress, totalTentativas, totalAproveitados,
        taxaConversao, corretoresAtivos, corretoresParados,
        totalCorretores: corretores.length,
      };
    },
    enabled: !!user && !!ready,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch ALL team corretores to show who hasn't started
  const { data: allTeamCorretores = [] } = useQuery({
    queryKey: ["oa-all-team-corretores", teamOnly, user?.id],
    queryFn: async () => {
      if (teamOnly) {
        const { data } = await supabase
          .from("team_members")
          .select("user_id, nome")
          .eq("gerente_id", user!.id)
          .eq("status", "ativo");
        return (data || []).map(t => ({ id: t.user_id, nome: t.nome })).filter(t => t.id);
      }
      // Admin: get all users that have role 'corretor' via user_roles
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "corretor" as any);
      const userIds = (roleRows || []).map(r => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);
      return (profiles || []).map(p => ({ id: p.user_id, nome: p.nome || "Corretor" }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const allCorretorIds = useMemo(() => allTeamCorretores.map(c => c.id).filter(Boolean), [allTeamCorretores]);

  // Fetch team names for corretores (for empty state display)
  const { data: corretorTeamMap = {} } = useQuery({
    queryKey: ["oa-live-team-map", allCorretorIds],
    queryFn: async () => {
      if (allCorretorIds.length === 0) return {};
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, gerente_id")
        .in("user_id", allCorretorIds)
        .eq("status", "ativo");
      const gerenteIds = [...new Set((members || []).map(m => m.gerente_id).filter(Boolean))];
      const gerenteNameMap: Record<string, string> = {};
      if (gerenteIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", gerenteIds);
        for (const p of profiles || []) gerenteNameMap[p.user_id] = p.nome?.split(" ")[0] || "Equipe";
      }
      const result: Record<string, string> = {};
      for (const m of members || []) {
        if (m.user_id && m.gerente_id) result[m.user_id] = `Eq. ${gerenteNameMap[m.gerente_id] || "?"}`;
      }
      return result;
    },
    enabled: allCorretorIds.length > 0 && !teamOnly,
    staleTime: 60_000,
  });

  // Elapsed timer
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (isLoading || (teamOnly && !teamMemberUserIds)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando arena...</p>
        </div>
      </div>
    );
  }

  if (teamOnly && teamMemberUserIds && teamMemberUserIds.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 p-12 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)" }}>
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
        <p className="font-bold text-foreground">Nenhum corretor vinculado</p>
        <p className="text-sm text-muted-foreground mt-1">Vincule corretores ao seu time em "Meu Time".</p>
      </div>
    );
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string; glow: string; pulse: boolean; emoji: string }> = {
    discando: { label: "Discando", color: "bg-emerald-500", glow: "shadow-emerald-500/50", pulse: true, emoji: "🔥" },
    ativo: { label: "Ativo", color: "bg-blue-500", glow: "shadow-blue-500/40", pulse: false, emoji: "⚡" },
    parado: { label: "Parado", color: "bg-red-500", glow: "shadow-red-500/30", pulse: false, emoji: "💤" },
  };

  // Use liveData or empty defaults
  const data_ = liveData || { corretores: [], listaProgress: [], totalTentativas: 0, totalAproveitados: 0, taxaConversao: 0, corretoresAtivos: 0, corretoresParados: 0, totalCorretores: 0 };
  const activeIds = new Set(data_.corretores.map(c => c.corretor_id));
  const naoIniciaram = allTeamCorretores.filter(c => !activeIds.has(c.id));

  const kpis = [
    { icon: Phone, label: "Tentativas", value: data_.totalTentativas, color: "from-violet-500/20 to-violet-600/5", iconColor: "text-violet-500 dark:text-violet-400", valueColor: "text-violet-700 dark:text-violet-300", border: "border-violet-500/20" },
    { icon: ThumbsUp, label: "Aproveitados", value: data_.totalAproveitados, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-600 dark:text-emerald-400", valueColor: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/20" },
    { icon: Target, label: "Conversão", value: `${data_.taxaConversao}%`, color: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-600 dark:text-amber-400", valueColor: "text-amber-700 dark:text-amber-300", border: "border-amber-500/20" },
    { icon: Users, label: "Corretores", value: data_.corretoresAtivos, extra: `/${data_.totalCorretores}`, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-600 dark:text-blue-400", valueColor: "text-blue-700 dark:text-blue-300", border: "border-blue-500/20" },
  ];

  return (
    <div className="space-y-5">
      {/* ═══ Arena Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-card to-muted/80 border border-border"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-primary/10"
              style={{ width: 4 + i * 3, height: 4 + i * 3, left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ y: [0, -15, 0], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-emerald-500/30 blur-sm"
              />
              <div className="relative h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                Arena Live
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AO VIVO
                </motion.span>
              </h2>
              <p className="text-xs text-muted-foreground">{teamOnly ? "Minha equipe" : "Todos os times"} · Tempo real</p>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border/50">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-lg font-bold text-foreground tracking-wider">{elapsed}</span>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div
              className={`relative overflow-hidden rounded-xl p-4 border ${kpi.border} bg-gradient-to-br ${kpi.color}`}
              style={{ backdropFilter: "blur(10px)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                <span className="text-[11px] font-medium text-muted-foreground">{kpi.label}</span>
              </div>
              <motion.p
                key={String(kpi.value)}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-3xl font-black ${kpi.valueColor}`}
              >
                {kpi.value}
                {"extra" in kpi && <span className="text-sm font-normal text-muted-foreground">{(kpi as any).extra}</span>}
              </motion.p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Parado Alert ═══ */}
      <AnimatePresence>
        {data_.corretoresParados > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}>
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              </motion.div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {data_.corretoresParados} corretor(es) parado(s) há mais de 20 minutos
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Corretores Live Grid ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Corretores na Arena</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{data_.corretores.length} ativos</span>
        </div>

        {data_.corretores.length === 0 && naoIniciaram.length === 0 ? (
          <div className="rounded-xl border border-border/50 p-10 text-center" style={{ background: "hsl(var(--card))" }}>
            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-semibold text-foreground">Sem atividade hoje</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum corretor começou a discar ainda.</p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <AnimatePresence>
              {data_.corretores.map((c, i) => {
                const cfg = STATUS_CONFIG[c.status];
                const taxa = c.tentativas > 0 ? Math.round((c.aproveitados / c.tentativas) * 100) : 0;
                const isHot = c.status === "discando";
                const isIdle = c.status === "parado" && c.minutos_parado > 20;

                return (
                  <motion.div
                    key={c.corretor_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    layout
                    className={`relative overflow-hidden rounded-xl border p-3.5 transition-all ${
                      isHot ? "border-emerald-500/30 bg-emerald-500/5" :
                      isIdle ? "border-amber-500/20 bg-amber-500/5" :
                      "border-border/50 bg-card"
                    }`}
                  >
                    {/* Glow for active */}
                    {isHot && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/5 pointer-events-none"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}

                    <div className="relative flex items-center gap-3">
                      {/* Status indicator */}
                      <div className="flex flex-col items-center gap-1 min-w-[48px]">
                        <div className="relative">
                          {cfg.pulse && (
                            <motion.span
                              className={`absolute inset-0 rounded-full ${cfg.color} blur-sm`}
                              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          )}
                          <span className={`relative flex h-3 w-3 rounded-full ${cfg.color} shadow-lg ${cfg.glow}`} />
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
                      </div>

                      {/* Name + emoji */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {cfg.emoji} {c.nome}
                        </p>
                        {!teamOnly && corretorTeamMap[c.corretor_id] && (
                          <p className="text-[10px] text-muted-foreground">{corretorTeamMap[c.corretor_id]}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <motion.p
                            key={c.tentativas}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className="text-lg font-black text-foreground leading-none"
                          >
                            {c.tentativas}
                          </motion.p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">📞 Liga</p>
                        </div>
                        <div className="text-center">
                          <motion.p
                            key={c.aproveitados}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className="text-lg font-black text-emerald-400 leading-none"
                          >
                            {c.aproveitados}
                          </motion.p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">✅ Aprov</p>
                        </div>
                        <div className="text-center min-w-[40px]">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold h-5 px-1.5 ${
                              taxa >= 15 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
                              taxa >= 8 ? "text-blue-400 border-blue-500/40 bg-blue-500/10" :
                              "text-muted-foreground border-border/50"
                            }`}
                          >
                            {taxa}%
                          </Badge>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Taxa</p>
                        </div>
                        <div className="text-center min-w-[36px]">
                          <p className="text-xs font-semibold text-muted-foreground leading-none">
                            {c.ultima_tentativa ? (
                              c.minutos_parado <= 1 ? (
                                <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-emerald-400">agora</motion.span>
                              ) :
                              c.minutos_parado < 60 ? `${c.minutos_parado}m` :
                              format(new Date(c.ultima_tentativa), "HH:mm")
                            ) : "—"}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Última</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ═══ Não Iniciaram ═══ */}
      {naoIniciaram.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Ainda não iniciaram ({naoIniciaram.length})</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {naoIniciaram.map(c => (
                <span key={c.id} className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300/80 border border-amber-500/15">
                  💤 {c.nome}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ Lista Progress (grouped by campaign) ═══ */}
      {data_.listaProgress.length > 0 && (() => {
        // Group lists by campaign
        const campanhaMap = new Map<string, ListaProgress[]>();
        const avulsas: ListaProgress[] = [];
        for (const lp of data_.listaProgress) {
          if (lp.campanha) {
            const arr = campanhaMap.get(lp.campanha) || [];
            arr.push(lp);
            campanhaMap.set(lp.campanha, arr);
          } else {
            avulsas.push(lp);
          }
        }

        const campanhas: CampanhaProgress[] = Array.from(campanhaMap.entries()).map(([nome, listas]) => {
          const total = listas.reduce((s, l) => s + l.total, 0);
          const na_fila = listas.reduce((s, l) => s + l.na_fila, 0);
          const aproveitados = listas.reduce((s, l) => s + l.aproveitados, 0);
          const descartados = listas.reduce((s, l) => s + l.descartados, 0);
          const em_cooldown = listas.reduce((s, l) => s + l.em_cooldown, 0);
          const worked = aproveitados + descartados;
          return {
            campanha: nome, listas, total, na_fila, aproveitados, descartados, em_cooldown,
            percent_complete: total > 0 ? Math.round((worked / total) * 100) : 0,
          };
        });

        const renderProgressCard = (key: string, nome: string, subtitle: string, stats: { total: number; na_fila: number; em_cooldown: number; aproveitados: number; descartados: number; percent_complete: number }, idx: number, isCampanha?: boolean) => {
          const pct = stats.percent_complete;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border bg-card p-4 ${isCampanha ? "border-primary/20 bg-primary/[0.02]" : "border-border/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    {isCampanha && <Target className="h-3.5 w-3.5 text-primary" />}
                    {nome}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{subtitle}</p>
                </div>
                <div className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${
                  pct >= 80 ? "text-emerald-400 bg-emerald-500/15" :
                  pct >= 40 ? "text-blue-400 bg-blue-500/15" :
                  "text-muted-foreground bg-muted/50"
                }`}>
                  {pct}%
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden mb-2.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    pct >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                    pct >= 40 ? "bg-gradient-to-r from-blue-500 to-blue-400" :
                    "bg-gradient-to-r from-violet-500 to-violet-400"
                  }`}
                  style={{ boxShadow: pct >= 80 ? "0 0 8px rgba(52,211,153,0.4)" : pct >= 40 ? "0 0 8px rgba(96,165,250,0.4)" : "none" }}
                />
              </div>
              <div className="flex gap-3 text-[10px] font-medium text-muted-foreground">
                <span>📞 {stats.na_fila} fila</span>
                <span>⏳ {stats.em_cooldown} cool</span>
                <span className="text-emerald-400">✅ {stats.aproveitados}</span>
                <span className="text-red-400">❌ {stats.descartados}</span>
                <span className="ml-auto font-bold text-foreground">{stats.total} total</span>
              </div>
            </motion.div>
          );
        };

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Progresso das Campanhas</h3>
            </div>
            <div className="grid gap-3">
              {campanhas.map((cp, i) => (
                <div key={cp.campanha} className="space-y-2">
                  {renderProgressCard(`camp-${cp.campanha}`, cp.campanha, `${cp.listas.length} lista${cp.listas.length > 1 ? "s" : ""} agrupadas`, cp, i, true)}
                  <div className="pl-4 border-l-2 border-primary/15 space-y-2">
                    {cp.listas.map((lp, j) => renderProgressCard(lp.lista_id, lp.nome, lp.empreendimento, lp, j))}
                  </div>
                </div>
              ))}
              {avulsas.length > 0 && campanhas.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] text-muted-foreground font-medium">Listas avulsas</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
              )}
              {avulsas.map((lp, i) => renderProgressCard(lp.lista_id, lp.nome, lp.empreendimento, lp, i))}
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}
