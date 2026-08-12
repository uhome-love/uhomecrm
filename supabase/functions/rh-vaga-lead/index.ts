/**
 * rh-vaga-lead — Público (página /vaga).
 * Captura ANTECIPADA do candidato: grava assim que temos nome + WhatsApp,
 * antes do agendamento. Assim nenhum WhatsApp é perdido.
 *
 * POST body:
 *  { acao: "criar", nome, telefone, email?, respostas? }
 *    → { ok: true, candidato_id }
 *  { acao: "atualizar", candidato_id, respostas?, temperatura? }
 *    → { ok: true }
 *
 * Segurança: só toca em candidatos com origem='anuncio' e etapa em
 * ('novo_lead','entrevista_marcada'). Nunca retorna dados sensíveis.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ETAPAS_EDITAVEIS = ["novo_lead", "entrevista_marcada"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body inválido" }, 400);

    const acao = String(body.acao || "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── (a) criar lead cedo ──
    if (acao === "criar") {
      const nome = String(body.nome || "").trim();
      const telefone = String(body.telefone || "").trim();
      const email = body.email ? String(body.email).trim() : null;
      const respostas = body.respostas && typeof body.respostas === "object" ? body.respostas : {};

      if (nome.length < 2 || nome.length > 120) return json({ error: "Nome inválido" }, 400);
      const digitos = telefone.replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 13) return json({ error: "WhatsApp inválido" }, 400);

      // Dedup leve: mesmo telefone + origem anúncio nas últimas 6h
      const desde = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: existente } = await supabase
        .from("rh_candidatos")
        .select("id")
        .eq("origem", "anuncio")
        .eq("telefone", telefone)
        .in("etapa", ETAPAS_EDITAVEIS)
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existente?.id) {
        await supabase
          .from("rh_candidatos")
          .update({ nome, respostas })
          .eq("id", existente.id)
          .eq("origem", "anuncio")
          .in("etapa", ETAPAS_EDITAVEIS);
        return json({ ok: true, candidato_id: existente.id, reutilizado: true });
      }

      const { data: criado, error: err } = await supabase
        .from("rh_candidatos")
        .insert({
          nome,
          telefone,
          email,
          origem: "anuncio",
          etapa: "novo_lead",
          respostas,
        })
        .select("id")
        .single();

      if (err || !criado) {
        console.error("[rh-vaga-lead] criar", err);
        return json({ error: "Não foi possível registrar." }, 500);
      }
      return json({ ok: true, candidato_id: criado.id });
    }

    // ── (b) atualizar respostas/temperatura ──
    if (acao === "atualizar") {
      const candidatoId = String(body.candidato_id || "").trim();
      if (!candidatoId) return json({ error: "candidato_id obrigatório" }, 400);

      const patch: Record<string, unknown> = {};
      if (body.respostas && typeof body.respostas === "object") patch.respostas = body.respostas;
      if (["quente", "morno", "frio"].includes(String(body.temperatura))) {
        patch.temperatura = String(body.temperatura);
      }
      if (!Object.keys(patch).length) return json({ ok: true });

      const { error: err } = await supabase
        .from("rh_candidatos")
        .update(patch)
        .eq("id", candidatoId)
        .eq("origem", "anuncio")
        .in("etapa", ETAPAS_EDITAVEIS);

      if (err) {
        console.error("[rh-vaga-lead] atualizar", err);
        return json({ error: "Não foi possível atualizar." }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[rh-vaga-lead]", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
