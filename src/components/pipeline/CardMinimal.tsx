// ─────────────────────────────────────────────────────────────────
// CardMinimal — Card minimalista do Pipeline v2 (Fase 5)
//
// Princípio: card é APENAS visualização + drag + abrir drawer.
// Nenhuma ação dispara dialog aqui (regra "Tudo no Lead"). O 3-dot abre o drawer.
//
// Visual:
//   • Borda esquerda 4px colorida pelo status da tarefa
//     - vermelho   → tarefa atrasada
//     - emerald    → tarefa para hoje ou futura (em dia)
//     - âmbar      → sem tarefa pendente (precisa definir)
//     - sky        → convertido / zinc → descarte
//   • Linha 1: Nome do lead (truncate)
//   • Linha 2: Empreendimento (truncate, opcional)
//   • Linha 3: Próxima ação humanizada (formatNextAction)
//   • Linha 4 (opcional): telefone + parceiro/corretor
// ─────────────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { formatNextAction } from "@/lib/formatNextAction";
import { todayBRT, formatBRT } from "@/lib/brtTime";
import { Handshake, Phone, Check } from "lucide-react";
import CardOverflowMenu from "./CardOverflowMenu";
import TaskCompletionDialog from "./TaskCompletionDialog";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";
import { useAuth } from "@/hooks/useAuth";
import { completeLeadTask } from "@/lib/completeLeadTask";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import type { CompletionPayload } from "@/components/pipeline/task-completion/types";
import {
  parseTaskActionType,
  ACTION_ICON,
  ACTION_LABEL,
  ACTION_ICON_COLOR,
  getLeadSubstatusBadge,
} from "@/lib/leadHelpers";

import { fmtMoney } from "@/lib/fmtMoney";
import { substatusValueLabel } from "@/lib/pipelineAudit";

export interface CardMinimalProximaTarefa {
  id?: string;
  titulo?: string;
  tipo: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
  origem?: string | null;
}

