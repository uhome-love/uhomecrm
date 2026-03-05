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
import { Loader2, Sparkles, Download, Save, RefreshCw, FileText, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface TeamMember { id: string; nome: string; }

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
  const [activeTab, setActiveTab] = useState("gerar");
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

  // Load team + gerente name
  useEffect(() => {
    if (!user) return;
    supabase.from("team_members").select("id, nome").eq("gerente_id", user.id).eq("status", "ativo").order("nome").then(({ data }) => setTeam(data || []));
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
    // Deep clone
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
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="gerar" className="gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" /> Gerar Relatório
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs py-2">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-display">Configuração</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Corretor */}
                  <div className="space-y-2">
                    <Label className="text-xs">Corretor *</Label>
                    <Select value={corretorId} onValueChange={setCorretorId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o corretor..." /></SelectTrigger>
                      <SelectContent>
                        {team.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Period */}
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de período</Label>
                    <Select value={periodoTipo} onValueChange={setPeriodoTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} disabled={periodoTipo !== "personalizado"} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} disabled={periodoTipo !== "personalizado"} />
                    </div>
                  </div>

                  {/* Contexto */}
                  <div className="space-y-2">
                    <Label className="text-xs">Contexto do gerente sobre o corretor *</Label>
                    <Textarea
                      placeholder="Como o corretor está atualmente? Postura, energia, disciplina, foco, dificuldades, pontos fortes, comportamento com leads, comprometimento..."
                      value={contexto}
                      onChange={e => setContexto(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Observações adicionais (opcional)</Label>
                    <Textarea
                      placeholder="Fatos importantes do período: faltas, vendas grandes, eventos relevantes..."
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Preview */}
              {corretorId && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-display flex items-center justify-between">
                      Métricas do Período
                      {loadingMetricas && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metricRows.map(r => {
                      const p = pct(r.real, r.meta);
                      return (
                        <div key={r.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{r.label}</span>
                            <span className={`font-semibold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive"}`}>
                              {r.fmt(r.real)} / {r.fmt(r.meta)} ({p}%)
                            </span>
                          </div>
                          <Progress value={Math.min(p, 100)} className="h-1.5" />
                        </div>
                      );
                    })}

                    {/* Score */}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">Score de Performance</span>
                        <span className={`text-lg font-bold ${score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive"}`}>
                          {score}/100
                        </span>
                      </div>
                      <Progress value={score} className="h-2 mt-1" />
                    </div>

                    {/* Funnel rates */}
                    <div className="pt-2 border-t border-border space-y-1">
                      <p className="text-xs font-medium text-foreground mb-1">Taxas do Funil</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded-lg bg-muted p-2">
                          <span className="text-muted-foreground">Ligações→V.Marc</span>
                          <p className="font-bold text-foreground">{taxas.ligacoes_visitas_marcadas}%</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                          <span className="text-muted-foreground">V.Marc→V.Real</span>
                          <p className="font-bold text-foreground">{taxas.visitas_marcadas_realizadas}%</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                          <span className="text-muted-foreground">V.Real→Propostas</span>
                          <p className="font-bold text-foreground">{taxas.visitas_realizadas_propostas}%</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                          <span className="text-muted-foreground">Propostas→VGV</span>
                          <p className="font-bold text-foreground">{taxas.propostas_vgv}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={generate} disabled={generating || !corretorId} className="w-full gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Relatório com IA
              </Button>
            </div>

            {/* Result */}
            <div className="space-y-3">
              {generating && (
                <Card className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Gerando relatório 1:1 com IA...</p>
                  <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
                </Card>
              )}

              {resultado && !generating && (
                <div className="rounded-xl border border-border bg-card shadow-card">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-wrap">
                    <h3 className="font-display font-semibold text-sm flex-1">Relatório Gerado</h3>
                    <Button variant="outline" size="sm" onClick={downloadPdf} className="gap-1.5 text-xs h-7">
                      <Download className="h-3 w-3" /> Baixar PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={saveReport} className="gap-1.5 text-xs h-7">
                      <Save className="h-3 w-3" /> Salvar
                    </Button>
                    <Button variant="outline" size="sm" onClick={generate} className="gap-1.5 text-xs h-7">
                      <RefreshCw className="h-3 w-3" /> Nova versão
                    </Button>
                  </div>
                  <div ref={reportRef} className="p-4 prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground">
                    <ReactMarkdown>{resultado}</ReactMarkdown>
                  </div>
                </div>
              )}

              {!resultado && !generating && (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <h3 className="font-display font-semibold text-foreground mb-1">Relatório 1:1</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Selecione o corretor, período, adicione seu contexto e clique em "Gerar Relatório" para criar um relatório completo de performance.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

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
                  // Re-render markdown as HTML
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
