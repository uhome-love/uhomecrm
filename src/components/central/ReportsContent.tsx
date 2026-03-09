import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useUhomeIa } from "@/hooks/useUhomeIa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download, Sparkles, Copy } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ReportType = "funil" | "forecast" | "completo";

function fmtCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ReportsContent() {
  const { user } = useAuth();
  const { analyze, loading: iaLoading } = useUhomeIa();
  const [reportType, setReportType] = useState<ReportType>("completo");
  const [periodoTipo, setPeriodoTipo] = useState<"semanal" | "mensal">("mensal");
  const [refDate, setRefDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const getPeriod = useCallback(() => {
    const d = new Date(refDate + "T12:00:00");
    if (periodoTipo === "semanal") {
      return { start: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    }
    return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
  }, [refDate, periodoTipo]);

  const generateReport = async () => {
    if (!user) return;
    setGenerating(true);
    setReport(null);

    try {
      const { start, end } = getPeriod();
      const mesKey = start.slice(0, 7);

      // Fetch checkpoint data
      const { data: cps } = await supabase.from("checkpoints").select("id, data").eq("gerente_id", user.id).gte("data", start).lte("data", end);
      const cpIds = (cps || []).map(c => c.id);

      let lines: any[] = [];
      if (cpIds.length > 0) {
        const { data: linesData } = await supabase.from("checkpoint_lines").select("corretor_id, real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas, real_vgv_gerado, real_vgv_assinado").in("checkpoint_id", cpIds);
        lines = linesData || [];
      }

      const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id).eq("status", "ativo");
      const teamMap = new Map((team || []).map(t => [t.id, t.nome]));

      // Aggregate
      const byCorretor: Record<string, any> = {};
      let totals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };

      for (const l of lines) {
        const nome = teamMap.get(l.corretor_id) || "Desconhecido";
        if (!byCorretor[l.corretor_id]) byCorretor[l.corretor_id] = { nome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
        const c = byCorretor[l.corretor_id];
        const fields = ["leads", "ligacoes", "visitas_marcadas", "visitas_realizadas", "propostas"];
        for (const f of fields) {
          const val = l[`real_${f}`] || 0;
          c[f] += val;
          (totals as any)[f] += val;
        }
      }

      // PDN data
      const { data: pdns } = await supabase.from("pdn_entries").select("*").eq("gerente_id", user.id).eq("mes", mesKey);
      const pdnCount = (pdns || []).length;
      const pdnVgv = (pdns || []).reduce((s, p) => s + Number(p.vgv || 0), 0);
      const pdnAssinado = (pdns || []).filter(p => p.situacao === "assinado").reduce((s, p) => s + Number(p.vgv || 0), 0);

      // Metas CEO
      const { data: metas } = await supabase.from("ceo_metas_mensais").select("*").eq("gerente_id", user.id).eq("mes", mesKey).maybeSingle();

      // Build prompt based on type
      let prompt = "";
      const header = `Gere um relatório executivo profissional para o período ${format(new Date(start + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(end + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}.`;

      if (reportType === "funil" || reportType === "completo") {
        prompt += `\n\n## DADOS DO FUNIL (Checkpoint)\n- Leads aproveitados: ${totals.leads}\n- Ligações: ${totals.ligacoes}\n- Visitas Marcadas: ${totals.visitas_marcadas}\n- Visitas Realizadas: ${totals.visitas_realizadas}\n- Propostas: ${totals.propostas}\n\nPor Corretor:\n${Object.values(byCorretor).map((c: any) => `  - ${c.nome}: ${c.leads} leads, ${c.ligacoes} lig, ${c.visitas_marcadas} vis marc, ${c.visitas_realizadas} vis real, ${c.propostas} prop`).join("\n")}`;
      }

      if (reportType === "forecast" || reportType === "completo") {
        prompt += `\n\n## DADOS PDN / FORECAST\n- Negócios ativos: ${pdnCount}\n- VGV potencial: ${fmtCurrency(pdnVgv)}\n- VGV assinado: ${fmtCurrency(pdnAssinado)}`;
        if (metas) {
          prompt += `\n\nMETAS DO MÊS:\n- Meta VGV Assinado: ${fmtCurrency(Number(metas.meta_vgv_assinado))}\n- Meta Visitas Marcadas: ${metas.meta_visitas_marcadas}\n- Meta Visitas Realizadas: ${metas.meta_visitas_realizadas}`;
        }
        // PDN details
        if (pdns && pdns.length > 0) {
          prompt += `\n\nDETALHES PDN:\n${pdns.slice(0, 20).map(p => `  - ${p.nome} | ${p.empreendimento} | ${p.situacao} | ${p.temperatura} | VGV: ${fmtCurrency(Number(p.vgv || 0))}`).join("\n")}`;
        }
      }

      const fullPrompt = `${header}\n${prompt}\n\nFormate como relatório executivo em markdown com:\n1. Resumo executivo (2-3 frases)\n2. KPIs principais\n3. Performance por corretor (se houver dados)\n4. Análise de gargalos\n5. Ações recomendadas\n6. Projeção para o próximo período\n\nSeja direto e objetivo. Use emojis para destacar pontos-chave.`;

      const result = await analyze({
        module: "relatorio",
        prompt: fullPrompt,
        context: { totals, byCorretor, pdnCount, pdnVgv, metas },
      });

      setReport(result);
    } catch (err: any) {
      toast.error("Erro ao gerar relatório: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      toast.success("Relatório copiado!");
    }
  };

  const printReport = () => {
    if (!report) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>Relatório</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}h1,h2,h3{color:#1a1a2e}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>${report.replace(/\n/g, "<br>")}</body></html>`);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Gerar Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Tipo</label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="w-44 h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completo">Completo (Funil + Forecast)</SelectItem>
                  <SelectItem value="funil">Funil Comercial</SelectItem>
                  <SelectItem value="forecast">Forecast / PDN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Período</label>
              <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as any)}>
                <SelectTrigger className="w-32 h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Data referência</label>
              <Input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} className="w-40 h-9 mt-1" />
            </div>
            <Button onClick={generateReport} disabled={generating || iaLoading} className="gap-1.5 h-9">
              {generating || iaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">📊 Relatório Gerado</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyReport} className="gap-1.5 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={printReport} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Imprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
