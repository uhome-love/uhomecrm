/**
 * Sprint 1 R3-V2 — Captura estruturada de conclusão de tarefa
 * Enums alinhados com CHECK constraints em pipeline_atividades:
 *   - tipo_contato: 4 canais reais
 *   - resultado: 5 outcomes
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

export interface NovaTarefaPayload {
  tipo: TipoProximaTarefa;
  vence_em: string; // YYYY-MM-DD (BRT)
  hora_vencimento: string; // HH:mm
  obs?: string;
}

export interface CompletionPayload {
  tipo_contato: TipoContato;
  resultado: Resultado;
  descricao?: string;
  nova_tarefa: NovaTarefaPayload;
  novo_stage_id?: string;
}

/* ─────────── Labels e mapas para UI ─────────── */

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
  /** semantic tone (drives color) */
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
