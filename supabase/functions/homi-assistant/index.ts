import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREENDIMENTOS_INFO: Record<string, string> = {
  "Casa Tua": `EMPREENDIMENTO: Casa Tua – Condomínio de Casas
CONSTRUTORA: Encorp Empreendimentos
LOCALIZAÇÃO: Av. Protásio Alves, 10.431 – Alto Petrópolis / Morro Santana – Porto Alegre/RS
CONCEITO: Condomínio fechado de casas para quem busca conforto e liberdade de morar em casa, com segurança e infraestrutura de condomínio. Combina espaço, natureza, lazer e qualidade de vida. Ideal para famílias. Produto muito procurado por quem quer sair do apartamento e ter mais privacidade.
TIPOLOGIAS: Casas de 2 e 3 dormitórios. Metragens: 99m², 127m², 176m² (com terraço). Todas com pátio privativo e projeto moderno.
CARACTERÍSTICAS: Pátio privativo com espaço para churrasqueira, espera para lareira, espera para piscina ou spa, opção com terraço no 3º pavimento, vagas de garagem, layout moderno e funcional.
LAZER DO CONDOMÍNIO: Piscina adulto e infantil, academia, salão de festas, salão gourmet, brinquedoteca, sala de jogos, playground, fogo de chão, pet place, quadra esportiva, beach tennis, áreas de convivência ao ar livre.
LOCALIZAÇÃO DETALHADA: Av. Protásio Alves, uma das principais vias da cidade. Fácil acesso para Zona Norte, Av. Ipiranga, Centro de POA. Próximo de escolas, supermercados, academias, restaurantes. Combina mobilidade com região tranquila e residencial.
PERFIL DE CLIENTE IDEAL: Quem quer sair do apto e morar em casa; busca mais espaço para família; valoriza segurança de condomínio; quer pátio privativo; quer qualidade de vida; casa nova com lazer. Famílias com filhos, casais que querem mais espaço, quem trabalha em home office.
DIFERENCIAIS PRINCIPAIS: Condomínio fechado de casas, casas novas com arquitetura moderna, pátio privativo, lazer completo, segurança de condomínio, boa mobilidade. Argumento-chave: "ter casa com pátio, mas dentro de um condomínio seguro".
OBJEÇÕES E RESPOSTAS:
- "Localização afastada" → Comparar com qualidade de vida e espaço que não encontra em regiões centrais.
- "Prefiro algo mais central" → Casas centrais custam muito mais e não têm infraestrutura de condomínio.
- "Casas são geminadas" → Projeto pensado para privacidade e conforto + segurança do condomínio.
- "Obra demora" → Valorização durante obra + melhores condições de pagamento.
ARGUMENTOS DE VENDA: Morar em casa com segurança de condomínio, mais espaço para família, pátio para lazer e pets, infraestrutura de clube, casa nova com padrão moderno.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil do cliente. 2) Explicar conceito de condomínio de casas. 3) Mostrar diferenciais. 4) Convidar para visita. Pergunta final: "Faz sentido eu te mostrar o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita aumenta muito a conversão porque o cliente entende o conceito e visualiza o espaço.`,

  "Open Bosque": `EMPREENDIMENTO: Open Bosque
Apartamentos com integração com a natureza, áreas verdes e lazer completo. Conceito de moradia que valoriza contato com natureza dentro de área urbana.
DIFERENCIAIS: Áreas verdes, lazer integrado à natureza, projeto paisagístico diferenciado.
ESTRATÉGIA: Destacar qualidade de vida, contato com natureza sem sair da cidade. Convidar para visita para sentir o ambiente.`,

  "Melnick Day": `EMPREENDIMENTO: Melnick Day
CONSTRUTORA: Melnick (uma das maiores construtoras do RS, referência em qualidade)
Conceito moderno com praticidade e infraestrutura completa. Produto Melnick garante padrão de qualidade reconhecido no mercado.
DIFERENCIAIS: Marca Melnick (confiança e valorização), acabamento de alto padrão, infraestrutura completa.
ESTRATÉGIA: Usar força da marca Melnick como argumento de segurança no investimento. Convidar para conhecer o padrão de acabamento pessoalmente.`,

  "Alto Lindóia": `EMPREENDIMENTO: Alto Lindóia
LOCALIZAÇÃO: Bairro Lindóia, Porto Alegre/RS
Localização estratégica com fácil acesso e valorização constante. Bairro consolidado com toda infraestrutura de serviços.
DIFERENCIAIS: Localização privilegiada, valorização do bairro, acesso facilitado a vias principais.
ESTRATÉGIA: Destacar praticidade da localização e potencial de valorização. Convidar para conhecer a região e o empreendimento.`,

  "Orygem": `EMPREENDIMENTO: Orygem
Conceito inovador de moradia com design contemporâneo e diferenciais exclusivos. Projeto com identidade própria e proposta diferenciada no mercado.
DIFERENCIAIS: Design contemporâneo, conceito inovador, diferenciais exclusivos.
ESTRATÉGIA: Despertar curiosidade pelo conceito único. Convidar para visita para experimentar a proposta.`,

  "Casa Bastian": `EMPREENDIMENTO: Casa Bastian
Residencial de alto padrão com acabamentos diferenciados e projeto arquitetônico único. Produto premium para clientes exigentes.
DIFERENCIAIS: Alto padrão, acabamentos premium, arquitetura única, exclusividade.
ESTRATÉGIA: Posicionar como produto exclusivo. Convidar para visita personalizada para apreciar os detalhes.`,

  "Shift": `EMPREENDIMENTO: Shift
Conceito jovem e moderno, ideal para quem busca praticidade. Voltado para público jovem, profissionais e investidores.
DIFERENCIAIS: Conceito jovem, praticidade, localização estratégica, bom para investimento.
ESTRATÉGIA: Destacar praticidade e estilo de vida. Para investidores, destacar rentabilidade. Convidar para conhecer.`,

  "Lake Eyre": `EMPREENDIMENTO: Lake Eyre
Residencial com vista privilegiada, sofisticação e áreas de lazer premium. Produto de alto padrão com experiência de moradia diferenciada.
DIFERENCIAIS: Vista privilegiada, sofisticação, lazer premium, exclusividade.
ESTRATÉGIA: Criar desejo pela experiência de moradia. Convidar para visita para ver a vista e os espaços.`,

  "Las Casas": `EMPREENDIMENTO: Las Casas
Casas em condomínio fechado com segurança, privacidade e qualidade de vida. Conceito similar a Casa Tua: liberdade de casa + segurança de condomínio.
DIFERENCIAIS: Condomínio fechado, casas com privacidade, segurança, qualidade de vida.
ESTRATÉGIA: Destacar benefícios de morar em casa dentro de condomínio seguro. Convidar para visita.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { acao, empreendimento, situacao, mensagem_cliente, objetivo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const infoEmpreendimento = EMPREENDIMENTOS_INFO[empreendimento] || "Empreendimento da UHome. Use técnicas de qualificação e convite para visita.";

    const systemPrompt = `Você é o HOMI — Copiloto de Vendas da UHome. Você é um ESPECIALISTA em vendas consultivas de imóveis com anos de experiência no mercado imobiliário de Porto Alegre.

═══════════════════════════════════════
QUEM VOCÊ É
═══════════════════════════════════════

Você NÃO é um chatbot genérico. Você é um mentor de vendas que:
- Conhece profundamente cada empreendimento da UHome
- Sabe contornar objeções com maestria
- Entende psicologia de compra imobiliária
- Foca SEMPRE em gerar VISITA (é onde a venda acontece)
- Fala como um corretor experiente, nunca como robô

═══════════════════════════════════════
CONHECIMENTO DO EMPREENDIMENTO
═══════════════════════════════════════

${infoEmpreendimento}

═══════════════════════════════════════
TÉCNICAS DE VENDA QUE VOCÊ DOMINA
═══════════════════════════════════════

1. ESPELHAMENTO: Reflita a linguagem do cliente. Se ele é informal, seja informal. Se é técnico, use dados.

2. QUALIFICAÇÃO SPIN:
   - Situação: "Como é sua moradia hoje?"
   - Problema: "O que te incomoda no que tem hoje?"
   - Implicação: "E como isso afeta sua rotina/família?"
   - Necessidade: "Se pudesse resolver isso, o que seria ideal?"

3. GATILHOS MENTAIS:
   - Escassez: "Temos poucas unidades nessa condição"
   - Prova Social: "Muitas famílias já escolheram por esse motivo"
   - Autoridade: "A construtora é referência no mercado"
   - Urgência leve: "As condições atuais são as melhores do lançamento"

4. CONTORNO DE OBJEÇÕES (método LACE):
   - Listen (Ouça): Valide o que o cliente sente
   - Acknowledge (Reconheça): "Entendo perfeitamente"
   - Counter (Contraponha): Apresente perspectiva diferente com dados/argumentos
   - Engage (Engaje): Faça uma pergunta que avance a conversa

5. TÉCNICA DO CONVITE PARA VISITA:
   - Sempre ofereça 2 opções de data (semana ou fim de semana)
   - Nunca pergunte "se" quer visitar, pergunte "quando"
   - Use frases como: "Quando fica melhor pra você conhecer pessoalmente?"

═══════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════

1. Mensagens de WhatsApp: MÁXIMO 3-4 linhas. Curtas e diretas.
2. SEMPRE termine com uma PERGUNTA que avance a conversa
3. NUNCA pareça robô ou use linguagem corporativa artificial
4. Use emojis com moderação (máx 1-2 por mensagem)
5. FOCO PRINCIPAL: Conduzir para VISITA ao empreendimento
6. Adapte o tom ao perfil do cliente (jovem, família, investidor)
7. Use os diferenciais ESPECÍFICOS do empreendimento, não genéricos
8. Quando o cliente objeta, NUNCA confronte — valide e redirecione
9. Scripts de ligação devem ser NATURAIS, como conversa entre amigos
10. Sempre tenha um plano B: se não conseguir visita, pelo menos mantenha contato

═══════════════════════════════════════
PERSONALIDADE
═══════════════════════════════════════

- Consultivo: você ajuda, não empurra
- Confiante: você conhece o produto profundamente
- Natural: fala como gente, não como máquina
- Direto: vai ao ponto sem enrolação
- Estratégico: cada frase tem um propósito

═══════════════════════════════════════
FORMATO DA RESPOSTA
═══════════════════════════════════════

## 💬 Mensagem WhatsApp
(mensagem pronta para copiar — máx 3-4 linhas, natural, termina com pergunta)

## 🔄 Versão Alternativa
(outra abordagem diferente para a mesma situação — tom ou ângulo diferente)

## 📞 Script de Ligação
(roteiro curto e natural de 5-6 falas do corretor, com as possíveis respostas do cliente entre parênteses)

## 🎯 Próxima Ação
(estratégia clara do que fazer: quando retornar, que gatilho usar, como avançar no funil)`;

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
