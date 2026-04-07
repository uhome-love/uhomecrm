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

    // 4. Recycle expired acceptance leads — now returns lead details for auto-redistribution
    const { data: recycledLeads, error: recycleError } = await supabase.rpc(
      "reciclar_leads_expirados"
    );
    const recycledCount = recycledLeads?.length || 0;
    if (recycleError) L.error("Recycle RPC failed", {}, recycleError);

    // 4b. Auto-redistribute expired leads to next eligible broker
    let autoRedistributed = 0;
    let sentToCeoQueue = 0;

    if (recycledLeads && recycledLeads.length > 0) {
      for (const expired of recycledLeads) {
        // Try to redistribute via the distribution engine
        const distributed = await distributeWithRetry(
          supabaseUrl, serviceKey, expired.lead_id, traceId, 1, supabase
        );

        if (distributed) {
          // Check if it was actually assigned or fell to CEO queue
          const { data: check } = await supabase
            .from("pipeline_leads")
            .select("aceite_status, corretor_id")
            .eq("id", expired.lead_id)
            .maybeSingle();

          if (check?.corretor_id && check.aceite_status === "aguardando_aceite") {
            autoRedistributed++;
            L.info("Lead auto-redistributed after timeout", {
              leadId: expired.lead_id,
              previousBroker: expired.corretor_anterior,
              newBroker: check.corretor_id,
            });

            // Notify the previous broker they lost the lead
            if (expired.corretor_anterior) {
              await supabase.from("notifications").insert({
                user_id: expired.corretor_anterior,
                tipo: "lead_timeout_redistribuido",
                categoria: "leads",
                titulo: "⏱️ Lead redistribuído por timeout",
                mensagem: `${expired.lead_nome || "Lead"} (${expired.lead_empreendimento || "N/A"}) foi redistribuído após expirar o tempo de aceite.`,
                dados: { lead_id: expired.lead_id },
                cargo_destino: ["corretor"],
              } as any);

              await sendPush(supabaseUrl, serviceKey, expired.corretor_anterior,
                "⏱️ Lead redistribuído",
                `${expired.lead_nome || "Lead"} foi redistribuído por timeout.`,
                { lead_id: expired.lead_id }
              );
            }
          } else {
            // No broker available — stays in CEO queue
            sentToCeoQueue++;
            L.info("Lead sent to CEO queue — no eligible broker", {
              leadId: expired.lead_id,
              previousBroker: expired.corretor_anterior,
            });

            // Notify CEO/gerentes only when no broker is available
            try {
              const { data: adminRoles } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "admin");

              const recipientIds = new Set<string>();

              // Find corretor's gerente
              if (expired.corretor_anterior) {
                const { data: tm } = await supabase
                  .from("team_members")
                  .select("gerente_id")
                  .eq("user_id", expired.corretor_anterior)
                  .maybeSingle();
                if (tm?.gerente_id) {
                  const { data: gp } = await supabase
                    .from("profiles")
                    .select("user_id")
                    .eq("id", tm.gerente_id)
                    .maybeSingle();
                  if (gp?.user_id) recipientIds.add(gp.user_id);
                }
              }
              for (const admin of adminRoles || []) recipientIds.add(admin.user_id);

              const { data: corretorProfile } = expired.corretor_anterior
                ? await supabase.from("profiles").select("nome").eq("user_id", expired.corretor_anterior).maybeSingle()
                : { data: null };

              for (const recipientId of recipientIds) {
                await supabase.from("notifications").insert({
                  user_id: recipientId,
                  tipo: "lead_expirado_sem_corretor",
                  categoria: "leads",
                  titulo: "⏱️ Lead expirado — sem corretor disponível",
                  mensagem: `${corretorProfile?.nome || "Corretor"} não aceitou ${expired.lead_nome || "lead"} (${expired.lead_empreendimento || "N/A"}). Sem corretores elegíveis — aguardando despacho manual.`,
                  dados: { lead_id: expired.lead_id, corretor_anterior: expired.corretor_anterior },
                  cargo_destino: ["gerente", "ceo", "admin"],
                } as any);

                await sendPush(supabaseUrl, serviceKey, recipientId,
                  "⏱️ Lead sem corretor disponível",
                  `${expired.lead_nome || "Lead"} expirou e não há corretor elegível. Despacho manual necessário.`,
                  { lead_id: expired.lead_id }
                );
              }
            } catch (notifyErr) {
              L.error("CEO notification error (non-blocking)", {}, notifyErr);
            }
          }
        } else {
          sentToCeoQueue++;
          L.warn("Distribute retry failed for expired lead", { leadId: expired.lead_id });
        }
      }

      logOps("info", "business",
        `Expired leads: ${recycledCount} recycled, ${autoRedistributed} auto-redistributed, ${sentToCeoQueue} to CEO queue`,
        { recycledCount, autoRedistributed, sentToCeoQueue } as unknown as Record<string, unknown>
      );
    }

    const stuckRedistributed = autoRedistributed;

    // 4d. Reciclar leads "Sem Contato" inativos há 48h
    let semContatoRecycled = 0;
    try {
      const { data: recycledSemContato, error: scError } = await supabase.rpc("reciclar_leads_sem_contato");
      if (scError) {
        L.error("Sem Contato recycle RPC failed", {}, scError);
      } else if (recycledSemContato && recycledSemContato.length > 0) {
        semContatoRecycled = recycledSemContato.length;
        L.info("Sem Contato leads recycled", { count: semContatoRecycled });

        for (const item of recycledSemContato) {
          // Tentar redistribuir pela roleta
          await distributeWithRetry(supabaseUrl, serviceKey, item.lead_id, traceId, 1, supabase);

          // Notificar corretor original (in-app)
          if (item.corretor_anterior) {
            await supabase.from("notifications").insert({
              user_id: item.corretor_anterior,
              tipo: "lead_reciclado_sem_contato",
              categoria: "leads",
              titulo: `🔄 Lead redistribuído por inatividade`,
              mensagem: `${item.lead_nome || "Lead"} (${item.lead_empreendimento || "N/A"}) foi redistribuído após 48h sem contato.`,
              dados: { lead_id: item.lead_id },
              cargo_destino: ["corretor"],
            } as any);

            // Push ao corretor
            await sendPush(supabaseUrl, serviceKey, item.corretor_anterior,
              "🔄 Lead redistribuído",
              `${item.lead_nome || "Lead"} foi redistribuído por inatividade 48h.`,
              { lead_id: item.lead_id }
            );

            // Notificar gerente do corretor
            const { data: tm } = await supabase
              .from("team_members")
              .select("gerente_id")
              .eq("user_id", item.corretor_anterior)
              .maybeSingle();
            if (tm?.gerente_id) {
              const { data: gp } = await supabase
                .from("profiles")
                .select("user_id, nome")
                .eq("id", tm.gerente_id)
                .maybeSingle();
              if (gp?.user_id) {
                const { data: corretorProfile } = await supabase
                  .from("profiles")
                  .select("nome")
                  .eq("user_id", item.corretor_anterior)
                  .maybeSingle();
                await supabase.from("notifications").insert({
                  user_id: gp.user_id,
                  tipo: "lead_reciclado_sem_contato",
                  categoria: "leads",
                  titulo: `🔄 Lead sem contato redistribuído`,
                  mensagem: `${corretorProfile?.nome || "Corretor"} perdeu ${item.lead_nome || "lead"} por inatividade 48h. Redistribuído automaticamente.`,
                  dados: { lead_id: item.lead_id, corretor_id: item.corretor_anterior },
                  cargo_destino: ["gerente"],
                } as any);
              }
            }
          }
        }

        logOps("info", "business", `Sem Contato recycled: ${semContatoRecycled} leads`, { count: semContatoRecycled });
      }
    } catch (scErr) {
      L.error("Sem Contato recycling error (non-blocking)", {}, scErr);
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
      recycled: recycledCount,
      auto_redistributed: autoRedistributed,
      sent_to_ceo_queue: sentToCeoQueue,
      sem_contato_recycled: semContatoRecycled,
      stuck_redistributed: stuckRedistributed,
      locks_cleaned: cleanedCount || 0,
      timestamp: new Date().toISOString(),
    };

    L.info("Lead escalation run", result);
    if (result.escalated > 0 || result.recycled > 0 || result.sem_contato_recycled > 0 || result.auto_redistributed > 0) {
      logOps("info", "business", `Escalation run: ${result.escalated} escalated, ${result.recycled} recycled (${result.auto_redistributed} auto, ${result.sent_to_ceo_queue} CEO), ${result.sem_contato_recycled} sem_contato`, result as unknown as Record<string, unknown>);
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
