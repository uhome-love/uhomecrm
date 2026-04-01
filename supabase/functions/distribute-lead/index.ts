import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "distribute-lead", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "distribute-lead", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "distribute-lead", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: "distribute-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let userId: string | null = null;
    if (token !== serviceKey && token !== anonKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      userId = user.id;
    }

    const body = await req.json();
    const {
      action,
      pipeline_lead_id,
      pipeline_lead_ids,
      janela,
      lead_id,
      leadId,
      lead_ids,
      leadIds,
      selected_lead_ids,
      selectedLeadIds,
    } = body;

    const singleLeadId = pipeline_lead_id || lead_id || leadId || null;
    const batchLeadIdsRaw = pipeline_lead_ids || lead_ids || leadIds || selected_lead_ids || selectedLeadIds || [];
    const batchLeadIds: string[] = Array.isArray(batchLeadIdsRaw)
      ? [...new Set(batchLeadIdsRaw.map((id: any) => String(id || "").trim()).filter(Boolean))]
      : [];

    L.info("Request", { action, singleLeadId, batchCount: batchLeadIds.length });

    // ─── Accept / Reject ───
    if (action === "aceitar" || action === "rejeitar") {
      return await handleAcceptReject(supabase, body, userId!, supabaseUrl, serviceKey);
    }

    // ─── Batch dispatch (uses atomic RPC sequentially) ───
    if (action === "dispatch_batch" || action === "dispatch_fila_ceo") {
      const allLeadIds: string[] = batchLeadIds.length
        ? batchLeadIds
        : (singleLeadId ? [singleLeadId] : []);
      const targetJanela = janela || null; // Let the RPC determine janela if not specified

      if (allLeadIds.length === 0) {
        return jsonResponse({ success: true, dispatched: 0, reason: "no_leads_provided" });
      }

      let dispatched = 0;
      let failed = 0;
      const distributionLog: Array<{ leadId: string; corretorId: string; segmento: string }> = [];

      // Process leads SEQUENTIALLY — each call to the RPC is atomic with advisory lock
      for (const lid of allLeadIds) {
        const result = await distributeViaRPC(supabase, supabaseUrl, serviceKey, lid, targetJanela, null, L);
        if (result.success) {
          dispatched++;
          distributionLog.push({ leadId: lid, corretorId: result.corretor_id, segmento: result.segmento_id || "sem_segmento" });
        } else {
          L.warn("Batch lead failed", { leadId: lid, reason: result.reason });
          failed++;
        }
      }

      if (userId) {
        supabase.from("audit_log").insert({
          user_id: userId,
          modulo: "roleta",
          acao: "dispatch_fila_ceo",
          descricao: `Disparou ${dispatched} leads (${failed} falharam) via janela ${targetJanela || "auto"}`,
          depois: { dispatched, failed, janela: targetJanela, distribution: distributionLog.slice(0, 20) },
        }).then(r => { if (r.error) console.warn("audit_log insert:", r.error.message); });
      }

      L.info("Dispatch complete", { dispatched, failed });
      logOps("info", "business", `Dispatch complete: ${dispatched} leads`, { dispatched, failed, janela: targetJanela });
      return jsonResponse({ success: true, dispatched, failed });
    }

    // ─── Single lead distribution ───
    if (action === "distribute_single" || !action) {
      if (!singleLeadId) {
        return jsonResponse({ error: "pipeline_lead_id required" }, 400);
      }
      const result = await distributeViaRPC(supabase, supabaseUrl, serviceKey, singleLeadId, janela || null, null, L);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(JSON.stringify({ fn: "distribute-lead", level: "error", msg: "Unhandled exception", traceId, err: err instanceof Error ? { name: err.name, message: err.message } : { raw: String(err) }, ts: new Date().toISOString() }));
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: "distribute-lead", level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: err instanceof Error ? err.message : String(err) }).then(() => {});
    } catch {}
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

