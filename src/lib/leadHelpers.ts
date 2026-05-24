// ─────────────────────────────────────────────────────────────────
// leadHelpers — utilitários compartilhados do drawer de lead
// ─────────────────────────────────────────────────────────────────
import { parseDateBRTSafe } from "@/lib/utils";

/** "Kizye Anacleto" → "KA"; "Maria" → "MA"; "" → "?" */
export function getInitials(nome: string | null | undefined): string {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return (first + last).toUpperCase();
}

const WEEKDAYS_BRT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS_BRT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function toBRTDateOnly(d: Date): { y: number; m: number; day: number; weekday: number; } {
  // converte UTC → BRT (-03)
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: brt.getUTCFullYear(),
    m: brt.getUTCMonth(),
    day: brt.getUTCDate(),
    weekday: brt.getUTCDay(),
  };
}

/**
 * "HOJE" / "ONTEM" / "Quarta-feira" (2-6 dias) / "22 DE MAIO" (mais antigo).
 */
export function formatDayHeader(iso: string | Date | null | undefined): string {
  const d = typeof iso === "string" ? parseDateBRTSafe(iso) : (iso ?? null);
  if (!d) return "";
  const today = toBRTDateOnly(new Date());
  const target = toBRTDateOnly(d);
  const todayMid = Date.UTC(today.y, today.m, today.day);
  const targetMid = Date.UTC(target.y, target.m, target.day);
  const diffDays = Math.round((todayMid - targetMid) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "HOJE";
  if (diffDays === 1) return "ONTEM";
  if (diffDays >= 2 && diffDays <= 6) return WEEKDAYS_BRT[target.weekday];
  return `${String(target.day).padStart(2, "0")} DE ${MONTHS_BRT[target.m]}`;
}

/** Chave estável de dia BRT (YYYY-MM-DD) para agrupar eventos. */
export function dayKeyBRT(iso: string | Date | null | undefined): string {
  const d = typeof iso === "string" ? parseDateBRTSafe(iso) : (iso ?? null);
  if (!d) return "unknown";
  const t = toBRTDateOnly(d);
  return `${t.y}-${String(t.m + 1).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────
// Tipo de ação (próxima tarefa) — usado no CardMinimal Nível 2
// ─────────────────────────────────────────────────────────────────

export type TaskActionType = "call" | "msg" | "followup" | "visit" | "outro";

/** Mapeia o enum `tipo` da tabela pipeline_tarefas para categoria visual. */
export function parseTaskActionType(tipo: string | null | undefined): TaskActionType {
  if (!tipo) return "outro";
  const t = tipo.toLowerCase();
  if (t === "ligacao" || t === "ligar" || t.includes("ligaç")) return "call";
  if (t === "whatsapp" || t.includes("mensagem")) return "msg";
  if (t === "visita") return "visit";
  if (t === "followup" || t === "follow_up" || t.includes("follow")) return "followup";
  return "outro";
}

export const ACTION_ICON: Record<TaskActionType, string> = {
  call: "📞",
  msg: "💬",
  followup: "📨",
  visit: "🏠",
  outro: "📝",
};

export const ACTION_LABEL: Record<TaskActionType, string> = {
  call: "Ligação",
  msg: "WhatsApp",
  followup: "Follow-up",
  visit: "Visita",
  outro: "Tarefa",
};

export const ACTION_PILL_CLASS: Record<TaskActionType, string> = {
  call: "bg-red-100 text-red-700",
  msg: "bg-indigo-100 text-indigo-700",
  followup: "bg-purple-100 text-purple-700",
  visit: "bg-emerald-100 text-emerald-700",
  outro: "bg-zinc-100 text-zinc-600",
};

// ─────────────────────────────────────────────────────────────────
// Substatus compacto do CardMinimal — lê pipeline_leads.flag_status
// Estrutura por stage.tipo mapeada em LeadFlagBadges.tsx (fonte da verdade).
// Retorna no máx 1 badge para caber no header do card.
// ─────────────────────────────────────────────────────────────────

export interface SubstatusBadge {
  label: string;
  className: string;
}

const PILL_BASE =
  "px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-tight whitespace-nowrap";

const PILL = {
  red: `${PILL_BASE} bg-red-100 text-red-700`,
  amber: `${PILL_BASE} bg-amber-100 text-amber-700`,
  emerald: `${PILL_BASE} bg-emerald-100 text-emerald-700`,
  indigo: `${PILL_BASE} bg-indigo-100 text-indigo-700`,
  purple: `${PILL_BASE} bg-purple-100 text-purple-700`,
  zinc: `${PILL_BASE} bg-zinc-100 text-zinc-600`,
};

export function getLeadSubstatusBadge(
  flagStatus: Record<string, string> | null | undefined,
  stageTipo: string | null | undefined
): SubstatusBadge | null {
  if (!flagStatus || !stageTipo) return null;
  const f = flagStatus;

  switch (stageTipo) {
    case "sem_contato": {
      const n = parseInt(f.tentativas || "", 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      const color = n >= 5 ? PILL.red : n >= 3 ? PILL.amber : PILL.zinc;
      return { label: `☎️ ${n}/7`, className: color };
    }

    case "contato_inicial": {
      if (f.intencao === "morar") return { label: "🏠 Morar", className: PILL.indigo };
      if (f.intencao === "investir") return { label: "💰 Investir", className: PILL.purple };
      if (f.impressao === "gostou") return { label: "👍 Gostou", className: PILL.emerald };
      if (f.impressao === "nao_gostou") return { label: "👎 Não gostou", className: PILL.red };
      return null;
    }

    case "busca": {
      if (f.status_busca === "imoveis_enviados")
        return { label: "📨 Enviados", className: PILL.emerald };
      if (f.status_busca === "busca_pendente")
        return { label: "🔍 Pendente", className: PILL.amber };
      return null;
    }

    case "aquecimento": {
      const n = parseInt(f.prazo || "", 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      return { label: `⏰ ${n}d`, className: PILL.amber };
    }

    case "visita": {
      const map: Record<string, SubstatusBadge> = {
        marcada: { label: "📅 Marcada", className: PILL.indigo },
        realizada: { label: "✅ Realizada", className: PILL.emerald },
        no_show: { label: "❌ No-show", className: PILL.red },
        reagendada: { label: "🔁 Reagendada", className: PILL.amber },
      };
      return f.status_visita ? map[f.status_visita] ?? null : null;
    }

    case "pos_visita": {
      if (f.interesse === "alto") return { label: "🔥 Alto", className: PILL.red };
      if (f.interesse === "medio") return { label: "🟡 Médio", className: PILL.amber };
      if (f.interesse === "baixo") return { label: "❄️ Baixo", className: PILL.zinc };
      if (f.feedback_coletado === "sim")
        return { label: "💬 Feedback", className: PILL.emerald };
      if (f.simulacao_enviada === "sim")
        return { label: "💰 Simulação", className: PILL.indigo };
      if (f.objecoes_mapeadas === "sim")
        return { label: "🤔 Objeções", className: PILL.amber };
      return null;
    }

    default:
      return null;
  }
}


