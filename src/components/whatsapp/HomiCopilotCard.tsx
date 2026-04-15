import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, CalendarPlus, ArrowRight, Loader2, Thermometer } from "lucide-react";
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
  opcoes_resposta?: string[];
  briefing: string;
  tom_detectado: "interessado" | "hesitante" | "frio" | "pronto" | "curioso" | "com_objecao";
  temperatura_detectada?: "frio" | "morno" | "quente";
  momento_detectado?: "primeiro_contato" | "qualificacao" | "apresentacao" | "convite_visita" | "followup" | "objecao";
  proxima_acao?: string;
  sugestao_followup: string | null;
  sugestao_etapa: string | null;
}

const TOM_CONFIG: Record<string, { emoji: string; className: string }> = {
  interessado: { emoji: "🟢", className: "text-green-600" },
  hesitante: { emoji: "🟡", className: "text-yellow-600" },
  frio: { emoji: "🔵", className: "text-blue-600" },
  pronto: { emoji: "🔥", className: "text-orange-600" },
  curioso: { emoji: "🔵", className: "text-blue-500" },
  com_objecao: { emoji: "🟠", className: "text-orange-500" },
};

const MOMENTO_CONFIG: Record<string, { emoji: string; label: string }> = {
  primeiro_contato: { emoji: "🤝", label: "Acolhimento" },
  qualificacao: { emoji: "🔍", label: "Qualificando" },
  apresentacao: { emoji: "🏠", label: "Apresentando" },
  convite_visita: { emoji: "📅", label: "Propor visita" },
  followup: { emoji: "🔔", label: "Reativação" },
  objecao: { emoji: "⚠️", label: "Objeção detectada" },
};

const TEMP_CONFIG: Record<string, { emoji: string; label: string; className: string }> = {
  frio: { emoji: "🔵", label: "Frio", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  morno: { emoji: "🟡", label: "Morno", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  quente: { emoji: "🔴", label: "Quente", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const OPTION_LABELS = ["💬 Direta", "😊 Leve", "🤔 Curiosa"];

export default function HomiCopilotCard({ leadId, leadName, lastMessage, onUseSuggestion, isReadOnly = false }: HomiCopilotCardProps) {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CopilotData | null>(null);
  const [editedSuggestion, setEditedSuggestion] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessage) return;
    setLoading(true);
    setData(null);
    setVisible(true);
    setSelectedOption(null);

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
        const d = res as CopilotData;
        setData(d);
        setEditedSuggestion(d.sugestao_resposta);
        setLoading(false);
      });
  }, [leadId, lastMessage]);

  if (!visible) return null;

  const handleSelectOption = (idx: number) => {
    if (!data?.opcoes_resposta?.[idx]) return;
    setSelectedOption(idx);
    setEditedSuggestion(data.opcoes_resposta[idx]);
  };

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
  const momento = data?.momento_detectado ? MOMENTO_CONFIG[data.momento_detectado] || null : null;
  const temp = data?.temperatura_detectada ? TEMP_CONFIG[data.temperatura_detectada] || null : null;
  const hasOptions = data?.opcoes_resposta && data.opcoes_resposta.length >= 2;

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 mx-4 mb-3">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Sparkles size={14} />
            <span className="text-xs font-semibold">HOMI Copilot</span>
          </div>
          <div className="flex items-center gap-2">
            {momento && (
              <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                {momento.emoji} {momento.label}
              </span>
            )}
            {temp && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${temp.className}`}>
                {temp.emoji} {temp.label}
              </span>
            )}
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
            {data.proxima_acao && (
              <div className="text-[11px]">
                <span className="font-medium text-muted-foreground">Objetivo: </span>
                <span className="text-accent-foreground font-medium">{data.proxima_acao}</span>
              </div>
            )}

            {/* Option buttons */}
            {hasOptions && (
              <div className="flex gap-1.5">
                {data.opcoes_resposta!.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      selectedOption === idx
                        ? "border-green-500 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:border-green-300 hover:text-foreground"
                    }`}
                  >
                    {OPTION_LABELS[idx] || `Opção ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

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
