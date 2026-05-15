import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Zap, Phone, PhoneOff, MessageCircle, Mail, FileText, ClipboardList, MapPin, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  leadId: string;
  leadNome: string;
  corretorId?: string;
  children: React.ReactNode;
  onOpenDetail?: () => void;
  onScheduleVisit?: () => void;
  onRefresh?: () => void;
}

const QUICK_ACTIONS = [
  { id: "ligou_atendeu", emoji: "📞", label: "Liguei — atendeu", tipo: "ligacao", titulo: "Ligação realizada — atendeu" },
  { id: "ligou_nao_atendeu", emoji: "📞", label: "Liguei — não atendeu", tipo: "ligacao", titulo: "Ligação realizada — não atendeu", createTask: true },
  { id: "whatsapp", emoji: "💬", label: "Mandei WhatsApp", tipo: "whatsapp", titulo: "WhatsApp enviado" },
  { id: "email", emoji: "✉️", label: "Mandei email", tipo: "email", titulo: "Email enviado" },
  { id: "proposta", emoji: "📄", label: "Enviei proposta", tipo: "proposta", titulo: "Proposta enviada" },
  { id: "material", emoji: "📋", label: "Enviei material", tipo: "envio_material", titulo: "Material enviado" },
  { id: "visita", emoji: "🏠", label: "Marquei visita", tipo: "visita", titulo: "Visita agendada", openVisit: true },
];

export default function QuickActionMenu({ leadId, leadNome, corretorId, children, onOpenDetail, onScheduleVisit, onRefresh }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const handleAction = async (action: typeof QUICK_ACTIONS[0]) => {
    if (!user) return;

    // Open visit scheduler
    if (action.openVisit && onScheduleVisit) {
      onScheduleVisit();
      setOpen(false);
      return;
    }

    // Register activity
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: leadId,
      tipo: action.tipo,
      titulo: action.titulo,
      created_by: user.id,
    });

    // Update ultima_acao_at
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    // If "não atendeu", create a callback task in 2h
    if (action.createTask) {
      const venceEm = new Date();
      venceEm.setHours(venceEm.getHours() + 2);
      const dateStr = venceEm.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const timeStr = venceEm.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: leadId,
        tipo: "ligar",
        titulo: "Retornar ligação",
        descricao: `${leadNome} não atendeu. Retornar em 2h.`,
        vence_em: dateStr,
        hora_vencimento: timeStr,
        responsavel_id: corretorId || user.id,
        created_by: user.id,
      });
      toast.success(`${action.emoji} ${action.titulo} + Tarefa criada para retornar em 2h`);
    } else {
      toast.success(`${action.emoji} ${action.titulo}`);
    }

    onRefresh?.();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1.5 text-xs font-bold text-muted-foreground">⚡ Registrar Ação Rápida</p>
        <DropdownMenuSeparator />
        {QUICK_ACTIONS.map((action) => (
          <DropdownMenuItem key={action.id} onClick={() => handleAction(action)} className="gap-2 cursor-pointer">
            <span>{action.emoji}</span>
            <span className="text-sm">{action.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setOpen(false); onOpenDetail?.(); }} className="gap-2 cursor-pointer">
          <Pencil className="h-3.5 w-3.5" />
          <span className="text-sm">📝 Registrar com detalhes</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
