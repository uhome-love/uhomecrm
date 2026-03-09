import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Empreendimento → Segmento mapping ───
const EMPREENDIMENTO_SEGMENTO: Record<string, string> = {
  // MCMV / Até 500k
  "open bosque": "9948f523-29f4-46a7-bc1b-81ff8bb8dd50",
  "melnick day": "9948f523-29f4-46a7-bc1b-81ff8bb8dd50",
  "melnick day compactos": "9948f523-29f4-46a7-bc1b-81ff8bb8dd50",
  // Médio-Alto Padrão
  "casa tua": "d364f084-a63b-4be3-892e-15d66e367b43",
  "las casas": "d364f084-a63b-4be3-892e-15d66e367b43",
  "vértice - las casas": "d364f084-a63b-4be3-892e-15d66e367b43",
  "orygem": "d364f084-a63b-4be3-892e-15d66e367b43",
  "me day": "d364f084-a63b-4be3-892e-15d66e367b43",
  "alto lindóia": "d364f084-a63b-4be3-892e-15d66e367b43",
  "alto lindoia": "d364f084-a63b-4be3-892e-15d66e367b43",
  "terrace": "d364f084-a63b-4be3-892e-15d66e367b43",
  "alfa": "d364f084-a63b-4be3-892e-15d66e367b43",
  "duetto - morana": "d364f084-a63b-4be3-892e-15d66e367b43",
  // Altíssimo Padrão
  "lake eyre": "93ca556c-9a32-4fb8-b1af-148100ea47f0",
  "seen": "93ca556c-9a32-4fb8-b1af-148100ea47f0",
  "seen menino deus": "93ca556c-9a32-4fb8-b1af-148100ea47f0",
  "boa vista country club": "93ca556c-9a32-4fb8-b1af-148100ea47f0",
  "boa vista": "93ca556c-9a32-4fb8-b1af-148100ea47f0",
  // Investimento
  "shift": "409aeddf-077f-473a-97cc-dfc0692ed35e",
  "shift - vanguard": "409aeddf-077f-473a-97cc-dfc0692ed35e",
  "casa bastian": "409aeddf-077f-473a-97cc-dfc0692ed35e",
};

function resolveSegmento(empreendimento: string | null): string | null {
  if (!empreendimento) return null;
  const lower = empreendimento.toLowerCase().trim();
  if (EMPREENDIMENTO_SEGMENTO[lower]) return EMPREENDIMENTO_SEGMENTO[lower];
  // Fuzzy match
  for (const [key, segId] of Object.entries(EMPREENDIMENTO_SEGMENTO)) {
    if (lower.includes(key) || key.includes(lower)) return segId;
  }
  return null;
}

// ─── Current window detection ───
function getCurrentJanela(): string {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour >= 8 && brHour < 13) return "manha";
  if (brHour >= 13 && brHour < 19) return "tarde";
  return "noturna";
}

interface CorretorCandidate {
  corretorId: string;  // profiles.id (FK for credenciamentos)
  authUserId: string;  // auth.users.id (for pipeline_leads.corretor_id)
  leadsHoje: number;
  lastReceivedAt: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow service role calls (from jetimob-sync) or user JWT
    let userId: string | null = null;
    if (token !== serviceKey && token !== anonKey) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { action, pipeline_lead_id, pipeline_lead_ids, janela } = body;
    console.log(`Action: ${action}, Lead: ${pipeline_lead_id}, Leads: ${pipeline_lead_ids?.length || 0}`);

    // ─── Accept / Reject ───
    if (action === "aceitar" || action === "rejeitar") {
      return await handleAcceptReject(supabase, body, userId!, supabaseUrl, serviceKey);
    }

