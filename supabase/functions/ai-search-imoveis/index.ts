import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BAIRROS_ZONA_NORTE = [
  "Sarandi", "Passo d'Areia", "São Sebastião", "Jardim Lindóia", "Jardim São Pedro",
  "Vila Ipiranga", "Jardim Itu", "Higienópolis", "São João", "Santa Maria Goretti",
  "Jardim Europa", "Boa Vista", "Três Figueiras", "Chácara das Pedras",
];

const BAIRROS_ZONA_SUL = [
  "Tristeza", "Ipanema", "Cavalhada", "Camaquã", "Cristal", "Vila Nova",
  "Nonoai", "Teresópolis", "Vila Assunção", "Pedra Redonda", "Lami",
];

const BAIRROS_CENTRO = [
  "Centro Histórico", "Cidade Baixa", "Bom Fim", "Farroupilha", "Floresta",
  "Moinhos de Vento", "Independência", "Rio Branco", "Mont'Serrat", "Auxiliadora",
  "Bela Vista", "Petrópolis", "Menino Deus", "Praia de Belas", "Santa Cecília",
  "Santana", "Santo Antônio",
];

const BAIRROS_PERTO_IGUATEMI = [
  "Três Figueiras", "Chácara das Pedras", "Boa Vista", "Jardim Europa",
  "Vila Jardim", "Jardim Isabel", "Jardim Botânico", "Petrópolis",
];

const BAIRROS_ALTO_PADRAO = [
  "Moinhos de Vento", "Bela Vista", "Petrópolis", "Mont'Serrat", "Três Figueiras",
  "Auxiliadora", "Boa Vista", "Chácara das Pedras", "Jardim Europa",
  "Rio Branco", "Independência",
];

const BAIRROS_LESTE = [
  "Jardim Carvalho", "Jardim do Salso", "Mário Quintana", "Agronomia",
  "Lomba do Pinheiro", "Protásio Alves",
];

const BAIRROS_INVESTIMENTO = [
  "Centro Histórico", "Cidade Baixa", "Bom Fim", "Rio Branco", "Auxiliadora",
  "Moinhos de Vento", "Menino Deus",
];

