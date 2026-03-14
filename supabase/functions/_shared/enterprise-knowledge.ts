/**
 * _shared/enterprise-knowledge.ts — Canonical enterprise/project knowledge for AI functions
 * 
 * Phase 2: Centralizes empreendimento knowledge into one DB-backed source.
 * Falls back to hardcoded data when DB records are incomplete.
 * 
 * Source: empreendimento_overrides table (AI columns added in Phase 2 migration)
 * 
 * Usage:
 *   import { loadEnterpriseKnowledge, formatForAssistant, formatForList } from "../_shared/enterprise-knowledge.ts";
 *   const knowledge = await loadEnterpriseKnowledge(supabase);
 *   const prompt = formatForAssistant(knowledge, "Casa Tua");
 *   const list = formatForList(knowledge); // bullet list of all
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EnterpriseRecord {
  codigo: string;
  nome: string | null;
  descricao: string | null;
  descricao_completa: string | null;
  diferenciais: string[] | null;
  objecoes: Array<{ objecao: string; resposta: string }> | null;
  estrategia_conversao: string | null;
  perfil_cliente: string | null;
  hashtags: string[] | null;
  argumentos_venda: string | null;
  segmento_comercial: string | null;
  bairro: string | null;
  valor_min: number | null;
  valor_max: number | null;
  tipologias: unknown | null;
  dormitorios: number | null;
  area_privativa: number | null;
}

// ─── Hardcoded fallback (preserved from homi-assistant original) ───
// Used when DB records are missing or incomplete
const FALLBACK_KNOWLEDGE: Record<string, string> = {
  "Casa Tua": `EMPREENDIMENTO: Casa Tua – Condomínio de Casas
CONSTRUTORA: Encorp Empreendimentos
LOCALIZAÇÃO: Av. Protásio Alves, 10.431 – Alto Petrópolis / Morro Santana – Porto Alegre/RS
CONCEITO: Condomínio fechado de casas para quem busca conforto e liberdade de morar em casa, com segurança e infraestrutura de condomínio.
TIPOLOGIAS: Casas de 2 e 3 dormitórios. Metragens: 99m², 127m², 176m² (com terraço).
PERFIL: Famílias que querem sair do apartamento e ter mais privacidade.
DIFERENCIAIS: Pátio privativo, lazer completo, segurança de condomínio, arquitetura moderna.
OBJEÇÕES: "Localização afastada" → qualidade de vida e espaço. "Casas geminadas" → projeto para privacidade + segurança.
ESTRATÉGIA: Entender perfil → conceito de condomínio de casas → diferenciais → convidar visita.`,

  "Open Bosque": `EMPREENDIMENTO: Open Bosque – Parque do Arvoredo
CONSTRUTORA: Open Construtora (grupo Melnick)
LOCALIZAÇÃO: Rua Pedro Waine, 75 – Passo d'Areia / Santa Maria Goretti – Zona Norte – Porto Alegre/RS
CONCEITO: Condomínio-parque com +22.000m² de área verde. Primeiro imóvel, custo-benefício.
TIPOLOGIAS: Apartamentos 1, 2 e 3 dormitórios. 31m² a 63m².
PERFIL: Primeiro imóvel, sair do aluguel, jovens casais, famílias pequenas, investidores.
DIFERENCIAIS: Condomínio-parque integrado, infraestrutura completa, financiamento facilitado.
OBJEÇÕES: "Apto pequeno" → lazer compensa. "Não conheço região" → projeto de revitalização.
ESTRATÉGIA: Entender perfil → conceito condomínio-parque → lazer e localização → decorado.`,

  "Melnick Day": `TIPO: EVENTO DE VENDAS (não é empreendimento)
EMPRESA: Melnick
DATA: 21 de março de 2026 (evento de UM DIA)
CONCEITO: Maior evento de vendas do mercado imobiliário do Sul do Brasil. Descontos até ~30%.
PERFIL: Investidores, clientes que já procuravam imóvel, quem aguarda boas oportunidades.
DIFERENCIAIS: Descontos exclusivos, condições especiais, negociação direta com construtora.
OBJEÇÕES: "Vou pensar" → condições válidas APENAS durante o evento. "Quero ver depois" → valores retornam ao normal.
ESTRATÉGIA: Entender perfil → oportunidades únicas → empreendimentos participantes → urgência real.`,

  "Alto Lindóia": `EMPREENDIMENTO: Alto Lindóia Resort
INCORPORADORA: Florença Incorporadora
LOCALIZAÇÃO: Rua Monsenhor Antônio Guilherme Grings, 100 – Bairro Sarandi – Porto Alegre/RS
CONCEITO: Resort urbano com +25 espaços de lazer (~7.298m²). Custo-benefício.
TIPOLOGIAS: Apartamentos 1, 2 e 3 dormitórios. 36m² a 78m².
PERFIL: Sair do aluguel, primeiro imóvel, famílias jovens, investidores médio padrão.
DIFERENCIAIS: Conceito resort, +25 itens lazer, sacada com churrasqueira, custo-benefício.
OBJEÇÕES: "Apto pequeno" → lazer amplia convivência. "Mais central" → boa mobilidade, valores acessíveis.
ESTRATÉGIA: Entender perfil → conceito resort → estrutura lazer → convidar visita.`,

  "Orygem": `EMPREENDIMENTO: Orygem Residence Club
INCORPORADORA: Encorp Empreendimentos
LOCALIZAÇÃO: Av. Engenheiro Ludolfo Boehl, 931 – Bairro Teresópolis – Porto Alegre/RS
CONCEITO: Condomínio fechado de casas. Natureza, segurança e lazer completo.
TIPOLOGIAS: Casas 2 e 3 dormitórios. 150m² e 173m². 3 pavimentos.
PERFIL: Sair do apartamento, mais espaço, segurança de condomínio, upgrade de moradia.
DIFERENCIAIS: Casas amplas 3 pavimentos, pátio privativo, lazer completo, natureza.
OBJEÇÕES: "Prefiro apto" → liberdade de casa COM segurança. "Valor alto" → comparar com casas centrais.
ESTRATÉGIA: Entender perfil → conceito condomínio de casas → espaço e lazer → visita.`,

  "Casa Bastian": `EMPREENDIMENTO: Casa Bastian
INCORPORADORA: ABF Developments
LOCALIZAÇÃO: Av. Praia de Belas / Av. Bastian – Bairro Menino Deus – Porto Alegre/RS
CONCEITO: Lofts e studios compactos. Arquitetura moderna + preservação histórica. Alta liquidez.
TIPOLOGIAS: Lofts 14-30m², lofts com office 33-36m², aptos 1 dorm 29-36m².
PERFIL: Investidores, estudantes, jovens profissionais, executivos.
DIFERENCIAIS: Localização central Menino Deus, alta demanda locação, arquitetura moderna.
OBJEÇÕES: "Muito pequeno" → moradia urbana compacta, alta liquidez. "Mais para investimento?" → atende ambos.
ESTRATÉGIA: Moradia ou investimento → localização e liquidez → conceito studio → visita.`,

  "Shift": `EMPREENDIMENTO: Shift
INCORPORADORA: Vanguard (Grupo Plaenge)
LOCALIZAÇÃO: Rua Silva Jardim, 21 – Bairro Auxiliadora – Porto Alegre/RS
CONCEITO: Studios e aptos compactos. Conceito "Life on Demand". Mobilidade e praticidade.
TIPOLOGIAS: Studios ~24-48m², aptos 1 dorm ~75-108m².
PERFIL: Morar sozinho região central, investidores, estudantes, jovens profissionais.
DIFERENCIAIS: Localização premium Auxiliadora, alta demanda locação, projeto moderno.
OBJEÇÕES: "Apto pequeno" → moradia urbana funcional. "Mais para investimento?" → atende ambos.
ESTRATÉGIA: Moradia ou investimento → localização e mobilidade → conceito studio → visita.`,

  "Lake Eyre": `EMPREENDIMENTO: Lake Eyre
LOCALIZAÇÃO: Av. Diário de Notícias – Bairro Cristal – Porto Alegre/RS (Golden Lake)
CONCEITO: Alto padrão dentro do bairro planejado Golden Lake (~163 mil m²). Sofisticação e exclusividade.
TIPOLOGIAS: Aptos 3 e 4 suítes. 127m² a 186m². Coberturas até ~326m².
PERFIL: Famílias alto padrão, executivos, investidores.
DIFERENCIAIS: Golden Lake (bairro privativo), vista Guaíba, aptos amplos, lazer completo.
OBJEÇÕES: "Valor alto" → bairro exclusivo, forte valorização. "Prefiro casa" → metragem ampla + infraestrutura.
ESTRATÉGIA: Perfil e faixa investimento → conceito Golden Lake → exclusividade → visita.`,

  "Las Casas": `EMPREENDIMENTO: Las Casas
TIPO: Bairro planejado – Lotes em condomínio fechado
LOCALIZAÇÃO: Porto Alegre – RS
CONCEITO: Lotes para construção de casas. Privacidade, espaço e qualidade de vida.
PERFIL: Querem sair de apartamento, morar em casa com segurança, famílias.
DIFERENCIAIS: Condomínio fechado, casas modernas, segurança, infraestrutura de lazer.
OBJEÇÕES: "Prefiro apto" → segurança de condomínio + liberdade de casa. "Mais central" → tranquilidade e espaço.
ESTRATÉGIA: Casa ou apto → mais espaço → conceito condomínio → convidar visita.`,
};

// Brief fallback for homi-chat style (shorter descriptions)
const FALLBACK_BRIEF: Record<string, string> = {
  "Casa Tua": "Condomínio fechado de casas, Encorp, Alto Petrópolis/Morro Santana. Casas 2-3 dorms (99-176m²). Pátio privativo, lazer completo. Para famílias que querem sair de apto.",
  "Open Bosque": "Open Construtora (Melnick), Passo d'Areia. Condomínio-parque com 7.500m² de lazer. Aptos 2-3 dorms (47-80m²). Conceito de parque dentro do condomínio.",
  "Shift": "Vanguard (Plaenge), Auxiliadora. Studios e 1 dorm (24-108m²). Conceito Life on Demand. Localização premium esquina Silva Jardim com 24 de Outubro.",
  "Casa Bastian": "ABF Developments, Menino Deus. Lofts e studios (14-36m²). Arquitetura moderna + preservação histórica. Alta liquidez para locação.",
  "Melnick Day": "EVENTO DE VENDAS anual da Melnick. 21/março/2026. Descontos até ~30%. Condições exclusivas que não se repetem. Urgência real.",
  "Alto Lindóia": "Florença Incorporadora, Sarandi. Resort urbano com +25 espaços de lazer (~7.298m²). Aptos 1-3 dorms (36-78m²). Melhor custo-benefício.",
  "Lake Eyre": "Alto padrão no Golden Lake (bairro privativo), Cristal. Aptos 3-4 suítes (127-326m²). Vista Guaíba, sofisticação.",
  "Orygem": "Encorp, Teresópolis. Condomínio fechado de casas 2-3 dorms (150-173m²). Natureza e lazer completo.",
  "Las Casas": "Bairro planejado, lotes em condomínio fechado em POA. Para famílias que querem casa com segurança, espaço e natureza.",
};

// Fallback hashtags for homi-ana
const FALLBACK_HASHTAGS: Record<string, string[]> = {
  "Open Bosque": ["#OpenBosque", "#ApartamentoPOA", "#MCMV", "#MinhaCasaMinhaVida", "#ImóvelAcessível", "#UhomePOA"],
  "Lake Eyre": ["#LakeEyre", "#LuxuryLiving", "#ImóvelDeLuxo", "#AltopadrãoPOA", "#UhomeLuxury"],
  "Casa Bastian": ["#CasaBastian", "#InvestimentoImobiliário", "#RendaPassiva", "#ImóvelComoInvestimento"],
  "Shift": ["#Shift", "#InvestimentoImobiliário", "#RendaPassiva", "#ImóvelComoInvestimento"],
  "Orygem": ["#Orygem", "#SeuNovoLar", "#UhomePOA"],
  "Casa Tua": ["#CasaTua", "#SeuNovoLar", "#UhomePOA"],
  "Las Casas": ["#LasCasas", "#SeuNovoLar", "#UhomePOA"],
};

const FALLBACK_SEGMENTS: Record<string, string> = {
  "Open Bosque": "mcmv",
  "Alto Lindóia": "mcmv",
  "Casa Tua": "medio_alto",
  "Orygem": "medio_alto",
  "Las Casas": "medio_alto",
  "Lake Eyre": "altissimo",
  "Casa Bastian": "investimento",
  "Shift": "investimento",
  "Melnick Day": "evento",
};

let _cachedKnowledge: EnterpriseRecord[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a service-role Supabase client for DB access.
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Load all enterprise knowledge from DB with in-memory caching (5 min TTL).
 * Falls back gracefully if DB is unavailable.
 */
