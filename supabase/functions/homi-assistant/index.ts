import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREENDIMENTOS_INFO: Record<string, string> = {
  "Casa Tua": "Empreendimento residencial premium com foco em conforto e localização privilegiada.",
  "Open Bosque": "Apartamentos com integração com a natureza, áreas verdes e lazer completo.",
  "Melnick Day": "Empreendimento Melnick com conceito moderno, praticidade e infraestrutura completa.",
  "Alto Lindóia": "Localização estratégica no bairro Lindóia, fácil acesso e valorização constante.",
  "Orygem": "Conceito inovador de moradia com design contemporâneo e diferenciais exclusivos.",
  "Casa Bastian": "Residencial de alto padrão com acabamentos diferenciados e projeto arquitetônico único.",
  "Shift": "Empreendimento com conceito jovem e moderno, ideal para quem busca praticidade.",
  "Lake Eyre": "Residencial com vista privilegiada, sofisticação e áreas de lazer premium.",
  "Las Casas": "Casas em condomínio fechado com segurança, privacidade e qualidade de vida.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { acao, empreendimento, situacao, mensagem_cliente, objetivo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const infoEmpreendimento = EMPREENDIMENTOS_INFO[empreendimento] || "Empreendimento da UHome.";

    const systemPrompt = `Você é o HOMI — Assistente Comercial da UHome. Copiloto de vendas para corretores de imóveis.

PERSONALIDADE:
- Tom consultivo, confiante, natural, direto
- Mensagens CURTAS e práticas
- Nunca pareça robô
- Sempre termine mensagens com uma PERGUNTA
- Foco principal: GERAR VISITA ao empreendimento

EMPREENDIMENTO: ${empreendimento}
INFO: ${infoEmpreendimento}

REGRAS DE OURO:
1. Mensagens de no máximo 3-4 linhas
2. Linguagem natural como um corretor experiente
3. Sempre incluir um gancho/pergunta no final
4. Usar emojis com moderação (máx 1-2)
5. Foco em avançar o lead no funil de vendas
6. Se faltar info do empreendimento, foque em qualificação e convite para visita

FORMATO OBRIGATÓRIO DA RESPOSTA:

## 💬 Mensagem WhatsApp
(mensagem pronta para copiar)

## 🔄 Versão Alternativa
(outra abordagem para a mesma situação)

## 📞 Script de Ligação
(roteiro curto e direto de 4-5 falas)

## 🎯 Próxima Ação
(sugestão estratégica do que fazer depois)`;

    let userPrompt = "";

    switch (acao) {
      case "responder_whatsapp":
        userPrompt = `O corretor precisa responder um lead no WhatsApp.
Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
${mensagem_cliente ? `Mensagem do cliente: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}

Gere a resposta ideal para o corretor enviar agora.`;
        break;

      case "criar_followup":
        userPrompt = `O corretor precisa fazer follow-up com um lead.
Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
${mensagem_cliente ? `Contexto adicional: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}

Gere mensagens de follow-up naturais e eficazes.`;
        break;

      case "script_ligacao":
        userPrompt = `O corretor vai ligar para um lead.
Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
${mensagem_cliente ? `Contexto: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}

Gere um script de ligação curto e eficaz. O script de ligação deve ser mais detalhado neste caso.`;
        break;

      case "quebrar_objecao":
        userPrompt = `O lead apresentou uma objeção e o corretor precisa contorná-la.
Empreendimento: ${empreendimento}
Situação/Objeção: ${situacao}
${mensagem_cliente ? `O que o cliente disse: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}

Gere respostas para quebrar essa objeção de forma consultiva, sem pressão. Foque em entender a real necessidade do cliente.`;
        break;

      case "preparar_visita":
        userPrompt = `O corretor está preparando o lead para uma visita ao empreendimento.
Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
${mensagem_cliente ? `Contexto: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}

Gere mensagens que conduzam o lead para agendar/confirmar a visita. Crie urgência leve e destaque benefícios de conhecer pessoalmente.`;
        break;

      default:
        userPrompt = `Ajude o corretor com a seguinte situação:
Empreendimento: ${empreendimento}
Situação: ${situacao}
${mensagem_cliente ? `Mensagem do cliente: "${mensagem_cliente}"` : ""}
Objetivo: ${objetivo}`;
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
