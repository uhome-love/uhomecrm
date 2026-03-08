import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, Save, RefreshCw, FileText, History, Trash2, CheckCircle2, Clock, Bot } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import GerarManualTab from "@/components/relatorio/GerarManualTab";

interface TeamMember { id: string; nome: string; user_id: string | null; }

interface Metricas {
  ligacoes: { meta: number; real: number };
  presenca: { meta: number; real: number };
  visitas_marcadas: { meta: number; real: number };
  visitas_realizadas: { meta: number; real: number };
  propostas: { meta: number; real: number };
  vgv_gerado: { meta: number; real: number };
  vgv_assinado: { meta: number; real: number };
}

interface SavedReport {
  id: string;
  corretor_nome: string;
  periodo_tipo: string;
  periodo_inicio: string;
  periodo_fim: string;
  score_performance: number | null;
  created_at: string;
  conteudo_relatorio: string;
}

interface AutoReport {
  id: string;
  corretor_id: string;
  gerente_id: string;
  corretor_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  dados_semana: any;
  contexto_auto: string | null;
  conteudo_relatorio: string | null;
  status: string;
  score_performance: number | null;
  created_at: string;
  aprovado_em: string | null;
}

function calcScore(m: Metricas): number {
  const pesos = { vgv_assinado: 25, propostas: 20, visitas_realizadas: 18, visitas_marcadas: 15, ligacoes: 12, presenca: 10 };
  let score = 0;
  const pct = (r: number, mt: number) => mt > 0 ? Math.min(r / mt, 1.5) : 0;
  score += pct(m.vgv_assinado.real, m.vgv_assinado.meta) * pesos.vgv_assinado;
  score += pct(m.propostas.real, m.propostas.meta) * pesos.propostas;
  score += pct(m.visitas_realizadas.real, m.visitas_realizadas.meta) * pesos.visitas_realizadas;
  score += pct(m.visitas_marcadas.real, m.visitas_marcadas.meta) * pesos.visitas_marcadas;
  score += pct(m.ligacoes.real, m.ligacoes.meta) * pesos.ligacoes;
  score += pct(m.presenca.real, m.presenca.meta) * pesos.presenca;
  return Math.min(Math.round(score), 100);
}

function calcTaxas(m: Metricas) {
  const rate = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;
  return {
    ligacoes_visitas_marcadas: rate(m.visitas_marcadas.real, m.ligacoes.real),
    visitas_marcadas_realizadas: rate(m.visitas_realizadas.real, m.visitas_marcadas.real),
    visitas_realizadas_propostas: rate(m.propostas.real, m.visitas_realizadas.real),
    propostas_vgv: rate(m.vgv_assinado.real > 0 ? 1 : 0, m.propostas.real > 0 ? 1 : 0),
  };
}

const emptyMetricas: Metricas = {
  ligacoes: { meta: 0, real: 0 },
  presenca: { meta: 0, real: 0 },
  visitas_marcadas: { meta: 0, real: 0 },
  visitas_realizadas: { meta: 0, real: 0 },
  propostas: { meta: 0, real: 0 },
  vgv_gerado: { meta: 0, real: 0 },
  vgv_assinado: { meta: 0, real: 0 },
};

