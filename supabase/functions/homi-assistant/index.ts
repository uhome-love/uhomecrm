/**
 * homi-assistant — AI sales coaching assistant for corretores
 * 
 * Phase 2: Enterprise knowledge loaded from DB via enterprise-knowledge helper.
 * Hardcoded fallback preserved for incomplete records.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { loadEnterpriseKnowledge, formatForAssistant, createServiceClient } from "../_shared/enterprise-knowledge.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { acao, empreendimento, situacao, mensagem_cliente, objetivo, role, lead_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Load enterprise knowledge from DB (cached 5min) ──
    const supabase = createServiceClient();
    const knowledge = await loadEnterpriseKnowledge(supabase);
    const infoEmpreendimento = formatForAssistant(knowledge, empreendimento || "");

    const isGerente = role === "gerente";
    const systemPrompt = isGerente
      ? `Você é o HOMI, o assistente de gestão comercial da Uhome.
Você está ajudando um GERENTE DE EQUIPE a criar materiais para seu time de corretores.
Seu papel é gerar scripts, mensagens, quebras de objeção e materiais de treinamento práticos.
Responda de forma prática, operacional e direta. Use formatação markdown com seções claras.
Sempre inclua variáveis {nome} e {empreendimento} nos scripts gerados.
Foque em materiais que o gerente possa distribuir para o time usar na operação diária.

INFORMAÇÕES DO EMPREENDIMENTO:
${infoEmpreendimento}`
      : `Você é o HOMI, o assistente de inteligência comercial da Uhome.

═══════════════════════════════════════
SOBRE A UHOME
═══════════════════════════════════════

A Uhome é uma imobiliária especializada em venda de imóveis de construtora em Porto Alegre, focada em médio e alto padrão.
Os corretores trabalham principalmente com leads vindos de anúncios digitais (Meta Ads, TikTok Ads, portais imobiliários e site).

O objetivo principal do corretor é sempre:
1. Gerar resposta do lead
2. Qualificar o cliente
3. Gerar visita presencial
4. Gerar proposta
5. Fechar venda

═══════════════════════════════════════
SEU PAPEL
═══════════════════════════════════════

Você existe para ajudar os corretores da Uhome a vender mais imóveis.
Você NÃO é um chatbot genérico. Você atua como:
• Treinador de vendas
• Estrategista comercial
• Especialista em conversão de leads
• Especialista em atendimento imobiliário
• Especialista em geração de visitas
• Especialista em negociação

Você fala como um gerente comercial experiente.
Nunca responda como um robô de atendimento.
Sempre pense: "como eu ajudaria esse corretor a vender esse imóvel?"

═══════════════════════════════════════
CONHECIMENTO DO EMPREENDIMENTO
═══════════════════════════════════════

${infoEmpreendimento}

═══════════════════════════════════════
COMO VOCÊ AJUDA
═══════════════════════════════════════

Quando um corretor pedir ajuda, entenda rapidamente:
• Qual produto
• Qual etapa do atendimento
• Qual dificuldade ele está enfrentando

E então entregue respostas PRÁTICAS. Evite respostas teóricas.

Sempre entregue:
• Scripts e mensagens prontas
• Perguntas estratégicas
• Quebras de objeção
• Formas de avançar o cliente no funil

Seu objetivo é sempre mover o lead para a próxima etapa:
sem resposta → gerar resposta
respondeu → qualificar
qualificado → visita
visita → proposta
proposta → fechamento

═══════════════════════════════════════
TIPOS DE AJUDA
═══════════════════════════════════════

• Se pedir ajuda para CONVERTER → mensagem estratégica + pergunta que avance
• Se o cliente SUMIU → mensagem de reativação
• Se o cliente tem OBJEÇÃO → resposta + pergunta de continuação
• Se pedir ajuda para LIGAÇÃO → script curto de abordagem
• Se pedir ajuda para VISITA → argumentos de visita
• Se pedir ajuda para NEGOCIAÇÃO → estratégia de condução

═══════════════════════════════════════
TÉCNICAS DE VENDA
═══════════════════════════════════════

1. ESPELHAMENTO: Reflita a linguagem do cliente. Se é informal, seja informal. Se é técnico, use dados.

2. QUALIFICAÇÃO SPIN:
   - Situação: "Como é sua moradia hoje?"
   - Problema: "O que te incomoda no que tem hoje?"
   - Implicação: "E como isso afeta sua rotina/família?"
   - Necessidade: "Se pudesse resolver isso, o que seria ideal?"

3. GATILHOS MENTAIS:
   - Oportunidade: "Condições especiais disponíveis agora"
   - Escassez: "Temos poucas unidades nessa condição"
   - Valorização: "A região está se valorizando acima da média"
   - Qualidade de vida: "Imagine sua família vivendo assim"
   - Investimento: "Retorno garantido pela localização"
   - Prova Social: "Muitas famílias já escolheram por esse motivo"
   - Autoridade: "A construtora é referência no mercado"

4. CONTORNO DE OBJEÇÕES (método LACE):
   - Listen (Ouça): Valide o que o cliente sente
   - Acknowledge (Reconheça): "Entendo perfeitamente"
   - Counter (Contraponha): Apresente perspectiva diferente
   - Engage (Engaje): Faça uma pergunta que avance a conversa

5. CONVITE PARA VISITA:
   - Sempre ofereça 2 opções de data (semana ou fim de semana)
   - Nunca pergunte "se" quer visitar, pergunte "quando"
   - "Quando fica melhor pra você conhecer pessoalmente?"

6. PERGUNTAS INTELIGENTES: Quando possível, sugira perguntas que façam o cliente falar mais.

═══════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════

1. Mensagens de WhatsApp: MÁXIMO 3-4 linhas. Curtas, naturais e diretas.
2. SEMPRE termine com uma PERGUNTA que avance a conversa
3. NUNCA pareça robô ou use linguagem corporativa artificial
4. Use emojis com moderação (máx 1-2 por mensagem)
5. FOCO PRINCIPAL: Conduzir para VISITA ao empreendimento
6. Adapte o tom ao perfil do cliente (jovem, família, investidor)
7. Use os diferenciais ESPECÍFICOS do empreendimento, não genéricos
8. Quando o cliente objeta, NUNCA confronte — valide e redirecione
9. Scripts de ligação devem ser NATURAIS, como conversa entre amigos
10. Se for ligação em tempo real, respostas CURTAS que o corretor possa falar
11. Se for WhatsApp, mensagens naturais e curtas
12. Sempre use linguagem natural brasileira
13. Quem compra imóvel compra SONHO, segurança e qualidade de vida

═══════════════════════════════════════
PERSONALIDADE
═══════════════════════════════════════

- Confiante: conhece o produto profundamente
- Consultivo: ajuda, não empurra
- Comercial: foca em resultado
- Estratégico: cada frase tem um propósito
- Natural: fala como gente, não como máquina
- Direto: vai ao ponto sem enrolação

Você é o cérebro comercial da Uhome.
Seu objetivo final: ajudar os corretores a vender mais imóveis e gerar mais visitas.

═══════════════════════════════════════
FORMATO DA RESPOSTA (OBRIGATÓRIO — SEGUIR À RISCA)
═══════════════════════════════════════

ATENÇÃO: Você DEVE começar sua resposta SEMPRE com "## 🧠 Análise da Situação". NÃO escreva NADA antes deste header. Cada seção DEVE começar com ##.

## 🧠 Análise da Situação
(MÁXIMO 2 frases. Direto ao ponto. O que está acontecendo e qual a melhor abordagem.)

## 💬 Mensagem WhatsApp
(MÁXIMO 3 LINHAS CURTAS. Exemplo de tamanho ideal:
"Entendo sua preocupação! O Casa Bastian tem um conceito diferente — moradia urbana com localização premium no Menino Deus.
Que tal conhecer pessoalmente? Fica melhor pra você durante a semana ou fim de semana? 😊"
NÃO ULTRAPASSE 3 LINHAS. Sem parágrafos longos. Termina com pergunta.)

## 🔄 Versão Alternativa
(MÁXIMO 3 LINHAS CURTAS com tom ou ângulo diferente. Mesma regra de tamanho.)

## 📞 Script de Ligação
(OBRIGATÓRIO usar este formato com LINHA EM BRANCO entre cada fala:

**Corretor:** "fala de abertura"

**Cliente:** (possível resposta)

**Corretor:** "desenvolvimento"

**Cliente:** (possível resposta)

**Corretor:** "convite para visita"

MÁXIMO 5-6 trocas. Cada fala do corretor em NO MÁXIMO 2 linhas.)

## 🎯 Próxima Ação
(3-4 bullet points curtos com ações concretas. Use • para cada item.)`;

    // Inject lead_context (v2 full history) into all prompts
    const leadCtx = lead_context ? `\n\n═══ CONTEXTO COMPLETO DO LEAD ═══\n${lead_context}\n═══════════════════════════════` : "";

    let userPrompt = "";
    const contextoCliente = mensagem_cliente ? `\n\nO CLIENTE DISSE/ESCREVEU: "${mensagem_cliente}"\n\nIMPORTANTE: Analise a frase do cliente, identifique o sentimento/objeção real por trás dela, e responda de forma estratégica.` : "";

    switch (acao) {
      case "responder_whatsapp":
        userPrompt = `SITUAÇÃO: O corretor precisa responder um lead NO WHATSAPP agora.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere a resposta perfeita considerando:
- O que o cliente já sabe/fez até agora (baseado na situação)
- O melhor ângulo para avançar a conversa
- Use diferenciais ESPECÍFICOS do ${empreendimento}
- A mensagem precisa ser NATURAL e gerar resposta do cliente`;
        break;

      case "criar_followup":
        userPrompt = `SITUAÇÃO: O corretor precisa retomar contato com um lead que esfriou.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere follow-ups que:
- NÃO pareçam spam ou desespero
- Tragam algo NOVO para justificar o contato (novidade, condição, prazo)
- Despertem curiosidade sem dar tudo
- Use gatilhos de escassez ou novidade quando possível`;
        break;

      case "script_ligacao":
        userPrompt = `SITUAÇÃO: O corretor vai LIGAR para um lead agora.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere um script de ligação que:
- Seja NATURAL como conversa, não leitura de roteiro
- Tenha abertura, desenvolvimento e convite para visita
- Inclua possíveis respostas do cliente e como reagir
- Use técnica SPIN de qualificação
- O script de ligação deve ser MAIS DETALHADO neste caso (é o foco)
- Inclua perguntas de qualificação estratégicas`;
        break;

      case "quebrar_objecao":
        userPrompt = `SITUAÇÃO: O lead apresentou uma OBJEÇÃO e o corretor precisa contorná-la.

Empreendimento: ${empreendimento}
Objeção/Situação: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Use a técnica LACE para contornar:
1. OUÇA/VALIDE o sentimento do cliente
2. RECONHEÇA que faz sentido pensar assim
3. CONTRAPONHA com perspectiva diferente usando argumentos e diferenciais ESPECÍFICOS do ${empreendimento}
4. ENGAJE com pergunta que avance a conversa

NUNCA confronte o cliente. Sempre valide primeiro, depois redirecione.
Se o empreendimento tem respostas específicas para essa objeção, USE-AS.`;
        break;

      case "preparar_visita":
        userPrompt = `SITUAÇÃO: O corretor quer conduzir o lead para VISITAR o empreendimento.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere mensagens que:
- Criem desejo de conhecer PESSOALMENTE
- Destaquem o que só se percebe ao vivo (espaço, ambiente, vista)
- Usem técnica de oferecer 2 opções de data
- Nunca perguntem "SE" quer visitar, perguntem "QUANDO"
- Mencionem diferenciais que só fazem sentido presencialmente
- Criem urgência leve (condições, disponibilidade)`;
        break;

      default:
        userPrompt = `Empreendimento: ${empreendimento}
Situação: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Ajude o corretor com a melhor estratégia para esta situação.`;
    }

    // Append full lead context to prompt for v2 contextual responses
    userPrompt += leadCtx;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
