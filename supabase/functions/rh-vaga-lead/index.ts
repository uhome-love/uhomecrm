/**
 * rh-vaga-lead — v3 (2026-08-14) — Público (página /vaga).
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

    // ── (c) finalizar: grava preferência (dia + turno) e avisa a RH ──
    if (acao === "finalizar") {
      const nome = String(body.nome || "").trim();
      const telefone = String(body.telefone || "").trim();
      const email = body.email ? String(body.email).trim() : null;
      const respostas = body.respostas && typeof body.respostas === "object"
        ? body.respostas as Record<string, unknown>
        : {};
      const temperatura = ["quente", "morno", "frio"].includes(String(body.temperatura))
        ? String(body.temperatura)
        : null;

      const prefData = typeof respostas.pref_data === "string" ? respostas.pref_data : null;
      const prefTurno = ["manha", "tarde"].includes(String(respostas.pref_turno))
        ? String(respostas.pref_turno)
        : null;
      if (!prefData || !prefTurno) return json({ error: "Preferência inválida" }, 400);

      let candidatoId = String(body.candidato_id || "").trim() || null;

      if (candidatoId) {
        const { data: upd, error: upErr } = await supabase
          .from("rh_candidatos")
          .update({ respostas, temperatura, etapa: "novo_lead" })
          .eq("id", candidatoId)
          .eq("origem", "anuncio")
          .in("etapa", ETAPAS_EDITAVEIS)
          .select("id")
          .maybeSingle();
        if (upErr) console.error("[rh-vaga-lead] finalizar update", upErr);
        if (!upd) candidatoId = null; // fallback: cria abaixo
      }

      if (!candidatoId) {
        if (nome.length < 2 || nome.length > 120) return json({ error: "Nome inválido" }, 400);
        const digitos = telefone.replace(/\D/g, "");
        if (digitos.length < 10 || digitos.length > 13) return json({ error: "WhatsApp inválido" }, 400);

        const { data: criado, error: cErr } = await supabase
          .from("rh_candidatos")
          .insert({ nome, telefone, email, origem: "anuncio", etapa: "novo_lead", temperatura, respostas })
          .select("id")
          .single();
        if (cErr || !criado) {
          console.error("[rh-vaga-lead] finalizar insert", cErr);
          return json({ error: "Não foi possível registrar sua candidatura." }, 500);
        }
        candidatoId = criado.id;
      }

      // ── Notificação in-app para a RH (silenciosa: nunca quebra o funil) ──
      try {
        const turnoLabel = prefTurno === "manha" ? "manhã" : "tarde";
        const [ano, mes, dia] = prefData.split("-");
        const { data: rhRoles } = await supabase.from("user_roles").select("user_id").eq("role", "rh");
        const destinatarios = [...new Set(((rhRoles as { user_id: string }[]) || []).map((r) => r.user_id))];
        for (const userId of destinatarios) {
          const { error: notErr } = await supabase.rpc("criar_notificacao", {
            p_user_id: userId,
            p_tipo: "info",
            p_categoria: "recrutamento_novo_candidato",
            p_titulo: "Novo candidato — agendar entrevista",
            p_mensagem: `${nome || "Candidato"}${temperatura ? ` · ${temperatura}` : ""} · prefere ${dia}/${mes} de ${turnoLabel}`,
            p_dados: { candidato_id: candidatoId, temperatura, pref_data: prefData, pref_turno: prefTurno, ano, url: "/rh/recrutamento" },
            p_agrupamento_key: `recrutamento_novo_candidato:${candidatoId}`,
          });
          if (notErr) console.error("[rh-vaga-lead] notificar rh", notErr);
        }
      } catch (e) {
        console.error("[rh-vaga-lead] notificação falhou (ignorado)", e);
      }

      return json({ ok: true, candidato_id: candidatoId });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[rh-vaga-lead]", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
