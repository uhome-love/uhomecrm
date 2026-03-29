import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Dynamic Empreendimento → Roleta Segmento resolution ───
let cachedMapping: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadEmpreendimentoMapping(supabase: any): Promise<Record<string, string>> {
  if (cachedMapping && Date.now() - cacheTime < CACHE_TTL) return cachedMapping;
  const { data } = await supabase
    .from("roleta_campanhas")
    .select("empreendimento, segmento_id")
    .eq("ativo", true);
  const mapping: Record<string, string> = {};
  for (const row of data || []) {
    if (row.empreendimento && row.segmento_id) {
      mapping[row.empreendimento.toLowerCase().trim()] = row.segmento_id;
    }
  }
  cachedMapping = mapping;
  cacheTime = Date.now();
  return mapping;
}

async function resolveSegmento(supabase: any, empreendimento: string | null): Promise<string | null> {
  if (!empreendimento) return null;
  const mapping = await loadEmpreendimentoMapping(supabase);
  const lower = empreendimento.toLowerCase().trim();
  if (mapping[lower]) return mapping[lower];
  for (const [key, segId] of Object.entries(mapping)) {
    if (lower.includes(key) || key.includes(lower)) return segId;
  }
  return null;
}

function isSundayBRT(): boolean {
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  // Approximate BRT day: if brHour < UTC hour, we crossed midnight
  const utcDay = now.getUTCDay();
  const brDay = brHour < now.getUTCHours() ? (utcDay + 1) % 7 : utcDay;
  // Fix: recalculate properly using offset
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000;
  const brtDate = new Date(brtMs);
  return brtDate.getUTCDay() === 0; // 0 = Sunday
}

function getCurrentJanela(): string {
  if (isSundayBRT()) return "dia_todo";
  const now = new Date();
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour >= 8 && brHour < 13) return "manha";
  if (brHour >= 13 && brHour < 19) return "tarde";
  return "noturna";
}

