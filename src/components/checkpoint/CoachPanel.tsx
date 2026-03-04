import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bot, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format, startOfWeek, endOfWeek } from "date-fns";

export default function CoachPanel() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCoach = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Gather data for this week
      const now = new Date();
      const start = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const end = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

      const { data: cps } = await supabase.from("checkpoints").select("id, data, status").eq("gerente_id", user.id).gte("data", start).lte("data", end);
      if (!cps || cps.length === 0) { toast.error("Sem checkpoints nesta semana."); setLoading(false); return; }

      const cpIds = cps.map((c: any) => c.id);
      const { data: lines } = await supabase.from("checkpoint_lines").select("*").in("checkpoint_id", cpIds);
      const { data: team } = await supabase.from("team_members").select("id, nome").eq("gerente_id", user.id);

      // Build summary for AI
      const teamMap = new Map((team || []).map((t: any) => [t.id, t.nome]));
      const corretorSummaries: string[] = [];

      for (const [id, nome] of teamMap) {
        const corretorLines = (lines || []).filter((l: any) => l.corretor_id === id);
        if (corretorLines.length === 0) continue;
        const totals = corretorLines.reduce((acc: any, l: any) => ({
          meta_lig: acc.meta_lig + (l.meta_ligacoes ?? 0), real_lig: acc.real_lig + (l.real_ligacoes ?? 0),
          meta_vm: acc.meta_vm + (l.meta_visitas_marcadas ?? 0), real_vm: acc.real_vm + (l.real_visitas_marcadas ?? 0),
          meta_vr: acc.meta_vr + (l.meta_visitas_realizadas ?? 0), real_vr: acc.real_vr + (l.real_visitas_realizadas ?? 0),
          meta_prop: acc.meta_prop + (l.meta_propostas ?? 0), real_prop: acc.real_prop + (l.real_propostas ?? 0),
          meta_vgv_g: acc.meta_vgv_g + Number(l.meta_vgv_gerado ?? 0), real_vgv_g: acc.real_vgv_g + Number(l.real_vgv_gerado ?? 0),
          meta_vgv_a: acc.meta_vgv_a + Number(l.meta_vgv_assinado ?? 0), real_vgv_a: acc.real_vgv_a + Number(l.real_vgv_assinado ?? 0),
        }), { meta_lig: 0, real_lig: 0, meta_vm: 0, real_vm: 0, meta_vr: 0, real_vr: 0, meta_prop: 0, real_prop: 0, meta_vgv_g: 0, real_vgv_g: 0, meta_vgv_a: 0, real_vgv_a: 0 });

        corretorSummaries.push(`${nome}: Ligações ${totals.real_lig}/${totals.meta_lig}, Vis.Marc ${totals.real_vm}/${totals.meta_vm}, Vis.Real ${totals.real_vr}/${totals.meta_vr}, Propostas ${totals.real_prop}/${totals.meta_prop}, VGV Gerado R$${totals.real_vgv_g}/R$${totals.meta_vgv_g}, VGV Assinado R$${totals.real_vgv_a}/R$${totals.meta_vgv_a}`);
      }

      const prompt = `Dados da semana (${start} a ${end}) - ${cps.length} dias com checkpoint:\n\n${corretorSummaries.join("\n")}`;

      const { data, error } = await supabase.functions.invoke("checkpoint-coach", {
        body: { summary: prompt },
      });
      if (error) throw error;
      setAnalysis(data?.analysis || "Sem análise disponível.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise do Coach IA.");
    } finally { setLoading(false); }
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-warm">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Coach de Performance UHome</h3>
              <p className="text-xs text-muted-foreground">IA que analisa o desempenho semanal e gera feedbacks</p>
            </div>
          </div>
          <Button onClick={runCoach} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Analisando..." : "Analisar Semana"}
          </Button>
        </div>

        {analysis ? (
          <div className="prose prose-sm max-w-none text-foreground bg-muted/30 rounded-lg p-5 border border-border">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Clique em "Analisar Semana" para a IA gerar o diagnóstico.</p>
            <p className="text-xs mt-1">A IA irá analisar metas vs resultados, identificar gargalos e sugerir ações.</p>
          </div>
        )}
      </div>
    </div>
  );
}
