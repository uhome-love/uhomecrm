// ─────────────────────────────────────────────────────────────────
// CardMinimal — Card minimalista do Pipeline v2 (Fase 5)
//
// Princípio: card é APENAS visualização + drag + abrir drawer.
// Nenhuma ação dispara dialog aqui (regra "Tudo no Lead"). O 3-dot abre o drawer.
//
// Visual:
//   • Borda esquerda 4px colorida pelo status da tarefa
//     - vermelho   → tarefa atrasada
//     - âmbar      → tarefa para hoje
//     - emerald    → tarefa futura
//     - slate      → sem tarefa pendente
//   • Linha 1: Nome do lead (truncate)
//   • Linha 2: Empreendimento (truncate, opcional)
//   • Linha 3: Próxima ação humanizada (formatNextAction)
//   • Linha 4 (opcional): telefone + parceiro/corretor
// ─────────────────────────────────────────────────────────────────

import { memo, useMemo } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { formatNextAction } from "@/lib/formatNextAction";
import { todayBRT } from "@/lib/brtTime";
import { Handshake } from "lucide-react";
import CardOverflowMenu from "./CardOverflowMenu";

export interface CardMinimalProximaTarefa {
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
}

interface CardMinimalProps {
  lead: PipelineLead;
  stage?: PipelineStage;
  corretorNome?: string;
  parceiroNome?: string;
  proximaTarefa?: CardMinimalProximaTarefa | null;
  onClick: () => void;
  onDragStart: () => void;
  /** Stages do pipeline — necessário para o menu ··· (sub-menu "Mudar de etapa"). */
  stages?: PipelineStage[];
  /** Handler para mover lead via menu. Se omitido, sub-menu é desabilitado. */
  onMoveLead?: (leadId: string, newStageId: string, observacao?: string) => void;
  /** Callback após repasse de lead. */
  onTransferred?: (leadId: string, corretorId: string, nome: string) => void;
}

type StatusKey = "atrasada" | "hoje" | "futura" | "sem" | "convertido" | "descarte";

function resolveStatus(
  tarefa: CardMinimalProximaTarefa | null | undefined,
  stageTipo?: string
): StatusKey {
  if (stageTipo === "convertido") return "convertido";
  if (stageTipo === "descarte") return "descarte";
  if (!tarefa?.vence_em) return "sem";
  const hoje = todayBRT();
  if (tarefa.vence_em < hoje) return "atrasada";
  if (tarefa.vence_em === hoje) {
    // Mesmo dia: se hora_vencimento já passou (BRT), considera atrasada
    // (alinhado com getLeadStatusFilter para que filtro e borda do card combinem).
    if (tarefa.hora_vencimento) {
      const nowHHMM = new Date().toLocaleTimeString("en-GB", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      if (tarefa.hora_vencimento.slice(0, 5) < nowHHMM) return "atrasada";
    }
    return "hoje";
  }
  return "futura";
}


// Borda 4px à esquerda — semantic-friendly Tailwind classes.
const SIDEBAR_BY_STATUS: Record<StatusKey, string> = {
  atrasada: "before:bg-red-500",
  hoje: "before:bg-amber-500",
  futura: "before:bg-emerald-500",
  sem: "before:bg-slate-300 dark:before:bg-slate-600",
  convertido: "before:bg-primary",
  descarte: "before:bg-zinc-400 dark:before:bg-zinc-600",
};

const NEXT_ACTION_TONE: Record<StatusKey, string> = {
  atrasada: "text-red-600 dark:text-red-400",
  hoje: "text-amber-600 dark:text-amber-400",
  futura: "text-emerald-600 dark:text-emerald-400",
  sem: "text-muted-foreground",
  convertido: "text-primary",
  descarte: "text-muted-foreground",
};

function deduplicateEmp(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(/[·,;|]/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p.replace(/\s*\(.*?\)\s*/g, "").trim());
    }
  }
  return out.join(" · ");
}

function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  const local = (d.length === 13 || d.length === 12) && d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

function daysInStage(stageChangedAt: string | null | undefined): number | null {
  if (!stageChangedAt) return null;
  const t = new Date(stageChangedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

const CardMinimal = memo(function CardMinimal({
  lead,
  stage,
  corretorNome,
  parceiroNome,
  proximaTarefa,
  onClick,
  onDragStart,
  stages,
  onMoveLead,
  onTransferred,
}: CardMinimalProps) {
  const status = useMemo(
    () => resolveStatus(proximaTarefa ?? null, stage?.tipo),
    [proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento, stage?.tipo]
  );

  const nextActionLabel = useMemo(
    () => formatNextAction(proximaTarefa ?? null),
    [proximaTarefa?.tipo, proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento]
  );

  const empreendimento = useMemo(
    () => deduplicateEmp(lead.empreendimento || ""),
    [lead.empreendimento]
  );

  const telefoneFmt = useMemo(
    () => formatPhoneBR(lead.telefone || lead.telefone2 || ""),
    [lead.telefone, lead.telefone2]
  );

  const dias = useMemo(() => daysInStage(lead.stage_changed_at), [lead.stage_changed_at]);
  const diasLabel = dias == null || dias < 1 ? null : dias > 30 ? "30d+" : `${dias}d`;

  const menuEnabled = !!(stages && onMoveLead);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={[
        "group relative cursor-pointer rounded-xl bg-card border border-border/60",
        "px-3 py-2.5 pl-4 shadow-sm hover:shadow-md transition-all",
        "hover:border-border hover:-translate-y-px",
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r",
        SIDEBAR_BY_STATUS[status],
      ].join(" ")}
    >
      {/* Header: nome + 3-dot */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {lead.nome || "Sem nome"}
          </div>
          {empreendimento && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {empreendimento}
            </div>
          )}
        </div>
        {menuEnabled && (
          <CardOverflowMenu
            lead={lead}
            stages={stages!}
            onMoveLead={onMoveLead!}
            onOpenDetail={onClick}
            onTransferred={onTransferred}
          />
        )}
      </div>

      {/* Telefone */}
      {telefoneFmt && (
        <div className="mt-1 text-[12px] text-foreground/80 truncate">
          {telefoneFmt}
        </div>
      )}

      {/* Divisor sutil */}
      <div className="mt-2 border-t border-border/40" />

      {/* Próxima ação + dias-na-etapa (compactado em 1 linha) */}
      <div className="mt-2 flex justify-between items-center gap-2">
        <span className={`flex-1 min-w-0 truncate text-[11px] font-medium ${NEXT_ACTION_TONE[status]}`}>
          {nextActionLabel}
        </span>
        {diasLabel && (
          <span className="shrink-0 text-[10px] max-[479px]:text-[9px] font-medium text-muted-foreground">
            {diasLabel}
          </span>
        )}
      </div>

      {/* Rodapé: corretor / parceria — só aparece quando houver dado */}
      {(corretorNome || parceiroNome) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
          {parceiroNome ? (
            <>
              <Handshake className="h-3 w-3 shrink-0" />
              <span className="truncate">{parceiroNome}</span>
            </>
          ) : (
            <span className="truncate">{corretorNome}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default CardMinimal;