    // ─── Batch dispatch (CEO Fila) ───
    if (action === "dispatch_batch") {
      const leadIds: string[] = pipeline_lead_ids || [];
      const targetJanela = janela || getCurrentJanela();
      
      if (leadIds.length === 0) {
        return jsonResponse({ success: false, reason: "no_leads", dispatched: 0 });
      }

      // Load all leads
      const { data: leadsData } = await supabase
        .from("pipeline_leads")
        .select("id, empreendimento, nome, telefone")
        .in("id", leadIds)
        .eq("aceite_status", "pendente_distribuicao")
        .is("corretor_id", null);

      const leads = leadsData || [];
      if (leads.length === 0) {
        return jsonResponse({ success: true, dispatched: 0, reason: "no_eligible_leads" });
      }

      // Get today's start
      const todayStart = getTodayStartUTC();

      // Get ALL approved credenciamentos for today (ignore janela — balancing is global)
      const { data: creds } = await supabase
        .from("roleta_credenciamentos")
        .select("corretor_id, segmento_1_id, segmento_2_id, janela")
        .eq("data", getTodayDateStr())
        .eq("status", "aprovado")
        .is("saiu_em", null);
      if (!creds || creds.length === 0) {
        return jsonResponse({ success: false, reason: "no_credenciados", dispatched: 0 });
      }

      // Build unique corretor set with their segments
      const corretorSegments = new Map<string, Set<string>>();
      for (const c of creds) {
        if (!corretorSegments.has(c.corretor_id)) {
          corretorSegments.set(c.corretor_id, new Set());
        }
        const segs = corretorSegments.get(c.corretor_id)!;
        if (c.segmento_1_id) segs.add(c.segmento_1_id);
        if (c.segmento_2_id) segs.add(c.segmento_2_id);
      }

      // Resolve profiles → auth user IDs
      const corretorProfileIds = [...corretorSegments.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .in("id", corretorProfileIds);

      const profileToAuth = new Map<string, string>();
      const authToProfile = new Map<string, string>();
      for (const p of profiles || []) {
        if (p.user_id) {
          profileToAuth.set(p.id, p.user_id);
          authToProfile.set(p.user_id, p.id);
        }
      }

      // Count leads received TODAY per corretor — only ASSIGNED leads (aceito or pendente)
      // NEVER count pendente_distribuicao (those are unassigned in the CEO queue)
      const authUserIds = [...profileToAuth.values()];
      const { data: todayLeads } = await supabase
        .from("pipeline_leads")
        .select("corretor_id, distribuido_em")
        .in("corretor_id", authUserIds)
        .gte("distribuido_em", todayStart)
        .in("aceite_status", ["aceito", "pendente"]);

      // Count per auth user
      const leadsCount = new Map<string, number>();
      const lastReceived = new Map<string, string>();
      for (const uid of authUserIds) {
        leadsCount.set(uid, 0);
      }
      for (const l of todayLeads || []) {
        leadsCount.set(l.corretor_id, (leadsCount.get(l.corretor_id) || 0) + 1);
        const prev = lastReceived.get(l.corretor_id);
        if (!prev || l.distribuido_em > prev) {
          lastReceived.set(l.corretor_id, l.distribuido_em);
        }
      }

      // Distribute leads one by one with global balancing
      let dispatched = 0;
      let failed = 0;
      const distributionLog: Array<{ leadId: string; corretorId: string; segmento: string }> = [];

      for (const lead of leads) {
        const segmentoId = resolveSegmento(lead.empreendimento);
        
        // Find eligible corretores for this segment
        const eligible: CorretorCandidate[] = [];
        for (const [profileId, segs] of corretorSegments.entries()) {
          // If no segment identified, allow all credenciados
          if (segmentoId && !segs.has(segmentoId)) continue;
          
          const authId = profileToAuth.get(profileId);
          if (!authId) continue;

          eligible.push({
            corretorId: profileId,
            authUserId: authId,
            leadsHoje: leadsCount.get(authId) || 0,
            lastReceivedAt: lastReceived.get(authId) || null,
          });
        }

        if (eligible.length === 0) {
          console.warn(`No eligible corretor for lead ${lead.id} (emp: ${lead.empreendimento}, seg: ${segmentoId})`);
          failed++;
          continue;
        }

        // Sort: least leads first, then by last received (oldest first = longest without lead)
        eligible.sort((a, b) => {
          if (a.leadsHoje !== b.leadsHoje) return a.leadsHoje - b.leadsHoje;
          // Tie-breaker: who hasn't received recently (null = never received = first)
          if (!a.lastReceivedAt && b.lastReceivedAt) return -1;
          if (a.lastReceivedAt && !b.lastReceivedAt) return 1;
          if (a.lastReceivedAt && b.lastReceivedAt) {
            return a.lastReceivedAt < b.lastReceivedAt ? -1 : 1;
          }
          return 0;
        });

        const chosen = eligible[0];
        const now = new Date();
        const expireAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

        // Assign lead
        const { error: updateErr } = await supabase
          .from("pipeline_leads")
          .update({
            corretor_id: chosen.authUserId,
            aceite_status: "pendente",
            distribuido_em: now.toISOString(),
            aceite_expira_em: expireAt.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", lead.id);

        if (updateErr) {
          console.error(`Failed to assign lead ${lead.id}:`, updateErr.message);
          failed++;
          continue;
        }

        // Update counters for next iteration
        leadsCount.set(chosen.authUserId, (leadsCount.get(chosen.authUserId) || 0) + 1);
        lastReceived.set(chosen.authUserId, now.toISOString());

        // Log distribution
        await supabase.from("roleta_distribuicoes").insert({
          lead_id: lead.id,
          corretor_id: chosen.corretorId, // profile id
          segmento_id: segmentoId,
          janela: targetJanela,
          status: "pendente",
          enviado_em: now.toISOString(),
          expira_em: expireAt.toISOString(),
          avisos_enviados: 0,
        }).then(r => { if (r.error) console.warn("roleta_distribuicoes insert:", r.error.message); });

        // Create notification
        await supabase.from("notifications").insert({
          user_id: chosen.authUserId,
          tipo: "lead",
          categoria: "lead_novo",
          titulo: "🚨 Novo Lead!",
          mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` (${lead.empreendimento})` : ""}. Aceite em 10 minutos!`,
          dados: { pipeline_lead_id: lead.id, empreendimento: lead.empreendimento, telefone: lead.telefone },
          agrupamento_key: `lead_novo_${lead.id}`,
        }).then(r => { if (r.error) console.warn("notification insert:", r.error.message); });

        // Send WhatsApp notification (fire and forget)
        sendWhatsApp(supabase, supabaseUrl, serviceKey, chosen.authUserId, lead).catch(e =>
          console.warn("WhatsApp notify error:", e)
        );

        distributionLog.push({ leadId: lead.id, corretorId: chosen.authUserId, segmento: segmentoId || "unknown" });
        dispatched++;
      }

      // Audit log
      if (userId) {
        await supabase.from("audit_log").insert({
          user_id: userId,
          modulo: "roleta",
          acao: "dispatch_fila_ceo",
          descricao: `Disparou ${dispatched} leads (${failed} falharam) via janela ${targetJanela}`,
          depois: { dispatched, failed, janela: targetJanela, distribution: distributionLog.slice(0, 20) },
        }).catch(() => {});
      }

      console.log(`Dispatch complete: ${dispatched} distributed, ${failed} failed`);
      return jsonResponse({ success: true, dispatched, failed });
    }

    // ─── Single lead distribution (from jetimob-sync) ───
    if (action === "distribute_single" || !action) {
      if (!pipeline_lead_id) {
        return jsonResponse({ error: "pipeline_lead_id required" }, 400);
      }

      const result = await distributeSingleLead(supabase, supabaseUrl, serviceKey, pipeline_lead_id, janela);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

// ─── Distribute a single lead ───
async function distributeSingleLead(
  supabase: any, supabaseUrl: string, serviceKey: string,
  leadId: string, forceJanela?: string, excludeAuthUserId?: string
) {
  const { data: lead } = await supabase
    .from("pipeline_leads")
    .select("id, nome, telefone, empreendimento, aceite_status, corretor_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { success: false, reason: "lead_not_found" };
  if (lead.corretor_id && lead.aceite_status !== "pendente_distribuicao") {
    return { success: false, reason: "already_assigned" };
  }

  const segmentoId = resolveSegmento(lead.empreendimento);
  const targetJanela = forceJanela || getCurrentJanela();
  const todayStart = getTodayStartUTC();
  const todayStr = getTodayDateStr();

  // Get ALL approved credenciados for today (global balancing, no janela filter)
  const { data: creds } = await supabase
    .from("roleta_credenciamentos")
    .select("corretor_id, segmento_1_id, segmento_2_id")
    .eq("data", todayStr)
    .eq("status", "aprovado")
    .is("saiu_em", null);
  if (!creds || creds.length === 0) {
    return { success: false, reason: "no_credenciados" };
  }

  // Build eligible list filtered by segment
  const corretorSegments = new Map<string, Set<string>>();
  for (const c of creds) {
    if (!corretorSegments.has(c.corretor_id)) corretorSegments.set(c.corretor_id, new Set());
    const segs = corretorSegments.get(c.corretor_id)!;
    if (c.segmento_1_id) segs.add(c.segmento_1_id);
    if (c.segmento_2_id) segs.add(c.segmento_2_id);
  }

  // Filter by segment
  const eligibleProfileIds: string[] = [];
  for (const [profileId, segs] of corretorSegments.entries()) {
    if (!segmentoId || segs.has(segmentoId)) {
      eligibleProfileIds.push(profileId);
    }
  }

  if (eligibleProfileIds.length === 0) {
    return { success: false, reason: "no_corretor_available", segmento_id: segmentoId };
  }

  // Resolve auth IDs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("id", eligibleProfileIds);

  const profileToAuth = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.user_id) profileToAuth.set(p.id, p.user_id);
  }

  const authIds = [...profileToAuth.values()];

  // Count today's leads — only actually assigned (aceito/pendente), NOT pendente_distribuicao
  const { data: todayLeads } = await supabase
    .from("pipeline_leads")
    .select("corretor_id, distribuido_em")
    .in("corretor_id", authIds)
    .gte("distribuido_em", todayStart)
    .in("aceite_status", ["aceito", "pendente"]);

  const leadsCount = new Map<string, number>();
  const lastReceived = new Map<string, string>();
  for (const uid of authIds) leadsCount.set(uid, 0);
  for (const l of todayLeads || []) {
    leadsCount.set(l.corretor_id, (leadsCount.get(l.corretor_id) || 0) + 1);
    const prev = lastReceived.get(l.corretor_id);
    if (!prev || l.distribuido_em > prev) lastReceived.set(l.corretor_id, l.distribuido_em);
  }

  // Build candidates and sort — exclude rejected broker if specified
  const candidates: CorretorCandidate[] = [];
  for (const [profileId, authId] of profileToAuth.entries()) {
    if (excludeAuthUserId && authId === excludeAuthUserId) continue; // skip rejected broker
    candidates.push({
      corretorId: profileId,
      authUserId: authId,
      leadsHoje: leadsCount.get(authId) || 0,
      lastReceivedAt: lastReceived.get(authId) || null,
    });
  }

  candidates.sort((a, b) => {
    if (a.leadsHoje !== b.leadsHoje) return a.leadsHoje - b.leadsHoje;
    if (!a.lastReceivedAt && b.lastReceivedAt) return -1;
    if (a.lastReceivedAt && !b.lastReceivedAt) return 1;
    if (a.lastReceivedAt && b.lastReceivedAt) return a.lastReceivedAt < b.lastReceivedAt ? -1 : 1;
    return 0;
  });

  const chosen = candidates[0];
  const now = new Date();
  const expireAt = new Date(now.getTime() + 10 * 60 * 1000);

  const { error } = await supabase
    .from("pipeline_leads")
    .update({
      corretor_id: chosen.authUserId,
      aceite_status: "pendente",
      distribuido_em: now.toISOString(),
      aceite_expira_em: expireAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error(`Failed to assign lead ${leadId}:`, error.message);
    return { success: false, reason: "update_failed", error: error.message };
  }

  // Log, notify
  const distRes = await supabase.from("roleta_distribuicoes").insert({
    lead_id: leadId,
    corretor_id: chosen.corretorId,
    segmento_id: segmentoId,
    janela: targetJanela,
    status: "pendente",
    enviado_em: now.toISOString(),
    expira_em: expireAt.toISOString(),
    avisos_enviados: 0,
  });
  if (distRes.error) console.warn("roleta_distribuicoes insert:", distRes.error.message);

  const notifRes = await supabase.from("notifications").insert({
    user_id: chosen.authUserId,
    tipo: "lead",
    categoria: "lead_novo",
    titulo: "🚨 Novo Lead!",
    mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` (${lead.empreendimento})` : ""}. Aceite em 10 minutos!`,
    dados: { pipeline_lead_id: leadId, empreendimento: lead.empreendimento },
    agrupamento_key: `lead_novo_${leadId}`,
  });
  if (notifRes.error) console.warn("notification insert:", notifRes.error.message);

  try { await sendWhatsApp(supabase, supabaseUrl, serviceKey, chosen.authUserId, lead); } catch (e) { console.warn("WhatsApp error:", e); }

  return { success: true, corretor_id: chosen.authUserId, segmento_id: segmentoId };
}

// ─── Accept / Reject handler ───
async function handleAcceptReject(supabase: any, body: any, userId: string, supabaseUrl: string, serviceKey: string) {
  const { action, pipeline_lead_id } = body;

  if (action === "aceitar") {
    const { error } = await supabase
      .from("pipeline_leads")
      .update({
        aceite_status: "aceito",
        aceito_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pipeline_lead_id)
      .eq("corretor_id", userId)
      .eq("aceite_status", "pendente");

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    // Update roleta_distribuicoes
    const distUpd = await supabase.from("roleta_distribuicoes")
      .update({ status: "aceito", aceito_em: new Date().toISOString() })
      .eq("lead_id", pipeline_lead_id)
      .eq("status", "pendente");
    if (distUpd.error) console.warn("roleta_distribuicoes update:", distUpd.error.message);

    // Notification
    const { data: leadData } = await supabase
      .from("pipeline_leads")
      .select("nome, empreendimento")
      .eq("id", pipeline_lead_id)
      .maybeSingle();

    if (leadData) {
      await supabase.from("notifications").insert({
        user_id: userId,
        tipo: "lead",
        categoria: "lead_aceito",
        titulo: "✅ Lead aceito!",
        mensagem: `${leadData.nome || "Lead"} - ${leadData.empreendimento || ""}. Faça o primeiro contato agora!`,
        dados: { pipeline_lead_id },
        agrupamento_key: `lead_aceito_${pipeline_lead_id}`,
      }).catch(() => {});
    }

    return jsonResponse({ success: true });
  }

  if (action === "rejeitar") {
    // Reject: clear corretor, set back to pendente_distribuicao for redistribution
    const { error } = await supabase
      .from("pipeline_leads")
      .update({
        aceite_status: "pendente_distribuicao",
        corretor_id: null,
        distribuido_em: null,
        aceite_expira_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pipeline_lead_id)
      .eq("corretor_id", userId);

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    // Update roleta_distribuicoes
    await supabase.from("roleta_distribuicoes")
      .update({ status: "rejeitado" })
      .eq("lead_id", pipeline_lead_id)
      .eq("status", "pendente")
      .catch(() => {});

    // Try to redistribute immediately, excluding the broker who just rejected
    const result = await distributeSingleLead(supabase, supabaseUrl, serviceKey, pipeline_lead_id, undefined, userId);
    console.log(`Redistribution after reject (excluded ${userId}):`, JSON.stringify(result));

    return jsonResponse({ success: true, redistributed: result.success });
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

function getTodayStartUTC(): string {
  // Brazil is UTC-3
  const now = new Date();
  const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brDate.getUTCFullYear();
  const m = String(brDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T03:00:00.000Z`; // midnight BR = 03:00 UTC
}

function getTodayDateStr(): string {
  const now = new Date();
  const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brDate.getUTCFullYear();
  const m = String(brDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