// ─── Core: distribute a single lead via atomic RPC ───
async function distributeViaRPC(
  supabase: any, supabaseUrl: string, serviceKey: string,
  leadId: string, janela: string | null, excludeAuthUserId: string | null,
  L: { info: Function; warn: Function; error: Function }
): Promise<any> {
  const { data: result, error } = await supabase.rpc("distribuir_lead_atomico", {
    p_lead_id: leadId,
    p_janela: janela,
    p_exclude_auth_user_id: excludeAuthUserId,
  });

  if (error) {
    L.error("RPC distribuir_lead_atomico failed", { leadId }, error);
    return { success: false, reason: "rpc_error", error: error.message };
  }

  if (!result || !result.success) {
    return result || { success: false, reason: "unknown" };
  }

  // RPC handled: assignment, distribuicao_historico, roleta_distribuicoes, roleta_fila
  // Edge function handles: notifications (WhatsApp, push, in-app)

  const lead = {
    id: leadId,
    nome: result.lead_nome,
    empreendimento: result.lead_empreendimento,
    telefone: result.lead_telefone,
    origem: result.lead_origem,
  };

  // Notification insert
  supabase.from("notifications").insert({
    user_id: result.corretor_id,
    tipo: "lead",
    categoria: "lead_novo",
    titulo: `🚨 Novo Lead! ${lead.nome || ""}`.trim(),
    mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}${lead.origem ? ` (${lead.origem})` : ""}. Aceite em 10 minutos!`,
    dados: { pipeline_lead_id: leadId, lead_nome: lead.nome, empreendimento: lead.empreendimento, telefone: lead.telefone, origem: lead.origem },
    agrupamento_key: `lead_novo_${leadId}`,
  }).then((r: any) => { if (r.error) console.warn("notification insert:", r.error.message); });

  // WhatsApp + Push (fire-and-forget)
  sendWhatsApp(supabase, supabaseUrl, serviceKey, result.corretor_id, lead).catch(e =>
    console.warn("WhatsApp notify error:", e)
  );
  sendPush(supabaseUrl, serviceKey, result.corretor_id, lead).catch(e =>
    console.warn("Push notify error:", e)
  );

  L.info("Lead distributed", {
    leadId,
    corretorId: result.corretor_id,
    segmento: result.segmento_id,
    janela: result.janela,
  });

  return result;
}

// ─── Accept / Reject handler ───
async function handleAcceptReject(supabase: any, body: any, userId: string, supabaseUrl: string, serviceKey: string) {
  const { action, pipeline_lead_id, status_inicial, motivo } = body;

  if (action === "aceitar") {
    const { data: result, error } = await supabase.rpc("aceitar_lead", {
      p_lead_id: pipeline_lead_id,
      p_corretor_id: userId,
      p_status_inicial: status_inicial || "ligando_agora",
    });

    if (error) {
      console.error("aceitar_lead RPC error:", error);
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (!result?.success) {
      return jsonResponse(result);
    }

    const { data: leadData } = await supabase
      .from("pipeline_leads")
      .select("nome, empreendimento")
      .eq("id", pipeline_lead_id)
      .maybeSingle();

    if (leadData) {
      supabase.from("notifications").insert({
        user_id: userId,
        tipo: "lead",
        categoria: "lead_aceito",
        titulo: `✅ Lead aceito! ${leadData.nome || ""}`.trim(),
        mensagem: `${leadData.nome || "Lead"}${leadData.empreendimento ? ` — ${leadData.empreendimento}` : ""}. Faça o primeiro contato agora!`,
        dados: { pipeline_lead_id, lead_nome: leadData.nome, empreendimento: leadData.empreendimento },
        agrupamento_key: `lead_aceito_${pipeline_lead_id}`,
      }).then(r => { if (r.error) console.warn("notification insert:", r.error.message); });
    }

    return jsonResponse({ success: true });
  }

  if (action === "rejeitar") {
    const { data: result, error } = await supabase.rpc("rejeitar_lead", {
      p_lead_id: pipeline_lead_id,
      p_corretor_id: userId,
      p_motivo: motivo || "outro",
    });

    if (error) {
      console.error("rejeitar_lead RPC error:", error);
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (!result?.success) {
      return jsonResponse(result);
    }

    // Redistribute via atomic RPC, excluding the rejector
    const L = {
      info: (msg: string, ctx?: any) => console.info(JSON.stringify({ fn: "distribute-lead", msg, ctx })),
      warn: (msg: string, ctx?: any) => console.warn(JSON.stringify({ fn: "distribute-lead", msg, ctx })),
      error: (msg: string, ctx?: any, err?: any) => console.error(JSON.stringify({ fn: "distribute-lead", msg, ctx, err })),
    };
    const redistResult = await distributeViaRPC(
      supabase, Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      pipeline_lead_id, undefined, userId, L
    );

    return jsonResponse({ success: true, redistributed: redistResult.success });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
}

// ─── Helpers ───
async function sendWhatsApp(supabase: any, supabaseUrl: string, serviceKey: string, authUserId: string, lead: any) {
  const { data: corretor } = await supabase
    .from("profiles")
    .select("telefone, nome")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (corretor?.telefone) {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-notificacao`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        telefone: corretor.telefone,
        tipo: "novo_lead",
        dados: {
          nome: lead.nome || "Lead",
          empreendimento: lead.empreendimento || "Não identificado",
          telefone: lead.telefone || "",
        },
      }),
    });
  }
}

async function sendPush(supabaseUrl: string, serviceKey: string, authUserId: string, lead: any) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: authUserId,
        title: "🚨 Novo Lead!",
        body: `${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}. Aceite em 10 min!`,
        url: "/aceite-leads",
        data: { tag: `lead_novo_${lead.id}` },
      }),
    });
  } catch (e) {
    console.warn("Push notification error:", e);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
