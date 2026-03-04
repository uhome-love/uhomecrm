import { useState } from "react";
import { useCeoData, pct, type CeoPeriod } from "@/hooks/useCeoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export default function CeoAdvisor() {
  const [period, setPeriod] = useState<CeoPeriod>("semana");
  const { gerentes, companyTotals, allCorretores, loading: dataLoading, dateRange } = useCeoData(period);
  const [analysis, setAnalysis] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateAnalysis = async () => {
    if (gerentes.length === 0) { toast.error("Sem dados para analisar"); return; }
    setGenerating(true);
    setAnalysis("");

    // Build data summary for the AI
    const summary = {
      periodo: `${dateRange.start} a ${dateRange.end}`,
      empresa: companyTotals,
      gerentes: gerentes.map(g => ({
        nome: g.gerente_nome,
        score: g.totals.score,
        corretores_count: g.corretores.length,
        ...g.totals,
        corretores: g.corretores.map(c => ({
          nome: c.corretor_nome, score: c.score,
          real_ligacoes: c.real_ligacoes, meta_ligacoes: c.meta_ligacoes,
          real_visitas_marcadas: c.real_visitas_marcadas, meta_visitas_marcadas: c.meta_visitas_marcadas,
          real_visitas_realizadas: c.real_visitas_realizadas, meta_visitas_realizadas: c.meta_visitas_realizadas,
          real_propostas: c.real_propostas, meta_propostas: c.meta_propostas,
          real_vgv_gerado: c.real_vgv_gerado, meta_vgv_gerado: c.meta_vgv_gerado,
          real_vgv_assinado: c.real_vgv_assinado, meta_vgv_assinado: c.meta_vgv_assinado,
          eficiencia: {
            lig_vmarc: c.real_ligacoes > 0 ? Math.round((c.real_visitas_marcadas / c.real_ligacoes) * 100) : 0,
            vmarc_vreal: c.real_visitas_marcadas > 0 ? Math.round((c.real_visitas_realizadas / c.real_visitas_marcadas) * 100) : 0,
            vreal_prop: c.real_visitas_realizadas > 0 ? Math.round((c.real_propostas / c.real_visitas_realizadas) * 100) : 0,
          },
        })),
      })),
    };

    try {
      const resp = await supabase.functions.invoke("ceo-advisor", { body: { data: summary } });

      if (resp.error) {
        toast.error("Erro ao gerar análise");
        console.error(resp.error);
      } else {
        setAnalysis(resp.data?.analysis || "Sem resposta da IA.");
      }
    } catch (e) {
      toast.error("Erro de conexão");
      console.error(e);
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={v => setPeriod(v as CeoPeriod)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={generateAnalysis} disabled={generating || dataLoading} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Análise CEO Advisor
        </Button>
      </div>

      {!analysis && !generating && (
        <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
          <Bot className="h-12 w-12 text-primary/30 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-foreground mb-1">Uhome Gestão e IA – CEO Advisor</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Selecione o período e clique em "Gerar Análise" para receber insights estratégicos, diagnósticos por gerente e corretor, e ações recomendadas.
          </p>
        </div>
      )}

      {generating && (
        <div className="rounded-xl border border-border bg-card shadow-card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analisando dados e gerando insights estratégicos...</p>
        </div>
      )}

      {analysis && !generating && (
        <div className="rounded-xl border border-border bg-card shadow-card p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold">Análise CEO Advisor</h3>
            <span className="text-xs text-muted-foreground ml-auto">{dateRange.start} a {dateRange.end}</span>
          </div>
          <div className="prose prose-sm max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
