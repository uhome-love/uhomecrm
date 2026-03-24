import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Users, Phone, Inbox, Activity,
  CalendarDays, CalendarCheck, Briefcase, TrendingUp, FileSignature, DollarSign,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { format, getISOWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBRLCompact } from "@/lib/utils";
import {
  useRelatorioExecutivo,
  useUserScope,
  getPeriodRange,
  type PeriodMode,
  type ExecutiveKpis,
  type CorretorRow,
  type TeamRow,
} from "@/hooks/useRelatorioExecutivo";
import ExecutiveKpiDetailDialog, { type ExecKpiType } from "@/components/relatorio/ExecutiveKpiDetailDialog";

/* ── Apple-inspired inline styles (Light theme) ── */
const appleFont = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;
const appleCurve = "0.25, 0.46, 0.45, 0.94";
const fadeUpStyle = (i: number): React.CSSProperties => ({
  opacity: 0,
  animation: `appleCardFadeUp 0.4s cubic-bezier(${appleCurve}) ${i * 0.05}s forwards`,
});

// ── KPI Card Config ──
const KPI_CONFIG: { key: keyof ExecutiveKpis; label: string; icon: any; color: string; isCurrency?: boolean }[] = [
  { key: "presencas", label: "Presenças", icon: Users, color: "#5e9eff" },
  { key: "ligacoes", label: "Ligações", icon: Phone, color: "#7c7aff" },
  { key: "leadsRecebidos", label: "Leads Recebidos", icon: Inbox, color: "#5ac8fa" },
  { key: "leadsAtivos", label: "Leads Ativos", icon: Activity, color: "#34c759" },
  { key: "visitasMarcadas", label: "Visitas Marcadas", icon: CalendarDays, color: "#ff9f0a" },
  { key: "visitasRealizadas", label: "Visitas Realizadas", icon: CalendarCheck, color: "#30d158" },
  { key: "negociosCriados", label: "Negócios Criados", icon: Briefcase, color: "#af52de" },
  { key: "negociosGerados", label: "Negócios Gerados", icon: TrendingUp, color: "#ff6723" },
  { key: "negociosAssinados", label: "Negócios Assinados", icon: FileSignature, color: "#30d158" },
  { key: "vgvTotal", label: "VGV Total", icon: DollarSign, color: "#30d158", isCurrency: true },
];

// ── Variation Badge ──
function VarBadge({ pctChange, periodLabel }: { pctChange: number; periodLabel: string }) {
  if (pctChange === 0) return null;
  const up = pctChange > 0;
  return (
    <span
      className="text-xs font-semibold flex items-center gap-0.5 mt-1"
      style={{ color: up ? "#30d158" : "#ff453a", letterSpacing: "0.1px" }}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pctChange)}% {periodLabel}
    </span>
  );
}

// ── Sort helpers ──
type SortKey = keyof CorretorRow;

