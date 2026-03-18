import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, Award, MapPin, Target, AlertTriangle, TrendingDown, ArrowDown, Trophy } from "lucide-react";
import ManagerKpiDetailDialog, { type ManagerKpiType } from "./ManagerKpiDetailDialog";
import { format, subDays } from "date-fns";
import { formatBRLCompact } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtR = formatBRLCompact;

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

interface CorretorData {
  nome: string;
  ligacoes: number;
  aproveitados: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  propostas: number;
  vgv: number;
}

interface FunnelStep {
  label: string;
  count: number;
  pct: number;
}

interface RelatorioData {
  periodo: string;
  total_ligacoes: number;
  total_aproveitados: number;
  taxa_aproveitamento: number;
  total_visitas_marcadas: number;
  total_visitas_realizadas: number;
  vgv_gerado: number;
  vgv_assinado: number;
  total_negocios: number;
  total_propostas: number;
  por_corretor: CorretorData[];
  funil: FunnelStep[];
}

export default function RelatoriosTab({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes">("semana");
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [activeSection, setActiveSection] = useState<"performance" | "conversao" | "ranking">("performance");
  const [kpiDetail, setKpiDetail] = useState<{ type: ManagerKpiType; label: string } | null>(null);

  const kpiDateRange = useMemo(() => {
    const hoje = new Date();
    let inicio: Date;
    if (periodo === "hoje") inicio = hoje;
    else if (periodo === "semana") inicio = subDays(hoje, 7);
    else inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { start: format(inicio, "yyyy-MM-dd"), end: format(hoje, "yyyy-MM-dd") };
  }, [periodo]);

  const load = useCallback(async () => {
    if (!user || teamUserIds.length === 0) return;
    const hoje = new Date();
    let inicio: Date;
    if (periodo === "hoje") inicio = hoje;
    else if (periodo === "semana") inicio = subDays(hoje, 7);
    else inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const inicioStr = format(inicio, "yyyy-MM-dd");
    const fimStr = format(hoje, "yyyy-MM-dd");

    // Build queries with proper date filters
    const tentQuery = supabase.from("oferta_ativa_tentativas")
      .select("corretor_id, resultado")
      .in("corretor_id", teamUserIds)
      .gte("created_at", `${inicioStr}T00:00:00`)
      .lte("created_at", `${fimStr}T23:59:59`);

    const visQuery = supabase.from("visitas")
      .select("corretor_id, status")
      .in("corretor_id", teamUserIds)
      .gte("data_visita", inicioStr)
      .lte("data_visita", fimStr);

    const negQuery = supabase.from("negocios")
      .select("corretor_id, auth_user_id, vgv_estimado, vgv_final, fase, data_assinatura, created_at")
      .or(teamUserIds.map(id => `corretor_id.eq.${id},auth_user_id.eq.${id}`).join(","))
      .gte("created_at", `${inicioStr}T00:00:00`)
      .lte("created_at", `${fimStr}T23:59:59`);

    const pipelineQuery = supabase.from("pipeline_leads")
      .select("corretor_id, stage_id")
      .in("corretor_id", teamUserIds)
      .gte("created_at", `${inicioStr}T00:00:00`)
      .lte("created_at", `${fimStr}T23:59:59`);

    const [{ data: tent }, { data: vis }, { data: neg }, { data: pipelineLeads }] = await Promise.all([
      tentQuery, visQuery, negQuery, pipelineQuery,
    ]);

    // Load stage definitions
    const { data: stagesDef } = await supabase.from("pipeline_stages").select("id, tipo").eq("ativo", true).eq("pipeline_tipo", "leads");
    const stageTypeMap: Record<string, string> = {};
    (stagesDef || []).forEach((s: any) => { stageTypeMap[s.id] = s.tipo; });

    // Count pipeline leads by stage type
    const pipelineCounts: Record<string, number> = {};
    (pipelineLeads || []).forEach((l: any) => {
      const tipo = stageTypeMap[l.stage_id];
      if (tipo && tipo !== "descarte") pipelineCounts[tipo] = (pipelineCounts[tipo] || 0) + 1;
    });

    const ligMap: Record<string, number> = {};
    const aprovMap: Record<string, number> = {};
    tent?.forEach(t => { ligMap[t.corretor_id] = (ligMap[t.corretor_id] || 0) + 1; if (t.resultado === "com_interesse") aprovMap[t.corretor_id] = (aprovMap[t.corretor_id] || 0) + 1; });

    const vrMap: Record<string, number> = {};
    const vmMap: Record<string, number> = {};
    vis?.forEach(v => { if (v.corretor_id) { vmMap[v.corretor_id] = (vmMap[v.corretor_id] || 0) + 1; if (v.status === "realizada") vrMap[v.corretor_id] = (vrMap[v.corretor_id] || 0) + 1; } });

    const propMap: Record<string, number> = {};
    const vgvMap: Record<string, number> = {};
    let vgvGerado = 0, vgvAssinado = 0, totalNegocios = 0, totalPropostas = 0;
    neg?.forEach(n => {
      totalNegocios++;
      const cId = n.corretor_id || n.auth_user_id;
      if (cId && teamUserIds.includes(cId)) {
        propMap[cId] = (propMap[cId] || 0) + 1;
        if (n.fase === "assinado" || n.fase === "vendido") {
          vgvMap[cId] = (vgvMap[cId] || 0) + Number(n.vgv_final || n.vgv_estimado || 0);
        }
      }
      vgvGerado += Number(n.vgv_estimado ?? 0);
      if (n.fase === "assinado" || n.fase === "vendido") { vgvAssinado += Number(n.vgv_final || n.vgv_estimado || 0); }
      if (["proposta", "negociacao", "documentacao", "assinado", "vendido"].includes(n.fase || "")) totalPropostas++;
    });

    const totalLig = Object.values(ligMap).reduce((a, b) => a + b, 0);
    const totalAprov = Object.values(aprovMap).reduce((a, b) => a + b, 0);
    const totalVM = Object.values(vmMap).reduce((a, b) => a + b, 0);
    const totalVR = Object.values(vrMap).reduce((a, b) => a + b, 0);

    // Build funnel
    const totalPipelineLeads = Object.values(pipelineCounts).reduce((a, b) => a + b, 0);
    const contatoIniciado = (pipelineCounts["contato_iniciado"] || 0) + (pipelineCounts["qualificacao"] || 0) + (pipelineCounts["possivel_visita"] || 0) + (pipelineCounts["visita_marcada"] || 0) + (pipelineCounts["visita_realizada"] || 0);
    const assinadoCount = (neg || []).filter(n => n.fase === "assinado").length;

    const funnelRaw = [
      { label: "Leads Recebidos", count: totalPipelineLeads },
      { label: "Contato Iniciado", count: contatoIniciado },
      { label: "Visita Marcada", count: totalVM },
      { label: "Visita Realizada", count: totalVR },
      { label: "Negócio Criado", count: totalNegocios },
      { label: "Proposta", count: totalPropostas },
      { label: "Assinado", count: assinadoCount },
    ];
    const funil: FunnelStep[] = funnelRaw.map((step, i) => ({
      ...step,
      pct: i === 0 ? 100 : (funnelRaw[i - 1].count > 0 ? Math.round((step.count / funnelRaw[i - 1].count) * 100) : 0),
    }));

    setRelatorio({
      periodo: `${format(inicio, "dd/MM")} a ${format(hoje, "dd/MM/yyyy")}`,
      total_ligacoes: totalLig,
      total_aproveitados: totalAprov,
      taxa_aproveitamento: pct(totalAprov, totalLig),
      total_visitas_marcadas: totalVM,
      total_visitas_realizadas: totalVR,
      vgv_gerado: vgvGerado,
      vgv_assinado: vgvAssinado,
      total_negocios: totalNegocios,
      total_propostas: totalPropostas,
      por_corretor: teamUserIds.map(id => ({
        nome: teamNameMap[id] || "Corretor",
        ligacoes: ligMap[id] ?? 0,
        aproveitados: aprovMap[id] ?? 0,
        visitas_marcadas: vmMap[id] ?? 0,
        visitas_realizadas: vrMap[id] ?? 0,
        propostas: propMap[id] ?? 0,
        vgv: vgvMap[id] ?? 0,
      })).sort((a, b) => b.ligacoes - a.ligacoes),
      funil,
    });
  }, [user, periodo, teamUserIds, teamNameMap]);

  useEffect(() => { load(); }, [load]);

  const sections = [
    { key: "performance" as const, label: "📊 Performance" },
    { key: "conversao" as const, label: "🔄 Conversão" },
    { key: "ranking" as const, label: "🏆 Ranking" },
  ];

  return (
    <>
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                activeSection === s.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={periodo} onChange={e => setPeriodo(e.target.value as any)} className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:border-primary/50">
            <option value="hoje">Hoje</option>
            <option value="semana">Última Semana</option>
            <option value="mes">Este Mês</option>
          </select>
          {relatorio && <span className="text-[10px] text-muted-foreground">{relatorio.periodo}</span>}
        </div>
      </div>

      {!relatorio ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
          Carregando...
        </div>
      ) : (
        <>
          {/* ═══ PERFORMANCE ═══ */}
          {activeSection === "performance" && (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Ligações", value: fmt(relatorio.total_ligacoes), sub: `${relatorio.taxa_aproveitamento}% aproveitamento`, icon: <Phone size={16} className="text-blue-500" />, accent: "bg-blue-500/10", kpiType: "ligacoes" as ManagerKpiType },
                  { label: "Aproveitados", value: fmt(relatorio.total_aproveitados), sub: `de ${fmt(relatorio.total_ligacoes)} tentativas`, icon: <Award size={16} className="text-emerald-500" />, accent: "bg-emerald-500/10", kpiType: "aproveitados" as ManagerKpiType },
                  { label: "Visitas", value: `${relatorio.total_visitas_realizadas}/${relatorio.total_visitas_marcadas}`, sub: "realizadas/marcadas", icon: <MapPin size={16} className="text-amber-500" />, accent: "bg-amber-500/10", kpiType: "visitas" as ManagerKpiType },
                  { label: "VGV Assinado", value: fmtR(relatorio.vgv_assinado), sub: `Gerado: ${fmtR(relatorio.vgv_gerado)}`, icon: <Target size={16} className="text-purple-500" />, accent: "bg-purple-500/10", kpiType: "vgv" as ManagerKpiType },
                ].map(card => (
                  <div
                    key={card.label}
                    onClick={() => setKpiDetail({ type: card.kpiType, label: card.label })}
                    className="border border-border rounded-xl p-4 bg-card cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${card.accent}`}>{card.icon}</div>
                      <span className="text-xs text-muted-foreground">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Desempenho por Corretor */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Desempenho por Corretor</h3>
                <TooltipProvider>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Corretor</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Ligações</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Aprov.</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Taxa</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Vis.M</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Vis.R</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">Negócios</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground">VGV</th>
                          <th className="text-center py-2.5 px-2 font-semibold text-muted-foreground w-12">⚡</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.por_corretor.map((c, i) => {
                          const taxa = pct(c.aproveitados, c.ligacoes);
                          const isMvp = i === 0 && c.ligacoes > 0;
                          const noActivity = c.ligacoes === 0 && c.aproveitados === 0 && c.visitas_realizadas === 0;

                          return (
                            <tr key={c.nome} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-foreground">
                                <span className="text-muted-foreground text-[10px] mr-2">#{i + 1}</span>
                                {c.nome}
                                {isMvp && <Badge variant="outline" className="ml-2 text-[9px] bg-amber-500/10 text-amber-700 border-amber-200">🏆 MVP</Badge>}
                                {noActivity && <Badge variant="outline" className="ml-2 text-[9px] bg-destructive/10 text-destructive border-destructive/20">⚠️ Sem atividade</Badge>}
                              </td>
                              <td className="text-center py-2.5 font-bold text-blue-600">{c.ligacoes}</td>
                              <td className="text-center py-2.5 font-bold text-emerald-600">{c.aproveitados}</td>
                              <td className="text-center py-2.5">
                                <span className={`font-bold ${taxa >= 10 ? "text-emerald-600" : taxa > 0 ? "text-amber-600" : "text-muted-foreground/40"}`}>
                                  {taxa}%
                                </span>
                              </td>
                              <td className="text-center py-2.5 text-foreground">{c.visitas_marcadas}</td>
                              <td className="text-center py-2.5 text-amber-600">{c.visitas_realizadas}</td>
                              <td className="text-center py-2.5 text-purple-600">{c.propostas}</td>
                              <td className="text-center py-2.5 font-medium text-foreground">{c.vgv > 0 ? fmtR(c.vgv) : "—"}</td>
                              <td className="text-center py-2.5">
                                {c.visitas_realizadas > 0 && c.ligacoes < c.visitas_realizadas && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertTriangle size={13} className="text-amber-500 mx-auto" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-[200px]">
                                      Visitas sem ligações correspondentes
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {relatorio.por_corretor.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-border bg-muted/30">
                            <td className="py-2.5 px-3 font-semibold text-muted-foreground">Média do Time</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{Math.round(relatorio.total_ligacoes / relatorio.por_corretor.length)}</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{Math.round(relatorio.total_aproveitados / relatorio.por_corretor.length)}</td>
                            <td className="text-center py-2.5 font-bold text-muted-foreground">{relatorio.taxa_aproveitamento}%</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{Math.round(relatorio.total_visitas_marcadas / relatorio.por_corretor.length)}</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{Math.round(relatorio.total_visitas_realizadas / relatorio.por_corretor.length)}</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{Math.round(relatorio.por_corretor.reduce((a, c) => a + c.propostas, 0) / relatorio.por_corretor.length)}</td>
                            <td className="text-center py-2.5 font-medium text-muted-foreground">{fmtR(Math.round(relatorio.por_corretor.reduce((a, c) => a + c.vgv, 0) / relatorio.por_corretor.length))}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </TooltipProvider>
              </div>
            </div>
          )}

          {/* ═══ CONVERSÃO ═══ */}
          {activeSection === "conversao" && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-foreground">Funil de Conversão do Time</h3>

              {/* Funnel visualization */}
              <div className="space-y-1">
                {relatorio.funil.map((step, i) => {
                  const maxCount = Math.max(...relatorio.funil.map(s => s.count), 1);
                  const barW = Math.max(12, (step.count / maxCount) * 100);
                  const colors = [
                    "bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-teal-500",
                    "bg-amber-500", "bg-orange-500", "bg-emerald-500",
                  ];
                  const convColor = step.pct >= 50 ? "text-emerald-600" : step.pct >= 20 ? "text-amber-600" : "text-destructive";

                  return (
                    <div key={step.label}>
                      {i > 0 && (
                        <div className="flex items-center gap-2 py-0.5 pl-[120px]">
                          <ArrowDown size={10} className="text-muted-foreground/40" />
                          <span className={`text-[10px] font-bold ${convColor}`}>
                            {step.pct}% conversão
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-[110px] shrink-0 text-right">
                          <p className="text-[11px] font-medium text-muted-foreground">{step.label}</p>
                        </div>
                        <div className="flex-1 h-8 bg-accent/30 rounded-lg overflow-hidden relative">
                          <div
                            className={`h-full rounded-lg flex items-center px-3 transition-all duration-500 ${colors[i % colors.length]}`}
                            style={{ width: `${barW}%`, minWidth: "40px" }}
                          >
                            <span className="text-xs font-bold text-white drop-shadow-sm">{step.count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Conversion summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border">
                {[
                  { label: "Lead → Contato", value: `${pct(relatorio.funil[1]?.count || 0, relatorio.funil[0]?.count || 1)}%` },
                  { label: "Contato → Visita", value: `${pct(relatorio.total_visitas_marcadas, relatorio.funil[1]?.count || 1)}%` },
                  { label: "Visita → Negócio", value: `${pct(relatorio.total_negocios, relatorio.total_visitas_realizadas || 1)}%` },
                  { label: "Negócio → Venda", value: `${pct((relatorio.funil[6]?.count || 0), relatorio.total_negocios || 1)}%` },
                ].map(c => (
                  <div key={c.label} className="border border-border rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                    <p className="text-xl font-bold text-foreground">{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ RANKING ═══ */}
          {activeSection === "ranking" && (
            <div className="space-y-5">
              {/* Ranking cards by category */}
              {[
                { title: "📞 Ranking por Ligações", sortKey: "ligacoes" as const, format: (v: number) => `${v} ligações` },
                { title: "✅ Ranking por Aproveitamento", sortKey: "aproveitados" as const, format: (v: number) => `${v} aproveitados` },
                { title: "🏠 Ranking por Visitas", sortKey: "visitas_realizadas" as const, format: (v: number) => `${v} visitas` },
                { title: "💰 Ranking por VGV", sortKey: "vgv" as const, format: (v: number) => fmtR(v) },
              ].map(category => {
                const sorted = [...relatorio.por_corretor].sort((a, b) => b[category.sortKey] - a[category.sortKey]);
                const medals = ["🥇", "🥈", "🥉"];

                return (
                  <div key={category.sortKey} className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                      <h4 className="text-xs font-semibold text-foreground">{category.title}</h4>
                    </div>
                    <div className="divide-y divide-border/50">
                      {sorted.map((c, i) => {
                        const value = c[category.sortKey];
                        const maxVal = sorted[0]?.[category.sortKey] || 1;
                        const barPct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;

                        return (
                          <div key={c.nome} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                            <span className="text-sm w-6 text-center shrink-0">
                              {i < 3 ? medals[i] : <span className="text-[10px] text-muted-foreground">#{i + 1}</span>}
                            </span>
                            <span className="text-xs font-medium text-foreground w-28 truncate">{c.nome}</span>
                            <div className="flex-1 h-2 bg-accent/40 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-blue-400" : i === 2 ? "bg-orange-400" : "bg-muted-foreground/30"}`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold shrink-0 ${value > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                              {category.format(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>

      <ManagerKpiDetailDialog
        open={!!kpiDetail}
        onOpenChange={(o) => { if (!o) setKpiDetail(null); }}
        type={kpiDetail?.type || "ligacoes"}
        label={kpiDetail?.label || ""}
        teamUserIds={teamUserIds}
        teamNameMap={teamNameMap}
        dateRange={kpiDateRange}
      />
    </>
  );
}
