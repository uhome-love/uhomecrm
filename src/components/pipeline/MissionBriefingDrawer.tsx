import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Mail, Eye, ArrowRight } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PhaseTheme {
  name: string;
  icon: string;
  color: string;
  missionBadge: string;
}

interface Props {
  lead: PipelineLead | null;
  stages: PipelineStage[];
  stageThemes: Map<string, PhaseTheme>;
  corretorNomes: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveLead: (leadId: string, stageId: string) => void;
  onViewFull: (lead: PipelineLead) => void;
}

export default function MissionBriefingDrawer({
  lead, stages, stageThemes, corretorNomes, open, onOpenChange, onMoveLead, onViewFull,
}: Props) {
  if (!lead) return null;

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const currentIdx = stages.findIndex(s => s.id === lead.stage_id);
  const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
  const theme = stageThemes.get(lead.stage_id);
  const daysHere = differenceInDays(new Date(), new Date(lead.stage_changed_at));

  const handleAdvance = () => {
    if (!nextStage) return;
    onMoveLead(lead.id, nextStage.id);
    const nextTheme = stageThemes.get(nextStage.id);
    toast.success(`${nextTheme?.icon || "➜"} ${lead.nome} avançou para ${nextTheme?.name || nextStage.nome}!`);
    onOpenChange(false);
  };

  const handleWhatsApp = () => {
    if (!lead.telefone) return;
    const digits = lead.telefone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${number}`, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[440px] border-l p-0 overflow-y-auto"
        style={{ background: "#0A0F1E", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-white text-lg font-black flex items-center gap-2">
              📋 BRIEFING DA MISSÃO
            </SheetTitle>
            {theme && (
              <Badge className="w-fit text-[10px] border-0" style={{ background: `${theme.color}20`, color: theme.color }}>
                {theme.icon} {theme.name}
              </Badge>
            )}
          </SheetHeader>

          {/* Lead info */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-base font-bold text-white">{lead.nome}</h3>
            {lead.empreendimento && (
              <p className="text-xs text-gray-400">{lead.empreendimento}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>⏱️ {daysHere} dias nesta fase</span>
              {lead.valor_estimado && (
                <span>💰 R$ {lead.valor_estimado.toLocaleString("pt-BR")}</span>
              )}
            </div>
            {lead.corretor_id && corretorNomes[lead.corretor_id] && (
              <p className="text-xs text-gray-500">👤 {corretorNomes[lead.corretor_id]}</p>
            )}
          </div>

          {/* Contact actions */}
          <div className="flex gap-2">
            {lead.telefone && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs border-gray-700 text-gray-300 hover:text-white"
                onClick={() => window.open(`tel:${lead.telefone}`, "_self")}
              >
                <Phone className="h-3.5 w-3.5" /> Ligar
              </Button>
            )}
            {lead.telefone && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs border-green-800 text-green-400 hover:text-green-300"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            )}
            {lead.email && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs border-gray-700 text-gray-300 hover:text-white"
                onClick={() => window.open(`mailto:${lead.email}`, "_blank")}
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
            )}
          </div>

          {/* Details */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Detalhes</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>
                <span className="text-gray-500">Origem</span>
                <p className="text-gray-300">{lead.origem?.replace(/_/g, " ") || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Temperatura</span>
                <p className="text-gray-300">{lead.temperatura || "auto"}</p>
              </div>
              <div>
                <span className="text-gray-500">Criado em</span>
                <p className="text-gray-300">{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <span className="text-gray-500">Última atualização</span>
                <p className="text-gray-300">{format(new Date(lead.updated_at), "dd/MM HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
            {lead.observacoes && (
              <div className="pt-2 border-t border-gray-800">
                <span className="text-[10px] text-gray-500 uppercase">Observações</span>
                <p className="text-xs text-gray-300 mt-1">{lead.observacoes}</p>
              </div>
            )}
          </div>

          {/* Próxima ação */}
          {lead.proxima_acao && (
            <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <h4 className="text-xs font-bold text-blue-400 mb-1">🤖 Próxima ação sugerida</h4>
              <p className="text-xs text-gray-300">{lead.proxima_acao}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {nextStage && (
              <Button
                className="flex-1 gap-1.5 font-bold"
                onClick={handleAdvance}
                style={{ background: theme?.color || "#3B82F6" }}
              >
                Avançar fase <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-gray-700 text-gray-300"
              onClick={() => onViewFull(lead)}
            >
              <Eye className="h-4 w-4" /> Ver no Pipeline
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
