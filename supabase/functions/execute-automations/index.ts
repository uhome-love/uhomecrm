import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: "execute-automations", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // Fetch all active automations
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
              .select("id, nome, telefone, empreendimento, corretor_id, segmento_id, origem, stage_changed_at")
              .lt("stage_changed_at", cutoff)
              .order("stage_changed_at", { ascending: true })
              .limit(50);
            matchedLeads = leads || [];
            break;
          }

          case "lead_arrived": {
            // Check leads created in the last 5 minutes
            const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
            const { data: leads } = await supabase
              .from("pipeline_leads")
              .select("id, nome, telefone, empreendimento, corretor_id, segmento_id, origem, created_at")
              .gt("created_at", fiveMinAgo)
              .limit(50);
            matchedLeads = leads || [];
            break;
          }

          case "deal_lost": {
            // Check leads moved to "caiu" stages in last 5 minutes
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
                  .select("id, nome, telefone, empreendimento, corretor_id, segmento_id, origem")
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

        // Deduplicate: check if already executed today for each lead (non-cron)
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
                  await supabase.from("notifications").insert({
                    user_id: auto.created_by,
                    titulo: `Automação: ${auto.name}`,
                    mensagem: action.notify_text || `Ação disparada para lead ${lead.nome}`,
                    tipo: "automacao",
                    categoria: "pipeline",
                    dados: { lead_id: lead.id, automation_id: auto.id },
                  });
                  executedActions.push("notify_manager");
                  break;
                }

                case "whatsapp": {
                  // Log the WhatsApp action (actual sending would be done via whatsapp-send function)
                  executedActions.push("whatsapp");
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
        await supabase.from("automation_logs").insert({
          automation_id: auto.id,
          actions_executed: [],
          status: "error",
          error_message: err.message || "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, totalExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
