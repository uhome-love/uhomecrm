// oferta-ativa-cutucar — Envia uma "cutucada" motivacional para um corretor no Mutirão.
// Somente CEO/Diretor/Gestor podem chamar.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MENSAGENS_MOTIVACIONAIS = [
  "🔥 Bora! Uma ligação a mais pode virar uma visita — o CEO tá de olho torcendo por você!",
  "🚀 Levanta a cabeça e mete bronca! Sua próxima ligação pode ser o SIM do dia.",
  "💪 O topo do ranking tá logo ali. Mais 3 ligações e você entra no pódio!",
  "⚡ Ritmo! Ritmo! Ritmo! Cada minuto parado é uma visita que não acontece.",
  "🎯 Foco total nos próximos 15 minutos — a diferença entre bom e campeão é constância.",
  "🏆 Grandes vendedores ligam quando querem parar. Mostra do que você é capaz!",
  "🌟 Você já matou leões maiores que esse — vai pra cima!",
  "🔔 Cutucada do CEO: acelera aí, campeão! A meta do dia tá te esperando.",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await sbAuth.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requesterAuthId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verifica papel do solicitante
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", requesterAuthId);
    const allowedRoles = new Set(["admin", "diretor", "gestor"]);
    const canPoke = (roles ?? []).some((r: any) => allowedRoles.has(r.role));
    if (!canPoke) {
      return new Response(JSON.stringify({ error: "Sem permissão para cutucar." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const corretorProfileId = body.corretor_profile_id as string | undefined;
    const sessaoId = body.sessao_id as string | undefined;
    const mensagemCustom = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
    if (!corretorProfileId) {
      return new Response(JSON.stringify({ error: "corretor_profile_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve auth user_id do corretor + nomes
    const { data: alvo } = await admin.from("profiles").select("id, user_id, nome").eq("id", corretorProfileId).maybeSingle();
    if (!alvo?.user_id) {
      return new Response(JSON.stringify({ error: "Corretor não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: quem } = await admin.from("profiles").select("nome").eq("user_id", requesterAuthId).maybeSingle();
    const quemNome = quem?.nome || "CEO";

    // Rate limit: 1 cutucada por corretor a cada 30 segundos
    const desde = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: recente } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", alvo.user_id)
      .eq("categoria", "mutirao_cutucada")
      .gte("created_at", desde)
      .limit(1);
    if (recente && recente.length > 0) {
      return new Response(JSON.stringify({ error: "Aguarde alguns segundos antes de cutucar novamente esse corretor." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mensagem = mensagemCustom || MENSAGENS_MOTIVACIONAIS[Math.floor(Math.random() * MENSAGENS_MOTIVACIONAIS.length)];
    const titulo = `👋 Cutucada do ${quemNome}`;

    // Cria notificação (dispara popup + som via useNotifications)
    const { error: notErr } = await admin.rpc("criar_notificacao", {
      p_user_id: alvo.user_id,
      p_tipo: "mutirao",
      p_categoria: "mutirao_cutucada",
      p_titulo: titulo,
      p_mensagem: mensagem,
      p_dados: { sessao_id: sessaoId ?? null, from_auth_id: requesterAuthId, from_nome: quemNome, url: "/oferta-ativa-ao-vivo" },
      p_agrupamento_key: null,
    });
    if (notErr) {
      console.error("cutucar notify err", notErr);
      return new Response(JSON.stringify({ error: notErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, mensagem, alvo: alvo.nome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cutucar error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
