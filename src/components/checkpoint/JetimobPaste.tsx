import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function JetimobPaste() {
  const [pastedData, setPastedData] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!pastedData.trim()) { toast.error("Cole os dados do Jetimob primeiro."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkpoint-coach", {
        body: {
          summary: `DADOS COLADOS DO JETIMOB:\n${pastedData}`,
          mode: "jetimob_analysis",
        },
      });
      if (error) throw error;
      setAnalysis(data?.analysis || "Sem análise disponível.");
    } catch {
      toast.error("Erro ao analisar dados.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display font-semibold text-foreground">Dados do Jetimob</h3>
            <p className="text-xs text-muted-foreground">Cole dados exportados do Jetimob (tabela, texto ou CSV)</p>
          </div>
        </div>

        <Textarea
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          placeholder="Cole aqui os dados do Jetimob (ex: relatório de visitas, leads, propostas...)"
          rows={10}
          className="font-mono text-xs"
        />

        <Button onClick={analyze} disabled={loading} className="mt-4 gap-2 w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analisando..." : "Interpretar Dados com IA"}
        </Button>
      </div>

      {analysis && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h4 className="font-display font-semibold text-foreground mb-3">Análise da IA</h4>
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
