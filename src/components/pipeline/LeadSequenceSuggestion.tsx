import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Bot, Zap, Play, CheckCircle2 } from "lucide-react";

interface Props {
  leadId: string;
  leadNome: string;
  stageType: string;
  empreendimento?: string | null;
}

interface Sequencia {
  id: string;
  nome: string;
  descricao: string | null;
  stage_gatilho: string;
}

const STAGE_SUGGESTIONS: Record<string, string> = {
  novo_lead: "Primeira abordagem",
  sem_contato: "Reativação",
  contato_inicial: "Follow-up inicial",
  possibilidade_visita: "Aquecer para visita",
  visita_marcada: "Confirmar visita",
  visita_realizada: "Pós visita",
  negociacao: "Fechamento",
};

export default function LeadSequenceSuggestion({ leadId, leadNome, stageType, empreendimento }: Props) {
  const { user } = useAuth();
  const [suggested, setSuggested] = useState<Sequencia[]>([]);
  const [activeSeqs, setActiveSeqs] = useState<string[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Load suggested sequences for this stage
      const { data: seqs } = await supabase
        .from("pipeline_sequencias")
        .select("id, nome, descricao, stage_gatilho")
        .eq("stage_gatilho", stageType)
        .eq("ativa", true)
        .limit(5);

      setSuggested((seqs || []) as Sequencia[]);

      // Check already active sequences for this lead
      const { data: active } = await supabase
        .from("pipeline_lead_sequencias")
        .select("sequencia_id")
        .eq("pipeline_lead_id", leadId)
        .in("status", ["ativa", "pausada"]);

      setActiveSeqs((active || []).map(a => a.sequencia_id));
      setLoading(false);
    })();
  }, [leadId, stageType]);

  const handleApply = useCallback(async (seqId: string) => {
    if (!user) return;
    setApplying(seqId);
    try {
      const { error } = await supabase.from("pipeline_lead_sequencias").insert({
        pipeline_lead_id: leadId,
        sequencia_id: seqId,
        status: "ativa",
        passo_atual: 0,
      });
      if (error) throw error;
      setActiveSeqs(prev => [...prev, seqId]);
      toast.success("Sequência aplicada ao lead!");
    } catch {
      toast.error("Erro ao aplicar sequência");
    } finally {
      setApplying(null);
    }
  }, [leadId, user]);

  if (loading) return null;
  if (suggested.length === 0) return null;

  const suggestion = STAGE_SUGGESTIONS[stageType];

  return (
    <Card className="p-3 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-primary" />
        <h4 className="text-[11px] font-bold text-primary">Sugestão de Sequência</h4>
        {suggestion && (
          <Badge variant="secondary" className="text-[9px]">{suggestion}</Badge>
        )}
      </div>

      <div className="space-y-1.5">
        {suggested.map(seq => {
          const isActive = activeSeqs.includes(seq.id);
          return (
            <div key={seq.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background border border-border">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-foreground truncate block">{seq.nome}</span>
                {seq.descricao && (
                  <span className="text-[10px] text-muted-foreground truncate block">{seq.descricao}</span>
                )}
              </div>
              {isActive ? (
                <Badge variant="default" className="text-[9px] gap-1 shrink-0">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => handleApply(seq.id)}
                  disabled={applying === seq.id}
                >
                  {applying === seq.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Aplicar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
