/**
 * _shared/homi-knowledge.ts
 *
 * Recupera trechos do Método Uhome (ou de outros documentos indexados em
 * homi_chunks) usando embeddings via Lovable AI Gateway.
 *
 * NÃO confundir com _shared/enterprise-knowledge.ts — este é para o Método
 * (documentos de homi_documents), aquele é para fichas de empreendimento
 * (empreendimento_overrides).
 *
 * Falha nunca derruba a função chamadora: erro ou vazio → loga e retorna [].
 */

// deno-lint-ignore-file no-explicit-any

const EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dims — bate com a coluna homi_chunks.embedding
const DEFAULT_LIMIAR = 0.35;

export interface MetodoChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

async function embed(query: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.warn("[homi-knowledge] LOVABLE_API_KEY missing — pulando retrieval");
    return null;
  }
  const cleaned = (query || "").trim().slice(0, 6000);
  if (!cleaned) return null;
  try {
    const r = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: cleaned }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error(`[homi-knowledge] embedding ${r.status}: ${t.slice(0, 200)}`);
      return null;
    }
    const data = await r.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[homi-knowledge] embedding error:", e);
    return null;
  }
}

/**
 * Busca top-k trechos do Método Uhome relevantes para a query.
 * Retorna [] em qualquer falha — nunca lança.
 */
export async function searchMetodoUhome(
  supabase: any,
  query: string,
  k = 4,
  limiar = DEFAULT_LIMIAR,
): Promise<MetodoChunk[]> {
  try {
    const emb = await embed(query);
    if (!emb) return [];
    const { data, error } = await supabase.rpc("match_homi_chunks", {
      query_embedding: emb,
      match_count: k,
      filter_category: "metodo_comercial",
    });
    if (error) {
      console.error("[homi-knowledge] match_homi_chunks error:", error);
      return [];
    }
    const rows = (data || []) as MetodoChunk[];
    return rows.filter((r) => (r.similarity ?? 0) >= limiar);
  } catch (e) {
    console.error("[homi-knowledge] searchMetodoUhome error:", e);
    return [];
  }
}

/**
 * Monta o bloco pronto para injetar no system prompt.
 * Cada trecho vem citado com [fonte: heading_path].
 * Retorna string vazia se não houver chunks — nunca "polui" o prompt.
 */
export function formatMetodoBlock(chunks: MetodoChunk[]): string {
  if (!chunks || chunks.length === 0) return "";
  const parts = chunks.map((c) => {
    const fonte = c.metadata?.heading_path || c.metadata?.section_slug || "Método Uhome";
    return `— ${c.content.trim()}\n  [fonte: ${fonte} · sim=${(c.similarity ?? 0).toFixed(2)}]`;
  });
  return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMÉTODO UHOME (trechos relevantes)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${parts.join("\n\n")}\n`;
}

/**
 * Constantes verbatim do documento (seções 0 e 11) — redundância proposital
 * com a Fase 1 (também vão indexadas como chunks), para garantir que as
 * regras SEMPRE cheguem ao prompt, independentemente do retrieval.
 */

export const METODO_REGRAS_INVIOLAVEIS = `MÉTODO UHOME — REGRAS INVIOLÁVEIS (aplicam-se a toda sugestão)
- Nunca escrever textão. Máximo 3 a 4 linhas por mensagem; se for mais, quebrar em 2 mensagens.
- Sempre terminar com pergunta ou convite. Mensagem que termina em ponto final mata a conversa.
- Sempre em PORTUGUÊS BRASILEIRO COLOQUIAL de Porto Alegre, tratamento por "tu" com verbo em 3ª pessoa do singular ("tu viu", "tu quer", "tu pode"). PROIBIDO português europeu: nada de ênclise ou próclise ("ter-te", "vê-lo", "dizer-lhe", "conhecê-la"). Usar sempre a próclise brasileira ("te ver", "te ajudar", "te mandar"). Nada de "vossa", "consigo" no lugar de "com você/contigo", "és" no lugar de "tu é/você é".
- Nunca inventar preço, taxa, aprovação de crédito, prazo de financiamento ou rentabilidade. Se o dado não está no CRM ou na ficha do empreendimento, escrever a frase de contorno honesto: "Solicitei os valores, já te envio."
- Nunca sugerir escassez que não seja verdadeira. Se não houver dado real de estoque ou prazo, usar outra técnica.
- O objetivo de toda sugestão é AVANÇAR PARA A VISITA AGENDADA (ou, no pós-visita, para a ponte de crédito). Se a mensagem sugerida não avança, ela está errada.
- Se o lead tiver ai_replied = true, avisar o corretor que a IA já respondeu, para ele não duplicar contato.

QUANDO RECUSAR E ESCALAR PARA HUMANO: pergunta jurídica ou contratual, reclamação formal de atendimento, pedido explícito de preço final de unidade específica sem dado no sistema, e qualquer pedido de garantia de aprovação de crédito.`;

export const METODO_FORMATO_3_PARTES = `MÉTODO UHOME — FORMATO PADRÃO DE RESPOSTA DO HOMI AO CORRETOR
Sempre três partes, nesta ordem, sem enrolação:

1. Leitura (1 linha): em que etapa do método o lead está e qual é o obstáculo real.
2. Mensagem pronta (para copiar e colar): no tom Uhome, curta, uma ideia por vez, terminando em pergunta ou convite.
3. Por quê (1 linha): qual técnica do método está sendo usada e qual é o próximo passo esperado.`;

export const METODO_LINHAS_VERMELHAS = `MÉTODO UHOME — LINHAS VERMELHAS (o que NUNCA se afirma)
Valem para o corretor humano e, com mais rigor ainda, para qualquer sugestão que o HOMI gerar.

Pode dizer: faixa de preço, condições gerais divulgadas pela construtora, o que vem incluso, prazo de entrega informado, histórico de rentabilidade de imóveis comparáveis (como histórico, nunca como promessa), o caminho do financiamento.

Nunca afirmar:
- Aprovação de crédito ("com certeza aprova").
- Taxa de juros exata ou prazo final do financiamento.
- Rentabilidade garantida ou retorno prometido.
- Desconto que não foi autorizado.
- Preço de unidade específica sem o dado em mãos — usar "solicitei os valores, já te envio".
- Escassez inventada. Se não há dado real de estoque, usar outra técnica.

Nunca fazer:
- Falar mal do mercado, da concorrência ou de outro corretor.
- Pedir ou receber documento por canal de IA.
- Usar nome, CPF, RG ou dado pessoal de cliente em exemplo, treinamento ou material.
- Mandar textão ou parecer robô.`;

/**
 * Instrução específica para whatsapp-ai-reply — fala com o CLIENTE, não com o corretor.
 * NÃO usar formato "Leitura / Mensagem / Por quê" aqui.
 */
export const METODO_INSTRUCAO_ATENDIMENTO_DIRETO = `MÉTODO UHOME — INSTRUÇÃO DE SAÍDA (atendimento direto ao cliente)
Use os trechos do MÉTODO UHOME abaixo como técnica de atendimento. Produza APENAS a mensagem final ao cliente, em primeira pessoa, no tom Uhome (tratamento por "tu", 3 a 4 linhas no máximo, terminando em pergunta ou convite). Nunca escreva rótulos como "Leitura:", "Mensagem:" ou "Por quê:". Nunca comente a técnica que está usando. As LINHAS VERMELHAS valem integralmente.`;