export async function loadEnterpriseKnowledge(
  supabase?: ReturnType<typeof createClient>
): Promise<EnterpriseRecord[]> {
  // Check cache
  if (_cachedKnowledge && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _cachedKnowledge;
  }

  try {
    const client = supabase || createServiceClient();
    const { data, error } = await client
      .from("empreendimento_overrides")
      .select("codigo, nome, descricao, descricao_completa, diferenciais, objecoes, estrategia_conversao, perfil_cliente, hashtags, argumentos_venda, segmento_comercial, bairro, valor_min, valor_max, tipologias, dormitorios, area_privativa")
      .order("nome");

    if (error) {
      console.error("enterprise-knowledge: DB load error:", error.message);
      return _cachedKnowledge || [];
    }

    _cachedKnowledge = (data || []).map(row => ({
      ...row,
      objecoes: Array.isArray(row.objecoes) ? row.objecoes : null,
    }));
    _cacheTime = Date.now();
    return _cachedKnowledge;
  } catch (e) {
    console.error("enterprise-knowledge: load exception:", e);
    return _cachedKnowledge || [];
  }
}

/**
 * Format a single empreendimento for detailed AI assistant prompts.
 * Uses DB data when available, falls back to hardcoded.
 */
export function formatForAssistant(
  records: EnterpriseRecord[],
  empreendimentoName: string
): string {
  // Try to find DB record (case-insensitive match)
  const record = records.find(r =>
    (r.nome || r.codigo || "").toLowerCase() === empreendimentoName.toLowerCase() ||
    r.codigo.toLowerCase() === empreendimentoName.toLowerCase()
  );

  // If DB has descricao_completa, use it (canonical source)
  if (record?.descricao_completa) {
    return record.descricao_completa;
  }

  // Build from structured DB fields if available
  if (record && (record.descricao || record.diferenciais?.length)) {
    let text = `EMPREENDIMENTO: ${record.nome || record.codigo}`;
    if (record.bairro) text += `\nLOCALIZAÇÃO: ${record.bairro} – Porto Alegre/RS`;
    if (record.descricao) text += `\nCONCEITO: ${record.descricao}`;
    if (record.tipologias) text += `\nTIPOLOGIAS: ${JSON.stringify(record.tipologias)}`;
    if (record.perfil_cliente) text += `\nPERFIL DE CLIENTE IDEAL: ${record.perfil_cliente}`;
    if (record.diferenciais?.length) text += `\nDIFERENCIAIS: ${record.diferenciais.join(", ")}`;
    if (record.objecoes?.length) {
      text += "\nOBJEÇÕES E RESPOSTAS:";
      record.objecoes.forEach(o => {
        text += `\n- "${o.objecao}" → ${o.resposta}`;
      });
    }
    if (record.argumentos_venda) text += `\nARGUMENTOS DE VENDA: ${record.argumentos_venda}`;
    if (record.estrategia_conversao) text += `\nESTRATÉGIA DE CONVERSÃO: ${record.estrategia_conversao}`;
    return text;
  }

  // Fallback to hardcoded detailed knowledge
  return FALLBACK_KNOWLEDGE[empreendimentoName]
    || `Empreendimento da UHome: ${empreendimentoName}. Use técnicas de qualificação e convite para visita.`;
}