interface CardMinimalProps {
  lead: PipelineLead;
  stage?: PipelineStage;
  corretorNome?: string;
  corretorAvatarUrl?: string;
  parceiroNome?: string;
  proximaTarefa?: CardMinimalProximaTarefa | null;
  /** Estado da cadência "Sem Contato" (tentativa atual + quando vence a próxima). */
  cadencia?: { tentativa: number; proxima_em: string | null } | null;
  /** Negócio vinculado ao lead — marca discreta ◆ e enriquecimento na lente Negócios. */
  negocioInfo?: { fase: string; vgv: number; fase_changed_at: string } | null;
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
  // Etapas terminais (Ganho/Caiu) não entram no fluxo de tarefas.
  if (stageTipo === "venda" || stageTipo === "caiu") return "convertido";
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
  hoje: "before:bg-emerald-500",
  futura: "before:bg-emerald-500",
  sem: "before:bg-amber-500",
  convertido: "before:bg-sky-500",
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
  cadencia,
  negocioInfo,
  onClick,
  onDragStart,
  stages,
  onMoveLead,
  onTransferred,
}: CardMinimalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [completingOpen, setCompletingOpen] = useState(false);
  const [completingBusy, setCompletingBusy] = useState(false);

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

  // Título específico = tarefa criada pelo qualificacaoTaskEngine (origem começa com "qualificacao_").
  // Dispensa rótulo genérico + actionWhen no card e o badge de substatus (redundante).
  // Não usar heurística de texto ("·"/"às") porque completeLeadTask também gera títulos com " · ".
  const hasSpecificTitle = useMemo(() => {
    return !!proximaTarefa?.origem?.startsWith("qualificacao_");
  }, [proximaTarefa?.origem]);

  // fallback acessível: usado como title e leitura por SR
  const fullActionLabel = useMemo(
    () => (hasSpecificTitle ? (proximaTarefa?.titulo || "") : formatNextAction(proximaTarefa ?? null)),
    [hasSpecificTitle, proximaTarefa?.titulo, proximaTarefa?.tipo, proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento]
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
  // Atalho de check só aparece para tarefa vencendo hoje ou atrasada, e desde que tenhamos o id.
  const canQuickComplete =
    !!proximaTarefa?.id && (status === "atrasada" || status === "hoje");

  const parceiroPrimeiroNome = useMemo(() => {
    if (!parceiroNome) return "";
    return parceiroNome.trim().split(/\s+/)[0] || parceiroNome;
  }, [parceiroNome]);

  const substatus = useMemo(
    () => getLeadSubstatusBadge(lead.flag_status, stage?.tipo),
    [lead.flag_status, stage?.tipo]
  );

  // Badge da cadência "Sem Contato": Tn + semáforo (verde em dia / âmbar próximo / vermelho atrasado ou risco T6+)
  const cadenciaBadge = useMemo(() => {
    if (!cadencia) return null;
    const n = cadencia.tentativa;
    const prox = cadencia.proxima_em ? new Date(cadencia.proxima_em).getTime() : null;
    const now = Date.now();
    const atrasado = prox != null && prox < now;
    let tone = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    if (atrasado || n >= 6) tone = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
    else if (n >= 3) tone = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    let when = "";
    if (prox != null) {
      const diffMin = Math.round((prox - now) / 60000);
      if (diffMin <= 0) when = "agora";
      else if (diffMin < 60) when = `${diffMin}min`;
      else if (diffMin < 1440) when = `${Math.round(diffMin / 60)}h`;
      else when = `${Math.round(diffMin / 1440)}d`;
    }
    return { label: `T${Math.min(7, n + 1)}`, when, tone, atrasado };
  }, [cadencia?.tentativa, cadencia?.proxima_em]);

  // Selo de negócio padronizado: "sub-status · VGV · imóvel"
  // (ex.: "📤 Proposta enviada · R$ 389 mil · Terrace"). Semáforo por aging na fase.
  const negocioBadge = useMemo(() => {
    if (!negocioInfo) return null;
    const vgvLabel = negocioInfo.vgv > 0 ? fmtMoney(negocioInfo.vgv, "short") : "";
    // Sub-status conforme a etapa do negócio (Em Negociação / Contrato).
    const flags = (lead.flag_status || {}) as Record<string, any>;
    const field = stage?.tipo === "contrato_gerado" ? "status_contrato" : "status_negociacao";
    const subRaw = flags[field];
    const subLabel = subRaw ? substatusValueLabel(field, subRaw) : "";
    const imovel = (empreendimento || "").split("·")[0]?.trim() || "";

    let aging: number | null = null;
    if (negocioInfo.fase_changed_at) {
      const diff = Math.floor((Date.now() - new Date(negocioInfo.fase_changed_at).getTime()) / 86400000);
      aging = diff >= 0 ? diff : null;
    }
    // Nada a mostrar se não há sub-status nem VGV.
    if (!subLabel && !vgvLabel) return null;
    const parts = [subLabel, vgvLabel, imovel].filter(Boolean);
    let tone: string;
    if (aging == null) tone = "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
    else if (aging > 7) tone = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
    else if (aging >= 4) tone = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    else tone = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    return { text: parts.join(" · "), aging, tone };
  }, [negocioInfo?.vgv, negocioInfo?.fase_changed_at, lead.flag_status, stage?.tipo, empreendimento]);

  const handleOpen = () => {
    trackPipelineEvent("pipeline_card_clicked", {
      lead_id: lead.id,
      stage_id: lead.stage_id,
      corretor_id: lead.corretor_id,
      stage: stage?.tipo ?? stage?.nome,
      status,
    });
    onClick();
  };

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Abrir lead ${lead.nome || "sem nome"}`}
      onDragStart={() => { setIsDragging(true); onDragStart(); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
      data-dragging={isDragging || undefined}
      className={[
        "group relative cursor-pointer rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ease-out",
        "px-3.5 py-3 pl-4 hover:-translate-y-px active:scale-[0.985] active:shadow-sm motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        parceiroNome
          ? "bg-purple-50/40 dark:bg-purple-950/20 border border-purple-300/70 dark:border-purple-700/60 ring-1 ring-purple-400/50 hover:border-purple-400"
          : "bg-card border border-border/60 hover:border-border",
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r",
        stage?.tipo === "novo_lead" ? "before:bg-[#4F46E5]" : SIDEBAR_BY_STATUS[status],
        isDragging ? "opacity-60 scale-[0.98] shadow-lg cursor-grabbing" : "",
      ].join(" ")}
    >
      {/* Header: badges + nome + substatus · avatar do corretor + menu ··· */}
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="flex-1 min-w-0">
          {/* Linha de badges: encolhe/quebra livremente, sem competir com o nome */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {stage?.tipo === "novo_lead" && (
              <span className="shrink-0 inline-block bg-[#4F46E5] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Novo
              </span>
            )}
            {/* Parceria vira chip compacto ao lado do nome (linha do nome), não mais banner cheio. */}
            {cadenciaBadge && (
              <span
                className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums ${cadenciaBadge.tone}`}
                title={`Cadência Sem Contato — próxima ${cadenciaBadge.label}${cadenciaBadge.when ? ` em ${cadenciaBadge.when}` : ""}`}
              >
                📲 {cadenciaBadge.label}{cadenciaBadge.when ? ` · ${cadenciaBadge.when}` : ""}
              </span>
            )}
            {substatus && !hasSpecificTitle && (
              <span className={`shrink-0 ${substatus.className}`}>
                {substatus.label}
              </span>
            )}
          </div>
          {/* Nome do lead + chip compacto de parceria (mesma linha) */}
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
            <span className="flex-1 min-w-0 text-[14px] font-semibold text-foreground tracking-tight leading-tight truncate">
              {lead.nome || "Sem nome"}
            </span>
            {parceiroNome && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 px-1.5 py-px text-[9.5px] font-semibold"
                title={`Parceria com ${parceiroNome}`}
              >
                <Handshake className="h-2.5 w-2.5" />
                c/ {parceiroPrimeiroNome}
              </span>
            )}
          </div>
          {empreendimento && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {empreendimento}
            </div>
          )}
          {negocioBadge && (
            <div
              className={`inline-flex items-center gap-1 mt-1 rounded-full px-1.5 py-px text-[9px] font-semibold ${negocioBadge.tone}`}
              title={`Negócio · ${negocioBadge.text}${negocioBadge.aging != null ? ` · ${negocioBadge.aging}d na fase` : ""}`}
            >
              ◆ {negocioBadge.text}
              {negocioBadge.aging != null ? ` · ${negocioBadge.aging}d` : ""}
            </div>
          )}
        </div>



        {/* Menu ··· */}
        {menuEnabled && (
          <div className="shrink-0">
            <CardOverflowMenu
              lead={lead}
              stages={stages!}
              onMoveLead={onMoveLead!}
              onOpenDetail={onClick}
              onTransferred={onTransferred}
            />
          </div>
        )}
      </div>


      {/* Telefone com ícone discreto */}
      {telefoneFmt && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-foreground/80 min-w-0">
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
            {status === "sem" ? (
              <span className="flex-1 min-w-0 truncate text-[11.5px] text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1">
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide">
                  ⚠ Definir tarefa
                </span>
              </span>
            ) : hasSpecificTitle ? (
              <span
                className={`flex-1 min-w-0 truncate text-[11.5px] ${
                  isAtrasada ? "text-red-600" : "text-foreground"
                }`}
              >
                <strong
                  className={`font-semibold ${
                    isAtrasada ? "text-red-600" : "text-foreground"
                  }`}
                >
                  {proximaTarefa?.titulo}
                </strong>
              </span>
            ) : (
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
            )}
            {diasLabel && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {diasLabel}
              </span>
            )}
            {canQuickComplete && (
              <button
                type="button"
                aria-label="Concluir tarefa"
                title="Concluir tarefa"
                disabled={completingBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  setCompletingOpen(true);
                }}
                className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors disabled:opacity-60"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
            )}
          </div>
        </>
      )}

      {/* Rodapé: dono do lead (corretor) — nome sempre visível.
          Parceria agora aparece só como chip compacto ao lado do nome. */}
      {corretorNome && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1.5 min-w-0">
          {corretorAvatarUrl ? (
            <img
              src={corretorAvatarUrl}
              alt={corretorNome}
              className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7e22ce] text-white flex items-center justify-center font-semibold text-[8px] shrink-0">
              {getInitials(corretorNome)}
            </div>
          )}
          <span className="truncate text-[11px] font-medium text-foreground/80">
            {corretorNome}
          </span>
        </div>
      )}

      {canQuickComplete && (
        <TaskCompletionDialog
          open={completingOpen}
          onOpenChange={(v) => { if (!completingBusy) setCompletingOpen(v); }}
          tarefaTitulo={proximaTarefa?.titulo || "Tarefa"}
          tarefaOrigem={proximaTarefa?.origem ?? null}
          tarefaTipo={proximaTarefa?.tipo ?? null}

          leadNome={lead.nome || undefined}
          leadId={lead.id}
          currentStageId={lead.stage_id}
          context="lead"
          onConfirm={async (payload: CompletionPayload) => {
            if (!user || !proximaTarefa?.id) return;
            setCompletingBusy(true);
            try {
              const { toast: msg } = await completeLeadTask({
                tarefaId: proximaTarefa.id,
                tarefaTitulo: proximaTarefa.titulo || "Tarefa",
                leadId: lead.id,
                leadNome: lead.nome,
                userId: user.id,
                payload,
              });
              toast.success(msg);
              setCompletingOpen(false);
              invalidateTaskQueries(queryClient, lead.id);
            } catch (err) {
              const m = err instanceof Error ? err.message : "Erro ao concluir tarefa";
              toast.error("Não foi possível concluir: " + m);
            } finally {
              setCompletingBusy(false);
            }
          }}
        />
      )}

    </div>
  );
});

export default CardMinimal;
