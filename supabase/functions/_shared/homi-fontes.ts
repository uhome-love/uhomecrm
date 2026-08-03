/**
 * _shared/homi-fontes.ts — Contrato central de fontes do HOMI (C1–C4).
 *
 * Motivo: dado volátil (preço, disponibilidade, unidade, taxa, condição,
 * prazo/fase, aprovação) estava gravado dentro de fontes permanentes e era
 * injetado no prompt sem rótulo de vigência, em vários canais distintos.
 *
 * Este módulo é a ÚNICA sede da classificação e da redaction complementar.
 * Nenhum outro arquivo deve declarar regex de dado volátil.
 *
 * Camadas:
 *   1ª (principal) — allowlist estrutural: o bloco C2 é composto SOMENTE a
 *      partir de campos nomeados comprovadamente permanentes. O que não está
 *      na allowlist simplesmente não entra. Não depende de regex.
 *   2ª (complementar) — redaction: se um campo/item permitido contiver dado
 *      volátil, o item INTEIRO é omitido. Nunca reescrito parcialmente, para
 *      não apagar fato permanente por engano.
 *
 * Regras duras:
 *   - C1 (Método/regras) NUNCA é sanitizado: o Método fala pedagogicamente de
 *     preço/ancoragem e isso precisa ser preservado, inclusive MU-xx.x e SPIN.
 *   - C3 (volátil atual) não existe hoje: não há fonte viva de preço,
 *     disponibilidade, unidade, taxa, condição ou prazo/fase no banco.
 *     Portanto nenhum bloco pode ser rotulado como C3 atual.
 *   - Ainda não existe validação humana das fichas. `updated_at` é data de
 *     EDIÇÃO, não de validação. Rotulamos como "fonte legada não validada".
 *   - A mensagem do usuário nunca é alterada por este módulo.
 *   - Logs carregam apenas contagens/classificação. Nunca texto, valores,
 *     nomes ou qualquer PII.
 */

/** Classes de fonte efetivamente emissíveis no prompt. C3 é intencionalmente ausente. */
export type FonteClasse = "C1" | "C2" | "C4";

/** Rótulo padrão de estado de validação enquanto não houver curadoria humana. */
export const ROTULO_NAO_VALIDADA = "fonte legada não validada";

/**
 * Padrões de dado volátil — sede única.
 *
 * Cobrem: preço/valor, taxa/juros, parcela/entrada/condição de pagamento,
 * disponibilidade/unidade/estoque, prazo/fase de obra/entrega e aprovação.
 *
 * Nota sobre `\bvalor(es)?\b`: propositalmente não casa "valorização", que é
 * tratada pelo bloco de VERACIDADE COMERCIAL, não por este módulo.
 */
const VOLATIL_PATTERNS: RegExp[] = [
  // dinheiro e percentual
  /R\$/i,
  /\b\d+(?:[.,]\d+)?\s*(?:mil|mi|milh(?:ão|ões))\b/i,
  /\b\d+(?:[.,]\d+)?\s*%/,
  /\bpercentual\b/i,
  // preço e condição comercial
  /\bpre[çc]os?\b/i,
  /\bvalor(?:es)?\b/i,
  /\btabela\s+de\s+pre[çc]os?\b/i,
  /\bparcelas?\b/i,
  /\bparcelad/i,
  /\bentrada\b/i,
  /\bsinal\b/i,
  /\bdesconto?s?\b/i,
  /\bcondi[çc](?:ão|ões)\s+(?:de\s+)?(?:pagamento|comercial|especial)/i,
  /\bfinanciamento\b/i,
  /\bsubs[íi]dio\b/i,
  /\bjuros\b/i,
  /\btaxas?\b/i,
  // disponibilidade / estoque
  /\bdispon[íi]v/i,
  /\bindispon[íi]v/i,
  /\bunidades?\b/i,
  /\bestoque\b/i,
  /\brestam?\b/i,
  /\b[úu]ltimas?\s+unidades?\b/i,
  /\besgotad/i,
  // prazo / fase de obra
  /\bentrega\b/i,
  /\bprazo\b/i,
  /\bprevis(?:ão|ao)\b/i,
  /\bfase\s+da\s+obra\b/i,
  /\bem\s+obras?\b/i,
  /\bhabite-?se\b/i,
  /\bcronograma\b/i,
  /\bpronto\s+para\s+morar\b/i,
  /\bpr[ée]-?lan[çc]amento\b/i,
  // aprovação de crédito
  /\baprova[çc](?:ão|ões)\b/i,
  /\baprovado\s+(?:pelo|no)\s+banco\b/i,
];