interface CorretorCandidate {
  corretorId: string;  // profiles.id
  authUserId: string;  // auth.users.id
  leadsHoje: number;
  totalAtivos: number;
  lastReceivedAt: string | null;
}

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
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // ─── Accept / Reject (now using atomic RPCs) ───
    if (action === "aceitar" || action === "rejeitar") {
      return await handleAcceptReject(supabase, body, userId!, supabaseUrl, serviceKey);
    }

    // ─── Batch dispatch ───
    if (action === "dispatch_batch" || action === "dispatch_fila_ceo") {
      const leadIds: string[] = batchLeadIds.length
        ? batchLeadIds
        : (singleLeadId ? [singleLeadId] : []);
      const targetJanela = janela || getCurrentJanela();

      const { data: leadsData } = await supabase
        .from("pipeline_leads")
        .select("id, empreendimento, nome, telefone")
        .in("id", leadIds)
        .is("corretor_id", null);

      const leads = leadsData || [];
      if (leads.length === 0) {
        return jsonResponse({ success: true, dispatched: 0, reason: "no_eligible_leads" });
      }

      const todayStart = getTodayStartUTC();

      // On Sunday (dia_todo), accept credenciamentos from any janela
      let credsQuery = supabase
        .from("roleta_credenciamentos")
        .select("corretor_id, segmento_1_id, segmento_2_id, janela")
        .eq("data", getTodayDateStr())
        .eq("status", "aprovado")
        .is("saiu_em", null);
      
      if (targetJanela !== "dia_todo") {
        credsQuery = credsQuery.eq("janela", targetJanela);
      }

      const { data: creds } = await credsQuery;
      if (!creds || creds.length === 0) {
        return jsonResponse({ success: false, reason: "no_credenciados", dispatched: 0 });
      }

      const corretorSegments = new Map<string, Set<string>>();
      for (const c of creds) {
        if (!corretorSegments.has(c.corretor_id)) corretorSegments.set(c.corretor_id, new Set());
        const segs = corretorSegments.get(c.corretor_id)!;
        if (c.segmento_1_id) segs.add(c.segmento_1_id);
        if (c.segmento_2_id) segs.add(c.segmento_2_id);
      }

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

      // For "qualquer" (real-time), filter by na_roleta=true.
      // For specific janela dispatches (manha/tarde/noturna/dia_todo), the approved credenciamento is enough.
      if (targetJanela === "qualquer") {
        const allAuthUserIds = [...profileToAuth.values()];
        const { data: dispRows } = await supabase
          .from("corretor_disponibilidade")
          .select("user_id")
          .in("user_id", allAuthUserIds)
          .eq("na_roleta", true);
        const activeAuthIds = new Set((dispRows || []).map((d: any) => d.user_id));
        
        for (const [profileId, authId] of profileToAuth.entries()) {
          if (!activeAuthIds.has(authId)) {
            profileToAuth.delete(profileId);
            authToProfile.delete(authId);
            corretorSegments.delete(profileId);
          }
        }
      }
      
      const authUserIds = [...profileToAuth.values()];
      if (authUserIds.length === 0) {
        return jsonResponse({ success: false, reason: "no_corretores_na_roleta", dispatched: 0 });
      }
      // FIX Bug 3: Count ALL distributed leads today (including timed-out ones)
      // This ensures corretores who received but didn't accept still have it counted
      const { data: todayDistributions } = await supabase
        .from("distribuicao_historico")
        .select("corretor_id, pipeline_lead_id, created_at")
        .in("acao", ["distribuido"])
        .gte("created_at", todayStart);

      // Also get current leads for segment resolution
      const { data: todayLeads } = await supabase
        .from("pipeline_leads")
        .select("id, corretor_id, distribuido_em, empreendimento")
        .in("corretor_id", authUserIds)
        .gte("distribuido_em", todayStart);

      const { data: activeLeadsData } = await supabase
        .from("pipeline_leads")
        .select("corretor_id")
        .in("corretor_id", authUserIds)
        .in("aceite_status", ["aceito", "pendente"]);

      const totalAtivosCount = new Map<string, number>();
      for (const uid of authUserIds) totalAtivosCount.set(uid, 0);
      for (const l of activeLeadsData || []) {
        totalAtivosCount.set(l.corretor_id, (totalAtivosCount.get(l.corretor_id) || 0) + 1);
      }

      // Build a map of lead_id → empreendimento for segment resolution
      const leadEmpreendimentoMap = new Map<string, string>();
      for (const l of todayLeads || []) {
        if (l.empreendimento) leadEmpreendimentoMap.set(l.id, l.empreendimento);
      }

      // Per-segment lead count based on ALL distributions (not just current assignment)
      const leadsCountBySegment = new Map<string, number>();
      const leadsCountGlobal = new Map<string, number>();
      const lastReceived = new Map<string, string>();
      for (const uid of authUserIds) leadsCountGlobal.set(uid, 0);

      for (const d of todayDistributions || []) {
        if (!authUserIds.includes(d.corretor_id)) continue;
        leadsCountGlobal.set(d.corretor_id, (leadsCountGlobal.get(d.corretor_id) || 0) + 1);
        // Resolve segment from the lead's empreendimento
        const emp = leadEmpreendimentoMap.get(d.pipeline_lead_id);
        if (emp) {
          const seg = await resolveSegmento(supabase, emp);
          if (seg) {
            const key = `${d.corretor_id}::${seg}`;
            leadsCountBySegment.set(key, (leadsCountBySegment.get(key) || 0) + 1);
          }
        }
        const prev = lastReceived.get(d.corretor_id);
        if (!prev || d.created_at > prev) lastReceived.set(d.corretor_id, d.created_at);
      }

      let dispatched = 0;
      let failed = 0;
      const distributionLog: Array<{ leadId: string; corretorId: string; segmento: string; leadsHoje?: number; totalAtivos?: number }> = [];

      for (const lead of leads) {
        const segmentoId = await resolveSegmento(supabase, lead.empreendimento);

        // ── Exclude corretors who already timed out on this lead ──
        const excludeAuthIds = new Set<string>();
        const { data: prevTimeouts } = await supabase
          .from("distribuicao_historico")
          .select("corretor_id")
          .eq("pipeline_lead_id", lead.id)
          .eq("acao", "timeout");
        for (const t of prevTimeouts || []) {
          if (t.corretor_id) excludeAuthIds.add(t.corretor_id);
        }

        const eligible: CorretorCandidate[] = [];
        for (const [profileId, segs] of corretorSegments.entries()) {
          if (segmentoId && !segs.has(segmentoId)) continue;
          const authId = profileToAuth.get(profileId);
          if (!authId) continue;
          if (excludeAuthIds.has(authId)) continue;
          // Use per-segment count for balancing; fallback to global if no segment
          const segKey = segmentoId ? `${authId}::${segmentoId}` : null;
          const leadsHojeSegmento = segKey ? (leadsCountBySegment.get(segKey) || 0) : (leadsCountGlobal.get(authId) || 0);
          eligible.push({
            corretorId: profileId,
            authUserId: authId,
            leadsHoje: leadsHojeSegmento,
            totalAtivos: totalAtivosCount.get(authId) || 0,
            lastReceivedAt: lastReceived.get(authId) || null,
          });
        }

        if (eligible.length === 0) {
          L.warn("No eligible corretor", { leadId: lead.id, empreendimento: lead.empreendimento, segmentoId });
          failed++;
          continue;
        }

        eligible.sort((a, b) => {
          // Primary: fewer leads in THIS segment today
          if (a.leadsHoje !== b.leadsHoje) return a.leadsHoje - b.leadsHoje;
          // Secondary: fewer total active leads
          if (a.totalAtivos !== b.totalAtivos) return a.totalAtivos - b.totalAtivos;
          // Tertiary: who received a lead least recently
          if (!a.lastReceivedAt && b.lastReceivedAt) return -1;
          if (a.lastReceivedAt && !b.lastReceivedAt) return 1;
          if (a.lastReceivedAt && b.lastReceivedAt) return a.lastReceivedAt < b.lastReceivedAt ? -1 : 1;
          return 0;
        });

        L.info("Lead routing", { leadNome: lead.nome, segmentoId, eligible: eligible.length, top: eligible.slice(0, 3).map(e => ({ id: e.authUserId.slice(0,8), hojeSegmento: e.leadsHoje, total: e.totalAtivos })) });
        const chosen = eligible[0];
        const now = new Date();
        const expireAt = new Date(now.getTime() + 10 * 60 * 1000);

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
          L.error("Failed to assign lead", { leadId: lead.id }, updateErr);
          failed++;
          continue;
        }

        // Update per-segment count
        if (segmentoId) {
          const segKey = `${chosen.authUserId}::${segmentoId}`;
          leadsCountBySegment.set(segKey, (leadsCountBySegment.get(segKey) || 0) + 1);
        }
        leadsCountGlobal.set(chosen.authUserId, (leadsCountGlobal.get(chosen.authUserId) || 0) + 1);
        totalAtivosCount.set(chosen.authUserId, (totalAtivosCount.get(chosen.authUserId) || 0) + 1);
        lastReceived.set(chosen.authUserId, now.toISOString());

        // FIX Bug 2: Sync roleta_fila so UI shows correct numbers
        if (segmentoId) {
          supabase.rpc("increment_roleta_fila", {
            p_corretor_profile_id: chosen.corretorId,
            p_segmento_id: segmentoId,
            p_data: getTodayDateStr(),
          }).then((r: any) => { if (r?.error) console.warn("roleta_fila sync:", r.error.message); });
        }

        await supabase.from("roleta_distribuicoes").insert({
          lead_id: lead.id,
          corretor_id: chosen.corretorId,
          segmento_id: segmentoId,
          janela: targetJanela,
          status: "aguardando",
          enviado_em: now.toISOString(),
          expira_em: expireAt.toISOString(),
          avisos_enviados: 0,
        }).then(r => { if (r.error) console.warn("roleta_distribuicoes insert:", r.error.message); });

        await supabase.from("notifications").insert({
          user_id: chosen.authUserId,
          tipo: "lead",
          categoria: "lead_novo",
          titulo: `🚨 Novo Lead! ${lead.nome || ""}`.trim(),
          mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}${lead.origem ? ` (${lead.origem})` : ""}. Aceite em 10 minutos!`,
          dados: { pipeline_lead_id: lead.id, lead_nome: lead.nome, empreendimento: lead.empreendimento, telefone: lead.telefone, origem: lead.origem },
          agrupamento_key: `lead_novo_${lead.id}`,
        }).then(r => { if (r.error) console.warn("notification insert:", r.error.message); });

        sendWhatsApp(supabase, supabaseUrl, serviceKey, chosen.authUserId, lead).catch(e =>
          console.warn("WhatsApp notify error:", e)
        );
        sendPush(supabaseUrl, serviceKey, chosen.authUserId, lead).catch(e =>
          console.warn("Push notify error:", e)
        );

        distributionLog.push({ leadId: lead.id, corretorId: chosen.authUserId, segmento: segmentoId || "unknown", leadsHoje: chosen.leadsHoje, totalAtivos: chosen.totalAtivos });
        dispatched++;
      }

      if (userId) {
        await supabase.from("audit_log").insert({
          user_id: userId,
          modulo: "roleta",
          acao: "dispatch_fila_ceo",
          descricao: `Disparou ${dispatched} leads (${failed} falharam) via janela ${targetJanela}`,
          depois: { dispatched, failed, janela: targetJanela, distribution: distributionLog.slice(0, 20) },
        }).then(r => { if (r.error) console.warn("audit_log insert:", r.error.message); });
      }

      L.info("Dispatch complete", { dispatched, failed });
      if (failed > 0) logOps("warn", "business", `Dispatch partial failure: ${failed} leads failed`, { dispatched, failed, janela: targetJanela });
      logOps("info", "business", `Dispatch complete: ${dispatched} leads`, { dispatched, failed, janela: targetJanela });
      return jsonResponse({ success: true, dispatched, failed });
    }

    // ─── Single lead distribution ───
    if (action === "distribute_single" || !action) {
      if (!singleLeadId) {
        return jsonResponse({ error: "pipeline_lead_id required" }, 400);
      }
      const result = await distributeSingleLead(supabase, supabaseUrl, serviceKey, singleLeadId, janela);
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

  const segmentoId = await resolveSegmento(supabase, lead.empreendimento);
  const targetJanela = forceJanela || getCurrentJanela();
  const todayStart = getTodayStartUTC();
  const todayStr = getTodayDateStr();

  // On Sunday (dia_todo), accept credenciamentos from any janela
  let credsQuery = supabase
    .from("roleta_credenciamentos")
    .select("corretor_id, segmento_1_id, segmento_2_id")
    .eq("data", todayStr)
    .eq("status", "aprovado")
    .is("saiu_em", null);
  
  if (targetJanela !== "dia_todo") {
    credsQuery = credsQuery.eq("janela", targetJanela);
  }

  const { data: creds } = await credsQuery;
  if (!creds || creds.length === 0) {
    return { success: false, reason: "no_credenciados" };
  }

  const corretorSegments = new Map<string, Set<string>>();
  for (const c of creds) {
    if (!corretorSegments.has(c.corretor_id)) corretorSegments.set(c.corretor_id, new Set());
    const segs = corretorSegments.get(c.corretor_id)!;
    if (c.segmento_1_id) segs.add(c.segmento_1_id);
    if (c.segmento_2_id) segs.add(c.segmento_2_id);
  }

  const eligibleProfileIds: string[] = [];
  for (const [profileId, segs] of corretorSegments.entries()) {
    if (!segmentoId || segs.has(segmentoId)) {
      eligibleProfileIds.push(profileId);
    }
  }

  if (eligibleProfileIds.length === 0) {
    return { success: false, reason: "no_corretor_available", segmento_id: segmentoId };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("id", eligibleProfileIds);

  const profileToAuth = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.user_id) profileToAuth.set(p.id, p.user_id);
  }

  const authIds = [...profileToAuth.values()];

      // FIX Bug 3: Count ALL distributions today (including timed-out) for fair balancing
      const { data: todayDistributions } = await supabase
        .from("distribuicao_historico")
        .select("corretor_id, pipeline_lead_id, created_at")
        .eq("acao", "distribuido")
        .gte("created_at", todayStart);

      const { data: todayLeads } = await supabase
        .from("pipeline_leads")
        .select("id, corretor_id, empreendimento")
        .in("corretor_id", authIds)
        .gte("distribuido_em", todayStart);

      const { data: activeLeadsData } = await supabase
        .from("pipeline_leads")
        .select("corretor_id")
        .in("corretor_id", authIds)
        .in("aceite_status", ["aceito", "pendente"]);

      const totalAtivosCount = new Map<string, number>();
      for (const uid of authIds) totalAtivosCount.set(uid, 0);
      for (const l of activeLeadsData || []) {
        totalAtivosCount.set(l.corretor_id, (totalAtivosCount.get(l.corretor_id) || 0) + 1);
      }

      const leadEmpreendimentoMap = new Map<string, string>();
      for (const l of todayLeads || []) {
        if (l.empreendimento) leadEmpreendimentoMap.set(l.id, l.empreendimento);
      }

      // Per-segment lead count based on ALL distributions
      const leadsCountBySegment = new Map<string, number>();
      const leadsCountGlobal = new Map<string, number>();
      const lastReceived = new Map<string, string>();
      for (const uid of authIds) leadsCountGlobal.set(uid, 0);

      for (const d of todayDistributions || []) {
        if (!authIds.includes(d.corretor_id)) continue;
        leadsCountGlobal.set(d.corretor_id, (leadsCountGlobal.get(d.corretor_id) || 0) + 1);
        const emp = leadEmpreendimentoMap.get(d.pipeline_lead_id);
        if (emp) {
          const seg = await resolveSegmento(supabase, emp);
          if (seg) {
            const key = `${d.corretor_id}::${seg}`;
            leadsCountBySegment.set(key, (leadsCountBySegment.get(key) || 0) + 1);
          }
        }
        const prev = lastReceived.get(d.corretor_id);
        if (!prev || d.created_at > prev) lastReceived.set(d.corretor_id, d.created_at);
      }

      // ── Exclude corretors who already timed out on this lead ──
      const excludeAuthIds = new Set<string>();
      if (excludeAuthUserId) excludeAuthIds.add(excludeAuthUserId);

      const { data: prevTimeouts } = await supabase
        .from("distribuicao_historico")
        .select("corretor_id")
        .eq("pipeline_lead_id", leadId)
        .eq("acao", "timeout");

      if (prevTimeouts && prevTimeouts.length > 0) {
        for (const t of prevTimeouts) {
          if (t.corretor_id) excludeAuthIds.add(t.corretor_id);
        }
        console.info(JSON.stringify({ fn: "distribute-lead", level: "info", msg: "Excluding timed-out corretors", ctx: { leadId, excluded: excludeAuthIds.size }, ts: new Date().toISOString() }));
      }

      const candidates: CorretorCandidate[] = [];
      for (const [profileId, authId] of profileToAuth.entries()) {
        if (excludeAuthIds.has(authId)) continue;
        const segKey = segmentoId ? `${authId}::${segmentoId}` : null;
        const leadsHojeSegmento = segKey ? (leadsCountBySegment.get(segKey) || 0) : (leadsCountGlobal.get(authId) || 0);
        candidates.push({
          corretorId: profileId,
          authUserId: authId,
          leadsHoje: leadsHojeSegmento,
          totalAtivos: totalAtivosCount.get(authId) || 0,
          lastReceivedAt: lastReceived.get(authId) || null,
        });
      }

      candidates.sort((a, b) => {
        if (a.leadsHoje !== b.leadsHoje) return a.leadsHoje - b.leadsHoje;
        if (a.totalAtivos !== b.totalAtivos) return a.totalAtivos - b.totalAtivos;
        if (!a.lastReceivedAt && b.lastReceivedAt) return -1;
        if (a.lastReceivedAt && !b.lastReceivedAt) return 1;
        if (a.lastReceivedAt && b.lastReceivedAt) return a.lastReceivedAt < b.lastReceivedAt ? -1 : 1;
        return 0;
      });

  if (candidates.length === 0) {
    return { success: false, reason: "no_corretor_available", segmento_id: segmentoId };
  }

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
    console.error(JSON.stringify({ fn: "distribute-lead", level: "error", msg: "Failed to assign single lead", ctx: { leadId }, err: { message: error.message }, ts: new Date().toISOString() }));
    // Note: logOps not available in this standalone function scope; error persisted via stdout
    return { success: false, reason: "update_failed", error: error.message };
  }

  // FIX Bug 2: Sync roleta_fila for single lead distribution
  if (segmentoId) {
    supabase.rpc("increment_roleta_fila", {
      p_corretor_profile_id: chosen.corretorId,
      p_segmento_id: segmentoId,
      p_data: getTodayDateStr(),
    }).then((r: any) => { if (r?.error) console.warn("roleta_fila sync:", r.error.message); });
  }

  // Log in distribuicao_historico for fair counting
  await supabase.from("distribuicao_historico").insert({
    pipeline_lead_id: leadId,
    corretor_id: chosen.authUserId,
    segmento_id: segmentoId ? undefined : undefined, // pipeline_segmentos FK
    acao: "distribuido",
  }).then(r => { if (r.error) console.warn("distribuicao_historico insert:", r.error.message); });

  const distRes = await supabase.from("roleta_distribuicoes").insert({
    lead_id: leadId,
    corretor_id: chosen.corretorId,
    segmento_id: segmentoId,
    janela: targetJanela,
    status: "aguardando",
    enviado_em: now.toISOString(),
    expira_em: expireAt.toISOString(),
    avisos_enviados: 0,
  });
  if (distRes.error) console.warn("roleta_distribuicoes insert:", distRes.error.message);

  const notifRes = await supabase.from("notifications").insert({
    user_id: chosen.authUserId,
    tipo: "lead",
    categoria: "lead_novo",
    titulo: `🚨 Novo Lead! ${lead.nome || ""}`.trim(),
    mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}${lead.origem ? ` (${lead.origem})` : ""}. Aceite em 10 minutos!`,
    dados: { pipeline_lead_id: leadId, lead_nome: lead.nome, empreendimento: lead.empreendimento, origem: lead.origem },
    agrupamento_key: `lead_novo_${leadId}`,
  });
  if (notifRes.error) console.warn("notification insert:", notifRes.error.message);

  try { await sendWhatsApp(supabase, supabaseUrl, serviceKey, chosen.authUserId, lead); } catch (e) { console.warn("WhatsApp error:", e); }
  try { await sendPush(supabaseUrl, serviceKey, chosen.authUserId, lead); } catch (e) { console.warn("Push error:", e); }

  return { success: true, corretor_id: chosen.authUserId, segmento_id: segmentoId };
}

