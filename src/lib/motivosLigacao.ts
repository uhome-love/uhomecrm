// Motivos estruturados de resultado de ligação — Oferta Ativa · Fase 5 · Bloco 3
// Fonte canônica; consumida pelo PosLigacaoDialog e enviada para
// `oferta-ativa-registrar-resultado` no campo `motivo_estruturado`.

export type ResultadoLigacao =
  | "aproveitado"
  | "nao_atendeu"
  | "sem_interesse"
  | "descarte_definitivo";

export interface ResultadoMeta {
  key: ResultadoLigacao;
  label: string;
  emoji: string;
  descricao: string;
  cooldownLabel: string;
  color: string; // token
  motivos: string[];
}

export const RESULTADOS_LIGACAO: ResultadoMeta[] = [
  {
    key: "aproveitado",
    label: "Aproveitado",
    emoji: "✅",
    descricao: "vira lead no pipeline",
    cooldownLabel: "sai da base",
    color: "emerald",
    motivos: [
      "Interessado em imóvel",
      "Quer visita",
      "Vai comprar em X meses",
      "Investidor",
    ],
  },
  {
    key: "nao_atendeu",
    label: "Não atendeu",
    emoji: "📵",
    descricao: "cooldown 7 dias",
    cooldownLabel: "cooldown 7d",
    color: "amber",
    motivos: [
      "Caixa postal",
      "Chamou e não atendeu",
      "Ocupado",
      "Número desligado",
      "Não é a pessoa",
    ],
  },
  {
    key: "sem_interesse",
    label: "Sem interesse agora",
    emoji: "🗣️",
    descricao: "cooldown 30 dias",
    cooldownLabel: "cooldown 30d",
    color: "sky",
    motivos: [
      "Já comprou",
      "Momento ruim",
      "Sem grana",
      "Buscando outro perfil",
      "Longe demais",
    ],
  },
  {
    key: "descarte_definitivo",
    label: "Descartar definitivamente",
    emoji: "❌",
    descricao: "nunca mais",
    cooldownLabel: "permanente",
    color: "rose",
    motivos: [
      "Errou o número",
      "Não quer mais ser contatado",
      "Concorrente",
      "Spam",
    ],
  },
];

export function getResultadoMeta(key: string): ResultadoMeta | undefined {
  return RESULTADOS_LIGACAO.find((r) => r.key === key);
}
