/**
 * Sprint 1 R3-V2 + Refactor Nível 2 (2026-05-22) — Captura estruturada de conclusão de tarefa
 *
 * Step 1 (inalterado): tipo_contato + resultado + descricao opcional.
 * Step 2 (refactor Nível 2): seletor de OUTCOME em 2 grupos × 2 opções.
 *
 *   ROTINA NORMAL                ENCERRAR LEAD
 *     ⦿ agendar  (default)         ○ descartar (reengajável)
 *     ○ concluir                   ○ inativar  (definitivo)
 *
 * Negócios mantêm fluxo legado: TaskCompletionDialog recebe prop `context='negocio'`
 * e renderiza Step 2 sem o grupo "Encerrar lead" (apenas Agendar é permitido).
 */

import { addDays, format } from "date-fns";
import { dateToBRT } from "@/lib/utils";

export type TipoContato = "ligacao" | "whatsapp" | "email" | "visita";

export type Resultado =
  | "atendeu"
  | "nao_atendeu"
  | "agendou_proximo"
  | "sem_interesse"
  | "outro";

export type TipoProximaTarefa =
  | "ligacao"
  | "whatsapp"
  | "follow_up"
  | "visita"
  | "proposta"
  | "email";

export type OutcomeChoice = "agendar" | "concluir" | "descartar" | "inativar";

export type CompletionContext = "lead" | "negocio";

export interface NovaTarefaPayload {
  tipo: TipoProximaTarefa;
  vence_em: string; // YYYY-MM-DD (BRT)
  hora_vencimento: string; // HH:mm
  obs?: string;
}

export interface CompletionPayload {
  // Step 1
  tipo_contato: TipoContato;
  resultado: Resultado;
  descricao?: string;

  // Step 2 — outcome dirige o que persiste
  outcome: OutcomeChoice;

  // novo_stage_id ainda é opcional para 'agendar' e 'concluir' (UI permite mover stage)
  novo_stage_id?: string;

  // Apenas para outcome='agendar'
  nova_tarefa?: NovaTarefaPayload;

  // Apenas para outcome em ['descartar', 'inativar']
  reason_code?: string;
  reason_label?: string; // label efetivamente gravado em motivo_descarte
  reason_custom_text?: string; // preenchido quando reason_code === 'outro'
}

/* ─────────── Labels e mapas para UI (Step 1) ─────────── */

import {
  Phone,
  MessageCircle,
  Mail,
  Home,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  ThumbsDown,
  HelpCircle,
  ClipboardList,
  FileText,
  type LucideIcon,
} from "lucide-react";

export const TIPO_CONTATO_OPTIONS: ReadonlyArray<{
  value: TipoContato;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "ligacao", label: "Ligação", Icon: Phone },
  { value: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { value: "email", label: "E-mail", Icon: Mail },
  { value: "visita", label: "Visita", Icon: Home },
];

export const RESULTADO_OPTIONS: ReadonlyArray<{
  value: Resultado;
  label: string;
  Icon: LucideIcon;
  tone: "positive" | "neutral" | "warning" | "negative";
}> = [
  { value: "atendeu", label: "Atendeu", Icon: CheckCircle2, tone: "positive" },
  { value: "agendou_proximo", label: "Agendou próximo", Icon: CalendarCheck, tone: "positive" },
  { value: "nao_atendeu", label: "Não atendeu", Icon: XCircle, tone: "warning" },
  { value: "sem_interesse", label: "Sem interesse", Icon: ThumbsDown, tone: "negative" },
  { value: "outro", label: "Outro", Icon: HelpCircle, tone: "neutral" },
];

export const PROXIMA_TAREFA_OPTIONS: ReadonlyArray<{
  value: TipoProximaTarefa;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "ligacao", label: "Ligação", Icon: Phone },
  { value: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { value: "follow_up", label: "Follow-up", Icon: ClipboardList },
  { value: "visita", label: "Visita", Icon: Home },
  { value: "proposta", label: "Proposta", Icon: FileText },
  { value: "email", label: "E-mail", Icon: Mail },
];

/* ─────────── Motivos canônicos (aprovados pelo CEO 2026-05-22) ─────────── */

export interface OutcomeReason {
  readonly code: string;
  readonly label: string;
}

export const DESCARTE_REASONS: ReadonlyArray<OutcomeReason> = [
  { code: "nao_atende", label: "Não atende / não responde" },
  { code: "sem_interesse_momento", label: "Sem interesse no momento" },
  { code: "sem_condicao_financeira", label: "Sem condição financeira" },
  { code: "imovel_nao_atende", label: "Imóvel não atende necessidade" },
  { code: "desistiu_compra", label: "Desistiu da compra" },
  { code: "outro", label: "Outro (especificar)" },
];

export const INATIVAR_REASONS: ReadonlyArray<OutcomeReason> = [
  { code: "nao_quer_contato", label: "Não quer mais contato" },
  { code: "contato_invalido", label: "Contato errado / Número inválido" },
  { code: "lgpd", label: "Solicitou retirada (LGPD)" },
  { code: "lead_antigo", label: "Lead antigo sem retorno" },
  { code: "outro", label: "Outro (especificar)" },
];

/* ─────────── Quick dates ─────────── */

export function quickDates(): Array<{ label: string; d: Date; h: string }> {
  const now = new Date();
  return [
    { label: "Hoje +2h", d: now, h: format(new Date(Date.now() + 2 * 3600_000), "HH:mm") },
    { label: "Amanhã 10h", d: addDays(now, 1), h: "10:00" },
    { label: "+2 dias", d: addDays(now, 2), h: "10:00" },
    { label: "+7 dias", d: addDays(now, 7), h: "10:00" },
  ];
}

export const defaultNovaTarefa = (): NovaTarefaPayload => ({
  tipo: "follow_up",
  vence_em: dateToBRT(addDays(new Date(), 1)),
  hora_vencimento: "10:00",
  obs: "",
});
