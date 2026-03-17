import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalize phone to digits-only without country code prefix duplication */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

/** Generate phone variants for dedup matching */
function phoneVariants(norm: string): string[] {
  const variants = new Set<string>();
  variants.add(norm);
  variants.add(`55${norm}`);
  // With/without 9th digit
  if (norm.length === 11) variants.add(norm.slice(0, 2) + norm.slice(3));
  if (norm.length === 10) variants.add(norm.slice(0, 2) + "9" + norm.slice(2));
  return [...variants];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth: Bearer token must match UHOME_AI_SECRET ──
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = Deno.env.get("UHOME_AI_SECRET");

  if (!secret || token !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Parse & validate body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const {
    lead_id,
    status,
    resumo,
    finalidade,
    regiao_interesse,
    faixa_investimento,
    prazo_compra,
    proxima_acao,
    prioridade,
    // New fields for lead creation/matching
    telefone,
    nome,
    email,
    empreendimento,
  } = body as Record<string, string>;

  // Required fields
  if (!status || !resumo || !proxima_acao || !prioridade) {
    return json(
      { error: "Missing required fields: status, resumo, proxima_acao, prioridade" },
      400,
    );
  }

  // ── Supabase service-role client (bypasses RLS) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const isPositive = [
    "interesse", "positivo", "com_interesse", "qualificado", "visita_marcada",
    "interessado_quente", "interessado_morno", "quer_visita", "quer_whatsapp",
  ].includes(status.toLowerCase());

  // ── Build classification details from IA ──
  const classificationParts: string[] = [];
  classificationParts.push(`📞 Resultado IA: ${status}`);
  if (resumo) classificationParts.push(`Resumo: ${resumo}`);
  if (finalidade) classificationParts.push(`Finalidade: ${finalidade}`);
  if (regiao_interesse) classificationParts.push(`Região: ${regiao_interesse}`);
  if (faixa_investimento) classificationParts.push(`Faixa investimento: ${faixa_investimento}`);
  if (prazo_compra) classificationParts.push(`Prazo: ${prazo_compra}`);
  if (proxima_acao) classificationParts.push(`Próx. ação: ${proxima_acao}`);
  if (prioridade) classificationParts.push(`Prioridade: ${prioridade}`);
  const classificationText = classificationParts.join(" | ");

  // ── 1. Try to find existing lead ──
  let existingLead: { id: string; corretor_id: string | null; observacoes: string | null } | null = null;

  // First: by lead_id if provided
  if (lead_id && UUID_RE.test(lead_id)) {
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, corretor_id, observacoes")
      .eq("id", lead_id)
      .maybeSingle();
    existingLead = data;
  }

  // Second: by phone if no lead found
  if (!existingLead && telefone) {
    const norm = normalizePhone(telefone);
    const variants = phoneVariants(norm);
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, corretor_id, observacoes")
      .in("telefone_normalizado", variants)
      .not("aceite_status", "eq", "descartado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingLead = data;
  }

  // Third: by email
  if (!existingLead && email) {
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, corretor_id, observacoes")
      .ilike("email", email.trim().toLowerCase())
      .not("aceite_status", "eq", "descartado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingLead = data;
  }

  // ──────────────────────────────────────────────────
  // CASE A: Lead exists in the system
  // ──────────────────────────────────────────────────
  if (existingLead) {
    // Update lead with IA classification (append to observacoes)
    const currentObs = existingLead.observacoes || "";
    const separator = currentObs ? "\n---\n" : "";
    const newObs = `${currentObs}${separator}🤖 Ligação IA - Melnick Day (${new Date().toLocaleDateString("pt-BR")})\n${classificationText}`;

    const updatePayload: Record<string, unknown> = {
      observacoes: newObs,
      proxima_acao,
      prioridade_lead: prioridade,
      ultima_acao_at: new Date().toISOString(),
    };
    if (regiao_interesse) updatePayload.bairro_regiao = regiao_interesse;
    if (finalidade) updatePayload.objetivo_cliente = finalidade;

    await supabase.from("pipeline_leads").update(updatePayload).eq("id", existingLead.id);

    // Register activity in timeline
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: existingLead.id,
      tipo: "ligacao",
      titulo: "📞 Ligação IA - Melnick Day",
      descricao: classificationText,
      data: new Date().toISOString().slice(0, 10),
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    });

    // Log to ia_call_results
    await supabase.from("ia_call_results").insert({
      lead_id: existingLead.id,
      status,
      resumo,
      finalidade: finalidade ?? null,
      regiao_interesse: regiao_interesse ?? null,
      faixa_investimento: faixa_investimento ?? null,
      prazo_compra: prazo_compra ?? null,
      proxima_acao,
      prioridade,
    });

    // If lead has a corretor, notify them
    if (existingLead.corretor_id && isPositive) {
      await supabase.from("notifications").insert({
        user_id: existingLead.corretor_id,
        titulo: `🤖 Ligação IA positiva — ${nome || "Lead"}`,
        mensagem: `A IA ligou para ${nome || "um lead"} e detectou interesse! ${resumo}. Ação: ${proxima_acao}`,
        tipo: "lead_reengajado",
        categoria: "leads",
        dados: { pipeline_lead_id: existingLead.id, status, prioridade },
      });

      // Send WhatsApp notification to corretor
      try {
        await fetch(`${supabaseUrl}/functions/v1/whatsapp-notificacao`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "lead_reengajado",
            corretor_id: existingLead.corretor_id,
            lead_id: existingLead.id,
            lead_nome: nome || "Lead",
            mensagem_extra: `Ligação IA positiva: ${resumo}`,
          }),
        });
      } catch (e) {
        console.warn("WhatsApp notification failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // If positive but no corretor assigned, send to roleta
    if (!existingLead.corretor_id && isPositive) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: existingLead.id }),
        });
        console.info(`[ia-call-result] Lead ${existingLead.id} sent to roleta (no corretor)`);
      } catch (e) {
        console.error("[ia-call-result] Roleta failed:", e instanceof Error ? e.message : String(e));
      }
    }

    console.info(`[ia-call-result] Existing lead updated: ${existingLead.id}, status=${status}, positive=${isPositive}`);
    return json({ success: true, action: "updated", lead_id: existingLead.id, positive: isPositive });
  }

  // ──────────────────────────────────────────────────
  // CASE B: Lead does NOT exist — create if positive
  // ──────────────────────────────────────────────────
  if (!isPositive) {
    // Not positive & no existing lead — just log the result
    await supabase.from("ia_call_results").insert({
      lead_id: null,
      status,
      resumo,
      finalidade: finalidade ?? null,
      regiao_interesse: regiao_interesse ?? null,
      faixa_investimento: faixa_investimento ?? null,
      prazo_compra: prazo_compra ?? null,
      proxima_acao,
      prioridade,
    });
    console.info(`[ia-call-result] Negative result, no existing lead. Logged only.`);
    return json({ success: true, action: "logged_only", positive: false });
  }

  // Positive result, create new lead
  if (!telefone && !email) {
    return json({ error: "Positive result but no telefone or email to create lead" }, 400);
  }

  // Get first pipeline stage
  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_tipo", "leads")
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStage) {
    return json({ error: "No pipeline stages configured" }, 500);
  }

  const phonNorm = telefone ? normalizePhone(telefone) : null;
  const leadNome = nome || "Lead Ligação IA";

  const obsText = `🤖 Ligação IA - Melnick Day Geral (${new Date().toLocaleDateString("pt-BR")})\n${classificationText}`;

  const { data: newLead, error: insertErr } = await supabase
    .from("pipeline_leads")
    .insert({
      nome: leadNome,
      telefone: telefone || null,
      telefone_normalizado: phonNorm,
      email: email || null,
      origem: "Ligação IA",
      campanha: "Melnick Day Geral - Ligação IA",
      empreendimento: empreendimento || "Melnick Day Geral",
      stage_id: firstStage.id,
      aceite_status: "pendente_distribuicao",
      tags: ["ligacao_ia", "melnick_day"],
      observacoes: obsText,
      prioridade_lead: prioridade,
      proxima_acao,
    })
    .select("id")
    .single();

  if (insertErr || !newLead) {
    console.error("[ia-call-result] Failed to create lead:", insertErr?.message);
    return json({ error: "Failed to create lead" }, 500);
  }

  console.info(`[ia-call-result] New lead created: ${newLead.id}`);

  // Register entry activity
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: newLead.id,
    tipo: "entrada",
    titulo: "📞 Lead gerado via Ligação IA — Melnick Day Geral",
    descricao: classificationText,
    status: "concluida",
    created_by: "00000000-0000-0000-0000-000000000000",
  });

  // Log to ia_call_results
  await supabase.from("ia_call_results").insert({
    lead_id: newLead.id,
    status,
    resumo,
    finalidade: finalidade ?? null,
    regiao_interesse: regiao_interesse ?? null,
    faixa_investimento: faixa_investimento ?? null,
    prazo_compra: prazo_compra ?? null,
    proxima_acao,
    prioridade,
  });

  // Send to roleta
  try {
    await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: newLead.id }),
    });
    console.info(`[ia-call-result] Lead ${newLead.id} sent to roleta`);
  } catch (e) {
    console.error("[ia-call-result] Roleta failed:", e instanceof Error ? e.message : String(e));
  }

  return json({ success: true, action: "created", lead_id: newLead.id, positive: true });
});
