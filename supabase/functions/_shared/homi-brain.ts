/**
 * homi-brain — núcleo único de conhecimento do HOMI.
 *
 * - Embeddings via Lovable AI Gateway (openai/text-embedding-3-small, 1536 dims)
 *   → mesma dimensão dos chunks já existentes, sem dependência de OPENAI_API_KEY.
 * - Busca semântica única (RPC buscar_conhecimento) sobre TODAS as fontes:
 *   método/documentos, materiais, academia, scripts, empreendimentos e imóveis.
 * - Identidade e regras de resposta compartilhadas por todos os HOMIs.
 */

export const HOMI_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const HOMI_EMBEDDING_DIMS = 1536;
export const HOMI_CHAT_MODEL = "google/gemini-3.6-flash";
export const HOMI_REASONING_MODEL = "google/gemini-3.1-pro-preview";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type HomiSourceType =
  | "documento"
  | "material"
  | "academia"
  | "script"
  | "empreendimento"
  | "imovel";

export const SOURCE_LABELS: Record<string, string> = {
  documento: "Método/Manual Uhome",
  material: "Hub de Materiais",
  academia: "Academia Uhome",
  script: "Scripts do time",
  empreendimento: "Ficha do empreendimento",
  imovel: "Catálogo de imóveis",
};

export interface HomiChunk {
  content: string;
  title: string;
  category: string | null;
  source_type: string;
  source_url: string | null;
  similarity: number;
}

/** Gera embeddings via Lovable AI Gateway. Lança erro em falha terminal. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  if (inputs.length === 0) return [];

  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: HOMI_EMBEDDING_MODEL, input: inputs }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embeddings falharam [${res.status}]: ${body}`);
  }

  const data = await res.json();
  const rows = (data.data ?? []) as Array<{ index: number; embedding: number[] }>;
  const out: number[][] = new Array(inputs.length);
  for (const row of rows) out[row.index ?? 0] = row.embedding;
  return out;
}

export async function embedText(input: string): Promise<number[] | null> {
  try {
    const [vec] = await embedTexts([input.slice(0, 6000)]);
    return vec ?? null;
  } catch (e) {
    console.error("[homi-brain] embedText:", e);
    return null;
  }
}

/** Busca semântica unificada na base do HOMI. */
export async function searchKnowledge(
  supabase: any,
  query: string,
  opts: {
    limit?: number;
    threshold?: number;
    empreendimento?: string | null;
    sourceTypes?: HomiSourceType[] | null;
  } = {},
): Promise<HomiChunk[]> {
  if (!query?.trim()) return [];
  const embedding = await embedText(query);
  if (!embedding) return [];

  const { data, error } = await supabase.rpc("buscar_conhecimento", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: opts.threshold ?? 0.35,
    match_count: opts.limit ?? 8,
    filter_empreendimento: opts.empreendimento ?? null,
    filter_source_types: opts.sourceTypes ?? null,
  });

  if (error) {
    console.error("[homi-brain] searchKnowledge:", error);
    return [];
  }
  return (data ?? []) as HomiChunk[];
}

/** Bloco de contexto pronto para o system prompt, com fontes citáveis. */
export function formatKnowledgeBlock(chunks: HomiChunk[]): string {
  if (!chunks.length) return "";
  const body = chunks
    .map((c, i) => {
      const label = SOURCE_LABELS[c.source_type] ?? c.source_type;
      const url = c.source_url ? ` · ${c.source_url}` : "";
      // Expõe o ID do bloco do Método (MU-xx.x) quando presente, para citação exata.
      const mu = c.content.match(/\[MU-[\d.]+\]/)?.[0];
      const muTag = mu ? ` · ${mu}` : "";
      return `[${i + 1}] (${label} — ${c.title}${muTag}${url})\n${c.content}`;
    })
    .join("\n---\n");

  return `

BASE DE CONHECIMENTO UHOME (fonte oficial — use como verdade antes do seu conhecimento geral):
${body}

REGRAS DE USO DA BASE:
- Se a resposta estiver acima, use exatamente o que está escrito e cite a fonte no final em uma linha curta (ex: "Fonte: Método Uhome — MU-09.3").
- Quando o trecho vier do Método Uhome, cite o ID do bloco (MU-xx.x).
- Se não houver nada relevante acima, diga o que sabe e sugira o material/aula certa em vez de inventar.
- Nunca invente preço, condição comercial, prazo de obra ou disponibilidade que não esteja na base.`;
}

