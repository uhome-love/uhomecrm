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
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "execute-sequences", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "execute-sequences", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "execute-sequences", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    let executed = 0;
    let errors = 0;

    // 1. Find active lead-sequence enrollments that need processing
    const { data: pendingSteps, error: fetchError } = await supabase
      .from("pipeline_lead_sequencias")
      .select(`
        id, pipeline_lead_id, sequencia_id, passo_atual, status, iniciada_em,
        pipeline_leads!pipeline_lead_sequencias_pipeline_lead_id_fkey(id, nome, telefone, email, corretor_id, empreendimento, stage_id),
        pipeline_sequencias!pipeline_lead_sequencias_sequencia_id_fkey(id, nome, ativa)
      `)
      .eq("status", "ativa")
      .lte("proximo_envio_em", now.toISOString());

    if (fetchError) {
      L.error("Fetch pending sequences failed", {}, fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      });
    }

    for (const enrollment of (pendingSteps || [])) {
      try {
        const seq = enrollment.pipeline_sequencias as any;
        const lead = enrollment.pipeline_leads as any;

        // Skip if sequence disabled
        if (!seq?.ativa) {
          await supabase
            .from("pipeline_lead_sequencias")
            .update({ status: "pausada", pausada_em: now.toISOString() })
            .eq("id", enrollment.id);
          continue;
        }

        // Get the current step
        const { data: passo } = await supabase
          .from("pipeline_sequencia_passos")
          .select("*")
          .eq("sequencia_id", enrollment.sequencia_id)
          .eq("ordem", enrollment.passo_atual)
          .eq("ativo", true)
          .single();

        if (!passo) {
          // No more steps, mark as complete
          await supabase
            .from("pipeline_lead_sequencias")
            .update({ status: "concluida", concluida_em: now.toISOString() })
            .eq("id", enrollment.id);
          continue;
        }

        // Execute the step based on type
        if (passo.tipo === "mensagem" || passo.tipo === "material") {
          // Create a notification for the corretor to action
          if (lead?.corretor_id) {
            await supabase.rpc("criar_notificacao", {
              p_user_id: lead.corretor_id,
              p_tipo: "sequencias",
              p_categoria: "follow_up_automatico",
              p_titulo: `📋 Follow-up: ${passo.titulo}`,
              p_mensagem: `Sequência "${seq.nome}" — ${lead?.nome || "Lead"}: ${passo.conteudo || passo.titulo}`,
              p_dados: {
                lead_id: lead?.id,
                lead_nome: lead?.nome,
                telefone: lead?.telefone,
                passo_titulo: passo.titulo,
                passo_conteudo: passo.conteudo,
                canal: passo.canal,
                tipo: passo.tipo,
                sequencia_nome: seq.nome,
              },
              p_agrupamento_key: null,
            });
          }

          // Create an activity record on the lead
          if (lead?.id && lead?.corretor_id) {
            await supabase.from("pipeline_atividades").insert({
              pipeline_lead_id: lead.id,
              titulo: `[Auto] ${passo.titulo}`,
              descricao: passo.conteudo || `Follow-up automático da sequência "${seq.nome}"`,
              tipo: passo.canal === "ligacao" ? "ligacao" : passo.canal === "email" ? "email" : "whatsapp",
              prioridade: "alta",
              status: "pendente",
              data: now.toISOString().split("T")[0],
              created_by: lead.corretor_id,
              responsavel_id: lead.corretor_id,
            });
          }
        } else if (passo.tipo === "lembrete") {
          // Just notify the corretor
          if (lead?.corretor_id) {
            await supabase.rpc("criar_notificacao", {
              p_user_id: lead.corretor_id,
              p_tipo: "sequencias",
              p_categoria: "lembrete_follow_up",
              p_titulo: `🔔 Lembrete: ${passo.titulo}`,
              p_mensagem: `${lead?.nome || "Lead"} — ${passo.conteudo || "Realize o follow-up agora"}`,
              p_dados: {
                lead_id: lead?.id,
                lead_nome: lead?.nome,
                sequencia_nome: seq.nome,
              },
              p_agrupamento_key: null,
            });
          }
        }

        // Get next step
        const { data: nextPasso } = await supabase
          .from("pipeline_sequencia_passos")
          .select("ordem, dias_apos_inicio")
          .eq("sequencia_id", enrollment.sequencia_id)
          .gt("ordem", enrollment.passo_atual)
          .eq("ativo", true)
          .order("ordem")
          .limit(1)
          .single();

        if (nextPasso) {
          // Calculate next send time
          const iniciada = new Date(enrollment.iniciada_em);
          const nextDate = new Date(iniciada);
          nextDate.setDate(nextDate.getDate() + nextPasso.dias_apos_inicio);

          await supabase
            .from("pipeline_lead_sequencias")
            .update({
              passo_atual: nextPasso.ordem,
              proximo_envio_em: nextDate.toISOString(),
            })
            .eq("id", enrollment.id);
        } else {
          // No more steps
          await supabase
            .from("pipeline_lead_sequencias")
            .update({ status: "concluida", concluida_em: now.toISOString() })
            .eq("id", enrollment.id);
        }

        executed++;
      } catch (stepErr) {
        console.error("Step execution error:", stepErr);
        errors++;
      }
    }

    // 2. Auto-enroll new leads into matching sequences
    // Find leads that entered a stage matching a sequence trigger and aren't yet enrolled
    const { data: activeSeqs } = await supabase
      .from("pipeline_sequencias")
      .select("id, stage_gatilho, empreendimento")
      .eq("ativa", true);

    let enrolled = 0;
    for (const seq of (activeSeqs || [])) {
      const { data: matchingLeads } = await supabase
        .from("pipeline_leads")
        .select("id, stage_id, empreendimento, stage_changed_at")
        .eq("stage_id", (await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("tipo", seq.stage_gatilho)
          .eq("ativo", true)
          .single()).data?.id || "")
        // Only leads that changed stage in the last hour (prevent old leads)
        .gte("stage_changed_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      for (const lead of (matchingLeads || [])) {
        // Filter by empreendimento if specified
        if (seq.empreendimento && lead.empreendimento !== seq.empreendimento) continue;

        // Check if already enrolled
        const { data: existing } = await supabase
          .from("pipeline_lead_sequencias")
          .select("id")
          .eq("pipeline_lead_id", lead.id)
          .eq("sequencia_id", seq.id)
          .limit(1)
          .single();

        if (!existing) {
          // Get first step
          const { data: firstStep } = await supabase
            .from("pipeline_sequencia_passos")
            .select("ordem, dias_apos_inicio")
            .eq("sequencia_id", seq.id)
            .eq("ativo", true)
            .order("ordem")
            .limit(1)
            .single();

          if (firstStep) {
            const startDate = new Date();
            const nextDate = new Date(startDate);
            nextDate.setDate(nextDate.getDate() + firstStep.dias_apos_inicio);

            await supabase.from("pipeline_lead_sequencias").insert({
              pipeline_lead_id: lead.id,
              sequencia_id: seq.id,
              passo_atual: firstStep.ordem,
              status: "ativa",
              iniciada_em: startDate.toISOString(),
              proximo_envio_em: nextDate.toISOString(),
            });
            enrolled++;
          }
        }
      }
    }

    const result = { executed, errors, enrolled, timestamp: now.toISOString() };
    console.log("Sequence execution run:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sequence execution error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
