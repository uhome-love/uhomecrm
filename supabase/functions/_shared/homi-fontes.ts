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

/** true quando o texto contém qualquer marcador de dado volátil. */
export function contemVolatil(texto: unknown): boolean {
  if (typeof texto !== "string" || !texto.trim()) return false;
  return VOLATIL_PATTERNS.some((re) => re.test(texto));
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
  "tipologias",
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
] as const;

export interface ComposicaoC2 {
  /** Texto pronto do dossiê permanente, ou string vazia quando nada sobrou. */
  texto: string;
  /** Quantos campos permitidos foram omitidos pela 2ª camada. */
  omitidos: number;
  /** Quantos campos permitidos entraram. */
  incluidos: number;
}

/** Achata `tipologias` (jsonb livre) em texto curto e legível, sem despejar JSON cru. */
function textoTipologias(valor: unknown): string | null {
  if (!valor) return null;
  if (typeof valor === "string") return valor.trim() || null;
  if (Array.isArray(valor)) {
    const partes = valor
      .map((t) => (typeof t === "string" ? t : typeof t === "object" && t ? Object.values(t).join(" ") : ""))
      .map((s) => String(s).trim())
      .filter(Boolean);
    return partes.length ? partes.join("; ") : null;
  }
  if (typeof valor === "object") {
    const partes = Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .filter(Boolean);
    return partes.length ? partes.join("; ") : null;
  }
  return null;
}

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

  /** Adiciona um campo permitido, omitindo-o por inteiro se contiver volátil. */
  const push = (rotulo: string, bruto: unknown) => {
    if (bruto === null || bruto === undefined) return;
    const texto = String(bruto).trim();
    if (!texto) return;
    if (contemVolatil(texto)) {
      omitidos++;
      return;
    }
    linhas.push(`${rotulo}: ${texto}`);
    incluidos++;
  };

  if (registro.bairro) push("LOCALIZAÇÃO", `${registro.bairro} – Porto Alegre/RS`);
  push("CONCEITO", registro.descricao);

  const tipos = textoTipologias(registro.tipologias);
  push("TIPOLOGIAS", tipos);
  if (registro.dormitorios) push("DORMITÓRIOS", registro.dormitorios);
  if (registro.area_privativa) push("ÁREA PRIVATIVA (m²)", registro.area_privativa);

  push("PERFIL DE CLIENTE", registro.perfil_cliente);

  // diferenciais: item a item — item volátil cai inteiro, os demais permanecem.
  const difs = Array.isArray(registro.diferenciais) ? registro.diferenciais : null;
  if (difs?.length) {
    const limpos: string[] = [];
    for (const d of difs) {
      const s = String(d ?? "").trim();
      if (!s) continue;
      if (contemVolatil(s)) {
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
    if (!contemVolatil(linha)) {
      linhasOut.push(linha);
      mantidos++;
      continue;
    }
    // A linha tem volátil: desce ao nível de frase para preservar o permanente.
    const frases = linha.split(/(?<=[.!?;])\s+/);
    const limpas = frases.filter((f) => {
      if (contemVolatil(f)) {
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

/**
 * Classifica um chunk do RAG unificado.
 * C1 = conteúdo pedagógico/normativo (nunca sanitizado).
 * C4 = conteúdo comercial de produto/material/imóvel (sanitizável).
 */
export function classificarChunk(sourceType: string | null | undefined): FonteClasse {
  switch ((sourceType ?? "").toLowerCase()) {
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
