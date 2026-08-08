// Contrato de etapas da Lia.
//
// O enum `ia_etapa` no banco tem NOVE valores, mas a Lia só pode EMITIR seis.
// `entrada`, `bloqueado` e `migrado` são estados definidos pelo sistema, nunca pelo modelo.
// O validador da Fase 2 valida contra esta lista de seis, NUNCA contra o enum inteiro.
export const ETAPAS_IA_EMISSIVEIS = [
  "atendendo",
  "sem_resposta",
  "qualificado",
  "perfil_busca",
  "nutricao",
  "desqualificado",
] as const;

export type EtapaIaEmissivel = (typeof ETAPAS_IA_EMISSIVEIS)[number];

export function isEtapaIaEmissivel(valor: unknown): valor is EtapaIaEmissivel {
  return typeof valor === "string" &&
    (ETAPAS_IA_EMISSIVEIS as readonly string[]).includes(valor);
}

// Versão do prompt em execução. O arquivo é a fonte; `ia_prompt_versoes` registra
// versão + hash SHA-256 dos BYTES CRUS do arquivo (sem normalizar quebra de linha,
// sem trim, sem reencode). O carregador da Fase 2 recalcula sobre os bytes lidos
// e alerta se divergir.
export const LIA_PROMPT_VERSAO = "lia-canoas-v3.1";
export const LIA_PROMPT_ARQUIVO =
  "supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt";
