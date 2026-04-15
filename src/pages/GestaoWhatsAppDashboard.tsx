import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Clock, AlertTriangle, CalendarCheck,
  ChevronRight, RefreshCw, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function todayBRT(): string {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.toISOString().slice(0, 10);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function minutesSince(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / 60000;
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface CorretorInfo {
  profileId: string;
  nome: string;
  userId: string;
}

interface CorretorMetrics {
  profileId: string;
  nome: string;
  conversasAtivas: number;
  msgEnviadas: number;
  msgRecebidas: number;
  tempoMedioMin: number;
  leadsSemResposta: number;
}

interface AlertaLead {
  leadId: string;
  leadNome: string;
  empreendimento: string;
  corretorNome: string;
  corretorProfileId: string;
  esperandoMin: number;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function GestaoWhatsAppDashboard() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  // ── Load team members ─────────────────────────────────────────────────────
  const { data: corretores = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["gestao-wa-team", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("team_members")
        .select("user_id, profiles!team_members_user_id_fkey(id, nome)")
        .eq("status", "ativo");

      if (!isAdmin) {
        query = query.eq("gerente_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || [])
        .filter((tm: any) => tm.profiles)
        .map((tm: any) => ({
          profileId: tm.profiles.id as string,
          nome: (tm.profiles.nome ?? "Sem nome") as string,
          userId: tm.user_id as string,
        })) as CorretorInfo[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const profileIds = useMemo(() => corretores.map((c) => c.profileId), [corretores]);

  // ── Load messages today ───────────────────────────────────────────────────
  const today = todayBRT();

  const { data: mensagens = [], isLoading: loadingMsgs, refetch } = useQuery({
    queryKey: ["gestao-wa-msgs", today, profileIds],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      const { data, error } = await supabase
        .from("whatsapp_mensagens")
        .select("id, lead_id, corretor_id, direction, timestamp, body")
        .in("corretor_id", profileIds)
        .gte("timestamp", `${today}T00:00:00-03:00`)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: profileIds.length > 0,
    staleTime: 30_000,
  });

  // ── Load leads for names ──────────────────────────────────────────────────
  const leadIds = useMemo(() => [...new Set(mensagens.map((m) => m.lead_id))], [mensagens]);

  const { data: leadsMap = {} } = useQuery({
    queryKey: ["gestao-wa-leads", leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento_interesse")
        .in("id", leadIds.slice(0, 200));
      const map: Record<string, { nome: string; empreendimento: string }> = {};
      (data || []).forEach((l) => {
        map[l.id] = { nome: l.nome || "Lead", empreendimento: l.empreendimento_interesse || "" };
      });
      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: 60_000,
  });

  // ── Compute metrics ───────────────────────────────────────────────────────

  const { kpis, corretorMetrics, alertas } = useMemo(() => {
    const corretorMap = new Map(corretores.map((c) => [c.profileId, c]));

    // Group messages by lead+corretor
    const convs = new Map<string, typeof mensagens>();
    mensagens.forEach((m) => {
      const key = `${m.lead_id}__${m.corretor_id}`;
      if (!convs.has(key)) convs.set(key, []);
      convs.get(key)!.push(m);
    });

    // KPI 1: Conversas ativas
    const conversasAtivas = convs.size;

    // KPI 2: Tempo médio resposta & KPI 3: Leads sem resposta
    let totalResponseTime = 0;
    let responseCount = 0;
    const semResposta: AlertaLead[] = [];

    // Per-corretor accumulators
    const perCorretor = new Map<string, {
      conversas: number;
      sent: number;
      received: number;
      responseTimes: number[];
      semResposta: number;
    }>();

    profileIds.forEach((pid) => {
      perCorretor.set(pid, { conversas: 0, sent: 0, received: 0, responseTimes: [], semResposta: 0 });
    });

    convs.forEach((msgs, key) => {
      const [leadId, corretorId] = key.split("__");
      const acc = perCorretor.get(corretorId);
      if (acc) acc.conversas++;

      // Count sent/received
      msgs.forEach((m) => {
        if (!acc) return;
        if (m.direction === "sent") acc.sent++;
        else acc.received++;
      });

      // Compute response times
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].direction === "received" && msgs[i + 1].direction === "sent") {
          const diff = (new Date(msgs[i + 1].timestamp).getTime() - new Date(msgs[i].timestamp).getTime()) / 60000;
          if (diff >= 0 && diff < 1440) {
            totalResponseTime += diff;
            responseCount++;
            if (acc) acc.responseTimes.push(diff);
          }
        }
      }

      // Check if last message is received and waiting >2h
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg.direction === "received") {
        const waitMin = minutesSince(lastMsg.timestamp);
        if (waitMin > 120) {
          if (acc) acc.semResposta++;
          const lead = leadsMap[leadId];
          const corretor = corretorMap.get(corretorId);
          semResposta.push({
            leadId,
            leadNome: lead?.nome || "Lead",
            empreendimento: lead?.empreendimento || "",
            corretorNome: corretor?.nome || "Corretor",
            corretorProfileId: corretorId,
            esperandoMin: waitMin,
          });
        }
      }
    });

    const tempoMedioMin = responseCount > 0 ? totalResponseTime / responseCount : 0;
    const leadsSemResp = semResposta.length;

    // Sort alertas by wait time desc
    semResposta.sort((a, b) => b.esperandoMin - a.esperandoMin);

    // Build corretor metrics
    const metrics: CorretorMetrics[] = profileIds.map((pid) => {
      const acc = perCorretor.get(pid)!;
      const c = corretorMap.get(pid)!;
      const avg = acc.responseTimes.length > 0
        ? acc.responseTimes.reduce((a, b) => a + b, 0) / acc.responseTimes.length
        : 0;
      return {
        profileId: pid,
        nome: c.nome,
        conversasAtivas: acc.conversas,
        msgEnviadas: acc.sent,
        msgRecebidas: acc.received,
        tempoMedioMin: avg,
        leadsSemResposta: acc.semResposta,
      };
    });

    // Sort by leads sem resposta DESC
    metrics.sort((a, b) => b.leadsSemResposta - a.leadsSemResposta);

    return {
      kpis: { conversasAtivas, tempoMedioMin, leadsSemResp },
      corretorMetrics: metrics,
      alertas: semResposta.slice(0, 10),
    };
  }, [mensagens, corretores, profileIds, leadsMap]);

  const isLoading = loadingTeam || loadingMsgs;

  // ── Tempo médio color ─────────────────────────────────────────────────────
  const tempoColor = kpis.tempoMedioMin < 30
    ? "text-green-600"
    : kpis.tempoMedioMin < 120
    ? "text-yellow-600"
    : "text-red-600";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6" style={{ backgroundColor: "#f0f0f5" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestão WhatsApp</h1>
          <p className="text-sm text-gray-500">Monitoramento de conversas do time</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw size={14} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<MessageSquare size={20} />}
          label="Conversas ativas hoje"
          value={isLoading ? null : String(kpis.conversasAtivas)}
          accent="#4F46E5"
        />
        <KPICard
          icon={<Clock size={20} />}
          label="Tempo médio de resposta"
          value={isLoading ? null : formatDuration(kpis.tempoMedioMin)}
          valueClass={tempoColor}
          accent="#4F46E5"
        />
        <KPICard
          icon={<AlertTriangle size={20} />}
          label="Leads sem resposta +2h"
          value={isLoading ? null : String(kpis.leadsSemResp)}
          valueClass={kpis.leadsSemResp > 0 ? "text-red-600" : "text-green-600"}
          accent={kpis.leadsSemResp > 0 ? "#DC2626" : "#4F46E5"}
        />
        <KPICard
          icon={<CalendarCheck size={20} />}
          label="Conversas → Visita"
          value={isLoading ? null : "—"}
          accent="#4F46E5"
          sublabel="Em breve"
        />
      </div>

      {/* Corretor Table */}
      <Card className="rounded-xl bg-white border-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Users size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Performance por corretor</h2>
          <span className="text-xs text-gray-400 ml-auto">{corretores.length} corretores</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : corretorMetrics.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum corretor encontrado no time
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2.5 font-medium">Corretor</th>
                  <th className="text-center px-3 py-2.5 font-medium">Conversas</th>
                  <th className="text-center px-3 py-2.5 font-medium">Enviadas</th>
                  <th className="text-center px-3 py-2.5 font-medium">Recebidas</th>
                  <th className="text-center px-3 py-2.5 font-medium">Tempo médio</th>
                  <th className="text-center px-3 py-2.5 font-medium">Sem resposta</th>
                  <th className="text-center px-3 py-2.5 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {corretorMetrics.map((cm) => {
                  const statusIcon =
                    cm.leadsSemResposta >= 3
                      ? "🔴"
                      : cm.leadsSemResposta >= 1
                      ? "🟡"
                      : "🟢";

                  return (
                    <tr
                      key={cm.profileId}
                      className="border-t hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() =>
                        navigate("/whatsapp", {
                          state: { selectedCorretorId: cm.profileId },
                        })
                      }
                    >
                      <td className="px-4 py-3 flex items-center gap-3">
                        <span className="text-sm">{statusIcon}</span>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                            {getInitials(cm.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900 truncate max-w-[160px]">
                          {cm.nome.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-gray-700">{cm.conversasAtivas}</td>
                      <td className="text-center px-3 py-3 text-gray-700">{cm.msgEnviadas}</td>
                      <td className="text-center px-3 py-3 text-gray-700">{cm.msgRecebidas}</td>
                      <td className="text-center px-3 py-3">
                        <span
                          className={
                            cm.tempoMedioMin < 30
                              ? "text-green-600"
                              : cm.tempoMedioMin < 120
                              ? "text-yellow-600"
                              : "text-red-600"
                          }
                        >
                          {cm.conversasAtivas > 0 ? formatDuration(cm.tempoMedioMin) : "—"}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span
                          className={
                            cm.leadsSemResposta > 0
                              ? "font-bold text-red-600"
                              : "text-green-600"
                          }
                        >
                          {cm.leadsSemResposta}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <ChevronRight size={14} className="text-gray-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Alertas Críticos */}
      <Card className="rounded-xl bg-white border-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <h2 className="font-semibold text-gray-900">Atenção necessária</h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : alertas.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-2xl">✅</span>
            <p className="text-green-600 font-medium mt-2">
              Todos os leads estão sendo atendidos
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {alertas.map((a, i) => (
              <div
                key={`${a.leadId}-${i}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-[10px] bg-red-100 text-red-700">
                    {getInitials(a.leadNome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.leadNome}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {a.empreendimento && `${a.empreendimento} · `}
                    Corretor: {a.corretorNome.split(" ")[0]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <Clock size={11} />
                    Esperando há {formatDuration(a.esperandoMin)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0"
                  onClick={() =>
                    navigate("/whatsapp", {
                      state: { selectedCorretorId: a.corretorProfileId, selectedLeadId: a.leadId },
                    })
                  }
                >
                  Ver conversa
                  <ChevronRight size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  valueClass,
  accent,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  valueClass?: string;
  accent: string;
  sublabel?: string;
}) {
  return (
    <Card className="rounded-xl bg-white border-0 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
        <span className="text-xs text-gray-500 leading-tight">{label}</span>
      </div>
      {value === null ? (
        <Skeleton className="h-8 w-20 mt-1" />
      ) : (
        <div className="flex items-end gap-1">
          <span className={`text-2xl font-bold ${valueClass ?? "text-gray-900"}`}>
            {value}
          </span>
          {sublabel && (
            <span className="text-[10px] text-gray-400 mb-1">{sublabel}</span>
          )}
        </div>
      )}
    </Card>
  );
}