export default function RelatorioCorretor() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("rascunhos");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [corretorId, setCorretorId] = useState("");
  const [periodoTipo, setPeriodoTipo] = useState("semanal");
  const [dataInicio, setDataInicio] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [contexto, setContexto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [metricas, setMetricas] = useState<Metricas>(emptyMetricas);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultado, setResultado] = useState("");
  const [gerenteNome, setGerenteNome] = useState("");
  const [historico, setHistorico] = useState<SavedReport[]>([]);
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Auto reports state
  const [autoReports, setAutoReports] = useState<AutoReport[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [viewingAuto, setViewingAuto] = useState<AutoReport | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Load team + gerente name
  useEffect(() => {
    if (!user) return;
    supabase.from("team_members").select("id, nome, user_id").eq("gerente_id", user.id).eq("status", "ativo").order("nome").then(({ data }) => setTeam(data || []));
    supabase.from("profiles").select("nome").eq("user_id", user.id).single().then(({ data }) => { if (data?.nome) setGerenteNome(data.nome); });
  }, [user]);

  // Update dates based on period type
  useEffect(() => {
    const now = new Date();
    if (periodoTipo === "semanal") {
      setDataInicio(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setDataFim(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (periodoTipo === "mensal") {
      setDataInicio(format(startOfMonth(now), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(now), "yyyy-MM-dd"));
    }
  }, [periodoTipo]);

  // Load metrics when corretor + period selected
  const loadMetricas = useCallback(async () => {
    if (!user || !corretorId || !dataInicio || !dataFim) return;
    setLoadingMetricas(true);

    const { data: cps } = await supabase
      .from("checkpoints")
      .select("id")
      .eq("gerente_id", user.id)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    const cpIds = (cps || []).map(c => c.id);
    if (cpIds.length === 0) {
      setMetricas(emptyMetricas);
      setLoadingMetricas(false);
      return;
    }

    const { data: lines } = await supabase
      .from("checkpoint_lines")
      .select("*")
      .eq("corretor_id", corretorId)
      .in("checkpoint_id", cpIds);

    const m: Metricas = { ...emptyMetricas };
    Object.keys(m).forEach(k => { (m as any)[k] = { meta: 0, real: 0 }; });

    let presencaDias = 0;
    let presencaPresente = 0;

    (lines || []).forEach((l: any) => {
      m.ligacoes.meta += l.meta_ligacoes || 0;
      m.ligacoes.real += l.real_ligacoes || 0;
      m.visitas_marcadas.meta += l.meta_visitas_marcadas || 0;
      m.visitas_marcadas.real += l.real_visitas_marcadas || 0;
      m.visitas_realizadas.meta += l.meta_visitas_realizadas || 0;
      m.visitas_realizadas.real += l.real_visitas_realizadas || 0;
      m.propostas.meta += l.meta_propostas || 0;
      m.propostas.real += l.real_propostas || 0;
      m.vgv_gerado.meta += Number(l.meta_vgv_gerado || 0);
      m.vgv_gerado.real += Number(l.real_vgv_gerado || 0);
      m.vgv_assinado.meta += Number(l.meta_vgv_assinado || 0);
      m.vgv_assinado.real += Number(l.real_vgv_assinado || 0);
      presencaDias++;
      if (l.meta_presenca !== "falta") presencaPresente++;
    });

    m.presenca.meta = presencaDias;
    m.presenca.real = presencaPresente;

    setMetricas(m);
    setLoadingMetricas(false);
  }, [user, corretorId, dataInicio, dataFim]);

  useEffect(() => { loadMetricas(); }, [loadMetricas]);

  // Load history
  const loadHistorico = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("corretor_reports")
      .select("id, corretor_nome, periodo_tipo, periodo_inicio, periodo_fim, score_performance, created_at, conteudo_relatorio")
      .eq("gerente_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistorico((data as SavedReport[]) || []);
  }, [user]);

  useEffect(() => { loadHistorico(); }, [loadHistorico]);

  // Load auto reports
  const loadAutoReports = useCallback(async () => {
    if (!user) return;
    setLoadingAuto(true);
    const { data } = await supabase
      .from("one_on_one_reports")
      .select("*")
      .eq("gerente_id", user.id)
      .eq("status", "rascunho")
      .order("created_at", { ascending: false })
      .limit(100);
    setAutoReports((data as AutoReport[]) || []);
    setLoadingAuto(false);
  }, [user]);

  useEffect(() => { loadAutoReports(); }, [loadAutoReports]);

  // Load previous period metrics for trend
  const loadTendencia = useCallback(async () => {
    if (!user || !corretorId) return null;
    let prevStart: string, prevEnd: string;
    if (periodoTipo === "semanal") {
      const d = new Date(dataInicio);
      const prev = subWeeks(d, 1);
      prevStart = format(startOfWeek(prev, { weekStartsOn: 1 }), "yyyy-MM-dd");
      prevEnd = format(endOfWeek(prev, { weekStartsOn: 1 }), "yyyy-MM-dd");
    } else {
      const d = new Date(dataInicio);
      const prev = subMonths(d, 1);
      prevStart = format(startOfMonth(prev), "yyyy-MM-dd");
      prevEnd = format(endOfMonth(prev), "yyyy-MM-dd");
    }

    const { data: cps } = await supabase
      .from("checkpoints").select("id").eq("gerente_id", user.id).gte("data", prevStart).lte("data", prevEnd);
    const cpIds = (cps || []).map(c => c.id);
    if (cpIds.length === 0) return null;

    const { data: lines } = await supabase
      .from("checkpoint_lines").select("*").eq("corretor_id", corretorId).in("checkpoint_id", cpIds);

    const prev = { ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
    (lines || []).forEach((l: any) => {
      prev.ligacoes += l.real_ligacoes || 0;
      prev.visitas_marcadas += l.real_visitas_marcadas || 0;
      prev.visitas_realizadas += l.real_visitas_realizadas || 0;
      prev.propostas += l.real_propostas || 0;
      prev.vgv_gerado += Number(l.real_vgv_gerado || 0);
      prev.vgv_assinado += Number(l.real_vgv_assinado || 0);
    });
    return prev;
  }, [user, corretorId, periodoTipo, dataInicio]);

  const corretorNome = useMemo(() => team.find(t => t.id === corretorId)?.nome || "", [team, corretorId]);

  const score = useMemo(() => calcScore(metricas), [metricas]);
  const taxas = useMemo(() => calcTaxas(metricas), [metricas]);

  const generate = async () => {
    if (!corretorId) { toast.error("Selecione um corretor"); return; }
    if (!contexto.trim()) { toast.error("Preencha o contexto do gerente"); return; }

    setGenerating(true);
    setResultado("");

    const tendencia = await loadTendencia();

    const { data, error } = await supabase.functions.invoke("generate-corretor-report", {
      body: {
        corretor_nome: corretorNome,
        gerente_nome: gerenteNome,
        periodo_inicio: format(new Date(dataInicio), "dd/MM/yyyy"),
        periodo_fim: format(new Date(dataFim), "dd/MM/yyyy"),
        periodo_tipo: periodoTipo,
        metricas,
        taxas_conversao: taxas,
        score_performance: score,
        tendencia,
        contexto_gerente: contexto,
        observacoes,
      },
    });

    if (error) { toast.error("Erro ao gerar relatório"); console.error(error); }
    else setResultado(data?.content || "Sem resposta.");
    setGenerating(false);
  };

  const saveReport = async () => {
    if (!user || !resultado || !corretorId) return;
    const { error } = await supabase.from("corretor_reports").insert({
      gerente_id: user.id,
      corretor_id: corretorId,
      corretor_nome: corretorNome,
      periodo_tipo: periodoTipo,
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      contexto_gerente: contexto,
      observacoes,
      dados_metricas: metricas as any,
      conteudo_relatorio: resultado,
      score_performance: score,
    });
    if (error) { toast.error("Erro ao salvar"); console.error(error); }
    else { toast.success("Relatório salvo!"); loadHistorico(); }
  };

  const downloadPdf = () => {
    if (!reportRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para baixar o PDF."); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório ${corretorNome}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; font-size: 13px; }
      h1 { font-size: 22px; margin-bottom: 8px; color: #1a1a2e; }
      h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a2e; border-bottom: 2px solid #e8e8f0; padding-bottom: 4px; }
      h3 { font-size: 14px; margin-top: 16px; margin-bottom: 6px; }
      p { margin-bottom: 8px; }
      ul, ol { margin-left: 20px; margin-bottom: 8px; }
      li { margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
      th { background: #f0f0f8; font-weight: 600; }
      strong { font-weight: 600; }
      hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #1a1a2e; font-size: 11px; color: #666; text-align: center; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    ${reportRef.current.innerHTML}
    <div class="footer">
      <p><strong>Uhome Gestão e IA</strong> — Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
      <p>Gerente: ${gerenteNome}</p>
    </div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Excluir este relatório?")) return;
    await supabase.from("corretor_reports").delete().eq("id", id);
    toast.success("Relatório excluído");
    loadHistorico();
    if (viewingReport?.id === id) setViewingReport(null);
  };

  // Approve auto report
  const approveReport = async (report: AutoReport) => {
    if (!user) return;
    setApprovingId(report.id);
    
    const { error } = await supabase
      .from("one_on_one_reports")
      .update({
        status: "aprovado",
        aprovado_em: new Date().toISOString(),
        aprovado_por: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (error) {
      toast.error("Erro ao aprovar relatório");
      console.error(error);
    } else {
      toast.success(`Relatório de ${report.corretor_nome} aprovado!`);
      // Also save to corretor_reports for unified history
      await supabase.from("corretor_reports").insert({
        gerente_id: report.gerente_id,
        corretor_id: report.corretor_id,
        corretor_nome: report.corretor_nome,
        periodo_tipo: "semanal",
        periodo_inicio: report.periodo_inicio,
        periodo_fim: report.periodo_fim,
        contexto_gerente: report.contexto_auto || "Relatório automático",
        dados_metricas: report.dados_semana,
        conteudo_relatorio: report.contexto_auto || "",
        score_performance: report.score_performance,
      });
      loadAutoReports();
      loadHistorico();
    }
    setApprovingId(null);
    setViewingAuto(null);
  };

  const deleteAutoReport = async (id: string) => {
    if (!confirm("Excluir este rascunho?")) return;
    await supabase.from("one_on_one_reports").delete().eq("id", id);
    toast.success("Rascunho excluído");
    loadAutoReports();
    if (viewingAuto?.id === id) setViewingAuto(null);
  };

  const pct = (real: number, meta: number) => meta > 0 ? Math.round((real / meta) * 100) : 0;
  const fmtVgv = (v: number) => v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)}k` : `R$ ${v}`;

  const metricRows = [
    { label: "Ligações", ...metricas.ligacoes, fmt: (v: number) => String(v) },
    { label: "Presença (dias)", ...metricas.presenca, fmt: (v: number) => String(v) },
    { label: "Visitas Marcadas", ...metricas.visitas_marcadas, fmt: (v: number) => String(v) },
    { label: "Visitas Realizadas", ...metricas.visitas_realizadas, fmt: (v: number) => String(v) },
    { label: "Propostas", ...metricas.propostas, fmt: (v: number) => String(v) },
    { label: "VGV Gerado", ...metricas.vgv_gerado, fmt: fmtVgv },
    { label: "VGV Assinado", ...metricas.vgv_assinado, fmt: fmtVgv },
  ];

  const rascunhosCount = autoReports.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Relatório <span className="text-primary">1:1 por Corretor</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere relatórios de performance individuais com IA para reuniões one-a-one
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="rascunhos" className="gap-1.5 text-xs py-2 relative">
            <Bot className="h-3.5 w-3.5" /> Rascunhos
            {rascunhosCount > 0 && (
              <Badge variant="destructive" className="h-4 min-w-4 p-0 flex items-center justify-center text-[9px] rounded-full ml-1">
                {rascunhosCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="gerar" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" /> Gerar Manual
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs py-2">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ═══ RASCUNHOS AUTOMÁTICOS ═══ */}
        <TabsContent value="rascunhos" className="mt-4">
          {viewingAuto ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => setViewingAuto(null)}>← Voltar</Button>
                <h3 className="font-display font-semibold text-sm flex-1">
                  {viewingAuto.corretor_nome} — {format(new Date(viewingAuto.periodo_inicio + "T12:00:00"), "dd/MM")} a {format(new Date(viewingAuto.periodo_fim + "T12:00:00"), "dd/MM/yyyy")}
                </h3>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => approveReport(viewingAuto)}
                  disabled={approvingId === viewingAuto.id}
                >
                  {approvingId === viewingAuto.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Revisar e Aprovar
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Metrics summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-display flex items-center gap-2">
                      📊 Métricas da Semana
                      {viewingAuto.score_performance != null && (
                        <Badge variant={viewingAuto.score_performance >= 60 ? "default" : "secondary"} className="ml-auto text-xs">
                          Score: {viewingAuto.score_performance}/100
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {viewingAuto.dados_semana && (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Ligações", value: viewingAuto.dados_semana.total_ligacoes },
                          { label: "Aproveitados", value: viewingAuto.dados_semana.aproveitados },
                          { label: "Visitas Marcadas", value: viewingAuto.dados_semana.visitas_marcadas },
                          { label: "Visitas Realizadas", value: viewingAuto.dados_semana.visitas_realizadas },
                          { label: "Propostas", value: viewingAuto.dados_semana.propostas },
                          { label: "Taxa Aprov.", value: `${viewingAuto.dados_semana.taxa_aproveitamento}%` },
                          { label: "VGV Gerado", value: fmtVgv(viewingAuto.dados_semana.vgv_gerado || 0) },
                        ].map(item => (
                          <div key={item.label} className="rounded-lg bg-muted p-2.5">
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-bold text-foreground">{item.value ?? 0}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Context */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-display">📝 Análise Comparativa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {viewingAuto.contexto_auto || "Sem contexto gerado."}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {loadingAuto ? (
                <Card className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Carregando rascunhos...</p>
                </Card>
              ) : autoReports.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <h3 className="font-display font-semibold text-foreground mb-1">Nenhum rascunho pendente</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Os relatórios automáticos são gerados todo domingo às 20h. Quando disponíveis, aparecerão aqui para revisão.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{rascunhosCount} rascunhos aguardando revisão</span>
                    <Button variant="ghost" size="sm" onClick={loadAutoReports} className="ml-auto h-7 text-xs gap-1">
                      <RefreshCw className="h-3 w-3" /> Atualizar
                    </Button>
                  </div>
                  {autoReports.map(r => (
                    <Card key={r.id} className="hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => setViewingAuto(r)}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-sm text-foreground truncate">{r.corretor_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.periodo_inicio + "T12:00:00"), "dd/MM")} a {format(new Date(r.periodo_fim + "T12:00:00"), "dd/MM/yyyy")}
                          </p>
                        </div>
                        {r.score_performance != null && (
                          <div className={`text-sm font-bold ${r.score_performance >= 60 ? "text-emerald-600" : r.score_performance >= 40 ? "text-amber-600" : "text-red-600"}`}>
                            {r.score_performance}/100
                          </div>
                        )}
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Rascunho
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); approveReport(r); }}
                            disabled={approvingId === r.id}
                          >
                            {approvingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Aprovar
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); deleteAutoReport(r.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══ GERAR MANUAL ═══ */}
        <TabsContent value="gerar" className="mt-4">
          <GerarManualTab team={team} gerenteNome={gerenteNome} />
        </TabsContent>

        {/* ═══ HISTÓRICO ═══ */}
        <TabsContent value="historico" className="mt-4">
          {viewingReport ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setViewingReport(null)}>← Voltar</Button>
                <h3 className="font-display font-semibold text-sm flex-1">
                  {viewingReport.corretor_nome} — {format(new Date(viewingReport.periodo_inicio), "dd/MM")} a {format(new Date(viewingReport.periodo_fim), "dd/MM/yyyy")}
                </h3>
                <Button variant="outline" size="sm" onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) return;
                  printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório ${viewingReport.corretor_nome}</title>
                  <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Inter', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; font-size: 13px; }
                    h1 { font-size: 22px; margin-bottom: 8px; } h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #e8e8f0; padding-bottom: 4px; }
                    h3 { font-size: 14px; margin-top: 16px; margin-bottom: 6px; } p { margin-bottom: 8px; }
                    ul, ol { margin-left: 20px; margin-bottom: 8px; } li { margin-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; margin: 12px 0; } th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
                    th { background: #f0f0f8; font-weight: 600; } strong { font-weight: 600; } hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }
                    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #1a1a2e; font-size: 11px; color: #666; text-align: center; }
                  </style></head><body><div id="content"></div>
                  <div class="footer"><p><strong>Uhome Gestão e IA</strong> — Relatório gerado em ${format(new Date(viewingReport.created_at), "dd/MM/yyyy 'às' HH:mm")}</p></div>
                  </body></html>`);
                  const contentDiv = printWindow.document.getElementById("content");
                  if (contentDiv) contentDiv.innerHTML = printWindow.document.body.querySelector("#content")?.innerHTML || "";
                  const tempDiv = document.createElement("div");
                  document.body.appendChild(tempDiv);
                  import("react-dom/client").then(({ createRoot }) => {
                    import("react-markdown").then(({ default: RM }) => {
                      import("react").then(({ createElement }) => {
                        const root = createRoot(tempDiv);
                        root.render(createElement(RM, null, viewingReport.conteudo_relatorio));
                        setTimeout(() => {
                          if (contentDiv) contentDiv.innerHTML = tempDiv.innerHTML;
                          root.unmount();
                          document.body.removeChild(tempDiv);
                          printWindow.print();
                        }, 300);
                      });
                    });
                  });
                }} className="gap-1.5 text-xs h-7">
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
              <Card>
                <CardContent className="p-4 prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground">
                  <ReactMarkdown>{viewingReport.conteudo_relatorio}</ReactMarkdown>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">📂</div>
                  <h3 className="font-display font-semibold text-foreground mb-1">Nenhum relatório salvo</h3>
                  <p className="text-sm text-muted-foreground">Gere e salve relatórios para vê-los aqui.</p>
                </Card>
              ) : (
                historico.map(r => (
                  <Card key={r.id} className="hover:shadow-elevated transition-shadow cursor-pointer" onClick={() => setViewingReport(r)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm text-foreground truncate">{r.corretor_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.periodo_inicio), "dd/MM")} a {format(new Date(r.periodo_fim), "dd/MM/yyyy")} • {r.periodo_tipo}
                        </p>
                      </div>
                      {r.score_performance != null && (
                        <div className={`text-sm font-bold ${r.score_performance >= 80 ? "text-success" : r.score_performance >= 50 ? "text-warning" : "text-destructive"}`}>
                          {r.score_performance}/100
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), "dd/MM/yy HH:mm")}
                      </p>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); deleteReport(r.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
