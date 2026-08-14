/** Sala fixa de Google Meet usada nas entrevistas de recrutamento. */
export const MEET_LINK = "https://meet.google.com/nxk-gpvw-nra";

/**
 * Etapas do funil de recrutamento (kanban de candidatos). Fonte ÚNICA — fica
 * aqui (config, sem imports de componentes) para evitar import circular entre
 * RecrutamentoKanban e AgendaRecrutamento.
 */
export const ETAPAS = [
  { key: "novo_lead", label: "Novo Lead", color: "#4969FF" },
  { key: "atendimento", label: "Atendimento", color: "#06B6D4" },
  { key: "entrevista_marcada", label: "Entrevista Marcada", color: "#F97316" },
  { key: "pre_entrevista_realizada", label: "Pré-Entrevista Realizada", color: "#EAB308" },
  { key: "entrevista_realizada", label: "Entrevista Presencial Realizada", color: "#10B981" },
  { key: "contratado", label: "Contratado", color: "#22C55E" },
  { key: "sem_interesse", label: "Não Tem Interesse", color: "#EF4444" },
];
