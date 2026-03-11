import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, UserCheck, MapPin, Users, TrendingUp, Briefcase, BarChart3, Eye,
  CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, ArrowRight,
  ExternalLink, Clock, Zap, Shield
} from "lucide-react";
import { format, subDays, addDays, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

// ─── Pipeline stages config ───
const PIPELINE_STAGES = [
  { key: "novo_lead", label: "Novo", emoji: "🆕" },
  { key: "sem_contato", label: "S/Contato", emoji: "📵" },
  { key: "contato_iniciado", label: "Contato", emoji: "📞" },
  { key: "qualificacao", label: "Qualif.", emoji: "🎯" },
  { key: "possivel_visita", label: "P.Visita", emoji: "🏠" },
  { key: "visita_marcada", label: "V.Marcada", emoji: "📅" },
  { key: "visita_realizada", label: "V.Realiz.", emoji: "✅" },
];

const NEGOCIO_FASES = [
  { key: "visita", label: "Visita", color: "bg-blue-500" },
  { key: "gerado", label: "Gerado", color: "bg-indigo-500" },
  { key: "negociacao", label: "Negociação", color: "bg-amber-500" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500" },
  { key: "assinado", label: "Assinado", color: "bg-emerald-500" },
];

const fmtCurrency = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
};

interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  icon: string;
  message: string;
  action?: { label: string; route: string };
}