/**
 * Format a single empreendimento as a brief description (for homi-chat style).
 */
export function formatBrief(
  records: EnterpriseRecord[],
  empreendimentoName: string
): string {
  const record = records.find(r =>
    (r.nome || r.codigo || "").toLowerCase() === empreendimentoName.toLowerCase() ||
    r.codigo.toLowerCase() === empreendimentoName.toLowerCase()
  );

  if (record) {
    const parts: string[] = [];
    if (record.descricao) parts.push(record.descricao);
    else if (record.bairro) parts.push(`${record.bairro}, Porto Alegre`);
    if (record.dormitorios) parts.push(`${record.dormitorios} dorms`);
    if (record.diferenciais?.length) parts.push(record.diferenciais.slice(0, 2).join(", "));
    if (parts.length > 0) return parts.join(". ");
  }

  return FALLBACK_BRIEF[empreendimentoName] || `Empreendimento da UHome.`;
}

/**
 * Format all empreendimentos as a bullet list for system prompts.
 * Uses brief format for each.
 */
export function formatForList(records: EnterpriseRecord[]): string {
  // Merge DB records with fallback names to ensure completeness
  const allNames = new Set<string>();
  records.forEach(r => allNames.add(r.nome || r.codigo));
  Object.keys(FALLBACK_BRIEF).forEach(name => allNames.add(name));

  return Array.from(allNames)
    .map(name => `• ${name}: ${formatBrief(records, name)}`)
    .join("\n");
}

