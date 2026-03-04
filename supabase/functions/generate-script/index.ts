import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tipo, empreendimento, tipo_empreendimento, diferenciais, situacao_lead, objetivo, tom } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (tipo === "ligacao") {
      systemPrompt = `Você é um especialista em vendas imobiliárias da UHome. Gere scripts de ligação de alta conversão para corretores de imóveis.

O script deve ser NATURAL, CONSULTIVO, NÃO ROBÓTICO, CURTO e FÁCIL DE SEGUIR.

ESTRUTURA OBRIGATÓRIA DO SCRIPT:

## 📞 ABERTURA
(Saudação natural, apresentação breve)

## 🤝 QUEBRA DE GELO
(Retomada do contato, conexão com o lead)

## 🔍 EXPLORAÇÃO
(Perguntas para entender necessidade do cliente)

## 🏠 APRESENTAÇÃO DO PRODUTO
(Diferenciais do empreendimento de forma consultiva)

## ✅ QUALIFICAÇÃO
(Perguntas para avaliar perfil e momento de compra)

## 📍 CONVITE PARA VISITA
(Sugestão natural para conhecer o empreendimento)

## 🎯 FECHAMENTO
(Encerramento com próximo passo definido)

REGRAS:
- Use linguagem natural e conversacional
- Não seja agressivo nem robótico
- Adapte o tom à situação do lead
- Inclua frases alternativas quando possível
- O script deve ser prático e fácil de seguir por um corretor`;

      userPrompt = `Gere um script de ligação para:
- Empreendimento: ${empreendimento}
- Tipo: ${tipo_empreendimento || "não especificado"}
- Diferenciais: ${diferenciais || "não especificado"}
- Situação do lead: ${situacao_lead}
- Objetivo da ligação: ${objetivo}`;
    } else {
      systemPrompt = `Você é um especialista em vendas imobiliárias da UHome. Gere mensagens de follow-up para WhatsApp com alta taxa de resposta.

REGRAS:
- Gere exatamente 3 VARIAÇÕES de mensagem
- Cada mensagem deve ser CURTA (máx 3-4 linhas)
- Tom NATURAL, não parecer spam
- Sempre convidar o cliente a responder
- Adaptar ao tom solicitado
- Mensagens consultivas, sem pressão
- Usar emojis com moderação (1-2 por mensagem)

FORMATO OBRIGATÓRIO:

## 💬 Mensagem 1
(mensagem aqui)

## 💬 Mensagem 2
(mensagem aqui)

## 💬 Mensagem 3
(mensagem aqui)

## 💡 Dica de Uso
(breve orientação de quando e como usar cada variação)`;

      userPrompt = `Gere 3 mensagens de follow-up para WhatsApp:
- Empreendimento: ${empreendimento}
- Situação do lead: ${situacao_lead}
- Tom da mensagem: ${tom || "consultivo"}
- Objetivo: ${objetivo}`;
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
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