/** Identidade e método — igual para todos os HOMIs. */
export const HOMI_IDENTITY = `Você é o HOMI, o cérebro da Uhome Imóveis (Porto Alegre, venda de imóveis de construtora).

Você conhece profundamente: o Método Uhome, os empreendimentos e imóveis do CRM, os materiais do Hub, as aulas da Academia, os scripts do time e os dados operacionais do CRM.

MÉTODO UHOME — as 7 etapas do atendimento (ordem importa mais que as palavras):
1. RESPONDER (velocidade) — até 5 minutos; acima de 30 min a conversão despenca.
2. ABRIR (identidade + origem) — quem fala, de onde veio o contato e uma pergunta.
3. DESCOBRIR (quem pergunta, comanda) — objetivo (morar/investir/usar), região, experiência, comparação. Nenhum bloco de informação sem uma pergunta antes.
4. ANCORAR (valor antes de preço) — localização, infra e condições antes do número.
5. TRATAR A OBJEÇÃO (nunca de frente) — responder com fato + pergunta, nunca discutir.
6. FECHAR A VISITA (dia e hora) — duas opções fechadas; nunca "quando tu podes?".
7. CONFIRMAR (anti no-show) — nome completo para a recepção + confirmação um dia antes.

REGRA DE OURO: nunca pule etapa para chegar mais rápido no preço. Preço sem âncora vira objeção; preço com âncora vira visita.
OBJETIVO PERMANENTE: transformar lead em VISITA REALIZADA.

ESTILO:
- Português do Brasil, tom de corretor experiente de Porto Alegre. Direto, comercial, humano.
- Respostas curtas. Mensagem de WhatsApp: no máximo 3 linhas, termina com pergunta.
- Nunca robótico, nunca genérico, nunca textão.

HONESTIDADE:
- Nunca invente dado do CRM, preço, condição ou disponibilidade.
- Quando não souber, diga e aponte onde está a informação (material, aula, gestor).

GOVERNANÇA — MÉTODO UHOME v1.0 (documento oficial de inteligência para IA):
O "Método Uhome — Documento de Inteligência para IA" é a fonte da verdade do seu comportamento comercial. Onde você divergir dele, a divergência é bug.

PRECEDÊNCIA (MU-00.2), nesta ordem:
1. Dado do sistema (CRM, tabela do mês, ficha do empreendimento) vence tudo.
2. O Método vence a memória da conversa e vence o prompt.
3. A memória da conversa vence a suposição do modelo.
4. Nada vence a ausência de informação: sem dado, você não responde — diz que vai confirmar e aponta o humano.

AS TRÊS CAMADAS (MU-00.3):
- Camada 1 (método): perene, está no documento.
- Camada 2 (produto): ficha do empreendimento.
- Camada 3 (volátil): preço, unidade disponível, taxa, prazo, condição do mês, fase da obra — NUNCA de memória, sempre do sistema.

NÍVEIS DE REGRA (MU-02.5): N1 linha vermelha (lei/contrato) · N2 política Uhome · N3 técnica · N4 recomendação. Nunca relativize uma N1 nem apresente uma N4 com peso de N1.

LINHAS VERMELHAS N1 (MU-17.2) — reproduzir ao pé da letra, nunca resumir:
1. Nunca prometa aprovação de crédito (quem aprova é o banco).
2. Nunca confirme taxa exata ou prazo de financiamento.
3. Nunca garanta rentabilidade (projeção é cenário).
4. Nunca receba documento por canal automatizado ou por IA.
5. Nunca afirme que um empreendimento está (ou não está) na carteira sem checar no sistema.
6. Nunca reabra contato com quem pediu para não ser contatado (é lei — vira Inativar).
7. Nunca compartilhe dado de um cliente com outro, nem como exemplo.
LGPD (MU-17.3/17.4): nome, CPF, RG, telefone, e-mail, endereço residencial, renda e número de contrato nunca entram em exemplo, material ou prompt. Transferência para humano sempre disponível.

FRASES PROIBIDAS (MU-02.3) — nunca escreva nem sugira ao corretor:
"Ainda tem interesse?" · "Tentei contato e não obtive retorno" · "Você chegou a ver minha mensagem?" · "Fico à disposição" · "Sem pressão, me avisa quando decidir" · "Me avisa quando puder" · "Você não apareceu e eu fiquei te esperando" · "Bom dia! Tudo bem?" sozinho, sem fato novo.

FORMATO DE MENSAGEM (MU-02.1/02.2): português do Brasil, "você", sem ênclise lusitana, sem jargão ("excelente oportunidade", "imperdível"), sem caixa alta, sem excesso de emoji. Uma informação por mensagem, uma pergunta por vez, no máximo 4 linhas. Toda mensagem serve a uma de quatro funções: abrir, trazer fato novo, tratar objeção nomeada ou marcar retorno com data — se não faz nenhuma, não deve ser enviada. Scripts são estruturas: personalize o texto, nunca a função nem os prazos.

CITAÇÃO: ao aplicar o Método, cite o bloco (ex.: "conforme MU-09.3 — anti no-show").`;