/**
 * Get just the list of empreendimento names (for gerencial/ceo simple lists).
 */
export function getEmpreendimentoNames(records: EnterpriseRecord[]): string[] {
  const names = new Set<string>();
  records.forEach(r => names.add(r.nome || r.codigo));
  Object.keys(FALLBACK_BRIEF).forEach(name => names.add(name));
  return Array.from(names);
}

/**
 * Get hashtags for an empreendimento (for homi-ana).
 */
export function getHashtags(records: EnterpriseRecord[], empreendimentoName: string): string[] {
  const record = records.find(r =>
    (r.nome || r.codigo || "").toLowerCase() === empreendimentoName.toLowerCase()
  );
  if (record?.hashtags?.length) return record.hashtags;
  return FALLBACK_HASHTAGS[empreendimentoName] || ["#Uhome", "#UhomeNegócios", "#ImóvelPortoAlegre"];
}

/**
 * Get segment grouping for homi-ana marketing prompts.
 */
export function getSegmentGrouping(records: EnterpriseRecord[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    mcmv: [],
    medio_alto: [],
    altissimo: [],
    investimento: [],
    evento: [],
    outro: [],
  };

  const processed = new Set<string>();

  // DB records first
  records.forEach(r => {
    const name = r.nome || r.codigo;
    const seg = r.segmento_comercial || FALLBACK_SEGMENTS[name] || "outro";
    if (!groups[seg]) groups[seg] = [];
    groups[seg].push(name);
    processed.add(name);
  });

  // Fallback for missing
  Object.entries(FALLBACK_SEGMENTS).forEach(([name, seg]) => {
    if (!processed.has(name)) {
      if (!groups[seg]) groups[seg] = [];
      groups[seg].push(name);
    }
  });

  return groups;
}

/**
 * Build the full marketing context for homi-ana (segments + hashtags).
 */
export function formatForMarketing(records: EnterpriseRecord[]): string {
  const segments = getSegmentGrouping(records);
  const segLabels: Record<string, string> = {
    mcmv: "Seg 1 (MCMV/até 500k)",
    medio_alto: "Seg 2 (Médio-alto)",
    altissimo: "Seg 3 (Altíssimo padrão)",
    investimento: "Seg 4 (Investimento)",
    evento: "Eventos",
    outro: "Outros",
  };

  let text = "EMPREENDIMENTOS ATIVOS:";
  Object.entries(segments).forEach(([seg, names]) => {
    if (names.length === 0) return;
    text += `\n- ${segLabels[seg] || seg}: ${names.join(", ")}`;
  });

  text += "\n\nHASHTAGS POR EMPREENDIMENTO:";
  const allNames = getEmpreendimentoNames(records);
  allNames.forEach(name => {
    const tags = getHashtags(records, name);
    if (tags.length) text += `\n${name}: ${tags.join(" ")}`;
  });
  text += `\nGerais: #Uhome #UhomeNegócios #ImóvelPortoAlegre #MercadoImobiliário #NovoComeço`;

  return text;
}
