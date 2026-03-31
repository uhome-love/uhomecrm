import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "execute-automations", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    // ── Overlap guard ──
    const guardCutoff = new Date(Date.now() - 50_000).toISOString();
    const { data: recentRun } = await supabase
      .from("ops_events")
      .select("id, trace_id")
      .eq("fn", "execute-automations")
      .eq("category", "guard")
      .eq("message", "run_start")
      .gte("created_at", guardCutoff)
      .limit(1);

    if (recentRun && recentRun.length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "overlap_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("ops_events").insert({
      fn: "execute-automations", level: "info", category: "guard",
      message: "run_start", trace_id: traceId, ctx: {}, error_detail: null,
    });

    const { data: automations, error: autoErr } = await supabase
      .from("automations")
      .select("*")
      .eq("is_active", true);

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No active automations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let totalExecuted = 0;

    for (const auto of automations) {
      try {
        let matchedLeads: any[] = [];

        switch (auto.trigger_type) {
          case "lead_no_contact": {
            const hoursThreshold = auto.trigger_config?.hours || 24;
            const cutoff = new Date(now.getTime() - hoursThreshold * 60 * 60 * 1000).toISOString();
            const { data: leads } = await supabase
              .from("pipeline_leads")
              .select("id, nome, telefone, email, empreendimento, corretor_id, segmento_id, origem, stage_changed_at, conversation_window_until")
              .lt("stage_changed_at", cutoff)
              .order("stage_changed_at", { ascending: true })
              .limit(50);
            matchedLeads = leads || [];
            break;
          }

          case "lead_arrived": {
            const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
            const { data: leads } = await supabase
              .from("pipeline_leads")
              .select("id, nome, telefone, email, empreendimento, corretor_id, segmento_id, origem, created_at, conversation_window_until")
              .gt("created_at", fiveMinAgo)
              .limit(50);
            matchedLeads = leads || [];
            break;
          }

          case "deal_lost": {
            const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
            const { data: history } = await supabase
              .from("pipeline_historico")
              .select("pipeline_lead_id, stage_novo_id, created_at")
              .gt("created_at", fiveMinAgo);
            
            if (history && history.length > 0) {
              const { data: stages } = await supabase
                .from("pipeline_stages")
                .select("id")
                .eq("tipo", "caiu");
              const caiuIds = new Set((stages || []).map(s => s.id));
              const leadIds = history
                .filter(h => caiuIds.has(h.stage_novo_id))
                .map(h => h.pipeline_lead_id);
              
              if (leadIds.length > 0) {
                const { data: leads } = await supabase
                  .from("pipeline_leads")
                  .select("id, nome, telefone, email, empreendimento, corretor_id, segmento_id, origem, conversation_window_until")
                  .in("id", leadIds);
                matchedLeads = leads || [];
              }
            }
            break;
          }

          default:
            continue;
        }

        // Apply conditions
        if (auto.conditions && auto.conditions.length > 0) {
          for (const cond of auto.conditions) {
            if (cond.field === "segmento" && cond.value) {
              matchedLeads = matchedLeads.filter(l => l.segmento_id === cond.value);
            }
            if (cond.field === "origem" && cond.value) {
              matchedLeads = matchedLeads.filter(l =>
                (l.origem || "").toLowerCase().includes(cond.value.toLowerCase())
              );
            }
            if (cond.field === "empreendimento" && cond.value) {
              matchedLeads = matchedLeads.filter(l =>
                (l.empreendimento || "").toLowerCase().includes(cond.value.toLowerCase())
              );
            }
          }
        }

        // Deduplicate: check if already executed today
        if (auto.trigger_type !== "cron" && matchedLeads.length > 0) {
          const { data: existingLogs } = await supabase
            .from("automation_logs")
            .select("lead_id")
            .eq("automation_id", auto.id)
            .gte("triggered_at", todayStr + "T00:00:00Z")
            .eq("status", "success");

          const executedLeadIds = new Set((existingLogs || []).map(l => l.lead_id));
          matchedLeads = matchedLeads.filter(l => !executedLeadIds.has(l.id));
        }

        // Execute actions for each matched lead
        for (const lead of matchedLeads) {
          const executedActions: string[] = [];

          for (const action of auto.actions || []) {
            try {
              switch (action.type) {
                case "create_activity": {
                  const hours = action.activity_hours || 2;
                  const dueDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
                  await supabase.from("pipeline_atividades").insert({
                    pipeline_lead_id: lead.id,
                    titulo: action.activity_title || "Tarefa automática",
                    tipo: "tarefa",
                    data: dueDate.toISOString().slice(0, 10),
                    hora: dueDate.toTimeString().slice(0, 5),
                    created_by: auto.created_by,
                  });
                  executedActions.push("create_activity");
                  break;
                }

                case "move_lead": {
                  if (action.stage_id) {
                    await supabase
                      .from("pipeline_leads")
                      .update({ stage_id: action.stage_id, stage_changed_at: now.toISOString() })
                      .eq("id", lead.id);
                    await supabase.from("pipeline_historico").insert({
                      pipeline_lead_id: lead.id,
                      stage_novo_id: action.stage_id,
                      movido_por: auto.created_by,
                      observacao: `Automação: ${auto.name}`,
                    });
                    executedActions.push("move_lead");
                  }
                  break;
                }

                case "notify_manager": {
                  const notifyMsg = (action.notify_text || `Lead ${lead.nome} precisa de atenção`)
                    .replace(/\{\{nome\}\}/g, lead.nome || "Lead");
                  await supabase.from("notifications").insert({
                    user_id: auto.created_by,
                    titulo: lead.nome ? `⚙️ ${lead.nome} — ${auto.name}` : `Automação: ${auto.name}`,
                    mensagem: notifyMsg,
                    tipo: "automacao",
                    categoria: "pipeline",
                    dados: { pipeline_lead_id: lead.id, lead_id: lead.id, lead_nome: lead.nome, automation_id: auto.id },
                  });
                  executedActions.push("notify_manager");
                  break;
                }

                // ── Bloco 3: Real WhatsApp dispatch ──
                case "whatsapp": {
                  const leadPhone = lead.telefone;
                  if (!leadPhone) {
                    console.warn(`WhatsApp action skipped: lead ${lead.id} has no phone`);
                    break;
                  }

                  // Check if 24h conversation window is open
                  const windowOpen = lead.conversation_window_until && new Date(lead.conversation_window_until) > now;

                  let waBody: Record<string, any>;
                  if (windowOpen && action.message) {
                    // Free-text message within 24h window
                    const msg = (action.message || "Olá {{nome}}, temos novidades para você!")
                      .replace(/\{\{nome\}\}/g, lead.nome?.split(" ")[0] || "Cliente")
                      .replace(/\{\{empreendimento\}\}/g, lead.empreendimento || "nosso empreendimento");
                    waBody = { telefone: leadPhone, mensagem: msg };
                  } else {
                    // Template message (outside 24h window)
                    const templateName = action.template_name || "hello_world";
                    waBody = {
                      telefone: leadPhone,
                      template: {
                        name: templateName,
                        language: action.template_language || "pt_BR",
                        parameters: {
                          nome: lead.nome?.split(" ")[0] || "Cliente",
                          empreendimento: lead.empreendimento || "nosso empreendimento",
                        },
                      },
                    };
                  }

                  try {
                    const waResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${serviceKey}`,
                      },
                      body: JSON.stringify(waBody),
                    });

                    const waResult = await waResponse.json();

                    if (waResponse.ok && waResult.success) {
                      executedActions.push("whatsapp");

                      // Register in timeline
                      await supabase.from("pipeline_atividades").insert({
                        pipeline_lead_id: lead.id,
                        tipo: "nurturing_sequencia",
                        titulo: `📨 WhatsApp automático — ${auto.name}`,
                        descricao: windowOpen ? `Mensagem livre (janela 24h): "${(waBody.mensagem || '').slice(0, 100)}"` : `Template: ${waBody.template?.name || 'N/A'}`,
                        data: now.toISOString().slice(0, 10),
                        status: "concluida",
                        created_by: auto.created_by,
                      });
                    } else {
                      console.error(`WhatsApp send failed for lead ${lead.id}:`, waResult.error);
                      logOps("warn", "business", `WhatsApp failed for automation ${auto.name}`, { lead_id: lead.id, error: waResult.error });
                    }
                  } catch (waErr: any) {
                    console.error(`WhatsApp send exception for lead ${lead.id}:`, waErr.message);
                  }
                  break;
                }

                case "redistribute": {
                  executedActions.push("redistribute");
                  break;
                }
              }
            } catch (actionErr) {
              console.error(`Action ${action.type} failed:`, actionErr);
            }
          }

          // Log execution
          await supabase.from("automation_logs").insert({
            automation_id: auto.id,
            lead_id: lead.id,
            actions_executed: executedActions.map(a => ({ type: a })),
            status: "success",
          });

          totalExecuted++;
        }

        // Update automation stats
        if (matchedLeads.length > 0) {
          await supabase
            .from("automations")
            .update({
              last_run_at: now.toISOString(),
              run_count: (auto.run_count || 0) + matchedLeads.length,
            })
            .eq("id", auto.id);
        }
      } catch (err) {
        console.error(`Automation ${auto.id} failed:`, err);
        logOps("error", "system", `Automation ${auto.name} failed`, { automation_id: auto.id }, err.message || "Unknown error");
        await supabase.from("automation_logs").insert({
          automation_id: auto.id,
          actions_executed: [],
          status: "error",
          error_message: err.message || "Unknown error",
        });
      }
    }

    if (totalExecuted > 0) {
      logOps("info", "business", `Automations run: ${totalExecuted} actions executed`, { totalExecuted });
    }

    return new Response(JSON.stringify({ success: true, totalExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logOps("error", "system", "Unhandled exception", {}, error.message || "Unknown");
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
