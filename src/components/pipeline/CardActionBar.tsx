import { Phone, ClipboardList, MessageCircle, MoreHorizontal, Calendar, Send, ArrowRightLeft, Handshake, ArrowRight, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { PipelineStage } from "@/hooks/usePipeline";
import CardQuickTaskPopover from "./CardQuickTaskPopover";

interface CardActionBarProps {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  stageId: string;
  stages: PipelineStage[];
  canTransfer: boolean;
  onCall: (e: React.MouseEvent) => void;
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
  onCall, onWhatsApp, onOpenDetail, onScheduleVisit, onOpenComunicacao,
  onOpenTransfer, onOpenPartner, onMarkLost, onMoveStage,
}: CardActionBarProps) {
  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
    padding: "8px 4px", cursor: "pointer",
    background: "transparent", border: "none", outline: "none",
    fontSize: 11, fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "background 0.15s ease",
    flex: 1, minWidth: 0,
  };

  return (
    <div data-actions-area>
      <div style={{
        display: "flex", alignItems: "center",
        borderTop: "0.5px solid var(--border)",
      }}>
        {/* Ligar */}
        <button
          onClick={onCall}
          style={{ ...btnBase, color: "#4F46E5" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#EEEDFE"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Phone style={{ width: 12, height: 12 }} />
          <span>Ligar</span>
        </button>

        <div style={{ width: 0.5, alignSelf: "stretch", background: "var(--border)" }} />

        {/* Tarefa */}
        <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
          <CardQuickTaskPopover leadId={leadId} leadNome={leadNome} />
        </div>

        <div style={{ width: 0.5, alignSelf: "stretch", background: "var(--border)" }} />

        {/* WhatsApp */}
        <button
          onClick={onWhatsApp}
          style={{ ...btnBase, color: "#16a34a", flexDirection: "row" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#EAF3DE"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>💬</span>
          <span>WhatsApp</span>
        </button>

        <div style={{ width: 0.5, alignSelf: "stretch", background: "var(--border)" }} />

        {/* ··· Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{ ...btnBase, flex: "none", width: 36, color: "#888780", outline: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--muted))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <MoreHorizontal style={{ width: 14, height: 14 }} />
            </button>
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
    </div>
  );
}
