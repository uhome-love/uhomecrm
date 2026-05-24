// ─────────────────────────────────────────────────────────────────
// CardOverflowMenu — Menu curado do CardMinimal (Pipeline v2 / Fase 5)
//
// 7 itens fixos:
//   ↔ Mudar de etapa  ▸ sub-menu com stages ativas (exclui atual + descarte + convertido)
//   📅 Agendar visita
//   ✓  Criar tarefa   → abre drawer do lead (diretriz "Tudo no Lead")
//   🔄 Repassar lead
//   🤝 Parceria
//   ──────────────
//   🗑️ Descartar lead → DiscardLeadDialog defaultTipo="reengajavel"
//   📦 Inativar lead  → DiscardLeadDialog defaultTipo="definitivo"
//
// Reusa dialogs existentes sem modificá-los (exceto DiscardLeadDialog que ganha
// prop opcional defaultTipo).
// ─────────────────────────────────────────────────────────────────

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import CardScheduleVisitDialog from "./CardScheduleVisitDialog";
import PartnershipDialog from "./PartnershipDialog";
import PipelineTransferDialog from "./PipelineTransferDialog";
import DiscardLeadDialog from "./DiscardLeadDialog";

interface CardOverflowMenuProps {
  lead: PipelineLead;
  stages: PipelineStage[];
  onMoveLead: (leadId: string, newStageId: string, observacao?: string) => void;
  onOpenDetail: () => void;
  onTransferred?: (leadId: string, corretorId: string, nome: string) => void;
}

function trackMenuAction(leadId: string, action: string) {
  // TODO P3: substituir por trackPipelineEvent quando disponível
  // eslint-disable-next-line no-console
  console.debug("[pipeline_card_menu_action]", { lead_id: leadId, action });
}

export default function CardOverflowMenu({
  lead,
  stages,
  onMoveLead,
  onOpenDetail,
  onTransferred,
}: CardOverflowMenuProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardTipo, setDiscardTipo] = useState<"reengajavel" | "definitivo">("reengajavel");

  const moveStages = stages.filter(
    (s) => s.id !== lead.stage_id && s.tipo !== "descarte" && s.tipo !== "convertido"
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity"
            aria-label="Ações do lead"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-sm">
              <span className="mr-2">↔</span>Mudar de etapa
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-52 max-h-72 overflow-auto">
                {moveStages.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Sem etapas disponíveis
                  </DropdownMenuItem>
                ) : (
                  moveStages.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => {
                        trackMenuAction(lead.id, `change_stage:${s.tipo || s.nome}`);
                        onMoveLead(lead.id, s.id);
                      }}
                      className="text-sm"
                    >
                      {s.nome}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "schedule_visit");
              setScheduleOpen(true);
            }}
            className="text-sm"
          >
            <span className="mr-2">📅</span>Agendar visita
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "create_task");
              onOpenDetail();
            }}
            className="text-sm"
          >
            <span className="mr-2">✓</span>Criar tarefa
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "transfer");
              setTransferOpen(true);
            }}
            className="text-sm"
          >
            <span className="mr-2">🔄</span>Repassar lead
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "partnership");
              setPartnerOpen(true);
            }}
            className="text-sm"
          >
            <span className="mr-2">🤝</span>Parceria
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "discard");
              setDiscardTipo("reengajavel");
              setDiscardOpen(true);
            }}
            className="text-sm text-amber-700 dark:text-amber-500 focus:text-amber-700 dark:focus:text-amber-500"
          >
            <span className="mr-2">🗑️</span>Descartar lead
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              trackMenuAction(lead.id, "inactivate");
              setDiscardTipo("definitivo");
              setDiscardOpen(true);
            }}
            className="text-sm text-destructive focus:text-destructive"
          >
            <span className="mr-2">📦</span>Inativar lead
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs — isolados de propagation do card */}
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        {scheduleOpen && (
          <CardScheduleVisitDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            lead={lead}
            stages={stages}
            onMoveLead={onMoveLead}
          />
        )}
        {partnerOpen && (
          <PartnershipDialog
            open={partnerOpen}
            onOpenChange={setPartnerOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            corretorPrincipalId={lead.corretor_id}
          />
        )}
        {transferOpen && (
          <PipelineTransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            currentCorretorId={lead.corretor_id}
            stages={stages}
            onTransferred={(corretorId, nome) =>
              onTransferred?.(lead.id, corretorId, nome)
            }
          />
        )}
        {discardOpen && (
          <DiscardLeadDialog
            open={discardOpen}
            onOpenChange={setDiscardOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            stages={stages}
            defaultTipo={discardTipo}
          />
        )}
      </div>
    </>
  );
}