export default function CheckpointVisaoGeralTab({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [oaData, setOaData] = useState<Record<string, { ligacoes: number; aproveitados: number; whatsapps: number }>>({});
  const [pipelineData, setPipelineData] = useState<Record<string, Record<string, number>>>({});
  const [negociosData, setNegociosData] = useState<Record<string, { count: number; vgv: number }[]>>({});
  const [visitasHoje, setVisitasHoje] = useState<{ corretor_id: string; status: string; empreendimento: string | null; hora: string | null }[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [negociosParados, setNegociosParados] = useState<any[]>([]);
  const [leadsSemContato, setLeadsSemContato] = useState(0);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");

  const loadData = useCallback(async () => {
    if (teamUserIds.length === 0) return;
    setLoading(true);

    // Load pipeline stage definitions first
    const { data: stagesDef } = await supabase.from("pipeline_stages").select("id, tipo, nome").eq("ativo", true).eq("pipeline_tipo", "leads");
    const stageMap: Record<string, string> = {};
    (stagesDef || []).forEach((s: any) => { stageMap[s.id] = s.tipo; });

    // Split queries - cast as any to avoid TS2589
    const q1: any = supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, canal").in("corretor_id", teamUserIds).gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`);
    const q2: any = supabase.from("pipeline_leads").select("corretor_id, stage_id").in("corretor_id", teamUserIds);
    const q3: any = supabase.from("negocios").select("corretor_id, fase, vgv_estimado, vgv_final, nome_cliente, updated_at, fase_changed_at, empreendimento").in("corretor_id", teamUserIds).not("fase", "in", "(perdido,cancelado)");
    const q4: any = supabase.from("visitas").select("corretor_id, status, empreendimento, horario").in("corretor_id", teamUserIds).eq("data_visita", dateStr);
    const q5: any = supabase.from("negocios").select("id, nome_cliente, fase, corretor_id, vgv_estimado, updated_at, fase_changed_at, empreendimento").in("corretor_id", teamUserIds).not("fase", "in", "(perdido,cancelado,assinado,vendido)").order("updated_at", { ascending: true }).limit(50);
    const q6: any = supabase.from("pipeline_leads").select("id, corretor_id, nome, created_at, stage_id").in("corretor_id", teamUserIds).lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()).limit(50);

    const [r1, r2, r3, r4, r5, r6] = await Promise.all([q1, q2, q3, q4, q5, q6]);
    const tentativas = r1.data;
    const pipelineLeads = r2.data;
    const negocios = r3.data;
    const visitasDia = r4.data;
    const negParados = r5.data;
    const leadsPendentes = r6.data;

    // Process OA
    const oa: Record<string, { ligacoes: number; aproveitados: number; whatsapps: number }> = {};
    teamUserIds.forEach(uid => { oa[uid] = { ligacoes: 0, aproveitados: 0, whatsapps: 0 }; });
    (tentativas || []).forEach((t: any) => {
      if (!oa[t.corretor_id]) oa[t.corretor_id] = { ligacoes: 0, aproveitados: 0, whatsapps: 0 };
      oa[t.corretor_id].ligacoes++;
      if (t.resultado === "com_interesse") oa[t.corretor_id].aproveitados++;
      if (t.canal === "whatsapp") oa[t.corretor_id].whatsapps++;
    });
    setOaData(oa);

    // Process Pipeline (FIXED: use stage_id → stageMap lookup)
    const descarteStageIds = new Set(Object.entries(stageMap).filter(([_, tipo]) => tipo === "descarte").map(([id]) => id));
    const pipeline: Record<string, Record<string, number>> = {};
    teamUserIds.forEach(uid => {
      pipeline[uid] = {};
      PIPELINE_STAGES.forEach(s => { pipeline[uid][s.key] = 0; });
    });
    (pipelineLeads || []).forEach((l: any) => {
      if (descarteStageIds.has(l.stage_id)) return; // skip descarte
      const tipo = stageMap[l.stage_id];
      if (pipeline[l.corretor_id] && tipo) {
        pipeline[l.corretor_id][tipo] = (pipeline[l.corretor_id][tipo] || 0) + 1;
      }
    });
    setPipelineData(pipeline);

    // Process Negócios
    const neg: Record<string, { count: number; vgv: number }[]> = {};
    teamUserIds.forEach(uid => {
      neg[uid] = NEGOCIO_FASES.map(() => ({ count: 0, vgv: 0 }));
    });
    (negocios || []).forEach((n: any) => {
      const uid = n.corretor_id;
      if (!neg[uid]) return;
      const idx = NEGOCIO_FASES.findIndex(f => f.key === n.fase);
      if (idx >= 0) {
        neg[uid][idx].count++;
        neg[uid][idx].vgv += Number(n.vgv_final || n.vgv_estimado || 0);
      }
    });
    setNegociosData(neg);

    // Process Visitas
    setVisitasHoje((visitasDia || []).map((v: any) => ({
      corretor_id: v.corretor_id,
      status: v.status || "agendada",
      empreendimento: v.empreendimento,
      hora: v.horario,
    })));

    // Process Negócios Parados
    const now = new Date();
    const parados = (negParados || [])
      .map((n: any) => {
        const lastUpdate = n.fase_changed_at || n.updated_at;
        const dias = lastUpdate ? differenceInDays(now, new Date(lastUpdate)) : 999;
        return { ...n, diasParado: dias };
      })
      .filter(n => n.diasParado >= 5)
      .sort((a, b) => b.diasParado - a.diasParado);
    setNegociosParados(parados);

    // Leads sem contato
    setLeadsSemContato((leadsPendentes || []).length);

    // Build Alerts
    const newAlerts: Alert[] = [];

    // Corretores sem ligação
    const semLigacao = teamUserIds.filter(uid => (oa[uid]?.ligacoes || 0) === 0);
    if (semLigacao.length > 0 && dateStr === format(new Date(), "yyyy-MM-dd")) {
      newAlerts.push({
        id: "sem-ligacao",
        type: "warning",
        icon: "📵",
        message: `${semLigacao.map(uid => teamNameMap[uid]).join(", ")} ainda não fizeram ligações hoje`,
        action: { label: "Ver OA", route: "/oferta-ativa" },
      });
    }

    // Leads sem contato
    if ((leadsPendentes || []).length > 0) {
      newAlerts.push({
        id: "leads-sem-contato",
        type: "danger",
        icon: "🚨",
        message: `${(leadsPendentes || []).length} leads sem contato há mais de 48h`,
        action: { label: "Ver Pipeline", route: "/pipeline" },
      });
    }

    // Negócios parados
    if (parados.length > 0) {
      newAlerts.push({
        id: "negocios-parados",
        type: "warning",
        icon: "⏸️",
        message: `${parados.length} negócios parados há 5+ dias (VGV: ${fmtCurrency(parados.reduce((s, n) => s + Number(n.vgv_estimado || 0), 0))})`,
        action: { label: "Ver Negócios", route: "/negocios" },
      });
    }

    // Visitas sem confirmação
    const visitasPendentes = (visitasDia || []).filter((v: any) => v.status === "agendada");
    if (visitasPendentes.length > 0 && dateStr === format(new Date(), "yyyy-MM-dd")) {
      newAlerts.push({
        id: "visitas-pendentes",
        type: "info",
        icon: "📅",
        message: `${visitasPendentes.length} visitas de hoje ainda sem confirmação`,
        action: { label: "Ver Agenda", route: "/agenda-visitas" },
      });
    }

    setAlerts(newAlerts);
    setLoading(false);
  }, [teamUserIds, user, dateStr, teamNameMap]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Realtime subscriptions ───
  useEffect(() => {
    if (teamUserIds.length === 0) return;

    const channel = supabase
      .channel("command-center-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "oferta_ativa_tentativas" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "negocios" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas" }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamUserIds, loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Carregando Command Center...
      </div>
    );
  }

  // ─── Totals ───
  const totalOA = Object.values(oaData).reduce((acc, v) => ({
    ligacoes: acc.ligacoes + v.ligacoes,
    aproveitados: acc.aproveitados + v.aproveitados,
    whatsapps: acc.whatsapps + v.whatsapps,
  }), { ligacoes: 0, aproveitados: 0, whatsapps: 0 });

  const totalPipelineByStage: Record<string, number> = {};
  PIPELINE_STAGES.forEach(s => { totalPipelineByStage[s.key] = 0; });
  Object.values(pipelineData).forEach(stages => {
    Object.entries(stages).forEach(([k, v]) => { totalPipelineByStage[k] = (totalPipelineByStage[k] || 0) + v; });
  });
  const totalLeads = Object.values(totalPipelineByStage).reduce((a, b) => a + b, 0);

  const totalNegByFase = NEGOCIO_FASES.map((_, i) => {
    return Object.values(negociosData).reduce((acc, arr) => ({
      count: acc.count + (arr[i]?.count || 0),
      vgv: acc.vgv + (arr[i]?.vgv || 0),
    }), { count: 0, vgv: 0 });
  });
  const totalNegCount = totalNegByFase.reduce((a, b) => a + b.count, 0);
  const totalVGV = totalNegByFase.reduce((a, b) => a + b.vgv, 0);

  const taxa = totalOA.ligacoes > 0 ? ((totalOA.aproveitados / totalOA.ligacoes) * 100).toFixed(0) : "0";

  const sortedTeam = [...teamUserIds].sort((a, b) => (oaData[b]?.ligacoes || 0) - (oaData[a]?.ligacoes || 0));

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  const totalVisitasHoje = visitasHoje.length;
  const visitasRealizadas = visitasHoje.filter(v => v.status === "realizada").length;

  return (
    <div className="space-y-5">
      {/* ═══ DATE PICKER ═══ */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[160px] justify-center gap-2 font-medium">
              <CalendarIcon size={14} />
              {dateFmt}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight size={16} />
        </Button>
        {!isToday && (
          <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => setSelectedDate(new Date())}>
            Hoje
          </Button>
        )}
        {isToday && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            TEMPO REAL
          </span>
        )}
      </div>

      {/* ═══ ALERTS ═══ */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                alert.type === "danger" && "bg-destructive/10 border-destructive/30",
                alert.type === "warning" && "bg-amber-500/10 border-amber-500/30",
                alert.type === "info" && "bg-blue-500/10 border-blue-500/30",
              )}
            >
              <span className="text-base">{alert.icon}</span>
              <p className="flex-1 text-xs font-medium text-foreground">{alert.message}</p>
              {alert.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1 shrink-0"
                  onClick={() => navigate(alert.action!.route)}
                >
                  {alert.action.label} <ExternalLink size={12} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ HEADER CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard
          icon={<Phone size={18} />}
          label={isToday ? "Ligações Hoje" : `Ligações ${dateFmt}`}
          value={totalOA.ligacoes}
          accent="text-blue-600 bg-blue-500/10"
          onClick={() => navigate("/oferta-ativa")}
        />
        <SummaryCard
          icon={<UserCheck size={18} />}
          label="Aproveitados"
          value={totalOA.aproveitados}
          sub={`${taxa}% taxa`}
          accent="text-emerald-600 bg-emerald-500/10"
        />
        <SummaryCard
          icon={<Users size={18} />}
          label="Leads Pipeline"
          value={totalLeads}
          accent="text-primary bg-primary/10"
          onClick={() => navigate("/pipeline")}
        />
        <SummaryCard
          icon={<Briefcase size={18} />}
          label="Negócios Ativos"
          value={totalNegCount}
          sub={fmtCurrency(totalVGV)}
          accent="text-amber-600 bg-amber-500/10"
          onClick={() => navigate("/negocios")}
        />
        <SummaryCard
          icon={<MapPin size={18} />}
          label="Visitas Hoje"
          value={totalVisitasHoje}
          sub={`${visitasRealizadas} realizadas`}
          accent="text-purple-600 bg-purple-500/10"
          onClick={() => navigate("/agenda-visitas")}
        />
      </div>

      {/* ═══ FUNIL INTEGRADO VISUAL ═══ */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap size={14} className="text-primary" /> Fluxo Operacional Integrado
        </h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { label: "Oferta Ativa", value: totalOA.ligacoes, sub: `${totalOA.aproveitados} aprov.`, color: "bg-blue-500/10 text-blue-700 border-blue-200", route: "/oferta-ativa" },
            { label: "Pipeline Leads", value: totalLeads, sub: `${totalPipelineByStage["visita_marcada"] || 0} com visita`, color: "bg-indigo-500/10 text-indigo-700 border-indigo-200", route: "/pipeline" },
            { label: "Visitas", value: totalVisitasHoje, sub: `${visitasRealizadas} realiz.`, color: "bg-purple-500/10 text-purple-700 border-purple-200", route: "/agenda-visitas" },
            { label: "Negócios", value: totalNegCount, sub: fmtCurrency(totalVGV), color: "bg-amber-500/10 text-amber-700 border-amber-200", route: "/negocios" },
            { label: "Assinados", value: totalNegByFase[4]?.count || 0, sub: fmtCurrency(totalNegByFase[4]?.vgv || 0), color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", route: "/negocios" },
          ].map((block, i, arr) => (
            <div key={block.label} className="flex items-center gap-1" style={{ flex: 1, minWidth: 120 }}>
              <button
                onClick={() => navigate(block.route)}
                className={`w-full rounded-xl border p-3 text-center transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${block.color}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{block.label}</p>
                <p className="text-2xl font-extrabold">{block.value}</p>
                <p className="text-[10px] opacity-70">{block.sub}</p>
              </button>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ HEATMAP: MATRIZ DE CORRETORES ═══ */}
      <Section icon={<Shield size={16} />} title="Matriz de Corretores" badge={`${teamUserIds.length} ativos`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-muted/40">Corretor</th>
                <th className="px-2 py-2.5 text-center font-semibold">📞 OA</th>
                <th className="px-2 py-2.5 text-center font-semibold">✅ Aprov.</th>
                <th className="px-2 py-2.5 text-center font-semibold">📊 Leads</th>
                <th className="px-2 py-2.5 text-center font-semibold">🏠 Visitas</th>
                <th className="px-2 py-2.5 text-center font-semibold">💼 Negócios</th>
                <th className="px-2 py-2.5 text-center font-semibold">💰 VGV</th>
                <th className="px-2 py-2.5 text-center font-semibold">⚡ Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeam.map(uid => {
                const oa = oaData[uid] || { ligacoes: 0, aproveitados: 0, whatsapps: 0 };
                const stages = pipelineData[uid] || {};
                const totalLeadsCorr = Object.values(stages).reduce((a, b) => a + b, 0);
                const negArr = negociosData[uid] || NEGOCIO_FASES.map(() => ({ count: 0, vgv: 0 }));
                const totalNeg = negArr.reduce((a, b) => a + b.count, 0);
                const totalVgvCorr = negArr.reduce((a, b) => a + b.vgv, 0);
                const visitasCorr = visitasHoje.filter(v => v.corretor_id === uid).length;

                // Status assessment
                const hasActivity = oa.ligacoes > 0 || visitasCorr > 0;
                const statusColor = oa.ligacoes >= 20 ? "bg-emerald-500" : oa.ligacoes >= 10 ? "bg-blue-500" : oa.ligacoes > 0 ? "bg-amber-500" : "bg-muted-foreground/30";
                const statusLabel = oa.ligacoes >= 20 ? "🔥" : oa.ligacoes >= 10 ? "👍" : oa.ligacoes > 0 ? "⚠️" : "💤";

                return (
                  <tr key={uid} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground sticky left-0 bg-card">{teamNameMap[uid] || "Corretor"}</td>
                    <td className="px-2 py-2.5 text-center">
                      <HeatCell value={oa.ligacoes} max={30} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <HeatCell value={oa.aproveitados} max={5} positive />
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold text-foreground">{totalLeadsCorr}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-foreground">{visitasCorr}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-foreground">{totalNeg}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-bold ${totalVgvCorr > 0 ? "text-emerald-600" : "text-muted-foreground/40"}`}>
                        {totalVgvCorr > 0 ? fmtCurrency(totalVgvCorr) : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="text-base">{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ BLOCO 1: OA DO TIME ═══ */}
      <Section
        icon={<Phone size={16} />}
        title={`Oferta Ativa — ${isToday ? "Hoje" : dateFmt}`}
        badge={`${totalOA.ligacoes} ligações`}
        action={{ label: "Abrir OA", onClick: () => navigate("/oferta-ativa") }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2.5 font-semibold">Corretor</th>
                <th className="px-2 py-2.5 text-center font-semibold">Ligações</th>
                <th className="px-2 py-2.5 text-center font-semibold">Aproveitados</th>
                <th className="px-2 py-2.5 text-center font-semibold">Taxa</th>
                <th className="px-2 py-2.5 text-left font-semibold min-w-[120px]">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeam.map(uid => {
                const d = oaData[uid] || { ligacoes: 0, aproveitados: 0, whatsapps: 0 };
                const t = d.ligacoes > 0 ? ((d.aproveitados / d.ligacoes) * 100).toFixed(0) : "0";
                const prog = Math.min(100, Math.round((d.ligacoes / 30) * 100));
                return (
                  <tr key={uid} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-foreground">{d.ligacoes}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`font-bold ${d.aproveitados > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {d.aproveitados}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-muted-foreground">{t}%</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${prog >= 100 ? "bg-emerald-500" : prog >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{prog}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ BLOCO 2: GESTÃO DE LEADS ═══ */}
      <Section
        icon={<BarChart3 size={16} />}
        title="Gestão de Leads — Pipeline"
        badge={`${totalLeads} leads ativos`}
        action={{ label: "Abrir Pipeline", onClick: () => navigate("/pipeline") }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2.5 font-semibold">Corretor</th>
                {PIPELINE_STAGES.map(s => (
                  <th key={s.key} className="px-1.5 py-2.5 text-center font-semibold whitespace-nowrap">
                    <span className="block text-[10px]">{s.emoji}</span>
                    <span className="block">{s.label}</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeam.map(uid => {
                const stages = pipelineData[uid] || {};
                const total = Object.values(stages).reduce((a, b) => a + b, 0);
                return (
                  <tr key={uid} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                    {PIPELINE_STAGES.map(s => {
                      const v = stages[s.key] || 0;
                      return (
                        <td key={s.key} className="px-1.5 py-2.5 text-center">
                          <span className={`font-bold ${v > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                            {v}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center font-bold text-primary">{total}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-bold">
                <td className="px-3 py-2.5 text-foreground">TOTAL</td>
                {PIPELINE_STAGES.map(s => (
                  <td key={s.key} className="px-1.5 py-2.5 text-center text-foreground">
                    {totalPipelineByStage[s.key] || 0}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center text-primary">{totalLeads}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ BLOCO 3: GESTÃO DE NEGÓCIOS ═══ */}
      <Section
        icon={<Briefcase size={16} />}
        title="Gestão de Negócios"
        badge={`${totalNegCount} negócios · ${fmtCurrency(totalVGV)}`}
        action={{ label: "Abrir Negócios", onClick: () => navigate("/negocios") }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2.5 font-semibold">Corretor</th>
                {NEGOCIO_FASES.map(f => (
                  <th key={f.key} className="px-2 py-2.5 text-center font-semibold">
                    <span className="block">{f.label}</span>
                    <span className="block text-[9px] text-muted-foreground font-normal">qtd · VGV</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-bold">Total VGV</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeam.map(uid => {
                const arr = negociosData[uid] || NEGOCIO_FASES.map(() => ({ count: 0, vgv: 0 }));
                const totalVgvCorretor = arr.reduce((a, b) => a + b.vgv, 0);
                return (
                  <tr key={uid} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                    {arr.map((cell, i) => (
                      <td key={i} className="px-2 py-2.5 text-center">
                        <span className={`font-bold ${cell.count > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {cell.count}
                        </span>
                        {cell.vgv > 0 && (
                          <span className="block text-[10px] text-muted-foreground">{fmtCurrency(cell.vgv)}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600">
                      {totalVgvCorretor > 0 ? fmtCurrency(totalVgvCorretor) : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-bold">
                <td className="px-3 py-2.5 text-foreground">TOTAL</td>
                {totalNegByFase.map((cell, i) => (
                  <td key={i} className="px-2 py-2.5 text-center">
                    <span className="text-foreground">{cell.count}</span>
                    {cell.vgv > 0 && (
                      <span className="block text-[10px] text-muted-foreground">{fmtCurrency(cell.vgv)}</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center text-emerald-600">{fmtCurrency(totalVGV)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ BLOCO 4: VISITAS DO DIA ═══ */}
      {visitasHoje.length > 0 && (
        <Section
          icon={<MapPin size={16} />}
          title={`Visitas — ${isToday ? "Hoje" : dateFmt}`}
          badge={`${totalVisitasHoje} agendadas · ${visitasRealizadas} realizadas`}
          action={{ label: "Abrir Agenda", onClick: () => navigate("/agenda-visitas") }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {visitasHoje.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  v.status === "realizada" ? "bg-emerald-500" : v.status === "cancelada" ? "bg-destructive" : "bg-amber-500"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{teamNameMap[v.corretor_id] || "Corretor"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento || "—"} {v.hora ? `· ${v.hora}` : ""}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  v.status === "realizada" ? "bg-emerald-500/15 text-emerald-700" :
                  v.status === "cancelada" ? "bg-destructive/15 text-destructive" :
                  "bg-amber-500/15 text-amber-700"
                )}>
                  {v.status === "realizada" ? "Realizada" : v.status === "cancelada" ? "Cancelada" : "Agendada"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ BLOCO 5: NEGÓCIOS PARADOS ═══ */}
      {negociosParados.length > 0 && (
        <Section
          icon={<AlertTriangle size={16} />}
          title={`⚠️ Negócios Parados (${negociosParados.length})`}
          badge="5+ dias sem movimentação"
          action={{ label: "Ver Negócios", onClick: () => navigate("/negocios") }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {negociosParados.slice(0, 9).map(n => (
              <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{n.nome_cliente || "Sem nome"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {teamNameMap[n.corretor_id] || "—"} · {n.empreendimento || "—"} · {n.fase}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-destructive">{n.diasParado}d</p>
                  <p className="text-[9px] text-muted-foreground">parado</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Subcomponents ───

function HeatCell({ value, max, positive }: { value: number; max: number; positive?: boolean }) {
  const ratio = Math.min(value / max, 1);
  const bgColor = value === 0
    ? "bg-muted/50 text-muted-foreground/40"
    : positive
      ? ratio >= 0.8 ? "bg-emerald-500/20 text-emerald-700" : ratio >= 0.4 ? "bg-emerald-500/10 text-emerald-600" : "bg-emerald-500/5 text-emerald-500"
      : ratio >= 0.8 ? "bg-blue-500/20 text-blue-700" : ratio >= 0.4 ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600";

  return (
    <span className={`inline-flex items-center justify-center font-bold rounded-md px-2 py-1 min-w-[32px] ${bgColor}`}>
      {value}
    </span>
  );
}

function SummaryCard({ icon, label, value, sub, accent, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("bg-card border border-border rounded-xl p-4 shadow-card", onClick && "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all")}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-display font-extrabold text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, badge, children, action }: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-foreground">
          {icon} {title}
        </h3>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
              {badge}
            </span>
          )}
          {action && (
            <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" onClick={action.onClick}>
              {action.label} <ExternalLink size={10} />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