const REGION_MAP: Record<string, string[]> = {
  "zona norte": BAIRROS_ZONA_NORTE,
  "zona sul": BAIRROS_ZONA_SUL,
  "centro": BAIRROS_CENTRO,
  "zona leste": BAIRROS_LESTE,
  "perto do iguatemi": BAIRROS_PERTO_IGUATEMI,
  "proximidades do iguatemi": BAIRROS_PERTO_IGUATEMI,
  "alto padrao": BAIRROS_ALTO_PADRAO,
  "alto padrão": BAIRROS_ALTO_PADRAO,
  "regiao nobre": BAIRROS_ALTO_PADRAO,
  "região nobre": BAIRROS_ALTO_PADRAO,
  "investimento": BAIRROS_INVESTIMENTO,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente especialista no mercado imobiliário de Porto Alegre, Brasil.
Sua tarefa é interpretar buscas em linguagem natural e extrair filtros estruturados para busca de imóveis.

CONTEXTO GEOGRÁFICO:
- Zona Norte: ${BAIRROS_ZONA_NORTE.join(", ")}
- Zona Sul: ${BAIRROS_ZONA_SUL.join(", ")}
- Centro: ${BAIRROS_CENTRO.join(", ")}
- Zona Leste: ${BAIRROS_LESTE.join(", ")}
- Perto do Iguatemi: ${BAIRROS_PERTO_IGUATEMI.join(", ")}
- Bairros Alto Padrão: ${BAIRROS_ALTO_PADRAO.join(", ")}
- Bairros para Investimento: ${BAIRROS_INVESTIMENTO.join(", ")}

SINÔNIMOS IMOBILIÁRIOS:
- "compacto", "studio", "kitnet" = tipo loft/studio/kitnet, 1 dormitório
- "alto padrão", "luxo", "premium" = bairros nobres, valor alto
- "entrada facilitada" = lançamento/em obras
- "bom para Airbnb", "investir", "renda" = perfil investidor, compactos em bairros centrais
- "para família", "família grande" = 3-4 dormitórios, maior metragem
- "casal", "jovem casal", "recém casados" = 2 dormitórios, valor moderado
- "qtos", "quartos" = dormitórios
- "apto" = apartamento
- "cond", "condomínio" = condomínio fechado (casas)
- "jk" = kitnet/studio, 1 dormitório
- "cobertura", "duplex" = cobertura
- "terreno", "lote" = terreno
- "alugar", "aluguel", "locação" = contrato locacao (usar campo contrato)
- "comprar", "compra", "venda" = contrato venda

FAIXAS DE PREÇO COMUNS EM PORTO ALEGRE:
- MCMV / econômico: até R$ 350.000
- Médio padrão: R$ 350.000 - R$ 700.000
- Médio-alto: R$ 700.000 - R$ 1.200.000
- Alto padrão: R$ 1.200.000 - R$ 2.500.000
- Altíssimo padrão: acima de R$ 2.500.000
- "barato", "econômico", "acessível" = até R$ 400.000
- "até 1 milhão" = valor_max 1.000.000

CORREÇÃO DE ERROS COMUNS:
- "bela vsta" = "Bela Vista", "iguatmi" = região Iguatemi
- "moinhos" = "Moinhos de Vento", "pet" = "Petrópolis"
- "lindoia" = "Jardim Lindóia" ou "Lindóia"
- "cidade baixa" ou "CB" = "Cidade Baixa"
- "menino deus" ou "MD" = "Menino Deus"
- "3fig" ou "tres figueiras" = "Três Figueiras"

REGRAS IMPORTANTES:
1. Se o usuário não especificar contrato, assuma VENDA
2. Se mencionar "aluguel/alugar/locação", defina contrato como "locacao"
3. NÃO restrinja excessivamente — se houver dúvida, seja mais amplo nos filtros
4. Se o usuário buscar por nome de empreendimento, coloque no texto_busca
5. Sempre forneça uma explicação consultiva clara

Use a ferramenta parse_property_search para extrair os filtros. Sempre chame a ferramenta.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Interprete esta busca de imóvel e extraia os filtros:\n\n"${query}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_property_search",
              description: "Extrai filtros estruturados de uma busca de imóvel em linguagem natural.",
              parameters: {
                type: "object",
                properties: {
                  tipos: {
                    type: "array",
                    items: { type: "string", enum: ["apartamento", "casa", "cobertura", "terreno", "comercial", "loft", "kitnet"] },
                    description: "Tipos de imóvel identificados. Só inclua se o usuário mencionou explicitamente.",
                  },
                  contrato: {
                    type: "string",
                    enum: ["venda", "locacao"],
                    description: "Tipo de contrato: venda (compra) ou locacao (aluguel). Default: venda",
                  },
                  bairros: {
                    type: "array",
                    items: { type: "string" },
                    description: "Bairros específicos mencionados ou inferidos da região. Use nomes exatos da lista de bairros.",
                  },
                  regiao: {
                    type: "string",
                    description: "Região mencionada: zona norte, zona sul, centro, zona leste, perto do iguatemi, etc.",
                  },
                  dormitorios: {
                    type: "array",
                    items: { type: "string" },
                    description: "Números de dormitórios desejados, ex: ['2','3']. Só inclua se mencionado.",
                  },
                  suites_min: {
                    type: "number",
                    description: "Mínimo de suítes. Só inclua se mencionado.",
                  },
                  vagas_min: {
                    type: "number",
                    description: "Mínimo de vagas de garagem. Só inclua se mencionado.",
                  },
                  valor_min: {
                    type: "number",
                    description: "Valor mínimo em reais. Só inclua se mencionado ou inferido do contexto.",
                  },
                  valor_max: {
                    type: "number",
                    description: "Valor máximo em reais. Só inclua se mencionado ou inferido do contexto.",
                  },
                  area_min: {
                    type: "number",
                    description: "Área mínima em m². Só inclua se mencionado.",
                  },
                  area_max: {
                    type: "number",
                    description: "Área máxima em m². Só inclua se mencionado.",
                  },
                  em_obras: {
                    type: "boolean",
                    description: "Se busca especificamente lançamentos/em obras. Só true se mencionado.",
                  },
                  perfil: {
                    type: "string",
                    enum: ["investidor", "moradia", "familia", "alto_padrao", "primeira_compra", "renda_passiva", "compacto"],
                    description: "Perfil identificado do comprador",
                  },
                  texto_busca: {
                    type: "string",
                    description: "Termos para busca textual livre no catálogo (nome de empreendimento, construtora, característica específica). Use '*' se não houver termos específicos.",
                  },
                  explicacao: {
                    type: "string",
                    description: "Frase consultiva explicando o que foi entendido da busca, como um consultor imobiliário faria. Ex: 'Busquei apartamentos compactos ideais para investimento na região central de Porto Alegre'",
                  },
                  sugestao_alternativa: {
                    type: "string",
                    description: "Sugestão proativa de busca alternativa, como um bom consultor faria. Ex: 'Considere também o bairro Menino Deus, com boa valorização e mesmo perfil'",
                  },
                },
                required: ["explicacao"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_property_search" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para busca por IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na busca inteligente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "parse_property_search") {
      return new Response(JSON.stringify({ error: "IA não conseguiu interpretar a busca" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expand region to bairros if no specific bairros given
    if (parsed.regiao && (!parsed.bairros || parsed.bairros.length === 0)) {
      const regionKey = parsed.regiao.toLowerCase().trim();
      const mapped = REGION_MAP[regionKey];
      if (mapped) {
        parsed.bairros = mapped;
      }
    }

    // Determine contrato
    const contrato = parsed.contrato || "venda";

    // Build Typesense-compatible filter_by
    const filterParts: string[] = [];

    // Contrato-based value filter
    if (contrato === "locacao") {
      filterParts.push("valor_locacao:>0");
    } else {
      filterParts.push("valor_venda:>0");
    }

    if (parsed.bairros?.length === 1) {
      filterParts.push(`bairro:=${parsed.bairros[0]}`);
    } else if (parsed.bairros?.length > 1) {
      filterParts.push(`bairro:[${parsed.bairros.join(",")}]`);
    }

    if (parsed.tipos?.length === 1) {
      filterParts.push(`tipo:=${parsed.tipos[0]}`);
    } else if (parsed.tipos?.length > 1) {
      filterParts.push(`tipo:[${parsed.tipos.join(",")}]`);
    }

    if (parsed.dormitorios?.length === 1) {
      filterParts.push(`dormitorios:=${parsed.dormitorios[0]}`);
    } else if (parsed.dormitorios?.length > 1) {
      filterParts.push(`dormitorios:[${parsed.dormitorios.join(",")}]`);
    }

    const priceField = contrato === "locacao" ? "valor_locacao" : "valor_venda";
    if (parsed.suites_min) filterParts.push(`suites:>=${parsed.suites_min}`);
    if (parsed.vagas_min) filterParts.push(`vagas:>=${parsed.vagas_min}`);
    if (parsed.valor_min) filterParts.push(`${priceField}:>=${parsed.valor_min}`);
    if (parsed.valor_max) filterParts.push(`${priceField}:<=${parsed.valor_max}`);
    if (parsed.area_min) filterParts.push(`area_privativa:>=${parsed.area_min}`);
    if (parsed.area_max) filterParts.push(`area_privativa:<=${parsed.area_max}`);
    if (parsed.em_obras) filterParts.push(`em_obras:=true`);

    const result = {
      filters: { ...parsed, contrato },
      filter_by: filterParts.join(" && "),
      query_by: "titulo,empreendimento,bairro,endereco,codigo,construtora,descricao_resumida",
      text_query: parsed.texto_busca || "*",
      explicacao: parsed.explicacao || "Busca processada.",
      sugestao_alternativa: parsed.sugestao_alternativa || null,
      perfil: parsed.perfil || null,
      contrato,
      tags: buildTags(parsed, contrato),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-search-imoveis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildTags(parsed: any, contrato?: string): { key: string; label: string; category: string }[] {
  const tags: { key: string; label: string; category: string }[] = [];

  if (contrato === "locacao") {
    tags.push({ key: "contrato", label: "Locação", category: "contrato" });
  }

  if (parsed.tipos?.length) {
    parsed.tipos.forEach((t: string) => tags.push({ key: `tipo-${t}`, label: t.charAt(0).toUpperCase() + t.slice(1), category: "tipo" }));
  }
  if (parsed.bairros?.length) {
    if (parsed.bairros.length <= 3) {
      parsed.bairros.forEach((b: string) => tags.push({ key: `bairro-${b}`, label: b, category: "bairro" }));
    } else {
      tags.push({ key: "bairros", label: `${parsed.bairros.length} bairros`, category: "bairro" });
    }
  }
  if (parsed.regiao) {
    tags.push({ key: "regiao", label: parsed.regiao.charAt(0).toUpperCase() + parsed.regiao.slice(1), category: "regiao" });
  }
  if (parsed.dormitorios?.length) {
    tags.push({ key: "dorms", label: parsed.dormitorios.join(", ") + " dorm", category: "dormitorios" });
  }
  if (parsed.suites_min) tags.push({ key: "suites", label: `${parsed.suites_min}+ suíte`, category: "suites" });
  if (parsed.vagas_min) tags.push({ key: "vagas", label: `${parsed.vagas_min}+ vaga`, category: "vagas" });
  if (parsed.valor_max) {
    const fmt = parsed.valor_max >= 1_000_000 ? `${(parsed.valor_max / 1_000_000).toFixed(1).replace(".0", "")}M` : `${(parsed.valor_max / 1_000).toFixed(0)}mil`;
    tags.push({ key: "valor_max", label: `até R$ ${fmt}`, category: "valor" });
  }
  if (parsed.valor_min) {
    const fmt = parsed.valor_min >= 1_000_000 ? `${(parsed.valor_min / 1_000_000).toFixed(1).replace(".0", "")}M` : `${(parsed.valor_min / 1_000).toFixed(0)}mil`;
    tags.push({ key: "valor_min", label: `a partir de R$ ${fmt}`, category: "valor" });
  }
  if (parsed.area_min || parsed.area_max) {
    const parts = [];
    if (parsed.area_min) parts.push(`${parsed.area_min}m²`);
    if (parsed.area_max) parts.push(`${parsed.area_max}m²`);
    tags.push({ key: "area", label: parts.join(" — "), category: "area" });
  }
  if (parsed.em_obras) tags.push({ key: "obras", label: "Lançamento / Em obras", category: "status" });
  if (parsed.perfil) {
    const perfis: Record<string, string> = {
      investidor: "🎯 Investidor", moradia: "🏠 Moradia", familia: "👨‍👩‍👧‍👦 Família",
      alto_padrao: "✨ Alto Padrão", primeira_compra: "🔑 Primeira Compra",
      renda_passiva: "💰 Renda Passiva", compacto: "📦 Compacto",
    };
    tags.push({ key: "perfil", label: perfis[parsed.perfil] || parsed.perfil, category: "perfil" });
  }

  return tags;
}