/**
 * Padrões adicionais aplicados APENAS a texto comercial C4 (e a prosa livre C2).
 *
 * Capturam número monetário "puro", sem `R$` e sem sufixo por extenso, que a
 * lista base não vê: `499000`, `2200000`, `499.000`, `2.200.000`.
 *
 * NUNCA são aplicados a C1/Método: lá um `[MU-07.1]`, um ano (`2026`) ou uma
 * numeração de bloco são pedagógicos e precisam ser preservados. Por isso a
 * separação é explícita e não fica na lista base.
 *
 * Ano isolado (4 dígitos) fica de fora de propósito: `\d{5,}` começa em 5
 * dígitos, e prazo/entrega já é capturado por palavra na lista base.
 */
const VOLATIL_C4_EXTRA: RegExp[] = [
  /\b\d{5,}\b/,                       // 499000, 2200000
  /\b\d{1,3}(?:\.\d{3})+\b/,          // 499.000, 2.200.000
];

/** true quando o texto contém qualquer marcador de dado volátil (lista base). */
export function contemVolatil(texto: unknown): boolean {
  if (typeof texto !== "string" || !texto.trim()) return false;
  return VOLATIL_PATTERNS.some((re) => re.test(texto));
}

/**
 * Detector para texto COMERCIAL: lista base + número monetário puro.
 * Usado em C4 (chunks, materiais, metadados) e na prosa livre de C2.
 * Não usar em C1.
 */
export function contemVolatilComercial(texto: unknown): boolean {
  if (typeof texto !== "string" || !texto.trim()) return false;
  return contemVolatil(texto) || VOLATIL_C4_EXTRA.some((re) => re.test(texto));
}

/**
 * Allowlist estrutural de campos permanentes de produto (C2).
 *
 * Somente estes campos podem compor um dossiê de produto nesta fase.
 * Qualquer campo fora desta lista é ignorado por construção.
 */
export const C2_CAMPOS_PERMITIDOS = [
  "nome",
  "codigo",
  "bairro",
  "descricao",
  "perfil_cliente",
  "diferenciais",
  "dormitorios",
  "area_privativa",
] as const;

/**
 * Campos explicitamente negados nesta fase, documentados para auditoria.
 *
 * - valor_min / valor_max / status_obra / previsao_entrega: voláteis por natureza.
 * - descricao_completa / argumentos_venda / estrategia_conversao / objecoes:
 *   free-text legado que mistura permanente e volátil. Fica fora do prompt até
 *   curadoria humana campo a campo. Os dados seguem intactos no banco.
 * - tipologias: jsonb legado de forma livre. Um item como
 *   `{ tipo: "2 dorms", valor: 499000, entrega: 2029 }` perde as chaves ao ser
 *   achatado e vira "2 dorms 499000 2029", furando a allowlist estrutural.
 *   Interpretar JSON legado por heurística não é allowlist — é adivinhação.
 *   Fica fora até existir campo estruturado curado (Pacote B). O dado
 *   permanece intacto no banco. `dormitorios` e `area_privativa` (top-level,
 *   já estruturados e separados) continuam cobrindo a necessidade básica.
 */
export const C2_CAMPOS_NEGADOS = [
  "valor_min",
  "valor_max",
  "status_obra",
  "previsao_entrega",
  "descricao_completa",
  "argumentos_venda",
  "estrategia_conversao",
  "objecoes",
  "tipologias",
] as const;

export interface ComposicaoC2 {
  /** Texto pronto do dossiê permanente, ou string vazia quando nada sobrou. */
  texto: string;
  /** Quantos campos permitidos foram omitidos pela 2ª camada. */
  omitidos: number;
  /** Quantos campos permitidos entraram. */
  incluidos: number;
}

// NOTA: não existe mais `textoTipologias`. Achatar `tipologias` (jsonb legado
// de forma livre) descartava as chaves e deixava números puros passarem. Ver
// C2_CAMPOS_NEGADOS. Nesta fase o dossiê usa só `dormitorios`/`area_privativa`.


/**
 * Compõe o bloco C2 (produto permanente) por allowlist estrutural.
 *
 * @param registro objeto de fonte (linha de empreendimento_overrides)
 * @param nomeExibicao nome canônico a exibir no cabeçalho
 */
