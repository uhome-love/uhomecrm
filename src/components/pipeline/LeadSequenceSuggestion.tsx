import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Bot, Play, CheckCircle2, MessageCircle, Phone, CalendarClock, Bell } from "lucide-react";
import { addDays, format } from "date-fns";

interface Props {
  leadId: string;
  leadNome: string;
  stageType: string;
  empreendimento?: string | null;
  onTasksCreated?: () => void;
}

interface BuiltInSequence {
  id: string;
  nome: string;
  descricao: string;
  stages: string[];
  passos: { titulo: string; tipo: string; diasOffset: number; icon: React.ReactNode }[];
}

const BUILT_IN_SEQUENCES: BuiltInSequence[] = [
  {
    id: "boas-vindas",
    nome: "Boas-vindas",
    descricao: "3 passos para engajar o lead recém-chegado",
    stages: ["novo_lead", "sem_contato"],
    passos: [
      { titulo: "Ligar para {{nome}}", tipo: "ligacao", diasOffset: 0, icon: <Phone className="h-3 w-3 text-blue-500" /> },
      { titulo: "WhatsApp de apresentação para {{nome}}", tipo: "whatsapp", diasOffset: 0, icon: <MessageCircle className="h-3 w-3 text-green-500" /> },
      { titulo: "Follow-up: {{nome}} respondeu?", tipo: "follow_up", diasOffset: 1, icon: <CalendarClock className="h-3 w-3 text-amber-500" /> },
    ],
  },
  {
    id: "contato-inicial",
    nome: "Sequência de contato",
    descricao: "Ligação + WhatsApp + follow-up em 3 dias",
    stages: ["contato_inicial", "sem_contato"],
    passos: [
      { titulo: "Ligar para {{nome}}", tipo: "ligacao", diasOffset: 0, icon: <Phone className="h-3 w-3 text-blue-500" /> },
      { titulo: "WhatsApp: enviar info do {{empreendimento}} para {{nome}}", tipo: "whatsapp", diasOffset: 1, icon: <MessageCircle className="h-3 w-3 text-green-500" /> },
      { titulo: "Follow-up final: ligar {{nome}}", tipo: "ligacao", diasOffset: 3, icon: <Phone className="h-3 w-3 text-blue-500" /> },
    ],
  },
  {
    id: "aquecer-visita",
    nome: "Aquecer para visita",
    descricao: "Enviar materiais e agendar visita",
    stages: ["aquecimento", "busca", "contato_inicial"],
    passos: [
      { titulo: "Enviar material do {{empreendimento}} para {{nome}}", tipo: "whatsapp", diasOffset: 0, icon: <MessageCircle className="h-3 w-3 text-green-500" /> },
      { titulo: "Ligar para {{nome}} — propor visita", tipo: "ligacao", diasOffset: 1, icon: <Phone className="h-3 w-3 text-blue-500" /> },
      { titulo: "Follow-up: confirmar visita com {{nome}}", tipo: "follow_up", diasOffset: 2, icon: <CalendarClock className="h-3 w-3 text-amber-500" /> },
    ],
  },
  {
    id: "pos-visita",
    nome: "Pós-visita",
    descricao: "Follow-up após visita realizada",
    stages: ["pos_visita", "negociacao"],
    passos: [
      { titulo: "WhatsApp pós-visita: {{nome}}, o que achou?", tipo: "whatsapp", diasOffset: 0, icon: <MessageCircle className="h-3 w-3 text-green-500" /> },
      { titulo: "Ligar para {{nome}} — proposta", tipo: "ligacao", diasOffset: 2, icon: <Phone className="h-3 w-3 text-blue-500" /> },
      { titulo: "Alerta: {{nome}} sem resposta pós-visita", tipo: "follow_up", diasOffset: 4, icon: <Bell className="h-3 w-3 text-destructive" /> },
    ],
  },
  {
    id: "reengajamento",
    nome: "Reengajamento",
    descricao: "Reativar lead parado há dias",
    stages: ["sem_contato", "contato_inicial", "aquecimento", "busca"],
    passos: [
      { titulo: "WhatsApp: Oi {{nome}}, ainda tem interesse no {{empreendimento}}?", tipo: "whatsapp", diasOffset: 0, icon: <MessageCircle className="h-3 w-3 text-green-500" /> },
      { titulo: "Ligar para {{nome}} — reengajar", tipo: "ligacao", diasOffset: 2, icon: <Phone className="h-3 w-3 text-blue-500" /> },
      { titulo: "Avaliar descarte de {{nome}}", tipo: "follow_up", diasOffset: 5, icon: <Bell className="h-3 w-3 text-destructive" /> },
    ],
  },
];

function replaceVars(text: string, nome: string, empreendimento?: string | null): string {
  return text
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{empreendimento\}\}/g, empreendimento || "imóvel");
}

export default function LeadSequenceSuggestion({ leadId, leadNome, stageType, empreendimento, onTasksCreated }: Props) {
  const { user } = useAuth();
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  // Filter sequences relevant to this stage
  const suggested = BUILT_IN_SEQUENCES.filter(s => s.stages.includes(stageType));

  const handleApply = useCallback(async (seq: BuiltInSequence) => {
    if (!user) return;
    setApplying(seq.id);

    try {
      const today = new Date();
      const tarefas = seq.passos.map((passo, i) => {
        const venceDate = addDays(today, passo.diasOffset);
        return {
          pipeline_lead_id: leadId,
          titulo: replaceVars(passo.titulo, leadNome, empreendimento),
          tipo: passo.tipo,
          status: "pendente",
          vence_em: format(venceDate, "yyyy-MM-dd"),
          hora_vencimento: passo.diasOffset === 0 ? format(new Date(today.getTime() + 30 * 60000), "HH:mm") : "09:00",
          responsavel_id: user.id,
          created_by: user.id,
          descricao: `Sequência: ${seq.nome}`,
        };
      });

      const { error } = await supabase.from("pipeline_tarefas").insert(tarefas as any);
      if (error) throw error;

      // Update lead ultima_acao
      await supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", leadId);

      setAppliedIds(prev => [...prev, seq.id]);
      toast.success(`Sequência "${seq.nome}" aplicada — ${tarefas.length} tarefas criadas!`);
      onTasksCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar sequência");
    } finally {
      setApplying(null);
    }
  }, [leadId, leadNome, empreendimento, user, onTasksCreated]);

  if (suggested.length === 0) return null;

  return (
    <Card className="p-3 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-primary" />
        <h4 className="text-[11px] font-bold text-primary">Sequências sugeridas para este lead</h4>
      </div>

      <div className="space-y-1.5">
        {suggested.map(seq => {
          const isApplied = appliedIds.includes(seq.id);
          return (
            <div key={seq.id} className="rounded-md bg-background border border-border overflow-hidden">
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-foreground block">{seq.nome}</span>
                  <span className="text-[10px] text-muted-foreground block">{seq.descricao}</span>
                </div>
                {isApplied ? (
                  <Badge variant="default" className="text-[9px] gap-1 shrink-0">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Aplicada
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => handleApply(seq)}
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
              {/* Steps preview */}
              <div className="px-2 pb-2 flex items-center gap-1.5 flex-wrap">
                {seq.passos.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                    {p.icon}
                    <span>D{p.diasOffset}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
