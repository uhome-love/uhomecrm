/**
 * homi-chat — assistente conversacional do HOMI com RAG unificado.
 *
 * Cérebro único: _shared/homi-brain.ts (identidade + embeddings via Lovable AI Gateway
 * + busca semântica em documentos/método, materiais, academia, scripts,
 * empreendimentos e imóveis).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { loadEnterpriseKnowledge, formatForList, formatForAssistant, createServiceClient } from "../_shared/enterprise-knowledge.ts";
import { searchMateriaisForHomi, formatMateriaisBlock } from "../_shared/materiais-context.ts";
import { HOMI_TOOLS, executeHomiTool } from "./homi-tools.ts";
import { searchKnowledge, formatKnowledgeBlock, HOMI_IDENTITY, HOMI_CHAT_MODEL } from "../_shared/homi-brain.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: validate JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _claimsErr } = await _sbAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_claimsErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const { messages, empreendimento, stream: wantStream = true, system: customSystem, enableTools = false, perfil = "corretor" } = await req.json();
    const shouldStream = wantStream !== false;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Load enterprise knowledge from DB (cached 5min) ──
    const supabase = createServiceClient();
    const knowledge = await loadEnterpriseKnowledge(supabase);
    const allEmpreendimentos = formatForList(knowledge);

    // ── Produto em foco (explícito, nunca inferido) ──
    // Correspondência exata e case-insensitive contra nome OU código já carregados.
    // Valor inválido = ausência de foco (sem erro, sem chute, sem log do valor).
    const focoAlvo = typeof empreendimento === "string" ? empreendimento.trim().toLowerCase() : "";
    const registroFoco = focoAlvo
      ? knowledge.find((r) =>
          (r.nome || "").trim().toLowerCase() === focoAlvo ||
          (r.codigo || "").trim().toLowerCase() === focoAlvo
        )
      : undefined;
    const empreendimentoValidado = registroFoco ? (registroFoco.nome || registroFoco.codigo) : null;
    console.log("[homi-chat] produto em foco:", empreendimentoValidado ? "válido" : "ausente/inválido");

    // Detalhe completo somente do produto em foco. Sem foco = sem dossiê.
    const detailedKnowledge = empreendimentoValidado
      ? formatForAssistant(knowledge, empreendimentoValidado)
      : "";
    const detalhesBlock = detailedKnowledge
      ? `\n\nCONHECIMENTO DETALHADO DO EMPREENDIMENTO EM FOCO (${empreendimentoValidado}):\n${detailedKnowledge}`
      : `\n\nNENHUM EMPREENDIMENTO EM FOCO: use apenas o resumo acima e a base de conhecimento. Não detalhe produto sem fonte; peça ao corretor qual empreendimento é o assunto quando a pergunta exigir detalhe.`;


    // ── RAG unificado (método, materiais, academia, scripts, empreendimentos, imóveis) ──
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content;

    /**
     * A pergunta atual é sempre a fonte principal da busca.
     * A mensagem anterior do usuário só entra quando a atual é claramente
     * uma continuação. Assunto novo ou pergunta autossuficiente = só a atual.
     */
    const userMsgs = (messages as any[]).filter((m) => m.role === "user");
    const prevUserMsg = userMsgs[userMsgs.length - 2]?.content;

    const CTX_MAX = 200;   // caracteres do contexto anterior
    const ASK_MAX = 400;   // caracteres da pergunta atual
    const CONT_MAX_CHARS = 60;
    const ELIPSE_MAX_PALAVRAS = 3;

    // Conector FORTE: a frase só existe colada no turno anterior.
    const CONT_FORTE = /^\s*(e|ou|mas|então|entao)\s|^\s*e\s*se\b|^\s*(e|ou)\s*(o|a)\s+(quê|que)\b/i;
    // Conector AMBÍGUO / elipse: só puxa contexto se a pergunta for muito curta.
    const CONT_AMBIGUO = /^\s*(por|pra|para|no|na|nos|nas|com|sem|de|do|da|nesse|nessa|neste|nesta|isso|esse|essa|ele|ela|lá|la|ali|mesmo|também|tambem|igual|quanto|qual)\b/i;
    // Marcadores explícitos de troca de assunto.
    const TEMA_NOVO = /^\s*(agora|muda|mudando|outro assunto|deixa|esquece|nova pergunta|preciso|quero|faça|faz|me faz|explique|explica|me explica|liste|lista|gere|gera|analise|analisa)\b/i;

    function montarQueryBusca(atual?: string, anterior?: string): string {
      const ask = (atual ?? "").trim().slice(0, ASK_MAX);
      if (!ask) return "";
      const ctxBruto = (anterior ?? "").trim();
      if (!ctxBruto) return ask;
      if (ask.length > CONT_MAX_CHARS) return ask;
      if (TEMA_NOVO.test(ask)) return ask;

      const palavras = ask.split(/\s+/).filter(Boolean).length;
      const ehContinuacao =
        CONT_FORTE.test(ask) ||
        (CONT_AMBIGUO.test(ask) && palavras <= ELIPSE_MAX_PALAVRAS);
      if (!ehContinuacao) return ask;

      return `Pergunta atual: ${ask}\nContexto anterior: ${ctxBruto.slice(0, CTX_MAX)}`;
    }

    const ragQuery = montarQueryBusca(lastUserMsg, prevUserMsg);
    let ragContext = "";
    if (ragQuery) {
      const chunks = await searchKnowledge(supabase, ragQuery, {
        limit: 10,
        threshold: 0.3,
        empreendimento: null,
      });
      ragContext = formatKnowledgeBlock(chunks);
    }


    const systemPrompt = HOMI_IDENTITY + `

Sua função é ajudar os corretores da Uhome a converter leads em visitas e vendas.



Você não é apenas um assistente. Você é:
• treinador de vendas
• especialista em conversão de leads
• especialista em vendas imobiliárias
• especialista em negociação
• estrategista comercial

Seu trabalho é ajudar o corretor a avançar o lead no funil de vendas.

FUNIL DE VENDAS DA UHOME:
1. Lead novo
2. Primeiro contato
3. Qualificação
4. Interesse
5. Visita
6. Proposta
7. Fechamento

Sempre pense em como mover o cliente para a próxima etapa.

OBJETIVO PRINCIPAL: Gerar VISITAS. Porque visitas aumentam drasticamente a conversão. Você sempre deve conduzir o corretor para gerar visita.

FORMAS DE AJUDA AO CORRETOR:
• mensagens de WhatsApp
• scripts de ligação
• quebra de objeções
• estratégias de follow up
• perguntas inteligentes
• condução para visita
• condução para proposta

Quando o corretor pedir ajuda, você deve:
1. Entender a situação
2. Identificar o estágio do lead
3. Gerar resposta estratégica

ESTILO DE RESPOSTA (REGRA FORTE):
Converse como ChatGPT/Claude: direto, natural, curto. Padrão de 2 a 5 linhas (~80 palavras no máximo).
Sem seções, sem títulos, sem listas longas. No máximo 3 bullets curtos quando ajudar a decidir.
Quando você já exibiu cartões na tela (imóveis, tarefas, visitas, leads): responda em NO MÁXIMO 1 frase e não repita os itens.
Só escreva respostas longas (plano, diagnóstico, relatório) se o corretor pedir explicitamente.
Nunca escreva textos robóticos. Sempre escreva como um corretor experiente falaria.


TIPOS DE RESPOSTA:
- Cliente não respondeu → gerar mensagem de reativação
- Cliente pediu informações → gerar mensagem que leve para conversa
- Cliente disse que vai pensar → gerar quebra de objeção suave
- Cliente quer preço → gerar resposta estratégica antes de dar preço
- Cliente quer ver depois → gerar urgência
- Cliente está interessado → conduzir para visita
- Cliente visitou → conduzir para proposta

PSICOLOGIA DE VENDAS:
Use gatilhos de venda como escassez, oportunidade, valorização, qualidade de vida, investimento, segurança e praticidade somente quando houver fato documentado que os sustente para o produto e a situação perguntados. Gatilho nunca cria fato. Use de forma consultiva e nunca agressiva.

TIPOS DE AJUDA QUE VOCÊ DEVE GERAR:
Se o corretor pedir ajuda, entregue: Mensagem pronta, ou Script de ligação, ou Pergunta estratégica, ou Estratégia de follow up. Sempre focando na conversão.

EMPREENDIMENTOS (RESUMO):
${allEmpreendimentos}

CONHECIMENTO DETALHADO DOS EMPREENDIMENTOS:
${detailedKnowledge}

Use somente os diferenciais documentados do empreendimento perguntado. Nunca transfira argumento ou diferencial de um produto para outro.

CONDUÇÃO PARA VISITA:
Sempre que possível leve o atendimento para:
"faz sentido conhecer pessoalmente?" ou "prefere visitar durante a semana ou no sábado?"

REGRAS IMPORTANTES:
- Nunca responda como robô
- Nunca escreva textos muito longos
- Nunca seja genérico
- Sempre seja: estratégico, comercial, prático
- No chat livre, responda de forma conversacional e direta
- Adapte a resposta ao que o corretor pedir
- Mensagens de WhatsApp: MÁXIMO 3 linhas, naturais, terminam com pergunta
- Scripts de ligação: naturais como conversa, com diálogo Corretor/Cliente

Seu objetivo é simples: ajudar o corretor da Uhome a vender mais imóveis.` + ragContext;

    // ── Foco por papel (mesmo cérebro, lente diferente) ──
    const isLideranca = perfil === "ceo" || perfil === "gestor" || perfil === "admin";
    const roleBlock = isLideranca
      ? `

PERFIL DE QUEM ESTÁ FALANDO COM VOCÊ: ${perfil === "gestor" ? "GESTOR/LÍDER DE EQUIPE" : "CEO/DIRETOR"}.
Você é o mesmo HOMI (mesmo conhecimento: Método Uhome, empreendimentos, imóveis, zonas de POA, Academia), mas com a lente da liderança:
- Fale de funil, VGV, produtividade do time, gargalos e decisão — não de "seu lead" nem de tarefas pessoais.
- Nunca chame quem fala de "corretor". Trate como líder.
- Mesmo assim, você TEM as mesmas ferramentas: quando pedirem imóveis ("me vê opções de 3 dorms na zona norte"), CHAME buscar_imovel normalmente e mostre os cartões — não responda só com texto.
- Respostas curtas e decidíveis: 1 frase de leitura + no máximo 3 bullets. Relatório completo só se pedirem "aprofundar".`
      : "";

    const finalSystemPrompt = (customSystem
      ? customSystem + "\n\nCONTEXTO DOS EMPREENDIMENTOS:\n" + allEmpreendimentos + "\n\nDETALHES:\n" + detailedKnowledge + ragContext
      : systemPrompt) + roleBlock;

    // Regra final de confiabilidade, válida para prompt padrão e customSystem.
    const VERACIDADE_COMERCIAL_BLOCK = `

VERACIDADE COMERCIAL — REGRA DURA:
- Só afirme valorização, rentabilidade, liquidez, demanda, escassez, desempenho ou ganho de capital quando o contexto disponível atribuir explicitamente esse fato ao empreendimento perguntado.
- Nunca transfira argumento, dado, diferencial ou desempenho de um empreendimento para outro. Nunca crie comparação sem fonte comparativa explícita.
- Projeção é cenário, nunca certeza, promessa ou garantia. Não invente percentual, resultado ou conclusão.
- Se a fonte for insuficiente, diga objetivamente que não é possível confirmar e indique consultar o material oficial atualizado ou o gestor.
- Verdade, fonte, regra legal e camadas N1/N2 sempre prevalecem sobre conversão e gatilhos de venda.`;

    // ── HOMI ↔ Materiais: injeta materiais relevantes do Hub ──
    let materiaisSuggestions: any[] = [];
    try {
      if (lastUserMsg) {
        const searchQuery = [empreendimento, lastUserMsg].filter(Boolean).join(" | ");
        materiaisSuggestions = await searchMateriaisForHomi(searchQuery, {
          limit: 4,
          empreendimentoNome: empreendimento,
        });
      }
    } catch (e) {
      console.error("[homi-chat] materiais context skipped:", e);
    }
    const materiaisBlock = formatMateriaisBlock(materiaisSuggestions);
    const finalSystemPromptWithMateriais = finalSystemPrompt + materiaisBlock + VERACIDADE_COMERCIAL_BLOCK;

    // ── Copilot mode: function-calling (non-streaming JSON) ──
    if (enableTools) {
      const uid = (_claims.claims as any).sub as string;
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      // ── Memória de longo prazo do usuário (RLS: só a dele) ──
      let memoriaBlock = "";
      try {
        const { data: mem } = await userClient
          .from("homi_memoria_usuario")
          .select("categoria, chave, valor")
          .order("updated_at", { ascending: false })
          .limit(40);
        if (mem && mem.length) {
          memoriaBlock = `

O QUE VOCÊ JÁ SABE SOBRE ESSA PESSOA (memória de longo prazo — use naturalmente, nunca pergunte de novo):
${mem.map((m: any) => `• [${m.categoria}] ${m.chave}: ${m.valor}`).join("\n")}`;
        }
      } catch (e) {
        console.error("[homi-chat] memória indisponível:", e);
      }

      const copilotSystem = finalSystemPromptWithMateriais + memoriaBlock + `


VOCÊ É UM COPILOTO COM FERRAMENTAS. Você PODE executar ações no CRM chamando ferramentas:
- meu_dia: montar o resumo do dia (AGORA / VISITAS / ESFRIANDO) num único cartão
- ver_pendencias: mostrar tarefas atrasadas/hoje e visitas de hoje
- buscar_imovel: encontrar imóveis no catálogo
- fila_execucao: montar a fila para resolver tarefas atrasadas (ou leads sem tarefa) 1 a 1 ou de 3 em 3
- visitas_a_confirmar: visitas futuras ainda não confirmadas com o cliente
- visitas_pendentes_resultado: visitas passadas sem resultado registrado
- briefing_do_dia: briefing objetivo com prioridades e números do dia
- criar_tarefa: preparar uma tarefa (o corretor confirma na tela)
- criar_visita: preparar uma visita (o corretor confirma na tela)
- resumo_lead: mostrar resumo do lead + próxima ação sugerida
- contexto_lead: LER o histórico completo do lead (etapa, timeline, anotações) para escrever mensagens sem perguntar
- registrar_resultado: registrar o resultado de um contato (o corretor confirma) e sugerir a próxima tarefa
- leads_esfriando: listar leads parados/sem contato há dias
- preparar_visita: montar briefing pré-visita
- anotar_lead: registrar uma anotação na timeline do lead (o corretor confirma)
- lembrar: guardar na memória de longo prazo um fato estável sobre a pessoa (meta, estilo, região, produtos). Use quando ela disser algo que valha lembrar depois — e NUNCA pergunte de novo o que já está na memória.


REGRAS DO COPILOTO:
- Data de hoje (Brasília): ${todayStr}. Amanhã: ${tomorrowStr}. Converta "hoje/amanhã/segunda" para YYYY-MM-DD antes de chamar a ferramenta.
- Quando o pedido for uma AÇÃO, CHAME a ferramenta certa em vez de responder só com texto.
- MEMÓRIA: se a pessoa disser "lembre que...", "lembra disso", "anota pra você", "minha meta é...", "eu atuo em...", "eu prefiro...", você é OBRIGADO a CHAMAR a ferramenta \`lembrar\` nesse mesmo turno ANTES de responder. NUNCA diga "anotado"/"guardei" sem ter chamado \`lembrar\` — isso é mentira. Depois de chamar, confirme em 1 frase curta.
- MENSAGEM / FOLLOW-UP / SCRIPT PARA UM LEAD CITADO PELO NOME: CHAME contexto_lead PRIMEIRO. NUNCA pergunte "qual o momento no funil" — deduza do histórico. Depois responda com um mini-resumo de 1 linha do momento do lead E a mensagem pronta no MESMO turno. Só pergunte algo se o lead não tiver histórico nenhum.
- NÃO fique perguntando campo a campo. Para criar_tarefa/criar_visita, se você tem pelo menos o nome do lead, JÁ CHAME a ferramenta — o cartão na tela tem busca de lead e todos os campos para o corretor completar/ajustar. Só peça esclarecimento se o pedido for totalmente ambíguo.
- Se o corretor não citou lead nenhum ao pedir "criar tarefa", chame criar_tarefa mesmo assim (sem lead_nome) — o cartão abre com a busca de lead.
- Depois da ferramenta, responda em NO MÁXIMO 1-2 frases curtas. Nunca repita a lista/dados em texto — eles já aparecem em cartões na tela.
- IMÓVEL: CHAME buscar_imovel direto e EXTRAIA todos os atributos do texto. "de 1M até 1,5M" / "entre 800 e 900 mil" é FAIXA → preencha valor_min E valor_max (nunca só o teto). "a partir de X" → valor_min. "até X" → valor_max. "M" = milhões, "mil"/"k" = milhares. "3 dorms" → dormitorios=3 com dormitorios_exato=true; "3+" ou "no mínimo 3" → dormitorios_exato=false. "mobiliado" → mobiliado=true. Suítes/vagas/área/tipo nos campos próprios. Em "termo" deixe SÓ bairro/empreendimento/cidade. Depois, confirme em 1 frase o critério que você entendeu (ex: "3 dorms, Menino Deus, R$ 1,0M–1,5M, mobiliado") e avise se algum critério foi relaxado.
- ZONAS DE PORTO ALEGRE: se o corretor pedir "zona norte / zona sul / zona leste / zona central / centro" (ou "região norte" etc.), preencha o campo \`zona\` do buscar_imovel (Norte | Central | Leste | Sul | Metropolitana) e NÃO coloque isso em "termo". Cidades vizinhas (Canoas, Viamão, Gravataí, Alvorada, Cachoeirinha, Esteio, São Leopoldo) e litoral (Capão da Canoa, Xangri-lá) = Metropolitana. Referência de bairros:
  · NORTE: Passo da Areia, São João, Higienópolis, Boa Vista, Cristo Redentor, Jardim Itu, Jardim Lindóia, Sarandi, Rubem Berta, Vila Ipiranga, São Sebastião, Alto Petrópolis (é aqui o Casa Tua), Jardim Floresta, Costa e Silva, Santa Maria Goretti, Parque dos Maias, Passo das Pedras, Anchieta, Humaitá, Farrapos, Navegantes, São Geraldo.
  · CENTRAL: Centro Histórico, Independência, Bom Fim, Rio Branco, Moinhos de Vento, Auxiliadora, Mont Serrat, Petrópolis, Bela Vista, Santana, Santa Cecília, Farroupilha, Cidade Baixa, Menino Deus, Praia de Belas, Azenha, Floresta, Santa Tereza.
  · LESTE: Partenon, Jardim Botânico, Santo Antônio, Vila Jardim, Bom Jesus, Chácara das Pedras, Três Figueiras, Jardim Carvalho, Jardim do Salso, Jardim Sabará, Agronomia, Lomba do Pinheiro, Mário Quintana, Protásio Alves, Morro Santana, Intercap.
  · SUL: Cristal, Camaquã, Cavalhada, Tristeza, Vila Assunção, Vila Nova, Nonoai, Teresópolis, Medianeira, Glória, Ipanema, Pedra Redonda, Vila Conceição, Espírito Santo, Guarujá, Serraria, Hípica, Aberta dos Morros, Belém Novo, Belém Velho, Lami, Restinga, Campo Novo, Terraville, Alphaville.
  NUNCA invente o bairro ou a zona de um empreendimento: se não souber, diga que não sabe.
- Quando o corretor relatar o que aconteceu num contato ("liguei e não atendeu", "quer visitar sábado"), CHAME registrar_resultado.
- NÃO abra a conversa com briefing automático. Só traga pendências/resumo do dia quando o corretor pedir.
- "MEU DIA" / "por onde começo" / "o que faço agora" / "me organiza" / "resumo do dia": CHAME meu_dia e responda em NO MÁXIMO 1 frase dizendo por onde começar. Nunca repita a lista em texto — ela já aparece em cartões.
- "BRIEFING" / "o que devo fazer hoje" / "me dá o objetivo do dia": CHAME briefing_do_dia e responda com as prioridades em tópicos curtos + risco do dia + oferta de iniciar a fila.
- "ME AJUDA A CONCLUIR AS ATRASADAS" / "leads sem tarefa" / "vamos de 3 em 3" / "me ajuda a resolver": CHAME fila_execucao (fila=tarefas_atrasadas ou leads_sem_tarefa, lote=1 ou 3 conforme o corretor pedir; padrão lote=1). Para cada card mostrado, entregue a sugestão de ação e a mensagem pronta.
- "QUAIS VISITAS TENHO QUE CONFIRMAR": CHAME visitas_a_confirmar. "QUAIS VISITAS TENHO PENDENTES" / "falta registrar visita": CHAME visitas_pendentes_resultado. Confirmar visita NÃO é o mesmo que realizar — nunca trate uma visita futura como realizada.
- POSTURA PROATIVA: sempre termine oferecendo o próximo passo concreto ("quer que eu abra a fila das 6 atrasadas?", "quero preparar as mensagens das 2 visitas de amanhã?"). Ofereça, não execute sem pedido.
- Para pedidos de mensagem/script de WhatsApp, ligação ou objeção SEM lead nomeado, responda com o texto pronto (sem ferramenta).
- "LEADS PARADOS" / "diagnostica meu funil" / "o que travou" / "por onde destravar": CHAME leads_parados_diagnostico e, para cada lead, escreva UMA linha "Nome — por que parou → próximo passo". No fim ofereça o follow-up em lote.
- "FOLLOW-UP PARA ESSES LEADS" / "gera mensagem para todos" / "follow-up em lote": ESCREVA você mesmo uma mensagem por lead (máx. 3 linhas, com nome e produto, terminando em pergunta) e CHAME followup_em_lote com o array \`mensagens\`. Nunca repita as mensagens em texto depois — elas já aparecem em cartões editáveis.
- NÚMEROS (VGV, vendas, visitas, leads, conversão, "como estou", comparar meses): CHAME relatorio_metricas (periodo: hoje | semana | mes_atual | mes_anterior | ano; use comparar=true quando pedirem comparação). NUNCA invente número nem estime: se a ferramenta falhar, diga que não conseguiu ler os números.
- LIDERANÇA (gestor, diretor, CEO, admin): "como está o time", "ranking", "quem está mal", "produtividade da equipe" → CHAME desempenho_time. "vamos bater a meta?", "quanto falta", "projeção do mês", "risco" → CHAME risco_meta. Um corretor citado pelo nome ("como está o João?", "raio-x da Maria", "preparar o 1:1") → CHAME diagnostico_corretor. Responda em no máximo 3 linhas com leitura + decisão; nunca repita a tabela, ela já está no cartão.`;


      // Multimodal: anexos (imagem/PDF) do último turno viram partes de conteúdo.
      const toModelMsg = (m: any) => {
        const anexos = Array.isArray(m?.anexos) ? m.anexos.filter((a: any) => a?.dataUrl) : [];
        if (!anexos.length) return { role: m.role, content: m.content ?? "" };
        const parts: any[] = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        for (const a of anexos) {
          if (String(a.tipo || "").startsWith("image/")) {
            parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
          } else {
            parts.push({ type: "file", file: { filename: a.nome || "arquivo.pdf", file_data: a.dataUrl } });
          }
        }
        return { role: m.role, content: parts };
      };

      const toolMessages: any[] = [
        { role: "system", content: copilotSystem },
        ...messages.map(toModelMsg),
      ];

      const collectedActions: any[] = [];
      const collectedResults: any[] = [];
      let finalContent = "";

      for (let iter = 0; iter < 4; iter++) {
        const tr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: HOMI_CHAT_MODEL,
            messages: toolMessages,
            tools: HOMI_TOOLS,
            tool_choice: "auto",
          }),
        });
        if (!tr.ok) {
          const t = await tr.text();
          console.error("AI gateway (tools) error:", tr.status, t);
          if (tr.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (tr.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          throw new Error("AI gateway error");
        }
        const data = await tr.json();
        const msg = data.choices?.[0]?.message;
        if (!msg) break;
        const toolCalls = msg.tool_calls || [];
        if (toolCalls.length === 0) {
          finalContent = msg.content || "";
          break;
        }
        toolMessages.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });
        for (const call of toolCalls) {
          let parsedArgs: Record<string, any> = {};
          try { parsedArgs = JSON.parse(call.function?.arguments || "{}"); } catch { /* ignore */ }
          const outcome = await executeHomiTool(call.function?.name, parsedArgs, userClient, uid);
          if (outcome.action) collectedActions.push(outcome.action);
          if (outcome.result) collectedResults.push(outcome.result);
          toolMessages.push({ role: "tool", tool_call_id: call.id, content: outcome.modelResult });
        }
      }

      return new Response(
        JSON.stringify({ content: finalContent, actions: collectedActions, results: collectedResults, materiais: materiaisSuggestions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HOMI_CHAT_MODEL,
        messages: [
          { role: "system", content: finalSystemPromptWithMateriais },
          ...messages,
        ],
        stream: shouldStream,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    if (shouldStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming: parse and return JSON
    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content, materiais: materiaisSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