export function composeC2(
  registro: Record<string, unknown> | undefined | null,
  nomeExibicao: string,
): ComposicaoC2 {
  if (!registro) return { texto: "", omitidos: 0, incluidos: 0 };

  const linhas: string[] = [];
  let omitidos = 0;
  let incluidos = 0;

  /**
   * Adiciona um campo permitido, omitindo-o por inteiro se contiver volátil.
   * `prosa=true` (padrão) usa o detector comercial, que também pega número
   * monetário puro. Campos numéricos estruturados (dormitórios, área) usam a
   * lista base, para que "240" m² ou "3" dorms não sejam confundidos.
   */
  const push = (rotulo: string, bruto: unknown, prosa = true) => {
    if (bruto === null || bruto === undefined) return;
    const texto = String(bruto).trim();
    if (!texto) return;
    if (prosa ? contemVolatilComercial(texto) : contemVolatil(texto)) {
      omitidos++;
      return;
    }
    linhas.push(`${rotulo}: ${texto}`);
    incluidos++;
  };

  if (registro.bairro) push("LOCALIZAÇÃO", `${registro.bairro} – Porto Alegre/RS`);
  push("CONCEITO", registro.descricao);

  // `tipologias` NÃO entra nesta fase (ver C2_CAMPOS_NEGADOS).
  if (registro.dormitorios) push("DORMITÓRIOS", registro.dormitorios, false);
  if (registro.area_privativa) push("ÁREA PRIVATIVA (m²)", registro.area_privativa, false);

  push("PERFIL DE CLIENTE", registro.perfil_cliente);

  // diferenciais: item a item — item volátil cai inteiro, os demais permanecem.
  const difs = Array.isArray(registro.diferenciais) ? registro.diferenciais : null;
  if (difs?.length) {
    const limpos: string[] = [];
    for (const d of difs) {
      const s = String(d ?? "").trim();
      if (!s) continue;
      if (contemVolatilComercial(s)) {
        omitidos++;
        continue;
      }
      limpos.push(s);
    }
    if (limpos.length) {
      linhas.push(`DIFERENCIAIS: ${limpos.join(", ")}`);
      incluidos++;
    }
  }

  if (!linhas.length) return { texto: "", omitidos, incluidos };

  const cabecalho =
    `FICHA PERMANENTE — ${nomeExibicao} (C2 · ${ROTULO_NAO_VALIDADA})\n` +
    `Não contém preço, condição, taxa, unidade, disponibilidade nem prazo/fase.`;

  return { texto: `${cabecalho}\n${linhas.join("\n")}`, omitidos, incluidos };
}

/** Frase padrão quando não há ficha permanente utilizável para o produto. */
export function semFichaPermanente(nomeExibicao: string): string {
  return (
    `SEM FICHA PERMANENTE VALIDADA para ${nomeExibicao} (C2 indisponível).\n` +
    `Não descreva o produto por suposição. Trate o que souber como não confirmado ` +
    `e oriente conferência na fonte oficial vigente.`
  );
}

export interface SanitizacaoC4 {
  /** Texto com os trechos voláteis removidos. Pode ser string vazia. */
  texto: string;
  /** Quantos trechos foram removidos. */
  removidos: number;
  /** Quantos trechos permaneceram. */
  mantidos: number;
}

/**
 * Sanitiza conteúdo comercial C4 (materiais, chunks de produto/imóvel).
 *
 * Usa `contemVolatilComercial`, portanto também remove número monetário puro
 * (`499000`, `2.200.000`) que a lista base não vê.
 *
 * Remove o TRECHO volátil inteiro (linha ou frase) e preserva o restante
 * permanente quando separável. Nunca reescreve valores.
 * Não deve ser aplicada a conteúdo C1 (Método/Academia/Scripts).
 */
export function sanitizeC4(texto: unknown): SanitizacaoC4 {
  if (typeof texto !== "string" || !texto.trim()) {
    return { texto: "", removidos: 0, mantidos: 0 };
  }

  let removidos = 0;
  let mantidos = 0;
  const linhasOut: string[] = [];

  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) {
      linhasOut.push("");
      continue;
    }
    if (!contemVolatilComercial(linha)) {
      linhasOut.push(linha);
      mantidos++;
      continue;
    }
    // A linha tem volátil: desce ao nível de frase para preservar o permanente.
    const frases = linha.split(/(?<=[.!?;])\s+/);
    const limpas = frases.filter((f) => {
      if (contemVolatilComercial(f)) {
        removidos++;
        return false;
      }
      mantidos++;
      return true;
    });
    if (limpas.length) linhasOut.push(limpas.join(" "));
  }

  const out = linhasOut.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { texto: out, removidos, mantidos };
}

