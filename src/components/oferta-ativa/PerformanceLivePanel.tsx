import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Activity, Users, Phone, ThumbsUp, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";

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
        .select("id, nome, empreendimento, total_leads, status")
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
      const activeCorretorIds = new Set(activeLocks.map(l => l.em_atendimento_por));

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
        for (const p of profiles || []) profileMap[p.user_id] = p.nome;
      }

      // Add locked corretors without attempts
      for (const cid of activeCorretorIds) {
        if (cid && !byCorretor[cid]) {
          byCorretor[cid] = {
            corretor_id: cid, tentativas: 0, aproveitados: 0,
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
            lista_id: lista.id, nome: lista.nome, empreendimento: lista.empreendimento,
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

  if (isLoading || (teamOnly && !teamMemberUserIds)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (teamOnly && teamMemberUserIds && teamMemberUserIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum corretor vinculado</p>
          <p className="text-sm mt-1">Vincule corretores ao seu time em "Meu Time" para ver a performance aqui.</p>
        </CardContent>
      </Card>
    );
  }

  if (!liveData || liveData.totalCorretores === 0) {
    // Show day summary even when empty
    const activeIds = new Set(liveData?.corretores.map(c => c.corretor_id) || []);
    const naoIniciaram = allTeamCorretores.filter(c => !activeIds.has(c.id));
    const hasAnySummary = liveData && liveData.totalTentativas > 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground/40" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {teamOnly ? "Minha equipe · " : ""}Última atualização · {format(now, "HH:mm:ss")}
          </span>
        </div>

        {/* Day Summary */}
        {hasAnySummary && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Phone className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{liveData.totalTentativas}</p>
                <p className="text-[10px] text-muted-foreground">Tentativas hoje</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <ThumbsUp className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-600">{liveData.totalAproveitados}</p>
                <p className="text-[10px] text-muted-foreground">Aproveitados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-purple-600">{liveData.taxaConversao}%</p>
                <p className="text-[10px] text-muted-foreground">Taxa Conversão</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Corretores that dialed today (but are now inactive) */}
        {liveData && liveData.corretores.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Corretores que discaram hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 px-3 text-left">Corretor</th>
                    {!teamOnly && <th className="py-2 px-3 text-left">Time</th>}
                    <th className="py-2 px-3 text-center">📞</th>
                    <th className="py-2 px-3 text-center">✅</th>
                    <th className="py-2 px-3 text-center">Último contato</th>
                  </tr>
                </thead>
                <tbody>
                  {liveData.corretores.map(c => (
                    <tr key={c.corretor_id} className="border-b border-border">
                      <td className="py-2.5 px-3 font-medium">{c.nome}</td>
                      {!teamOnly && (
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] text-muted-foreground">{corretorTeamMap[c.corretor_id] || "—"}</span>
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center font-semibold">{c.tentativas}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-emerald-600">{c.aproveitados}</td>
                      <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                        {c.ultima_tentativa ? format(new Date(c.ultima_tentativa), "HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Corretores that haven't started */}
        {naoIniciaram.length > 0 && (
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" /> ⚠️ Ainda não iniciaram hoje ({naoIniciaram.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {naoIniciaram.map(c => (
                  <Badge key={c.id} variant="outline" className="text-xs text-amber-700 border-amber-500/30 bg-amber-500/5">
                    {c.nome}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Truly empty state */}
        {!hasAnySummary && naoIniciaram.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Sem atividade hoje</p>
              <p className="text-sm mt-1">Nenhum corretor começou a discar ainda.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const STATUS_INDICATOR: Record<string, { label: string; color: string; pulse: boolean }> = {
    discando: { label: "Discando", color: "bg-emerald-500", pulse: true },
    ativo: { label: "Ativo", color: "bg-blue-500", pulse: false },
    parado: { label: "Parado", color: "bg-red-500", pulse: false },
  };

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {teamOnly ? "Minha equipe · " : ""}Tempo real · {format(now, "HH:mm:ss")}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Tentativas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{liveData.totalTentativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Aproveitados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{liveData.totalAproveitados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{liveData.taxaConversao}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Corretores</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {liveData.corretoresAtivos}
              <span className="text-sm font-normal text-muted-foreground">/{liveData.totalCorretores}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {liveData.corretoresParados > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              {liveData.corretoresParados} corretor(es) parado(s) há mais de 20 minutos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Corretores Live */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Corretores — Visão Live
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Corretor</th>
                <th className="py-2 px-3 text-center">📞</th>
                <th className="py-2 px-3 text-center">✅</th>
                <th className="py-2 px-3 text-center">Taxa</th>
                <th className="py-2 px-3 text-center">Última</th>
              </tr>
            </thead>
            <tbody>
              {liveData.corretores.map(c => {
                const ind = STATUS_INDICATOR[c.status];
                const taxa = c.tentativas > 0 ? Math.round((c.aproveitados / c.tentativas) * 100) : 0;
                return (
                  <tr key={c.corretor_id} className={`border-b border-border ${c.status === "parado" && c.minutos_parado > 20 ? "bg-amber-500/5" : ""}`}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          {ind.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ind.color} opacity-75`} />}
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ind.color}`} />
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">{ind.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-medium">{c.nome}</td>
                    <td className="py-2.5 px-3 text-center font-semibold">{c.tentativas}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-emerald-600">{c.aproveitados}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className={`text-[10px] h-5 ${taxa >= 15 ? "text-emerald-600 border-emerald-500/30" : taxa >= 8 ? "text-blue-600 border-blue-500/30" : "text-muted-foreground"}`}>
                        {taxa}%
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                      {c.ultima_tentativa ? (
                        c.minutos_parado <= 1 ? "agora" :
                        c.minutos_parado < 60 ? `${c.minutos_parado}min` :
                        format(new Date(c.ultima_tentativa), "HH:mm")
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Lista Progress */}
      {liveData.listaProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Progresso das Listas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveData.listaProgress.map(lp => (
              <div key={lp.lista_id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{lp.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{lp.empreendimento}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {lp.percent_complete}%
                  </Badge>
                </div>
                <Progress value={lp.percent_complete} className="h-2" />
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>📞 {lp.na_fila} na fila</span>
                  <span>⏳ {lp.em_cooldown} cooldown</span>
                  <span className="text-emerald-600">✅ {lp.aproveitados} aprov.</span>
                  <span>❌ {lp.descartados} desc.</span>
                  <span className="ml-auto font-medium">{lp.total} total</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
