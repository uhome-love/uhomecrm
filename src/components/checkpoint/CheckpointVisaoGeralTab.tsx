import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, UserCheck, MapPin, Users, TrendingUp, Briefcase, BarChart3, Eye, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export default function CheckpointVisaoGeralTab({ teamUserIds, teamNameMap }: Props) {
  const { user } = useAuth();
  const [oaData, setOaData] = useState<Record<string, { ligacoes: number; aproveitados: number; whatsapps: number }>>({});
  const [pipelineData, setPipelineData] = useState<Record<string, Record<string, number>>>({});
  const [negociosData, setNegociosData] = useState<Record<string, { count: number; vgv: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dateFmt = format(selectedDate, "dd/MM/yyyy");

  const loadData = useCallback(async () => {
    if (teamUserIds.length === 0) return;
    setLoading(true);

    const [{ data: tentativas }, { data: pipelineLeads }, { data: negocios }] = await Promise.all([
      // OA do dia
      supabase
        .from("oferta_ativa_tentativas")
        .select("corretor_id, resultado, canal")
        .in("corretor_id", teamUserIds)
        .gte("created_at", `${dateStr}T00:00:00`)
        .lte("created_at", `${dateStr}T23:59:59`),
      // Pipeline leads ativos
      supabase
        .from("pipeline_leads")
        .select("corretor_id, stage")
        .in("corretor_id", teamUserIds)
        .not("stage", "eq", "descarte")
        .eq("aceite_status", "aceito"),
      // Negócios ativos
      supabase
        .from("negocios")
        .select("corretor_id, fase, vgv_estimado, vgv_final")
        .eq("gerente_id", user!.id)
        .not("fase", "in", "(perdido,cancelado)"),
    ]);

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

    // Process Pipeline
    const pipeline: Record<string, Record<string, number>> = {};
    teamUserIds.forEach(uid => {
      pipeline[uid] = {};
      PIPELINE_STAGES.forEach(s => { pipeline[uid][s.key] = 0; });
    });
    (pipelineLeads || []).forEach((l: any) => {
      if (pipeline[l.corretor_id] && l.stage) {
        pipeline[l.corretor_id][l.stage] = (pipeline[l.corretor_id][l.stage] || 0) + 1;
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

    setLoading(false);
  }, [teamUserIds, user, dateStr]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-3" />
        Carregando visão do time...
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

  return (
    <div className="space-y-6">
      {/* ═══ HEADER CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Phone size={18} />} label="Ligações Hoje" value={totalOA.ligacoes} accent="text-blue-600 bg-blue-500/10" />
        <SummaryCard icon={<UserCheck size={18} />} label="Aproveitados" value={totalOA.aproveitados} sub={`${taxa}% taxa`} accent="text-emerald-600 bg-emerald-500/10" />
        <SummaryCard icon={<Users size={18} />} label="Leads no Pipeline" value={totalLeads} accent="text-primary bg-primary/10" />
        <SummaryCard icon={<Briefcase size={18} />} label="Negócios Ativos" value={totalNegCount} sub={fmtCurrency(totalVGV)} accent="text-amber-600 bg-amber-500/10" />
      </div>

      {/* ═══ BLOCO 1: OA DO TIME ═══ */}
      <Section icon={<Phone size={16} />} title="Oferta Ativa — Hoje" badge={`${totalOA.ligacoes} ligações`}>
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
      <Section icon={<BarChart3 size={16} />} title="Gestão de Leads — Pipeline" badge={`${totalLeads} leads ativos`}>
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
              {/* Total row */}
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
      <Section icon={<Briefcase size={16} />} title="Gestão de Negócios" badge={`${totalNegCount} negócios · ${fmtCurrency(totalVGV)}`}>
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
              {/* Total row */}
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
    </div>
  );
}

// ─── Subcomponents ───

function SummaryCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card">
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

function Section({ icon, title, badge, children }: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-foreground">
          {icon} {title}
        </h3>
        {badge && (
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