// ── Main Page ──
export default function RelatorioSemanal() {
  const { scope } = useUserScope();
  const [mode, setMode] = useState<PeriodMode>("semana");
  const [offset, setOffset] = useState(0);
  const period = useMemo(() => getPeriodRange(mode, offset), [mode, offset]);
  const { data, isLoading } = useRelatorioExecutivo(period);
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const isMobile = useIsMobile();

  // KPI detail dialog state
  const [kpiDetail, setKpiDetail] = useState<{ type: ExecKpiType; label: string } | null>(null);
  const kpiDateRange = useMemo(() => ({
    start: format(period.start, "yyyy-MM-dd"),
    end: format(period.end, "yyyy-MM-dd"),
  }), [period.start, period.end]);

  // Team/corretor filter
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCorretor, setSelectedCorretor] = useState<string>("all");

  // Ranking sort state
  const [sortKey, setSortKey] = useState<SortKey>("vgv");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (eq: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(eq) ? next.delete(eq) : next.add(eq);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Filter corretores by selected team or corretor
  const filteredCorretores = useMemo(() => {
    if (!data?.corretores) return [];
    let list = data.corretores;
    if (selectedTeam !== "all") list = list.filter(c => c.equipe === selectedTeam);
    if (selectedCorretor !== "all") list = list.filter(c => c.id === selectedCorretor);
    return list;
  }, [data?.corretores, selectedTeam, selectedCorretor]);

  const sortedCorretores = useMemo(() => {
    return [...filteredCorretores].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      if (typeof va === "string") return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filteredCorretores, sortKey, sortAsc]);

  // Filtered KPIs: recalculate from corretores when a team is selected
  const filteredKpis = useMemo(() => {
    if (!data?.kpis) return data?.kpis;
    if (selectedTeam === "all") return data.kpis;
    const cs = filteredCorretores;
    const sumPresencas = cs.reduce((s, c) => s + c.presencas, 0);
    const sumLigacoes = cs.reduce((s, c) => s + c.ligacoes, 0);
    const sumLeads = cs.reduce((s, c) => s + c.leads, 0);
    const sumVisMarcadas = cs.reduce((s, c) => s + c.visitasMarcadas, 0);
    const sumVisRealizadas = cs.reduce((s, c) => s + c.visitasRealizadas, 0);
    const sumNegCriados = cs.reduce((s, c) => s + c.negociosCriados, 0);
    const sumNegAssinados = cs.reduce((s, c) => s + c.negociosAssinados, 0);
    const sumVgv = cs.reduce((s, c) => s + c.vgv, 0);
    const mk = (cur: number) => ({ current: cur, prev: 0, pctChange: 0 });
    return {
      ...data.kpis,
      presencas: mk(sumPresencas),
      ligacoes: mk(sumLigacoes),
      leadsRecebidos: mk(sumLeads),
      visitasMarcadas: mk(sumVisMarcadas),
      visitasRealizadas: mk(sumVisRealizadas),
      negociosCriados: mk(sumNegCriados),
      negociosAssinados: mk(sumNegAssinados),
      vgvTotal: { ...mk(sumVgv), currentRaw: sumVgv, prevRaw: 0 },
    } as typeof data.kpis;
  }, [data?.kpis, selectedTeam, filteredCorretores]);

  // Find top performer for each column
  const topPerformers = useMemo(() => {
    if (!filteredCorretores.length) return {};
    const keys: SortKey[] = ["presencas", "ligacoes", "leads", "visitasMarcadas", "visitasRealizadas", "negociosCriados", "negociosAssinados", "vgv"];
    const result: Record<string, string> = {};
    keys.forEach(k => {
      const top = [...filteredCorretores].sort((a, b) => (b[k] as number) - (a[k] as number))[0];
      if (top && (top[k] as number) > 0) result[k] = top.id;
    });
    return result;
  }, [filteredCorretores]);

  const prevPeriodLabel = mode === "semana" ? "vs semana ant." : "vs mês ant.";

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdfFn = (mod.default || mod) as any;
      await html2pdfFn().set({
        margin: [8, 8, 8, 8],
        filename: `relatorio-executivo-${format(period.start, "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(reportRef.current.cloneNode(true)).save();
    } catch (e) {
      console.error("PDF error:", e);
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  const scopeLabel = scope === "admin" 
    ? (selectedTeam === "all" ? "Empresa" : selectedTeam)
    : scope === "gerente" ? "Minha Equipe" : "Meus Números";
  const teamOptions = useMemo(() => data?.teams?.map(t => t.equipe) || [], [data?.teams]);

  return (
    <div
      className="apple-report pb-8"
      style={{
        fontFamily: appleFont,
        padding: isMobile ? "16px" : "24px 32px",
        minHeight: "100vh",
        background: "#f0f0f5",
      }}
    >
      {/* Inject keyframes */}
      <style>{`
        @keyframes appleCardFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .apple-report * { box-sizing: border-box; }
        .apple-report ::-webkit-scrollbar { width: 6px; height: 6px; }
        .apple-report ::-webkit-scrollbar-track { background: transparent; }
        .apple-report ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
        .apple-glass-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .apple-glass-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .apple-glass-surface {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .apple-glass-highlight {
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .apple-pill {
          border-radius: 100px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
        }
        .apple-table th {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          color: rgba(0,0,0,0.4);
          padding: 10px 12px;
        }
        .apple-table td {
          font-size: 13px;
          padding: 10px 12px;
          color: rgba(0,0,0,0.8);
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .apple-table tr:hover td {
          background: rgba(0,0,0,0.02);
        }
        .apple-section-title {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.3px;
          color: rgba(0,0,0,0.88);
        }
        .apple-label {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.2px;
          text-transform: uppercase;
          color: rgba(0,0,0,0.45);
        }
        .apple-value {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: rgba(0,0,0,0.88);
        }
        .apple-period-btn {
          padding: 6px 16px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          color: rgba(0,0,0,0.45);
          cursor: pointer;
          border: none;
          background: transparent;
        }
        .apple-period-btn.active {
          background: rgba(255,255,255,0.95);
          color: rgba(0,0,0,0.88);
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .apple-period-btn:hover:not(.active) {
          color: rgba(0,0,0,0.65);
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8" style={fadeUpStyle(0)}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, color: "rgba(0,0,0,0.88)", lineHeight: 1.1 }}>
            Relatório Geral
          </h1>
          <p style={{ fontSize: 15, color: "rgba(0,0,0,0.45)", marginTop: 4, fontWeight: 400 }}>
            {scopeLabel} · Visão consolidada
          </p>
        </div>
        <button
          onClick={handlePDF}
          disabled={downloading}
          className="apple-glass-card flex items-center gap-2"
          style={{ padding: "8px 16px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,0.7)", cursor: "pointer" }}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF
        </button>
      </div>

      {/* ── Period Toggle + Navigation ── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8" style={fadeUpStyle(1)}>
        <div className="apple-glass-highlight flex items-center" style={{ borderRadius: 10, padding: 3 }}>
          <button
            onClick={() => { setMode("semana"); setOffset(0); }}
            className={`apple-period-btn ${mode === "semana" ? "active" : ""}`}
          >
            Semanal
          </button>
          <button
            onClick={() => { setMode("mes"); setOffset(0); }}
            className={`apple-period-btn ${mode === "mes" ? "active" : ""}`}
          >
            Mensal
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOffset(o => o - 1)}
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.5)", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", transition: `all 0.2s cubic-bezier(${appleCurve})` }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span
            className="apple-glass-highlight"
            style={{ padding: "6px 20px", borderRadius: 100, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.7)", minWidth: 200, textAlign: "center", display: "inline-block" }}
          >
            {period.label}
          </span>
          <button
            onClick={() => setOffset(o => o + 1)}
            disabled={offset >= 0}
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: offset >= 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.5)", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)", cursor: offset >= 0 ? "not-allowed" : "pointer", transition: `all 0.2s cubic-bezier(${appleCurve})` }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Filters */}
        {scope !== "corretor" && (data?.corretores?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 justify-center flex-wrap">
            {scope === "admin" && teamOptions.length > 0 && (
              <Select value={selectedTeam} onValueChange={(v) => { setSelectedTeam(v); setSelectedCorretor("all"); }}>
                <SelectTrigger className="w-[200px] bg-white border-black/10 text-black/70 rounded-lg">
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teamOptions.map(eq => (
                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger className="w-[220px] bg-white border-black/10 text-black/70 rounded-lg">
                <SelectValue placeholder="Todos os corretores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {(selectedTeam === "all" ? data?.corretores || [] : (data?.corretores || []).filter(c => c.equipe === selectedTeam))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div ref={reportRef} className="space-y-8">
        {/* ═══ BLOCO 1 — KPI Cards ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {KPI_CONFIG.map(({ key, label, icon: Icon, color, isCurrency }, i) => {
            const val = filteredKpis?.[key];
            return (
              <div
                key={key}
                onClick={() => !isLoading && key !== "leadsAtivos" && setKpiDetail({ type: key, label })}
                className={`apple-glass-card ${key !== "leadsAtivos" ? "cursor-pointer" : ""}`}
                style={{ ...fadeUpStyle(i + 2), padding: "20px 24px" }}
              >
                {isLoading ? (
                  <div className="space-y-3">
                    <div style={{ width: 80, height: 12, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
                    <div style={{ width: 48, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
                    <div style={{ width: 100, height: 10, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                          background: `${color}15`, border: `1px solid ${color}30`,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <span className="apple-label" style={{ fontSize: 11, textTransform: "uppercase" }}>{label}</span>
                    </div>
                    <p className="apple-value">
                      {isCurrency ? formatBRLCompact(val?.current ?? 0) : (val?.current ?? 0).toLocaleString("pt-BR")}
                    </p>
                    {key !== "leadsAtivos" && val && (
                      <VarBadge pctChange={val.pctChange} periodLabel={prevPeriodLabel} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ BLOCO 2 — Gráficos de Tendência ═══ */}
        {!isLoading && data?.dailyTrends && data.dailyTrends.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="apple-glass-surface" style={{ padding: 24, ...fadeUpStyle(12) }}>
              <h3 className="apple-section-title" style={{ fontSize: 17, marginBottom: 20 }}>Evolução Diária</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="diaLabel" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} stroke="rgba(0,0,0,0.08)" />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} stroke="rgba(0,0,0,0.08)" />
                  <RTooltip contentStyle={{ fontSize: 12, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, color: "#1d1d1f", backdropFilter: "blur(20px)", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }} />
                  <Line type="monotone" dataKey="ligacoes" name="Ligações" stroke="#7c7aff" strokeWidth={2} dot={{ r: 2, fill: "#7c7aff" }} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="#5ac8fa" strokeWidth={2} dot={{ r: 2, fill: "#5ac8fa" }} />
                  <Line type="monotone" dataKey="visitas" name="Visitas" stroke="#30d158" strokeWidth={2} dot={{ r: 2, fill: "#30d158" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="apple-glass-surface" style={{ padding: 24, ...fadeUpStyle(13) }}>
              <h3 className="apple-section-title" style={{ fontSize: 17, marginBottom: 20 }}>Leads × Visitas × Negócios</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="diaLabel" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} stroke="rgba(0,0,0,0.08)" />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} stroke="rgba(0,0,0,0.08)" />
                  <RTooltip contentStyle={{ fontSize: 12, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, color: "#1d1d1f", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }} />
                  <Bar dataKey="leads" name="Leads" fill="#5ac8fa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="visitas" name="Visitas" fill="#30d158" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="negocios" name="Negócios" fill="#af52de" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 2.5 — Visão por Equipe ═══ */}
        {!isLoading && data?.teams && data.teams.length > 0 && scope !== "corretor" && (
          <div className="apple-glass-surface overflow-hidden" style={fadeUpStyle(14)}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <h3 className="apple-section-title" style={{ fontSize: 17 }}>Visão por Equipe</h3>
              <p style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>Comparativo consolidado entre equipes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full apple-table">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <th className="text-left">Equipe</th>
                    <th className="text-center">Corretores</th>
                    <th className="text-center">Presenças</th>
                    <th className="text-center">Ligações</th>
                    <th className="text-center">Leads</th>
                    <th className="text-center">Vis.Marc.</th>
                    <th className="text-center">Vis.Real.</th>
                    <th className="text-center">Neg.Cri.</th>
                    <th className="text-center">Assinados</th>
                    <th className="text-right">VGV</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team) => (
                    <tr key={team.equipe}>
                      <td>
                        <span className="apple-pill" style={{ background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.7)", border: "1px solid rgba(0,0,0,0.08)" }}>
                          {team.equipe}
                        </span>
                      </td>
                      <td className="text-center" style={{ fontWeight: 500 }}>{team.corretores.length}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.presencas}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.ligacoes}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.leads}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.visitasMarcadas}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.visitasRealizadas}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.negociosCriados}</td>
                      <td className="text-center" style={{ fontWeight: 600 }}>{team.totals.negociosAssinados}</td>
                      <td className="text-right" style={{ fontWeight: 700, color: "#30d158" }}>{formatBRLCompact(team.totals.vgv)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ borderTop: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" }}>
                    <td style={{ fontWeight: 700, color: "rgba(0,0,0,0.88)" }}>Total</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.corretores.length, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.presencas, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.ligacoes, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.leads, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.visitasMarcadas, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.visitasRealizadas, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.negociosCriados, 0)}</td>
                    <td className="text-center" style={{ fontWeight: 700 }}>{data.teams.reduce((s, t) => s + t.totals.negociosAssinados, 0)}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: "#30d158" }}>{formatBRLCompact(data.teams.reduce((s, t) => s + t.totals.vgv, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 3 — Ranking de Corretores ═══ */}
        {!isLoading && sortedCorretores.length > 0 && (
          <div className="apple-glass-surface overflow-hidden" style={fadeUpStyle(15)}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <h3 className="apple-section-title" style={{ fontSize: 17 }}>Ranking de Corretores</h3>
              <p style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>Clique no cabeçalho para ordenar · ⭐ = top da coluna</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full apple-table">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {([
                      { key: "nome" as SortKey, label: "Corretor", align: "left" },
                      { key: "equipe" as SortKey, label: "Equipe", align: "left" },
                      { key: "presencas" as SortKey, label: "Pres.", align: "center" },
                      { key: "ligacoes" as SortKey, label: "Ligações", align: "center" },
                      { key: "leads" as SortKey, label: "Leads", align: "center" },
                      { key: "visitasMarcadas" as SortKey, label: "Vis.Marc.", align: "center" },
                      { key: "visitasRealizadas" as SortKey, label: "Vis.Real.", align: "center" },
                      { key: "negociosCriados" as SortKey, label: "Neg.Cri.", align: "center" },
                      { key: "negociosAssinados" as SortKey, label: "Assinados", align: "center" },
                      { key: "vgv" as SortKey, label: "VGV", align: "right" },
                    ]).map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                        style={{ cursor: "pointer", transition: `color 0.2s cubic-bezier(${appleCurve})` }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCorretores.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                        <span style={{ color: "rgba(0,0,0,0.3)", fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                        {c.nome}
                      </td>
                      <td>
                        <span className="apple-pill" style={{ background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.6)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 11 }}>
                          {c.equipe}
                        </span>
                      </td>
                      {(["presencas", "ligacoes", "leads", "visitasMarcadas", "visitasRealizadas", "negociosCriados", "negociosAssinados"] as SortKey[]).map(k => (
                        <td key={k} className="text-center">
                          <span style={{ fontWeight: 600, color: topPerformers[k] === c.id ? "#ff9f0a" : "rgba(0,0,0,0.8)" }}>
                            {topPerformers[k] === c.id && "⭐ "}{(c[k] as number) || 0}
                          </span>
                        </td>
                      ))}
                      <td className="text-right">
                        <span style={{
                          fontWeight: 700,
                          color: topPerformers.vgv === c.id ? "#ff9f0a" : c.vgv > 0 ? "#30d158" : "rgba(0,0,0,0.2)"
                        }}>
                          {topPerformers.vgv === c.id && "⭐ "}{c.vgv > 0 ? formatBRLCompact(c.vgv) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ BLOCO 4 — Breakdown por Equipe ═══ */}
        {!isLoading && data?.teams && data.teams.length > 0 && scope !== "corretor" && (
          <div className="space-y-4" style={fadeUpStyle(16)}>
            <h3 className="apple-section-title" style={{ fontSize: 22, paddingLeft: 4 }}>Breakdown por Equipe</h3>
            {data.teams.map(team => (
              <Collapsible key={team.equipe} open={expandedTeams.has(team.equipe)} onOpenChange={() => toggleTeam(team.equipe)}>
                <div className="apple-glass-surface overflow-hidden">
                  <CollapsibleTrigger
                    className="w-full flex items-center justify-between"
                    style={{ padding: "14px 24px", cursor: "pointer", transition: `background 0.2s cubic-bezier(${appleCurve})` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="apple-pill" style={{ background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.7)", border: "1px solid rgba(0,0,0,0.08)" }}>
                        {team.equipe}
                      </span>
                      <span style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>{team.corretores.length} corretor(es)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-4" style={{ fontSize: 13 }}>
                        <span style={{ color: "rgba(0,0,0,0.4)" }}>Lig: <strong style={{ color: "rgba(0,0,0,0.8)" }}>{team.totals.ligacoes}</strong></span>
                        <span style={{ color: "rgba(0,0,0,0.4)" }}>Vis: <strong style={{ color: "rgba(0,0,0,0.8)" }}>{team.totals.visitasRealizadas}</strong></span>
                        <span style={{ color: "rgba(0,0,0,0.4)" }}>Neg: <strong style={{ color: "rgba(0,0,0,0.8)" }}>{team.totals.negociosAssinados}</strong></span>
                        <span style={{ color: "rgba(0,0,0,0.4)" }}>VGV: <strong style={{ color: "#30d158" }}>{formatBRLCompact(team.totals.vgv)}</strong></span>
                      </div>
                      {expandedTeams.has(team.equipe)
                        ? <ChevronUp className="h-4 w-4" style={{ color: "rgba(0,0,0,0.3)" }} />
                        : <ChevronDown className="h-4 w-4" style={{ color: "rgba(0,0,0,0.3)" }} />
                      }
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      {/* Team totals */}
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-3" style={{ padding: "16px 24px", background: "rgba(0,0,0,0.02)" }}>
                        {[
                          { label: "Presenças", value: team.totals.presencas },
                          { label: "Ligações", value: team.totals.ligacoes },
                          { label: "Leads", value: team.totals.leads },
                          { label: "Vis.Marc.", value: team.totals.visitasMarcadas },
                          { label: "Vis.Real.", value: team.totals.visitasRealizadas },
                          { label: "Neg.Cri.", value: team.totals.negociosCriados },
                          { label: "Assinados", value: team.totals.negociosAssinados },
                          { label: "VGV", value: team.totals.vgv, isCurrency: true },
                        ].map(item => (
                          <div key={item.label} className="text-center">
                            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.label}</p>
                            <p style={{ fontSize: 16, fontWeight: 700, color: item.isCurrency ? "#30d158" : "rgba(0,0,0,0.85)", marginTop: 2 }}>
                              {item.isCurrency ? formatBRLCompact(item.value) : item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Per-corretor mini table */}
                      <div className="overflow-x-auto">
                        <table className="w-full apple-table">
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                              <th className="text-left">Corretor</th>
                              <th className="text-center">Pres.</th>
                              <th className="text-center">Lig.</th>
                              <th className="text-center">Leads</th>
                              <th className="text-center">V.M.</th>
                              <th className="text-center">V.R.</th>
                              <th className="text-center">Neg.</th>
                              <th className="text-center">Ass.</th>
                              <th className="text-right">VGV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.corretores.sort((a, b) => b.vgv - a.vgv).map((c) => {
                              const teamMax = Math.max(...team.corretores.map(x => x.ligacoes), 1);
                              const barPct = Math.round((c.ligacoes / teamMax) * 100);

                              return (
                                <tr key={c.id}>
                                  <td style={{ fontWeight: 500 }}>{c.nome}</td>
                                  <td className="text-center">{c.presencas}</td>
                                  <td className="text-center">
                                    <div className="flex items-center gap-1.5 justify-center">
                                      <span style={{ fontWeight: 600 }}>{c.ligacoes}</span>
                                      <div className="hidden md:block" style={{ width: 48, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 2, background: "#7c7aff" }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-center">{c.leads}</td>
                                  <td className="text-center">{c.visitasMarcadas}</td>
                                  <td className="text-center">{c.visitasRealizadas}</td>
                                  <td className="text-center">{c.negociosCriados}</td>
                                  <td className="text-center">{c.negociosAssinados}</td>
                                  <td className="text-right" style={{ fontWeight: 600, color: c.vgv > 0 ? "#30d158" : "rgba(0,0,0,0.2)" }}>
                                    {c.vgv > 0 ? formatBRLCompact(c.vgv) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="apple-glass-surface" style={{ height: 256 }} />
              <div className="apple-glass-surface" style={{ height: 256 }} />
            </div>
            <div className="apple-glass-surface" style={{ height: 384 }} />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!data?.corretores || data.corretores.length === 0) && (
          <div className="apple-glass-surface text-center" style={{ padding: 48 }}>
            <p style={{ color: "rgba(0,0,0,0.4)", fontSize: 15 }}>Sem dados disponíveis para o período selecionado.</p>
          </div>
        )}
      </div>

      {/* KPI Detail Dialog */}
      <ExecutiveKpiDetailDialog
        open={!!kpiDetail}
        onOpenChange={(o) => !o && setKpiDetail(null)}
        type={kpiDetail?.type || "ligacoes"}
        label={kpiDetail?.label || ""}
        scopeUserIds={null}
        scopeProfileIds={null}
        dateRange={kpiDateRange}
      />
    </div>
  );
}
