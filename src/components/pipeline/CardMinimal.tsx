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

import { memo, useMemo, useState } from "react";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { formatNextAction } from "@/lib/formatNextAction";
import { todayBRT, formatBRT } from "@/lib/brtTime";
import { Handshake, Phone } from "lucide-react";
import CardOverflowMenu from "./CardOverflowMenu";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";
import {
  parseTaskActionType,
  ACTION_ICON,
  ACTION_LABEL,
  ACTION_ICON_COLOR,
  getLeadSubstatusBadge,
} from "@/lib/leadHelpers";

export interface CardMinimalProximaTarefa {
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
}

interface CardMinimalProps {
  lead: PipelineLead;
  stage?: PipelineStage;
  corretorNome?: string;
  corretorAvatarUrl?: string;
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

/** Só a parte temporal: "agora", "hoje 14:30", "amanhã", "em 3 dias", "28/05". */
function formatTaskWhen(tarefa: CardMinimalProximaTarefa | null | undefined): string {
  if (!tarefa?.vence_em) return "definir";
  const hoje = todayBRT();
  if (tarefa.vence_em < hoje) return "agora";
  if (tarefa.vence_em === hoje) {
    return tarefa.hora_vencimento ? `hoje ${tarefa.hora_vencimento.slice(0, 5)}` : "hoje";
  }
  const [yh, mh, dh] = hoje.split("-").map(Number);
  const [yv, mv, dv] = tarefa.vence_em.split("-").map(Number);
  const diffDays = Math.round(
    (Date.UTC(yv, mv - 1, dv) - Date.UTC(yh, mh - 1, dh)) / 86400000
  );
  if (diffDays === 1) return "amanhã";
  if (diffDays > 0 && diffDays <= 6) return `em ${diffDays} dias`;
  return formatBRT(`${tarefa.vence_em}T12:00:00-03:00`, "dd/MM");
}

function daysInStage(stageChangedAt: string | null | undefined): number | null {
  if (!stageChangedAt) return null;
  const t = new Date(stageChangedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function getInitials(nome: string): string {
  if (!nome) return "??";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const CardMinimal = memo(function CardMinimal({
  lead,
  stage,
  corretorNome,
  corretorAvatarUrl,
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

  const actionType = useMemo(
    () => parseTaskActionType(proximaTarefa?.tipo),
    [proximaTarefa?.tipo]
  );

  const actionWhen = useMemo(
    () => formatTaskWhen(proximaTarefa ?? null),
    [proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento]
  );

  // fallback acessível: usado como title e leitura por SR
  const fullActionLabel = useMemo(
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
  const [isDragging, setIsDragging] = useState(false);

  const isAtrasada = status === "atrasada";
  const showActionLine = stage?.tipo !== "convertido" && stage?.tipo !== "descarte";

  const substatus = useMemo(
    () => getLeadSubstatusBadge(lead.flag_status, stage?.tipo),
    [lead.flag_status, stage?.tipo]
  );

  return (
    <div
      draggable
      onDragStart={() => { setIsDragging(true); onDragStart(); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => {
        trackPipelineEvent("pipeline_card_clicked", {
          lead_id: lead.id,
          stage_id: lead.stage_id,
          corretor_id: lead.corretor_id,
          stage: stage?.tipo ?? stage?.nome,
          status,
        });
        onClick();
      }}
      data-dragging={isDragging || undefined}
      className={[
        "group relative cursor-pointer rounded-xl shadow-sm hover:shadow-md transition-all",
        "px-3 py-2.5 pl-4 hover:-translate-y-px",
        parceiroNome
          ? "bg-purple-50/40 dark:bg-purple-950/20 border border-purple-300/70 dark:border-purple-700/60 ring-1 ring-purple-400/50 hover:border-purple-400"
          : "bg-card border border-border/60 hover:border-border",
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r",
        stage?.tipo === "novo_lead" ? "before:bg-[#4F46E5]" : SIDEBAR_BY_STATUS[status],
        isDragging ? "opacity-60 scale-[0.98] shadow-lg cursor-grabbing" : "",
      ].join(" ")}
    >
      {/* Header: nome + substatus + 3-dot */}
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {stage?.tipo === "novo_lead" && (
              <span className="shrink-0 inline-block bg-[#4F46E5] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Novo
              </span>
            )}
            <div className="flex-1 min-w-0 text-[13.5px] font-semibold text-foreground tracking-tight leading-tight truncate">
              {lead.nome || "Sem nome"}
            </div>
            {substatus && (
              <span className={`shrink-0 ${substatus.className}`}>
                {substatus.label}
              </span>
            )}
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


      {/* Telefone com ícone discreto */}
      {telefoneFmt && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground/80 min-w-0">
          <Phone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{telefoneFmt}</span>
        </div>
      )}

      {showActionLine && (
        <>
          {/* Divisor sutil */}
          <div className="mt-2 border-t border-border/40" />

          {/* Linha de ação: ícone colorido + tipo (bold) + quando + dias-na-etapa */}
          <div
            className="mt-2 flex items-center gap-1.5 min-w-0"
            title={fullActionLabel}
          >
            <span
              aria-hidden
              className={`shrink-0 text-[12px] leading-none ${ACTION_ICON_COLOR[actionType]}`}
            >
              {ACTION_ICON[actionType]}
            </span>
            <span
              className={`flex-1 min-w-0 truncate text-[11.5px] ${
                isAtrasada ? "text-red-600" : "text-muted-foreground"
              }`}
            >
              <strong
                className={`font-semibold ${
                  isAtrasada ? "text-red-600" : "text-foreground"
                }`}
              >
                {ACTION_LABEL[actionType]}
              </strong>{" "}
              {actionWhen}
            </span>
            {diasLabel && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {diasLabel}
              </span>
            )}
          </div>
        </>
      )}

      {/* Rodapé: corretor / parceria — só aparece quando houver dado */}
      {(corretorNome || parceiroNome) && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1.5 min-w-0">
          {parceiroNome ? (
            <>
              <Handshake className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-[11px] font-medium text-foreground/70">
                {parceiroNome}
              </span>
            </>
          ) : (
            <>
              {corretorAvatarUrl ? (
                <img
                  src={corretorAvatarUrl}
                  alt={corretorNome || ""}
                  className="w-[22px] h-[22px] rounded-full object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7e22ce] text-white flex items-center justify-center font-semibold text-[9px] shrink-0">
                  {getInitials(corretorNome || "")}
                </div>
              )}
              <span className="truncate text-[11px] font-medium text-foreground/70">
                {corretorNome}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default CardMinimal;
