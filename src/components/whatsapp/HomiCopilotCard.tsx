import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, CalendarPlus, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HomiCopilotCardProps {
  leadId: string;
  leadName: string;
  lastMessage: string;
  onUseSuggestion: (text: string) => void;
  isReadOnly?: boolean;
}

interface CopilotData {
  sugestao_resposta: string;
  briefing: string;
  tom_detectado: "interessado" | "hesitante" | "frio" | "pronto";
  sugestao_followup: string | null;
  sugestao_etapa: string | null;
}

const TOM_CONFIG = {
  interessado: { emoji: "🟢", className: "text-green-600" },
  hesitante: { emoji: "🟡", className: "text-yellow-600" },
  frio: { emoji: "🔵", className: "text-blue-600" },
  pronto: { emoji: "🔥", className: "text-orange-600" },
};

export default function HomiCopilotCard({ leadId, leadName, lastMessage, onUseSuggestion, isReadOnly = false }: HomiCopilotCardProps) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CopilotData | null>(null);
  const [editedSuggestion, setEditedSuggestion] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessage) return;
    setLoading(true);
    setData(null);
    setVisible(true);

    supabase.functions
      .invoke("homi-copilot", {
        body: { lead_id: leadId, ultima_mensagem: lastMessage },
      })
      .then(({ data: res, error }) => {
        if (error) {
          console.error("homi-copilot error:", error);
          setLoading(false);
          return;
        }
        setData(res as CopilotData);
        setEditedSuggestion((res as CopilotData).sugestao_resposta);
        setLoading(false);
      });
  }, [leadId, lastMessage]);

  if (!visible) return null;

  const handleFollowup = async () => {
    if (!data?.sugestao_followup) return;
    setActionLoading("followup");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: leadId,
      titulo: data.sugestao_followup,
      vence_em: tomorrow.toISOString(),
      status: "pendente",
      tipo: "follow_up",
    });
    setActionLoading(null);
    if (error) {
      toast.error("Erro ao criar follow-up");
    } else {
      toast.success("✅ Follow-up criado");
    }
  };

  const handleMoverEtapa = async () => {
    if (!data?.sugestao_etapa) return;
    setActionLoading("etapa");

    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("nome", data.sugestao_etapa)
      .maybeSingle();

    if (!stage) {
      toast.error(`Etapa "${data.sugestao_etapa}" não encontrada`);
      setActionLoading(null);
      return;
    }

    const { error } = await supabase
      .from("pipeline_leads")
      .update({ stage_id: stage.id })
      .eq("id", leadId);

    setActionLoading(null);
    if (error) {
      toast.error("Erro ao mover lead");
    } else {
      toast.success(`✅ Lead movido para ${data.sugestao_etapa}`);
    }
  };

  const tom = data ? TOM_CONFIG[data.tom_detectado] || TOM_CONFIG.hesitante : null;

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 mx-4 mb-3">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Sparkles size={14} />
            <span className="text-xs font-semibold">HOMI Copilot</span>
          </div>
          <div className="flex items-center gap-2">
            {tom && data && (
              <span className={`text-xs font-medium ${tom.className}`}>
                {tom.emoji} {data.tom_detectado}
              </span>
            )}
            <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={14} className="animate-spin text-green-600" />
            <span className="text-xs text-muted-foreground">HOMI está analisando...</span>
          </div>
        ) : data ? (
          <>
            <p className="text-[11px] italic text-muted-foreground">{data.briefing}</p>
            <Textarea
              value={editedSuggestion}
              onChange={(e) => setEditedSuggestion(e.target.value)}
              className="min-h-[60px] max-h-[120px] text-xs resize-none bg-white dark:bg-background border-border"
            />
            <div className="flex gap-2 flex-wrap">
              {!isReadOnly && (
                <>
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onUseSuggestion(editedSuggestion)}>
                    ✓ Usar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVisible(false)}>
                    Ignorar
                  </Button>
                </>
              )}
              {isReadOnly && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVisible(false)}>
                  Fechar
                </Button>
              )}
              {!isReadOnly && data.sugestao_followup && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={actionLoading === "followup"}
                  onClick={handleFollowup}
                >
                  {actionLoading === "followup" ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />}
                  {" "}+ {data.sugestao_followup}
                </Button>
              )}
              {!isReadOnly && data.sugestao_etapa && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={actionLoading === "etapa"}
                  onClick={handleMoverEtapa}
                >
                  {actionLoading === "etapa" ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                  {" "}💡 Mover para {data.sugestao_etapa}
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Não foi possível gerar sugestão.</p>
        )}
      </CardContent>
    </Card>
  );
}
