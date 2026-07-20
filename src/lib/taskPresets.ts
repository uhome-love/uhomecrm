/**
 * Catálogo canônico de PRESETS de tarefa manual (Fase B — 2026-07-20).
 *
 * Cada preset representa uma "próxima ação" típica de uma etapa. Selecionar
 * um preset preenche automaticamente:
 *   - tipo da tarefa (para o campo NovaTarefaPayload.tipo)
 *   - prazo (dias a partir de hoje BRT)
 *   - descrição sugerida (obs)
 *   - opcionalmente, o `status_etapa` do lead (persistido em flag_status)
 *
 * "outro" é sempre disponível e devolve ao modo livre (texto + status manual).
 */
import { addDays, format } from "date-fns";
import { dateToBRT } from "@/lib/utils";
import type { TipoProximaTarefa, NovaTarefaPayload } from "@/components/pipeline/task-completion/types";
import {
  Phone,
  MessageCircle,
  Search,
  Send,
  ClipboardList,
  CalendarCheck,
  FileText,
  Landmark,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type StageTipoPreset = "qualificacao" | "aquecimento" | "negociacao";

export interface TaskPreset {
  id: string;
  label: string;
  Icon: LucideIcon;
  tipo: TipoProximaTarefa;
  /** Dias a somar em hoje (BRT). Ignorado quando `resolveVenceEm` é fornecido. */
  prazoDias: number;
  horaDefault: string;
  obsSugerida: string;
  /** Se presente, aplica em `pipeline_leads.flag_status[syncFlagKey] = syncFlagValue`. */
  syncFlagKey?: "status_atendimento" | "prazo" | "status_negociacao";
  syncFlagValue?: string;
}

const QUALIFICACAO_PRESETS: TaskPreset[] = [
  {
    id: "alinhar_perfil",
    label: "Alinhar perfil",
    Icon: Phone,
    tipo: "ligacao",
    prazoDias: 1,
    horaDefault: "10:00",
    obsSugerida: "Ligar para alinhar perfil (tipologia, faixa, região).",
    syncFlagKey: "status_atendimento",
    syncFlagValue: "alinhamento_perfil",
  },
  {
    id: "buscar_imoveis",
    label: "Buscar imóveis",
    Icon: Search,
    tipo: "follow_up",
    prazoDias: 2,
    horaDefault: "10:00",
    obsSugerida: "Buscar opções que atendam o perfil.",
    syncFlagKey: "status_atendimento",
    syncFlagValue: "busca",
  },
  {
    id: "enviar_imoveis",
    label: "Enviar imóveis",
    Icon: Send,
    tipo: "whatsapp",
    prazoDias: 1,
    horaDefault: "10:00",
    obsSugerida: "Enviar opções selecionadas ao lead.",
    syncFlagKey: "status_atendimento",
    syncFlagValue: "envio_opcoes",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    Icon: ClipboardList,
    tipo: "whatsapp",
    prazoDias: 2,
    horaDefault: "10:00",
    obsSugerida: "Retomar contato com o lead.",
    syncFlagKey: "status_atendimento",
    syncFlagValue: "follow_up",
  },
  {
    id: "alinhar_visita",
    label: "Alinhar visita",
    Icon: CalendarCheck,
    tipo: "ligacao",
    prazoDias: 1,
    horaDefault: "10:00",
    obsSugerida: "Ligar para alinhar data/horário da visita.",
    syncFlagKey: "status_atendimento",
    syncFlagValue: "alinhando_visita",
  },
];

/** Aquecimento: chips diretos por prazo. Preenchem vence_em e flag_status.prazo. */
const AQUECIMENTO_PRESETS: TaskPreset[] = [
  {
    id: "retomar_30",
    label: "Retomar em 30d",
    Icon: RefreshCw,
    tipo: "whatsapp",
    prazoDias: 30,
    horaDefault: "10:00",
    obsSugerida: "Retomar contato (aquecimento 30 dias).",
    syncFlagKey: "prazo",
    syncFlagValue: "30",
  },
  {
    id: "retomar_60",
    label: "Retomar em 60d",
    Icon: RefreshCw,
    tipo: "whatsapp",
    prazoDias: 60,
    horaDefault: "10:00",
    obsSugerida: "Retomar contato (aquecimento 60 dias).",
    syncFlagKey: "prazo",
    syncFlagValue: "60",
  },
  {
    id: "retomar_90",
    label: "Retomar em 90d",
    Icon: RefreshCw,
    tipo: "whatsapp",
    prazoDias: 90,
    horaDefault: "10:00",
    obsSugerida: "Retomar contato (aquecimento 90 dias).",
    syncFlagKey: "prazo",
    syncFlagValue: "90",
  },
];

const NEGOCIACAO_PRESETS: TaskPreset[] = [
  {
    id: "enviar_proposta",
    label: "Enviar proposta",
    Icon: FileText,
    tipo: "proposta",
    prazoDias: 1,
    horaDefault: "10:00",
    obsSugerida: "Enviar proposta ao lead.",
    syncFlagKey: "status_negociacao",
    syncFlagValue: "proposta_enviada",
  },
  {
    id: "cobrar_retorno",
    label: "Cobrar retorno",
    Icon: MessageCircle,
    tipo: "whatsapp",
    prazoDias: 2,
    horaDefault: "10:00",
    obsSugerida: "Cobrar retorno da proposta enviada.",
  },
  {
    id: "acompanhar_aprovacao",
    label: "Acompanhar aprovação",
    Icon: Landmark,
    tipo: "follow_up",
    prazoDias: 3,
    horaDefault: "10:00",
    obsSugerida: "Acompanhar aprovação bancária/proprietário.",
    syncFlagKey: "status_negociacao",
    syncFlagValue: "aprovacao_bancaria",
  },
];

/** Chip "Outro" — vira modo livre no popup (input manual + status pill). */
export const PRESET_OUTRO_ID = "__outro__";

export const PRESET_OUTRO: TaskPreset = {
  id: PRESET_OUTRO_ID,
  label: "Outro (livre)",
  Icon: Sparkles,
  tipo: "follow_up",
  prazoDias: 1,
  horaDefault: "10:00",
  obsSugerida: "",
};

export function getPresetsForStage(stageTipo?: string | null): TaskPreset[] {
  switch (stageTipo) {
    case "qualificacao":
      return [...QUALIFICACAO_PRESETS, PRESET_OUTRO];
    case "aquecimento":
      return [...AQUECIMENTO_PRESETS, PRESET_OUTRO];
    case "negociacao":
      return [...NEGOCIACAO_PRESETS, PRESET_OUTRO];
    default:
      return [];
  }
}

/** Aplica o preset ao payload NovaTarefaPayload, mantendo campos manualmente editáveis. */
export function applyPresetToTarefa(preset: TaskPreset): NovaTarefaPayload {
  const d = addDays(new Date(), preset.prazoDias);
  return {
    tipo: preset.tipo,
    vence_em: dateToBRT(d),
    hora_vencimento: preset.horaDefault,
    obs: preset.obsSugerida,
  };
}

// evita "unused" no import de format
export const _fmt = format;
