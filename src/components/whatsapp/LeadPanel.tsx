import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, CalendarPlus, ClipboardList, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LeadPanelProps {
  lead: {
    id: string;
    nome: string;
    telefone: string;
    empreendimento: string | null;
    stage_id: string | null;
    segmento_id: string | null;
    lead_score: number | null;
    valor_estimado: number | null;
    bairro_regiao: string | null;
  } | null;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function LeadPanel({ lead }: LeadPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creatingTask, setCreatingTask] = useState(false);
  const [dynamicScore, setDynamicScore] = useState<number>(0);

  // Calculate dynamic score from received messages count
  useEffect(() => {
    if (!lead?.id) {
      setDynamicScore(0);
      return;
    }
    // If lead already has a real score, use it
    if (lead.lead_score && lead.lead_score > 0) {
      setDynamicScore(lead.lead_score);
      return;
    }
    // Otherwise calculate from received messages
    supabase
      .from("whatsapp_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("direction", "received")
      .then(({ count }) => {
        const calculated = Math.min((count || 0) * 10, 100);
        setDynamicScore(calculated);
      });
  }, [lead?.id, lead?.lead_score]);

  const handleCreateTask = async () => {
    if (!lead || !user) return;
    setCreatingTask(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const venceEm = tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      const { error } = await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: lead.id,
        titulo: "Follow-up WhatsApp",
        tipo: "follow_up",
        status: "pendente",
        vence_em: venceEm,
        hora_vencimento: "10:00",
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("✅ Tarefa criada!");
    } catch (err: any) {
      toast.error("Erro ao criar tarefa: " + (err.message || ""));
    } finally {
      setCreatingTask(false);
    }
  };

  if (!lead) {
    return (
      <div className="w-[220px] border-l border-border bg-muted/30 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">Selecione uma conversa para ver os dados do lead</p>
      </div>
    );
  }

  const score = dynamicScore;

  return (
    <div className="w-[220px] border-l border-border bg-muted/30 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col items-center gap-2">
        <Avatar className="h-14 w-14">
          <AvatarFallback className={`${getAvatarColor(lead.nome)} text-white text-lg`}>
            {getInitials(lead.nome)}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm text-center">{lead.nome}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone size={10} />
          <span>{lead.telefone}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="p-3 border-b border-border flex flex-wrap gap-1 justify-center">
        {lead.empreendimento && <Badge variant="secondary" className="text-[10px]">{lead.empreendimento}</Badge>}
        {lead.bairro_regiao && <Badge variant="outline" className="text-[10px]">{lead.bairro_regiao}</Badge>}
      </div>

      {/* Score */}
      <div className="p-3 border-b border-border space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Score HOMI</span>
          <span className="font-semibold">{score}/100</span>
        </div>
        <Progress value={score} className="h-2" />
      </div>

      {/* Data */}
      <div className="p-3 border-b border-border space-y-2 text-xs">
        {lead.valor_estimado && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor estimado</span>
            <span className="font-medium">R$ {(lead.valor_estimado / 1000).toFixed(0)}k</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2 mt-auto">
        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => navigate(`/pipeline?lead=${lead.id}`)}>
          <Eye size={12} /> Ver no Pipeline
        </Button>
        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => {
          navigate(`/pipeline?lead=${lead.id}`);
          toast.info("Abra o lead no pipeline para agendar visita");
        }}>
          <CalendarPlus size={12} /> Agendar Visita
        </Button>
        <Button size="sm" variant="ghost" className="w-full text-xs h-8" disabled={creatingTask} onClick={handleCreateTask}>
          {creatingTask ? <Loader2 size={12} className="animate-spin" /> : <ClipboardList size={12} />}
          Criar Tarefa
        </Button>
      </div>
    </div>
  );
}