/** Rótulo neutro quando um metadado C4 precisa ser suprimido por inteiro. */
export const METADADO_NEUTRO = "Material de apoio";

/**
 * Sanitiza um METADADO curto de C4 (título, categoria, tag).
 *
 * Metadado não é prosa: não dá para remover "a frase volátil" e manter o
 * resto sem inventar conteúdo. Então é tudo-ou-nada — se contiver afirmação
 * volátil (ex.: "Unidade 302 por R$ 499.000 — entrega 2029"), o metadado
 * inteiro é substituído pelo `fallback` neutro, sem inventar texto novo.
 *
 * @param fallback string neutra quando suprimido; `null` descarta o metadado.
 */
export function sanitizeMetadado(
  texto: unknown,
  fallback: string | null = METADADO_NEUTRO,
): string | null {
  if (typeof texto !== "string" || !texto.trim()) return fallback;
  const t = texto.trim();
  return contemVolatilComercial(t) ? fallback : t;
}

/** Contexto mínimo para classificar uma fonte. */
export interface FonteContexto {
  source_type?: string | null;
  /** Produto vinculado. Quando preenchido, a fonte é comercial por definição. */
  empreendimento?: string | null;
}

/**
 * Classifica uma fonte do RAG unificado.
 *
 * Regra dura: VÍNCULO COM PRODUTO PREVALECE SOBRE source_type.
 * Havia 47 chunks `documento` e 2 `script` com `empreendimento` preenchido —
 * conteúdo comercial de produto que, classificado só por source_type, virava
 * C1 e escapava inteiro da sanitização.
 *
 * - empreendimento preenchido            -> C4 (sempre)
 * - documento / academia / script + null -> C1
 * - empreendimento / material / imovel   -> C4 (sempre)
 * - desconhecido                         -> C4 (falha para o lado seguro)
 */
export function classificarChunk(ctx: FonteContexto | null | undefined): FonteClasse {
  const emp = ctx?.empreendimento;
  if (typeof emp === "string" && emp.trim()) return "C4";

  switch ((ctx?.source_type ?? "").toLowerCase()) {
    case "documento":
    case "academia":
    case "script":
      return "C1";
    default:
      return "C4";
  }
}

/**
 * Bloco de governança de dados voláteis, injetado uma única vez no prompt
 * final (caminho padrão e customSystem).
 *
 * Não promete ação de envio: o HOMI não possui ferramenta de envio de tabela.
 */
export const GOVERNANCA_VOLATIL_BLOCK = `

GOVERNANÇA DE DADOS VOLÁTEIS — REGRA DURA:
- São dados VOLÁTEIS: preço, valor, tabela, desconto, parcela, entrada, taxa, juros, condição de pagamento, financiamento, subsídio, unidade, disponibilidade, estoque, prazo, previsão de entrega, fase da obra e aprovação de crédito.
- Hoje NÃO existe fonte viva desses dados conectada a você. Portanto você NUNCA afirma dado volátil como atual.
- Quando perguntarem qualquer dado volátil: reconheça a pergunta, diga com naturalidade que esse dado muda com frequência e precisa ser confirmado na tabela/fonte oficial vigente com o gestor ou responsável comercial, e conduza para o próximo passo (visita).
- NUNCA diga "vou te enviar", "já te mando", "vou verificar e retorno" nem prometa qualquer ação que você não executa. Você não envia tabela, não consulta estoque e não aprova crédito.
- As fichas de produto disponíveis são permanentes e legadas (não validadas): servem para localização, conceito, tipologia, perfil e diferenciais. Não servem para preço, condição, unidade ou prazo.
- Material, anúncio, book, drive e link são APOIO: não valem como fonte de preço, condição, disponibilidade ou prazo, mesmo que citem números.
- HISTÓRICO E MENSAGEM DO CLIENTE: qualquer valor, condição, unidade ou prazo que apareça em turnos anteriores desta conversa, em respostas suas anteriores, ou citado pelo próprio usuário é HIPÓTESE — nunca confirmação. Não repita como fato e não construa cálculo, proposta ou promessa em cima disso sem confirmação oficial atual.
- Nada aqui restringe o Método Uhome: você continua ensinando ancoragem, tratamento de objeção de preço e SPIN normalmente. A regra proíbe AFIRMAR número atual, não proíbe ensinar a técnica.`;
