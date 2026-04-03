import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Structured logger with trace support
function _emit(level: string, msg: string, traceId?: string, ctx?: Record<string, unknown>, err?: unknown) {
  const payload = { fn: "lead-escalation", level, msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() };
  level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
}

function makeLogger(traceId: string) {
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => _emit("info", msg, traceId, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("warn", msg, traceId, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("error", msg, traceId, ctx, err),
  };
}

async function sendPush(supabaseUrl: string, serviceKey: string, userId: string, title: string, body: string, data?: Record<string, any>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, title, body, data, url: "/aceite-leads" }),
    });
  } catch (err) {
    console.error("Push send error:", err);
  }
}

async function sendWhatsApp(supabaseUrl: string, serviceKey: string, telefone: string, tipo: string, dados: Record<string, any>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-notificacao`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telefone, tipo, dados }),
    });
  } catch (err) {
    console.error("WhatsApp send error:", err);
  }
}

async function distributeWithRetry(
  supabaseUrl: string,
  serviceKey: string,
  leadId: string,
  traceId: string,
  maxRetries = 2,
  supabase?: any,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Idempotency guard: re-check lead status before each retry attempt
    if (attempt > 0 && supabase) {
      const { data: check } = await supabase
        .from("pipeline_leads")
        .select("aceite_status, corretor_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!check || check.aceite_status !== "pendente_distribuicao" || check.corretor_id) {
        _emit("info", `Retry ${attempt} skipped — lead already handled`, traceId, { leadId, status: check?.aceite_status });
        return true; // Not a failure — lead was handled by another path
      }
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "x-trace-id": traceId,
        },
        body: JSON.stringify({ action: "distribute_single", pipeline_lead_id: leadId }),
      });
      if (resp.ok) return true;
      const body = await resp.text().catch(() => "");
      _emit("warn", `distribute-lead attempt ${attempt} failed (${resp.status})`, traceId, { leadId, body });
    } catch (err) {
      _emit("warn", `distribute-lead attempt ${attempt} error`, traceId, { leadId }, err);
    }

    if (attempt < maxRetries) {
      // Exponential backoff with jitter: ~1s, ~2.5s
      const baseMs = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, baseMs + jitter));
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const L = makeLogger(traceId);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: "lead-escalation", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // 1. Run the DB-level escalation (creates in-app notifications)
    const { data: escalationCount, error: escError } = await supabase.rpc(
      "escalonar_notificacoes_leads"
    );
    if (escError) {
      L.error("Escalation RPC failed", {}, escError);
      logOps("error", "system", "Escalation RPC failed", {}, escError.message);
    }

    // 2. Send push + WhatsApp for leads at escalation thresholds
    // Fetch leads currently pending acceptance with their escalation state
    const { data: pendingLeads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, empreendimento, corretor_id, distribuido_em, escalation_level, last_escalation_at")
      .in("aceite_status", ["pendente", "aguardando_aceite"])
      .not("corretor_id", "is", null)
      .not("distribuido_em", "is", null);

    let pushSent = 0;

    if (pendingLeads && pendingLeads.length > 0) {
      for (const lead of pendingLeads) {
        const mins = (Date.now() - new Date(lead.distribuido_em).getTime()) / 60000;
        const lastEsc = lead.last_escalation_at ? new Date(lead.last_escalation_at).getTime() : 0;
        const sinceLast = (Date.now() - lastEsc) / 1000; // seconds since last escalation

        // Only send push/WhatsApp if the escalation just happened (within last 90s)
        if (sinceLast > 90) continue;

        // Level 1 (2min) → Push + WhatsApp to corretor
        if (lead.escalation_level === 1 && mins >= 2 && mins < 4) {
          // Get corretor phone
          const { data: profile } = await supabase
            .from("profiles")
            .select("telefone, nome")
            .eq("user_id", lead.corretor_id)
            .maybeSingle();

          await sendPush(supabaseUrl, serviceKey, lead.corretor_id,
            "⚡ Lead aguardando aceite há 2 min!",
            `Aceite ${lead.nome || "o lead"} AGORA ou será redistribuído.`,
            { lead_id: lead.id, urgencia: "alta" }
          );

          if (profile?.telefone) {
            await sendWhatsApp(supabaseUrl, serviceKey, profile.telefone, "sla_urgente", {
              nome: lead.nome || "Lead",
              empreendimento: lead.empreendimento || "N/A",
              minutos: "2",
              corretor: profile.nome || "Corretor",
            });
          }
          pushSent++;
        }

        // Level 2 (4min) → Push + WhatsApp to corretor + Notify gerente
        if (lead.escalation_level === 2 && mins >= 4) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("telefone, nome, gerente_id")
            .eq("user_id", lead.corretor_id)
            .maybeSingle();

          // Push to corretor
          await sendPush(supabaseUrl, serviceKey, lead.corretor_id,
            "🚨 ÚLTIMO ALERTA — Lead será redistribuído!",
            `${lead.nome || "Lead"} será redistribuído em instantes. Aceite AGORA!`,
            { lead_id: lead.id, urgencia: "critica" }
          );

          if (profile?.telefone) {
            await sendWhatsApp(supabaseUrl, serviceKey, profile.telefone, "sla_ultimo_aviso", {
              nome: lead.nome || "Lead",
              empreendimento: lead.empreendimento || "N/A",
              corretor: profile.nome || "Corretor",
            });
          }

          // Notify ONLY the corretor's gerente + CEOs (not all gerentes)
          const gestoresToNotify: { user_id: string; telefone: string | null; nome: string | null }[] = [];

          // Find the corretor's gerente via team_members
          if (profile) {
            const { data: teamMember } = await supabase
              .from("team_members")
              .select("gerente_id")
              .eq("user_id", lead.corretor_id)
              .maybeSingle();

            if (teamMember?.gerente_id) {
              // Get gerente's profile (gerente_id in team_members = profiles.id)
              const { data: gerenteProfile } = await supabase
                .from("profiles")
                .select("user_id, telefone, nome")
                .eq("id", teamMember.gerente_id)
                .maybeSingle();
              if (gerenteProfile?.user_id) gestoresToNotify.push(gerenteProfile);
            }
          }

          // Also notify CEOs/admins
          const { data: ceos } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          for (const ceo of ceos || []) {
            // Avoid duplicates if gerente is also admin
            if (gestoresToNotify.some(g => g.user_id === ceo.user_id)) continue;
            const { data: ceoProfile } = await supabase
              .from("profiles")
              .select("user_id, telefone, nome")
              .eq("user_id", ceo.user_id)
              .maybeSingle();
            if (ceoProfile?.user_id) gestoresToNotify.push(ceoProfile);
          }

          for (const gerente of gestoresToNotify) {
            if (!gerente.user_id) continue;
            // In-app notification
            await supabase.from("notifications").insert({
              user_id: gerente.user_id,
              tipo: "lead_ultimo_alerta",
              categoria: "leads",
              titulo: "🚨 Lead sem aceite há 4 min!",
              mensagem: `${profile?.nome || "Corretor"} não aceitou ${lead.nome || "lead"} (${lead.empreendimento || "N/A"}). Redistribuição iminente.`,
              dados: { lead_id: lead.id, corretor_id: lead.corretor_id, corretor_nome: profile?.nome },
              cargo_destino: ["gerente", "ceo", "admin"],
            } as any);

            // Push to gerente
            await sendPush(supabaseUrl, serviceKey, gerente.user_id,
              "🚨 Lead sem aceite há 4 min!",
              `${profile?.nome || "Corretor"} não aceitou ${lead.nome || "lead"}. Redistribuição iminente.`,
              { lead_id: lead.id }
            );
          }
          pushSent++;
        }
      }
    }

    // 3. Detect stale leads (Motor 4)
    const { data: staleCount, error: staleError } = await supabase.rpc(
      "detectar_leads_parados"
    );
    if (staleError) L.error("Stale detection RPC failed", {}, staleError);

    // 4. Recycle expired acceptance leads
    const { data: recycledCount, error: recycleError } = await supabase.rpc(
      "reciclar_leads_expirados"
    );
    if (recycleError) L.error("Recycle RPC failed", {}, recycleError);

    // 4b. Auto-redistribute recycled leads + notify CEO/gerentes
    if (recycledCount && recycledCount > 0) {
      try {
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: expiredLeads } = await supabase
          .from("distribuicao_historico")
          .select("pipeline_lead_id, corretor_id")
          .eq("acao", "timeout")
          .gte("created_at", twoMinAgo);

        if (expiredLeads && expiredLeads.length > 0) {
          // Get all CEOs/admins once
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));

          for (const expired of expiredLeads) {
            const { data: corretorProfile } = await supabase
              .from("profiles")
              .select("nome")
              .eq("user_id", expired.corretor_id)
              .maybeSingle();

            const { data: leadData } = await supabase
              .from("pipeline_leads")
              .select("nome, empreendimento, aceite_status")
              .eq("id", expired.pipeline_lead_id)
              .maybeSingle();

            if (!leadData) continue;

            // ── AUTO-REDISTRIBUTE with retry + duplicate guard ──
            if (leadData.aceite_status === "pendente_distribuicao") {
              // Re-check status right before distributing to avoid duplicate assignment
              const { data: freshLead } = await supabase
                .from("pipeline_leads")
                .select("aceite_status, corretor_id")
                .eq("id", expired.pipeline_lead_id)
                .maybeSingle();

              if (freshLead?.aceite_status !== "pendente_distribuicao") {
                L.info("Skip redistribute — status changed", { leadId: expired.pipeline_lead_id, status: freshLead?.aceite_status });
              } else {
                const ok = await distributeWithRetry(supabaseUrl, serviceKey, expired.pipeline_lead_id, traceId, 2, supabase);
                if (ok) {
                  L.info("Auto-redistribute succeeded", { leadId: expired.pipeline_lead_id });
                } else {
                  L.warn("Auto-redistribute failed after retries", { leadId: expired.pipeline_lead_id });
                  logOps("error", "business", "Auto-redistribute failed after retries", { lead_id: expired.pipeline_lead_id }, "All retry attempts exhausted");
                }
              }
            }

            // Notify CEO/gerentes
            const recipientIds = new Set<string>();
            const { data: teamMember } = await supabase
              .from("team_members")
              .select("gerente_id")
              .eq("user_id", expired.corretor_id)
              .maybeSingle();

            if (teamMember?.gerente_id) {
              const { data: gProfile } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("id", teamMember.gerente_id)
                .maybeSingle();
              if (gProfile?.user_id) recipientIds.add(gProfile.user_id);
            }
            for (const uid of adminUserIds) recipientIds.add(uid);

            for (const recipientId of recipientIds) {
              const { data: gestorProfile } = await supabase
                .from("profiles")
                .select("user_id, telefone, nome")
                .eq("user_id", recipientId)
                .maybeSingle();
              if (!gestorProfile) continue;

              if (gestorProfile.telefone) {
                await sendWhatsApp(supabaseUrl, serviceKey, gestorProfile.telefone, "lead_expirado_ceo", {
                  corretor: corretorProfile?.nome || "Desconhecido",
                  nome: leadData.nome || "Lead",
                  empreendimento: leadData.empreendimento || "Não identificado",
                  motivo: "Tempo de aceite expirado (10 min)",
                });
              }

              await sendPush(supabaseUrl, serviceKey, gestorProfile.user_id,
                "⏱️ Lead redistribuído — timeout",
                `${corretorProfile?.nome || "Corretor"} não aceitou ${leadData.nome || "lead"} em 10 min. Redistribuindo.`,
                { lead_id: expired.pipeline_lead_id }
              );
            }
          }
        }
      } catch (notifyErr) {
        L.error("CEO notification error (non-blocking)", {}, notifyErr);
      }
    }

    // 4c. Sweep stuck leads — catch pendente_distribuicao that 4b missed (previous retry failures)
    let stuckRedistributed = 0;
    try {
      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const { data: stuckLeads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento")
        .eq("aceite_status", "pendente_distribuicao")
        .is("corretor_id", null)
        .lt("updated_at", threeMinAgo)    // stuck for >3 min (not being handled by 4b)
        .gt("updated_at", thirtyMinAgo);  // cap at 30 min to avoid ancient orphans

      if (stuckLeads && stuckLeads.length > 0) {
        for (const stuck of stuckLeads) {
          // Cap: check how many timeout entries exist for this lead (max 5 total redistribute attempts)
          const { count } = await supabase
            .from("distribuicao_historico")
            .select("id", { count: "exact", head: true })
            .eq("pipeline_lead_id", stuck.id)
            .eq("acao", "timeout");

          if ((count || 0) >= 5) {
            L.warn("Stuck lead exceeded max redistribute attempts — requires manual intervention", { leadId: stuck.id, attempts: count });
            logOps("warn", "business", "Stuck lead max attempts reached", { lead_id: stuck.id, attempts: count }, "Requires manual CEO queue assignment");
            continue;
          }

          // Double-check status atomically before calling distribute
          const { data: freshCheck } = await supabase
            .from("pipeline_leads")
            .select("aceite_status, corretor_id")
            .eq("id", stuck.id)
            .maybeSingle();

          if (freshCheck?.aceite_status !== "pendente_distribuicao" || freshCheck?.corretor_id) {
            L.info("Stuck sweep — status changed, skipping", { leadId: stuck.id, status: freshCheck?.aceite_status });
            continue;
          }

          const ok = await distributeWithRetry(supabaseUrl, serviceKey, stuck.id, traceId, 2, supabase);
          if (ok) {
            stuckRedistributed++;
            L.info("Stuck lead redistributed successfully", { leadId: stuck.id, previousAttempts: count });
          } else {
            L.warn("Stuck lead redistribute failed — will retry next cycle", { leadId: stuck.id, attempt: (count || 0) + 1 });
            logOps("warn", "business", "Stuck lead redistribute retry failed", { lead_id: stuck.id, attempt: (count || 0) + 1 }, "Will retry next cron cycle");
          }
        }
      }
    } catch (stuckErr) {
      L.error("Stuck leads sweep error (non-blocking)", {}, stuckErr);
    }

    // 5. Clean expired OA locks
    const { data: cleanedCount, error: cleanError } = await supabase.rpc(
      "cleanup_expired_locks"
    );
    if (cleanError) L.error("Cleanup RPC failed", {}, cleanError);

    const result = {
      escalated: escalationCount || 0,
      push_sent: pushSent,
      stale_alerts: staleCount || 0,
      recycled: recycledCount || 0,
      stuck_redistributed: stuckRedistributed,
      locks_cleaned: cleanedCount || 0,
      timestamp: new Date().toISOString(),
    };

    L.info("Lead escalation run", result);
    if (result.escalated > 0 || result.recycled > 0 || result.stuck_redistributed > 0) {
      logOps("info", "business", `Escalation run: ${result.escalated} escalated, ${result.recycled} recycled, ${result.stuck_redistributed} stuck retried`, result as unknown as Record<string, unknown>);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    _emit("error", "Unhandled exception", undefined, {}, err);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: "lead-escalation", level: "error", category: "system", message: "Unhandled exception", trace_id: null, ctx: {}, error_detail: err instanceof Error ? err.message : String(err) }).then(() => {});
    } catch {}
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
