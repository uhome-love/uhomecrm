import { MessageCircle, Zap, Calendar, Send, ArrowRightLeft, Handshake, ArrowRight, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { PipelineStage } from "@/hooks/usePipeline";
import CardQuickTaskPopover from "./CardQuickTaskPopover";
import QuickActionMenu from "./QuickActionMenu";

interface CardActionBarProps {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  stageId: string;
  stages: PipelineStage[];
  canTransfer: boolean;
  onWhatsApp: (e: React.MouseEvent) => void;
  onOpenDetail: () => void;
  onScheduleVisit: () => void;
  onOpenComunicacao: () => void;
  onOpenTransfer: () => void;
  onOpenPartner: () => void;
  onMarkLost: () => void;
  onMoveStage: (e: React.MouseEvent, stageId: string) => void;
}

export default function CardActionBar({
  leadId, leadNome, leadTelefone, stageId, stages, canTransfer,
  onWhatsApp, onOpenDetail, onScheduleVisit, onOpenComunicacao,
  onOpenTransfer, onOpenPartner, onMarkLost, onMoveStage,
}: CardActionBarProps) {
  return (
    <div data-actions-area className="px-2.5 py-1.5 flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        <CardQuickTaskPopover leadId={leadId} leadNome={leadNome} />

        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px] text-[11px] px-3 gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
          title="Abrir WhatsApp"
          onClick={onWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>

        <QuickActionMenu
          leadId={leadId}
          leadNome={leadNome}
          onOpenDetail={onOpenDetail}
          onScheduleVisit={onScheduleVisit}
        >
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] text-[11px] px-3 gap-1.5 font-semibold text-primary hover:bg-primary/10 rounded-lg"
            title="Ação rápida"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Ação</span>
          </Button>
        </QuickActionMenu>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="min-h-[44px] w-11 p-0 hover:bg-accent" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          {stages.filter(s => s.id !== stageId).slice(0, 5).map(s => (
            <DropdownMenuItem key={s.id} onClick={(e) => onMoveStage(e as any, s.id)}>
              <ArrowRight className="h-3.5 w-3.5 mr-2" /> {s.nome}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onScheduleVisit(); }}>
            <Calendar className="h-3.5 w-3.5 mr-2" /> Agendar visita
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenComunicacao(); }}>
            <Send className="h-3.5 w-3.5 mr-2" /> Central de comunicação
          </DropdownMenuItem>
          {canTransfer && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenTransfer(); }}>
              <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Repassar lead
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenPartner(); }}>
            <Handshake className="h-3.5 w-3.5 mr-2" /> Parceria
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onMarkLost(); }}>
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Descartar lead
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
