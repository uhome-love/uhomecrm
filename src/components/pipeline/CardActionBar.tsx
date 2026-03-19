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
    <div data-actions-area>
      {/* 3-column footer grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          position: "relative",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* Dividers */}
        <div style={{
          position: "absolute", left: "33.33%", top: "20%", bottom: "20%",
          width: 1, background: "#F1F5F9",
        }} />
        <div style={{
          position: "absolute", left: "66.66%", top: "20%", bottom: "20%",
          width: 1, background: "#F1F5F9",
        }} />

        {/* Button 1: Tarefa */}
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center",
            borderRadius: "0 0 0 13px",
          }}
        >
          <CardQuickTaskPopover leadId={leadId} leadNome={leadNome} />
        </div>

        {/* Button 2: Mensagem */}
        <button
          onClick={onWhatsApp}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "9px 6px", cursor: "pointer",
            background: "transparent", border: "none",
            transition: "background 0.15s ease",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#EFF6FF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ fontSize: 15 }}>💬</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#2563EB", marginTop: 2 }}>Mensagem</span>
        </button>

        {/* Button 3: Ação (dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "9px 6px", cursor: "pointer",
                background: "transparent", border: "none",
                borderRadius: "0 0 13px 0",
                transition: "background 0.15s ease",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#ECFDF5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 15 }}>⚡</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#059669", marginTop: 2 }}>Ação</span>
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
