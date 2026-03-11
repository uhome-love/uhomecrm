import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, UserCheck, MapPin, Users, Briefcase, BarChart3,
  CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, ArrowRight,
  ExternalLink, Zap
} from "lucide-react";
import { format, subDays, addDays, differenceInDays } from "date-fns";
import { cn, formatBRLCompact } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

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

type DataTab = "oa" | "leads" | "negocios";

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
  const [dataTab, setDataTab] = useState<DataTab>("oa");

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");

  const loadData = useCallback(async () => {
    if (teamUserIds.length === 0) return;
    setLoading(true);

    const { data: stagesDef } = await supabase.from("pipeline_stages").select("id, tipo, nome").eq("ativo", true).eq("pipeline_tipo", "leads");
    const stageMap: Record<string, string> = {};
    (stagesDef || []).forEach((s: any) => { stageMap[s.id] = s.tipo; });

    const q1: any = supabase.from("oferta_ativa_tentativas").select("corretor_id, resultado, canal").in("corretor_id", teamUserIds).gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`);
    const q2: any = supabase.from("pipeline_leads").select("corretor_id, stage_id").in("corretor_id", teamUserIds);
    const q3: any = supabase.from("negocios").select("corretor_id, fase, vgv_estimado, vgv_final, nome_cliente, updated_at, fase_changed_at, empreendimento").in("corretor_id", teamUserIds).not("fase", "in", "(perdido,cancelado)");
    const q4: any = supabase.from("visitas").select("corretor_id, status, empreendimento, horario").in("corretor_id", teamUserIds).eq("data_visita", dateStr);
    const q5: any = supabase.from("negocios").select("id, nome_cliente, fase, corretor_id, vgv_estimado, updated_at, fase_changed_at, empreendimento").in("corretor_id", teamUserIds).not("fase", "in", "(perdido,cancelado,assinado,vendido)").order("updated_at", { ascending: true }).limit(50);
    const q6: any = supabase.from("pipeline_leads").select("id, corretor_id, nome, created_at, stage_id").in("corretor_id", teamUserIds).lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()).limit(50);

    const [r1, r2, r3, r4, r5, r6] = await Promise.all([q1, q2, q3, q4, q5, q6]);

    // Process OA
    const oa: Record<string, { ligacoes: number; aproveitados: number; whatsapps: number }> = {};
    teamUserIds.forEach(uid => { oa[uid] = { ligacoes: 0, aproveitados: 0, whatsapps: 0 }; });
    (r1.data || []).forEach((t: any) => {
      if (!oa[t.corretor_id]) oa[t.corretor_id] = { ligacoes: 0, aproveitados: 0, whatsapps: 0 };
      oa[t.corretor_id].ligacoes++;
      if (t.resultado === "com_interesse") oa[t.corretor_id].aproveitados++;
      if (t.canal === "whatsapp") oa[t.corretor_id].whatsapps++;
    });
    setOaData(oa);

    // Process Pipeline
    const descarteStageIds = new Set(Object.entries(stageMap).filter(([_, tipo]) => tipo === "descarte").map(([id]) => id));
    const pipeline: Record<string, Record<string, number>> = {};
    teamUserIds.forEach(uid => { pipeline[uid] = {}; PIPELINE_STAGES.forEach(s => { pipeline[uid][s.key] = 0; }); });
    (r2.data || []).forEach((l: any) => {
      if (descarteStageIds.has(l.stage_id)) return;
      const tipo = stageMap[l.stage_id];
      if (pipeline[l.corretor_id] && tipo) pipeline[l.corretor_id][tipo] = (pipeline[l.corretor_id][tipo] || 0) + 1;
    });
    setPipelineData(pipeline);

    // Process Negócios
    const neg: Record<string, { count: number; vgv: number }[]> = {};
    teamUserIds.forEach(uid => { neg[uid] = NEGOCIO_FASES.map(() => ({ count: 0, vgv: 0 })); });
    (r3.data || []).forEach((n: any) => {
      const uid = n.corretor_id;
      if (!neg[uid]) return;
      const idx = NEGOCIO_FASES.findIndex(f => f.key === n.fase);
      if (idx >= 0) { neg[uid][idx].count++; neg[uid][idx].vgv += Number(n.vgv_final || n.vgv_estimado || 0); }
    });
    setNegociosData(neg);

    setVisitasHoje((r4.data || []).map((v: any) => ({ corretor_id: v.corretor_id, status: v.status || "agendada", empreendimento: v.empreendimento, hora: v.horario })));

    // Negócios parados
    const now = new Date();
    const parados = (r5.data || []).map((n: any) => {
      const lastUpdate = n.fase_changed_at || n.updated_at;
      const dias = lastUpdate ? differenceInDays(now, new Date(lastUpdate)) : 999;
      return { ...n, diasParado: dias };
    }).filter(n => n.diasParado >= 5).sort((a, b) => b.diasParado - a.diasParado);
    setNegociosParados(parados);

    // Alerts
    const semContatoStageIds = new Set(Object.entries(stageMap).filter(([_, tipo]) => tipo === "novo_lead" || tipo === "sem_contato").map(([id]) => id));
    const leadsSemContatoList = (r6.data || []).filter((l: any) => semContatoStageIds.has(l.stage_id));
    const newAlerts: Alert[] = [];

    const semLigacao = teamUserIds.filter(uid => (oa[uid]?.ligacoes || 0) === 0);
    if (semLigacao.length > 0 && dateStr === format(new Date(), "yyyy-MM-dd")) {
      newAlerts.push({ id: "sem-ligacao", type: "warning", icon: "📵", message: `${semLigacao.map(uid => teamNameMap[uid]).join(", ")} ainda não fizeram ligações hoje`, action: { label: "Ver OA", route: "/oferta-ativa" } });
    }
    if (leadsSemContatoList.length > 0) {
      newAlerts.push({ id: "leads-sem-contato", type: "danger", icon: "🚨", message: `${leadsSemContatoList.length} leads sem contato há mais de 48h`, action: { label: "Ver Pipeline", route: "/pipeline-leads" } });
    }
    if (parados.length > 0) {
      newAlerts.push({ id: "negocios-parados", type: "warning", icon: "⏸️", message: `${parados.length} negócios parados há 5+ dias (VGV: ${fmtCurrency(parados.reduce((s, n) => s + Number(n.vgv_estimado || 0), 0))})`, action: { label: "Ver Negócios", route: "/negocios" } });
    }

    setAlerts(newAlerts);
    setLoading(false);
  }, [teamUserIds, user, dateStr, teamNameMap]);

  useEffect(() => { loadData(); }, [loadData]);

  // NO realtime subscriptions - removed to prevent infinite refresh

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Carregando...
      </div>
    );
  }

  // Totals
  const totalOA = Object.values(oaData).reduce((acc, v) => ({ ligacoes: acc.ligacoes + v.ligacoes, aproveitados: acc.aproveitados + v.aproveitados, whatsapps: acc.whatsapps + v.whatsapps }), { ligacoes: 0, aproveitados: 0, whatsapps: 0 });
  const totalPipelineByStage: Record<string, number> = {};
  PIPELINE_STAGES.forEach(s => { totalPipelineByStage[s.key] = 0; });
  Object.values(pipelineData).forEach(stages => { Object.entries(stages).forEach(([k, v]) => { totalPipelineByStage[k] = (totalPipelineByStage[k] || 0) + v; }); });
  const totalLeads = Object.values(totalPipelineByStage).reduce((a, b) => a + b, 0);
  const totalNegByFase = NEGOCIO_FASES.map((_, i) => Object.values(negociosData).reduce((acc, arr) => ({ count: acc.count + (arr[i]?.count || 0), vgv: acc.vgv + (arr[i]?.vgv || 0) }), { count: 0, vgv: 0 }));
  const totalNegCount = totalNegByFase.reduce((a, b) => a + b.count, 0);
  const totalVGV = totalNegByFase.reduce((a, b) => a + b.vgv, 0);
  const taxa = totalOA.ligacoes > 0 ? ((totalOA.aproveitados / totalOA.ligacoes) * 100).toFixed(0) : "0";
  const sortedTeam = [...teamUserIds].sort((a, b) => (oaData[b]?.ligacoes || 0) - (oaData[a]?.ligacoes || 0));
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const totalVisitasHoje = visitasHoje.length;
  const visitasRealizadas = visitasHoje.filter(v => v.status === "realizada").length;

  const DATA_TABS = [
    { key: "oa" as const, label: "Oferta Ativa", icon: <Phone size={13} />, badge: `${totalOA.ligacoes}` },
    { key: "leads" as const, label: "Gestão de Leads", icon: <BarChart3 size={13} />, badge: `${totalLeads}` },
    { key: "negocios" as const, label: "Gestão de Negócios", icon: <Briefcase size={13} />, badge: `${totalNegCount}` },
  ];

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft size={14} />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[140px] justify-center gap-2 font-medium text-xs h-8">
              <CalendarIcon size={12} /> {dateFmt}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight size={14} />
        </Button>
        {!isToday && (
          <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
        )}
        {isToday && (
          <span className="ml-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> TEMPO REAL
          </span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto text-[10px] h-7 gap-1" onClick={() => loadData()}>
          <Zap size={11} /> Atualizar
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map(alert => (
            <div key={alert.id} className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs",
              alert.type === "danger" && "bg-destructive/8 border-destructive/20",
              alert.type === "warning" && "bg-amber-500/8 border-amber-500/20",
              alert.type === "info" && "bg-blue-500/8 border-blue-500/20",
            )}>
              <span>{alert.icon}</span>
              <p className="flex-1 font-medium text-foreground">{alert.message}</p>
              {alert.action && (
                <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1 shrink-0" onClick={() => navigate(alert.action!.route)}>
                  {alert.action.label} <ExternalLink size={10} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <MiniCard icon={<Phone size={16} />} label={isToday ? "Ligações Hoje" : `Ligações`} value={totalOA.ligacoes} accent="text-blue-600 bg-blue-500/10" onClick={() => navigate("/oferta-ativa")} />
        <MiniCard icon={<UserCheck size={16} />} label="Aproveitados" value={totalOA.aproveitados} sub={`${taxa}%`} accent="text-emerald-600 bg-emerald-500/10" />
        <MiniCard icon={<Users size={16} />} label="Leads" value={totalLeads} accent="text-primary bg-primary/10" onClick={() => navigate("/pipeline-leads")} />
        <MiniCard icon={<Briefcase size={16} />} label="Negócios" value={totalNegCount} sub={fmtCurrency(totalVGV)} accent="text-amber-600 bg-amber-500/10" onClick={() => navigate("/pipeline-negocios")} />
        <MiniCard icon={<MapPin size={16} />} label="Visitas" value={totalVisitasHoje} sub={`${visitasRealizadas} realiz.`} accent="text-purple-600 bg-purple-500/10" onClick={() => navigate("/agenda-visitas")} />
      </div>

      {/* Tabbed Data Card - OA / Leads / Negócios */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
        <div className="flex border-b border-border">
          {DATA_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setDataTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all border-b-2",
                dataTab === tab.key
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {tab.icon} {tab.label}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                dataTab === tab.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>{tab.badge}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {dataTab === "oa" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Corretor</th>
                  <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Ligações</th>
                  <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Aproveit.</th>
                  <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Taxa</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground min-w-[100px]">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeam.map(uid => {
                  const d = oaData[uid] || { ligacoes: 0, aproveitados: 0, whatsapps: 0 };
                  const t = d.ligacoes > 0 ? ((d.aproveitados / d.ligacoes) * 100).toFixed(0) : "0";
                  const prog = Math.min(100, Math.round((d.ligacoes / 30) * 100));
                  return (
                    <tr key={uid} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                      <td className="px-2 py-2 text-center font-bold text-foreground">{d.ligacoes}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={cn("font-bold", d.aproveitados > 0 ? "text-emerald-600" : "text-muted-foreground/40")}>{d.aproveitados}</span>
                      </td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{t}%</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", prog >= 100 ? "bg-emerald-500" : prog >= 50 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${prog}%` }} />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-7 text-right">{prog}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {dataTab === "leads" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Corretor</th>
                  {PIPELINE_STAGES.map(s => (
                    <th key={s.key} className="px-1 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap">
                      <span className="block text-[9px]">{s.emoji}</span>
                      <span className="block text-[10px]">{s.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeam.map(uid => {
                  const stages = pipelineData[uid] || {};
                  const total = Object.values(stages).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={uid} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                      {PIPELINE_STAGES.map(s => (
                        <td key={s.key} className="px-1 py-2 text-center">
                          <span className={cn("font-bold", (stages[s.key] || 0) > 0 ? "text-foreground" : "text-muted-foreground/30")}>{stages[s.key] || 0}</span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-bold text-primary">{total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-bold border-t border-border">
                  <td className="px-3 py-2 text-foreground">TOTAL</td>
                  {PIPELINE_STAGES.map(s => (
                    <td key={s.key} className="px-1 py-2 text-center text-foreground">{totalPipelineByStage[s.key] || 0}</td>
                  ))}
                  <td className="px-2 py-2 text-center text-primary">{totalLeads}</td>
                </tr>
              </tbody>
            </table>
          )}

          {dataTab === "negocios" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Corretor</th>
                  {NEGOCIO_FASES.map(f => (
                    <th key={f.key} className="px-1.5 py-2 text-center font-semibold text-muted-foreground">
                      <span className="block text-[10px]">{f.label}</span>
                      <span className="block text-[8px] text-muted-foreground/60 font-normal">qtd · VGV</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold text-muted-foreground">VGV Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeam.map(uid => {
                  const arr = negociosData[uid] || NEGOCIO_FASES.map(() => ({ count: 0, vgv: 0 }));
                  const totalVgvCorr = arr.reduce((a, b) => a + b.vgv, 0);
                  return (
                    <tr key={uid} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground">{teamNameMap[uid] || "Corretor"}</td>
                      {arr.map((cell, i) => (
                        <td key={i} className="px-1.5 py-2 text-center">
                          <span className={cn("font-bold", cell.count > 0 ? "text-foreground" : "text-muted-foreground/30")}>{cell.count}</span>
                          {cell.vgv > 0 && <span className="block text-[9px] text-muted-foreground">{fmtCurrency(cell.vgv)}</span>}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-bold text-emerald-600">{totalVgvCorr > 0 ? fmtCurrency(totalVgvCorr) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-bold border-t border-border">
                  <td className="px-3 py-2 text-foreground">TOTAL</td>
                  {totalNegByFase.map((cell, i) => (
                    <td key={i} className="px-1.5 py-2 text-center">
                      <span className="text-foreground">{cell.count}</span>
                      {cell.vgv > 0 && <span className="block text-[9px] text-muted-foreground">{fmtCurrency(cell.vgv)}</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-emerald-600">{fmtCurrency(totalVGV)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Visitas do dia */}
      {visitasHoje.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 text-xs">
              <MapPin size={14} className="text-purple-500" />
              <span className="font-semibold text-foreground">Visitas {isToday ? "Hoje" : dateFmt}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 font-medium">{totalVisitasHoje} agendadas · {visitasRealizadas} realizadas</span>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => navigate("/agenda-visitas")}>
              Abrir Agenda <ExternalLink size={10} />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-2.5">
            {visitasHoje.map((v, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                <div className={cn("h-2 w-2 rounded-full shrink-0", v.status === "realizada" ? "bg-emerald-500" : v.status === "cancelada" ? "bg-destructive" : "bg-amber-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{teamNameMap[v.corretor_id] || "Corretor"}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{v.empreendimento || "—"} {v.hora ? `· ${v.hora}` : ""}</p>
                </div>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", v.status === "realizada" ? "bg-emerald-500/15 text-emerald-700" : v.status === "cancelada" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700")}>
                  {v.status === "realizada" ? "Realiz." : v.status === "cancelada" ? "Cancel." : "Agendada"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Negócios Parados */}
      {negociosParados.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle size={14} className="text-destructive" />
              <span className="font-semibold text-foreground">Negócios Parados ({negociosParados.length})</span>
              <span className="text-[10px] text-muted-foreground">5+ dias sem movimentação</span>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={() => navigate("/negocios")}>
              Ver Negócios <ExternalLink size={10} />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 p-2.5">
            {negociosParados.slice(0, 9).map(n => (
              <div key={n.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{n.nome_cliente || "Sem nome"}</p>
                  <p className="text-[9px] text-muted-foreground">{teamNameMap[n.corretor_id] || "—"} · {n.empreendimento || "—"} · {n.fase}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-destructive">{n.diasParado}d</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({ icon, label, value, sub, accent, onClick }: { icon: React.ReactNode; label: string; value: number; sub?: string; accent: string; onClick?: () => void }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-3 shadow-card", onClick && "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all")} onClick={onClick}>
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>{icon}</div>
        <div>
          <p className="text-lg font-display font-extrabold text-foreground leading-tight">{value}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
