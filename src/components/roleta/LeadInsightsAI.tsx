import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { CampaignPerf, SegmentoPerf, CorretorPerf } from "@/hooks/useLeadIntelligence";

interface Props {
  kpis: { leadsHoje: number; leadsMes: number; taxaContato: number; taxaVisita: number; taxaVenda: number };
  campanhas: CampaignPerf[];
  formularios: CampaignPerf[];
  segmentoPerf: SegmentoPerf[];
  corretorPerf: CorretorPerf[];
  periodo: string;
}

export default function LeadInsightsAI({ kpis, campanhas, formularios, segmentoPerf, corretorPerf, periodo }: Props) {
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const generateInsights = useCallback(async () => {
    setLoading(true);
    setInsights("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Sessão expirada"); return; }

      const summary = {
        periodo,
        kpis,
        top5Campanhas: campanhas.slice(0, 5),
        top5Formularios: formularios.slice(0, 5),
        segmentos: segmentoPerf,
        top5Corretores: corretorPerf.slice(0, 5),
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-intelligence-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ summary }),
        }
      );

      if (response.status === 429) { toast.error("Limite de requisições excedido. Tente novamente em breve."); return; }
      if (response.status === 402) { toast.error("Créditos de IA insuficientes."); return; }
      if (!response.ok || !response.body) throw new Error("Erro ao gerar insights");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setInsights(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar insights com IA");
    } finally {
      setLoading(false);
    }
  }, [kpis, campanhas, formularios, segmentoPerf, corretorPerf, periodo]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> Insights Automáticos com IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!insights && !loading && (
          <div className="text-center py-6">
            <Brain className="h-10 w-10 text-primary/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Gere análises inteligentes sobre seus leads com IA</p>
            <Button onClick={generateInsights} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Gerar Insights
            </Button>
          </div>
        )}
        {loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando dados...
            </div>
            {insights && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown>{insights}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {insights && !loading && (
          <div className="space-y-3">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
            <Button variant="outline" size="sm" onClick={generateInsights} className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Regenerar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RefreshCw(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
    </svg>
  );
}