// ─── Accept / Reject handler (now using atomic RPCs) ───
async function handleAcceptReject(supabase: any, body: any, userId: string, supabaseUrl: string, serviceKey: string) {
  const { action, pipeline_lead_id, status_inicial, motivo } = body;

  if (action === "aceitar") {
    // Use atomic RPC instead of direct update
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
      console.log(`Lead acceptance rejected: ${JSON.stringify(result)}`);
      return jsonResponse(result);
    }

    // Post-acceptance: notification (non-blocking)
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
        titulo: `✅ Lead aceito! ${leadData.nome || ""}`.trim(),
        mensagem: `${leadData.nome || "Lead"}${leadData.empreendimento ? ` — ${leadData.empreendimento}` : ""}. Faça o primeiro contato agora!`,
        dados: { pipeline_lead_id, lead_nome: leadData.nome, empreendimento: leadData.empreendimento },
        agrupamento_key: `lead_aceito_${pipeline_lead_id}`,
      }).then(r => { if (r.error) console.warn("notification insert:", r.error.message); });
    }

    return jsonResponse({ success: true });
  }

  if (action === "rejeitar") {
    // Use atomic RPC instead of direct update
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

    // Try to redistribute immediately, excluding the broker who just rejected
    const redistResult = await distributeSingleLead(supabase, supabaseUrl, serviceKey, pipeline_lead_id, undefined, userId);
    console.log(`Redistribution after reject (excluded ${userId}):`, JSON.stringify(redistResult));

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

function getTodayStartUTC(): string {
  const now = new Date();
  const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brDate.getUTCFullYear();
  const m = String(brDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T03:00:00.000Z`;
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
