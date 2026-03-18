import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatBRLCompact } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Download, Phone, ThumbsUp, CalendarDays, Eye, Users, DollarSign, TrendingUp, Briefcase, Bot, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember { id: string; nome: string; user_id: string | null; }

interface CorretorProfile {
  nome: string;
  cargo: string | null;
  avatar_gamificado_url: string | null;
  avatar_url: string | null;
}

interface PeriodData {
  ligacoes: number;
  aproveitados: number;
  taxaAproveitamento: number;
  visitasMarcadas: number;
  visitasRealizadas: number;
  leadsAtivos: number;
  leadsAproveitados: number;
  negociosAtivos: number;
  vgvAndamento: number;
}

interface ReportJSON {
  resumo_performance: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  plano_acao: Array<{ acao: string; prazo: string }>;
  mensagem_gerente: string;
}

function getInitials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const fmtVgv = formatBRLCompact;

interface Props {
  team: TeamMember[];
  gerenteNome: string;
}

export default function GerarManualTab({ team, gerenteNome }: Props) {
  const { user } = useAuth();
  const [corretorId, setCorretorId] = useState("");
  const [periodoTipo, setPeriodoTipo] = useState("semanal");
  const [dataInicio, setDataInicio] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [contexto, setContexto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportJSON | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Get user_id for selected team member
  const selectedMember = useMemo(() => team.find(t => t.id === corretorId), [team, corretorId]);
  const corretorUserId = selectedMember?.user_id || null;
  const corretorNome = selectedMember?.nome || "";

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

  // Fetch corretor profile
  const { data: profile } = useQuery({
    queryKey: ["corretor-profile-1on1", corretorUserId],
    queryFn: async () => {
      if (!corretorUserId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo, avatar_gamificado_url, avatar_url")
        .eq("user_id", corretorUserId)
        .maybeSingle();
      return data as CorretorProfile | null;
    },
    enabled: !!corretorUserId,
  });

  // Fetch period data automatically
  const { data: periodData, isLoading: loadingPeriod } = useQuery({
    queryKey: ["period-data-1on1", corretorUserId, corretorNome, dataInicio, dataFim],
    queryFn: async (): Promise<PeriodData> => {
      if (!corretorUserId) return { ligacoes: 0, aproveitados: 0, taxaAproveitamento: 0, visitasMarcadas: 0, visitasRealizadas: 0, leadsAtivos: 0, leadsAproveitados: 0, negociosAtivos: 0, vgvAndamento: 0 };

      const dayStart = `${dataInicio}T00:00:00-03:00`;
      const dayEnd = `${dataFim}T23:59:59.999-03:00`;

      // Parallel queries
      const [tentativasRes, visitasRes, negociosRes] = await Promise.all([
        supabase.from("oferta_ativa_tentativas").select("id, resultado").eq("corretor_id", corretorUserId).gte("created_at", dayStart).lte("created_at", dayEnd),
        supabase.from("visitas").select("id, status").eq("corretor_id", corretorUserId).gte("data_visita", dataInicio).lte("data_visita", dataFim),
        supabase.from("negocios").select("id, vgv_estimado").eq("corretor_id", corretorUserId).neq("fase", "perdido"),
      ]);

      const tentativas = tentativasRes.data || [];
      const visitas = visitasRes.data || [];
      const negocios = negociosRes.data || [];

      const ligacoes = tentativas.length;
      const aproveitados = tentativas.filter(t => t.resultado === "com_interesse").length;
      const visitasMarcadas = visitas.length;
      const visitasRealizadas = visitas.filter(v => v.status === "realizada").length;
      const vgvAndamento = negocios.reduce((sum, n) => sum + (Number(n.vgv_estimado) || 0), 0);

      // Leads ativos
      const { count: leadsAtivos } = await (supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true }) as any)
        .eq("corretor_id", corretorUserId)
        .neq("status", "arquivado");

      return {
        ligacoes,
        aproveitados,
        taxaAproveitamento: ligacoes > 0 ? Math.round((aproveitados / ligacoes) * 100) : 0,
        visitasMarcadas,
        visitasRealizadas,
        leadsAtivos: leadsAtivos || 0,
        leadsAproveitados: aproveitados,
        negociosAtivos: negocios.length,
        vgvAndamento,
      };
    },
    enabled: !!corretorUserId && !!dataInicio && !!dataFim,
    staleTime: 30_000,
  });

  const avatarSrc = profile?.avatar_gamificado_url || profile?.avatar_url;

  const extractReportJson = (raw: string): ReportJSON => {
    const normalized = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta não contém JSON válido");

    const parsed = JSON.parse(
      jsonMatch[0]
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
    );

    return {
      resumo_performance: String(parsed?.resumo_performance || ""),
      pontos_fortes: Array.isArray(parsed?.pontos_fortes) ? parsed.pontos_fortes.map(String) : [],
      pontos_atencao: Array.isArray(parsed?.pontos_atencao) ? parsed.pontos_atencao.map(String) : [],
      plano_acao: Array.isArray(parsed?.plano_acao)
        ? parsed.plano_acao.map((item: any) => ({ acao: String(item?.acao || ""), prazo: String(item?.prazo || "") })).filter((item: any) => item.acao)
        : [],
      mensagem_gerente: String(parsed?.mensagem_gerente || ""),
    };
  };

  const generate = async () => {
    if (!corretorId) { toast.error("Selecione um corretor"); return; }
    if (!corretorUserId) { toast.error("Este corretor não possui usuário vinculado"); return; }
    if (!contexto.trim()) { toast.error("Preencha o contexto do gerente"); return; }

    setGenerating(true);
    setReport(null);

    const pd = periodData || { ligacoes: 0, aproveitados: 0, taxaAproveitamento: 0, visitasMarcadas: 0, visitasRealizadas: 0, leadsAtivos: 0, leadsAproveitados: 0, negociosAtivos: 0, vgvAndamento: 0 };
    const metricas = {
      ligacoes: pd.ligacoes,
      aproveitados: pd.aproveitados,
      taxa_aproveitamento: pd.taxaAproveitamento,
      visitas_marcadas: pd.visitasMarcadas,
      visitas_realizadas: pd.visitasRealizadas,
      leads_ativos: pd.leadsAtivos,
      leads_aproveitados: pd.leadsAproveitados,
      negocios_ativos: pd.negociosAtivos,
      vgv_em_andamento: pd.vgvAndamento,
    };
    const taxasConversao = {
      ligacoes_para_visitas_marcadas: pd.ligacoes > 0 ? Math.round((pd.visitasMarcadas / pd.ligacoes) * 100) : 0,
      visitas_marcadas_para_realizadas: pd.visitasMarcadas > 0 ? Math.round((pd.visitasRealizadas / pd.visitasMarcadas) * 100) : 0,
    };
    const scorePerformance = Math.min(100, Math.round(
      (pd.aproveitados * 2) +
      (pd.visitasMarcadas * 6) +
      (pd.visitasRealizadas * 10) +
      (pd.negociosAtivos * 12) +
      (pd.taxaAproveitamento * 0.8)
    ));

    try {
      const { data, error } = await supabase.functions.invoke("generate-corretor-report", {
        body: {
          corretor_nome: corretorNome,
          gerente_nome: gerenteNome,
          periodo_inicio: format(new Date(dataInicio + "T12:00:00"), "dd/MM/yyyy"),
          periodo_fim: format(new Date(dataFim + "T12:00:00"), "dd/MM/yyyy"),
          periodo_tipo: periodoTipo,
          metricas,
          taxas_conversao: taxasConversao,
          score_performance: scorePerformance,
          tendencia: null,
          contexto_gerente: contexto,
          observacoes,
          response_format: "json",
        },
      });

      if (error) throw error;

      const parsed = extractReportJson(data?.content || "");
      setReport(parsed);

      if (user) {
        const { error: saveError } = await supabase.from("relatorios_1_1" as any).insert({
          corretor_id: corretorUserId,
          gerente_id: user.id,
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          conteudo_json: parsed,
          dados_periodo: pd,
        });

        if (saveError) {
          console.error("Erro ao salvar relatório 1:1:", saveError);
          toast.error("Relatório gerado, mas não foi possível salvar o histórico.");
        }
      }
    } catch (err: any) {
      console.error("Erro ao gerar relatório:", err);
      toast.error(err?.message || "Erro ao gerar relatório. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const exportPdf = () => {
    if (!reportRef.current) return;

    const exportBtn = reportRef.current.querySelector("[data-export-btn]");
    if (exportBtn) (exportBtn as HTMLElement).style.display = "none";

    const fileName = `Relatorio_1x1_${corretorNome.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      (window as any).html2pdf().set(opt).from(reportRef.current).save().then(() => {
        if (exportBtn) (exportBtn as HTMLElement).style.display = "";
      });
    };
    document.head.appendChild(script);
  };

  const dataCards = [
    { icon: Phone, label: "Ligações", value: periodData?.ligacoes ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: ThumbsUp, label: "Aproveitados", value: `${periodData?.aproveitados ?? 0} (${periodData?.taxaAproveitamento ?? 0}%)`, color: "text-green-600", bg: "bg-green-50" },
    { icon: CalendarDays, label: "Visitas Marcadas", value: periodData?.visitasMarcadas ?? 0, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: Eye, label: "Visitas Realizadas", value: periodData?.visitasRealizadas ?? 0, color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Users, label: "Leads Ativos", value: periodData?.leadsAtivos ?? 0, color: "text-indigo-600", bg: "bg-indigo-50" },
    { icon: TrendingUp, label: "Leads Aproveitados", value: periodData?.leadsAproveitados ?? 0, color: "text-cyan-600", bg: "bg-cyan-50" },
    { icon: Briefcase, label: "Negócios Ativos", value: periodData?.negociosAtivos ?? 0, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: DollarSign, label: "VGV em Andamento", value: fmtVgv(periodData?.vgvAndamento ?? 0), color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ═══ LEFT: Form ═══ */}
      <div className="space-y-4">
        {/* Corretor profile card */}
        {corretorId && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 p-4 bg-muted/30">
              <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center border-2 border-primary/20">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={corretorNome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">{getInitials(corretorNome)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground truncate">{profile?.nome || corretorNome}</p>
                <p className="text-xs text-muted-foreground">{profile?.cargo || "Corretor"}</p>
                {loadingPeriod && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[11px] text-primary">Carregando dados...</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Period data cards */}
        {corretorId && periodData && !loadingPeriod && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados do Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {dataCards.map(dc => (
                  <div key={dc.label} className={`rounded-lg p-2.5 ${dc.bg} border border-border/30`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <dc.icon className={`h-3.5 w-3.5 ${dc.color}`} />
                      <span className="text-[10px] text-muted-foreground truncate">{dc.label}</span>
                    </div>
                    <p className={`text-sm font-bold ${dc.color}`}>{dc.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Corretor *</Label>
              <Select value={corretorId} onValueChange={setCorretorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o corretor..." /></SelectTrigger>
                <SelectContent>
                  {team.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label className="text-xs">Contexto do gerente sobre o corretor *</Label>
              <Textarea
                placeholder="Como o corretor está atualmente? Postura, energia, disciplina, foco, dificuldades, pontos fortes..."
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

        <Button onClick={generate} disabled={generating || !corretorId} className="w-full gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Relatório com IA
        </Button>
      </div>

      {/* ═══ RIGHT: Report Preview ═══ */}
      <div className="space-y-3">
        {generating && (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Gerando relatório 1:1 com IA...</p>
            <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
          </Card>
        )}

        {report && !generating && (
          <div ref={reportRef} className="rounded-xl border border-border overflow-hidden bg-card shadow-card">
            {/* Report Header */}
            <div className="p-5" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden shrink-0 border-2 border-white/20 bg-white/10 flex items-center justify-center">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={corretorNome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white">{getInitials(corretorNome)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate">{profile?.nome || corretorNome}</p>
                  <p className="text-sm text-white/60">{profile?.cargo || "Corretor"}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {format(new Date(dataInicio + "T12:00:00"), "dd/MM/yyyy")} a {format(new Date(dataFim + "T12:00:00"), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge className="bg-white/10 text-white/80 border-white/20 text-[10px] gap-1">
                    <Bot className="h-3 w-3" /> Gerado pelo HOMI
                  </Badge>
                  <span className="text-[10px] text-white/40">{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Resumo */}
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                  📊 Resumo de Performance
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{report.resumo_performance}</p>
              </div>

              {/* Pontos Fortes */}
              {report.pontos_fortes?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    💪 Pontos Fortes
                  </h3>
                  <ul className="space-y-1.5">
                    {report.pontos_fortes.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pontos de Atenção */}
              {report.pontos_atencao?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    ⚠️ Pontos de Atenção
                  </h3>
                  <ul className="space-y-1.5">
                    {report.pontos_atencao.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-amber-500 shrink-0">●</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Plano de Ação */}
              {report.plano_acao?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    🎯 Plano de Ação
                  </h3>
                  <ol className="space-y-2">
                    {report.plano_acao.map((a, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-foreground font-medium">{a.acao}</p>
                          <p className="text-[11px] text-muted-foreground">Prazo: {a.prazo}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Mensagem da Gerente */}
              {report.mensagem_gerente && (
                <div className="rounded-lg bg-muted/50 p-4 border border-border/50">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                    💬 Mensagem da Gerente
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{report.mensagem_gerente}"</p>
                </div>
              )}
            </div>

            {/* Export button */}
            <div className="p-4 border-t border-border" data-export-btn>
              <Button onClick={exportPdf} variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" /> 📄 Exportar PDF
              </Button>
            </div>
          </div>
        )}

        {!report && !generating && (
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
  );
}
