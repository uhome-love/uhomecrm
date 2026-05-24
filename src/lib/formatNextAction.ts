// ─────────────────────────────────────────────────────────────────
// formatNextAction — Label humanizado da próxima ação do lead
//
// Converte (tipo, vence_em, hora_vencimento) em texto curto e BRT-correto:
//   • "Ligar agora"          — tarefa atrasada
//   • "Ligar hoje 14:30"     — tarefa para hoje com hora
//   • "Ligar hoje"           — tarefa para hoje sem hora
//   • "Ligar amanhã"         — tarefa para amanhã
//   • "Ligar em 3 dias"      — tarefa futura próxima
//   • "Ligar 28/05"          — tarefa futura mais distante
//   • "Sem próxima ação"     — sem tarefa
// ─────────────────────────────────────────────────────────────────

import { formatBRT, todayBRT } from "@/lib/brtTime";

export type NextActionInput = {
  tipo: string | null | undefined;
  vence_em: string | null | undefined;
  hora_vencimento: string | null | undefined;
} | null | undefined;

const VERBO_POR_TIPO: Record<string, string> = {
  ligacao: "Ligar",
  ligar: "Ligar",
  whatsapp: "Mensagem WhatsApp",
  email: "Enviar email",
  visita: "Visita",
  reuniao: "Reunião",
  followup: "Follow-up",
  follow_up: "Follow-up",
  outro: "Tarefa",
};

function verbo(tipo: string | null | undefined): string {
  if (!tipo) return "Tarefa";
  return VERBO_POR_TIPO[tipo.toLowerCase()] ?? "Tarefa";
}

function addDaysBRT(dateStr: string, days: number): string {
  // dateStr é YYYY-MM-DD; calcular UTC e formatar de volta
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatNextAction(tarefa: NextActionInput): string {
  if (!tarefa || !tarefa.vence_em) return "Sem próxima ação";

  const v = verbo(tarefa.tipo);
  const hoje = todayBRT();
  const amanha = addDaysBRT(hoje, 1);
  const venceEm = tarefa.vence_em;

  if (venceEm < hoje) return `${v} agora`;
  if (venceEm === hoje) {
    return tarefa.hora_vencimento ? `${v} hoje ${tarefa.hora_vencimento.slice(0, 5)}` : `${v} hoje`;
  }
  if (venceEm === amanha) return `${v} amanhã`;

  // calcular diff em dias
  const [yh, mh, dh] = hoje.split("-").map(Number);
  const [yv, mv, dv] = venceEm.split("-").map(Number);
  const diffDays = Math.round(
    (Date.UTC(yv, mv - 1, dv) - Date.UTC(yh, mh - 1, dh)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 0 && diffDays <= 6) return `${v} em ${diffDays} dias`;
  return `${v} ${formatBRT(`${venceEm}T12:00:00-03:00`, "dd/MM")}`;
}
