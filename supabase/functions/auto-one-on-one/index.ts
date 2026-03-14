import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "auto-one-on-one";

function makeLogger(traceId: string) {
  const emit = (level: string, msg: string, ctx?: Record<string, unknown>, err?: unknown) => {
    const payload = { fn: FN, level, msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() };
    level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("warn", msg, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("error", msg, ctx, err),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = makeLogger(traceId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: FN, level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // Calculate current week (Mon-Sun) in BRT
    const now = new Date();
    const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    // Current week: Monday to Sunday
    const dayOfWeek = brt.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(brt);
    monday.setDate(brt.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const periodoInicio = monday.toISOString().split("T")[0];
    const periodoFim = sunday.toISOString().split("T")[0];
    const dayStart = periodoInicio + "T00:00:00-03:00";
    const dayEnd = periodoFim + "T23:59:59.999-03:00";

    // Calculate previous 4 weeks for comparison
    const prev4WeeksStart = new Date(monday);
    prev4WeeksStart.setDate(prev4WeeksStart.getDate() - 28);
    const prev4Start = prev4WeeksStart.toISOString().split("T")[0] + "T00:00:00-03:00";
    const prev4End = periodoInicio + "T00:00:00-03:00";

    // Get all active gestors
    const { data: gestors, error: gestorErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "gestor");

    if (gestorErr) {
      L.error("Failed to fetch gestors", {}, gestorErr);
      logOps("error", "system", "Failed to fetch gestors", {}, gestorErr.message);
      return new Response(JSON.stringify({ error: gestorErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!gestors || gestors.length === 0) {
      L.info("No gestors found");
      return new Response(
        JSON.stringify({ success: true, message: "No gestors found", reports: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalReports = 0;
    let skippedExisting = 0;

    for (const gestor of gestors) {
      const gerenteId = gestor.user_id;

      // Get active team members
      const { data: team } = await supabase
        .from("team_members")
        .select("id, nome, user_id")
        .eq("gerente_id", gerenteId)
        .eq("status", "ativo");

      if (!team || team.length === 0) continue;

      // Get checkpoints for this week
      const { data: checkpoints } = await supabase
        .from("checkpoints")
        .select("id")
        .eq("gerente_id", gerenteId)
        .gte("data", periodoInicio)
        .lte("data", periodoFim);

      const cpIds = (checkpoints || []).map(c => c.id);

      // Get checkpoints for previous 4 weeks
      const { data: prevCheckpoints } = await supabase
        .from("checkpoints")
        .select("id")
        .eq("gerente_id", gerenteId)
        .gte("data", prev4WeeksStart.toISOString().split("T")[0])
        .lt("data", periodoInicio);

      const prevCpIds = (prevCheckpoints || []).map(c => c.id);

      for (const member of team) {
        // Skip if no user_id linked
        if (!member.user_id) continue;

        // Check if report already exists for this period (idempotency)
        const { data: existing } = await supabase
          .from("one_on_one_reports")
          .select("id")
          .eq("corretor_id", member.id)
          .eq("gerente_id", gerenteId)
          .eq("periodo_inicio", periodoInicio)
          .eq("periodo_fim", periodoFim)
          .maybeSingle();

        if (existing) {
          skippedExisting++;
          continue;
        }

        // ── Current week metrics ──
        let ligacoes = 0, aproveitados = 0, visitasMarcadas = 0, visitasRealizadas = 0;
        let vgvGerado = 0, propostas = 0;

        if (cpIds.length > 0) {
          const { data: lines } = await supabase
            .from("checkpoint_lines")
            .select("*")
            .eq("corretor_id", member.id)
            .in("checkpoint_id", cpIds);

          (lines || []).forEach((l: any) => {
            ligacoes += l.real_ligacoes || 0;
            aproveitados += l.real_leads || 0;
            visitasMarcadas += l.real_visitas_marcadas || 0;
            visitasRealizadas += l.real_visitas_realizadas || 0;
            vgvGerado += Number(l.real_vgv_gerado || 0);
            propostas += l.real_propostas || 0;
          });
        }

        // OA tentativas for the week
        const { data: oaTentativas } = await supabase
          .from("oferta_ativa_tentativas")
          .select("id, resultado")
          .eq("corretor_id", member.user_id)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);

        const oaTotal = (oaTentativas || []).length;
        const oaAproveitados = (oaTentativas || []).filter((t: any) => t.resultado === "com_interesse").length;
        
        // Use OA data if checkpoint data is empty
        if (ligacoes === 0 && oaTotal > 0) ligacoes = oaTotal;
        if (aproveitados === 0 && oaAproveitados > 0) aproveitados = oaAproveitados;

        const taxaAproveitamento = ligacoes > 0 ? Math.round((aproveitados / ligacoes) * 100) : 0;

        const dadosSemana = {
          total_ligacoes: ligacoes,
          aproveitados,
          visitas_marcadas: visitasMarcadas,
          visitas_realizadas: visitasRealizadas,
          vgv_gerado: vgvGerado,
          propostas,
          taxa_aproveitamento: taxaAproveitamento,
        };

        // ── Previous 4 weeks average ──
        let prevLigacoes = 0, prevAproveitados = 0, prevVisitasM = 0, prevVisitasR = 0;
        let prevVgv = 0, prevPropostas = 0, prevWeeks = 4;

        if (prevCpIds.length > 0) {
          const { data: prevLines } = await supabase
            .from("checkpoint_lines")
            .select("*")
            .eq("corretor_id", member.id)
            .in("checkpoint_id", prevCpIds);

          (prevLines || []).forEach((l: any) => {
            prevLigacoes += l.real_ligacoes || 0;
            prevAproveitados += l.real_leads || 0;
            prevVisitasM += l.real_visitas_marcadas || 0;
            prevVisitasR += l.real_visitas_realizadas || 0;
            prevVgv += Number(l.real_vgv_gerado || 0);
            prevPropostas += l.real_propostas || 0;
          });
        }

        const avgLigacoes = Math.round(prevLigacoes / prevWeeks);
        const avgAproveitados = Math.round(prevAproveitados / prevWeeks);
        const avgVisitasM = Math.round(prevVisitasM / prevWeeks);
        const avgVisitasR = Math.round(prevVisitasR / prevWeeks);
        const avgPropostas = Math.round(prevPropostas / prevWeeks);

        // Build comparison context
        const compare = (label: string, current: number, avg: number) => {
          if (avg === 0 && current === 0) return `${label}: sem dados`;
          if (avg === 0) return `${label}: ${current} (sem histórico para comparar)`;
          const diff = Math.round(((current - avg) / avg) * 100);
          const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
          return `${label}: ${current} (média 4sem: ${avg}, ${arrow}${Math.abs(diff)}%)`;
        };

        const contextoAuto = [
          `Relatório automático semanal — ${member.nome}`,
          `Período: ${periodoInicio} a ${periodoFim}`,
          "",
          "Comparativo com média das últimas 4 semanas:",
          compare("Ligações/Tentativas", ligacoes, avgLigacoes),
          compare("Aproveitados", aproveitados, avgAproveitados),
          compare("Visitas Marcadas", visitasMarcadas, avgVisitasM),
          compare("Visitas Realizadas", visitasRealizadas, avgVisitasR),
          compare("Propostas", propostas, avgPropostas),
          `Taxa de aproveitamento: ${taxaAproveitamento}%`,
          vgvGerado > 0 ? `VGV Gerado: R$ ${vgvGerado.toLocaleString("pt-BR")}` : "VGV Gerado: R$ 0",
        ].join("\n");

        // Calculate simple score
        let score = 0;
        if (ligacoes >= avgLigacoes && avgLigacoes > 0) score += 20;
        else if (ligacoes > 0) score += 10;
        if (aproveitados >= avgAproveitados && avgAproveitados > 0) score += 25;
        else if (aproveitados > 0) score += 12;
        if (visitasMarcadas >= avgVisitasM && avgVisitasM > 0) score += 20;
        else if (visitasMarcadas > 0) score += 10;
        if (visitasRealizadas > 0) score += 15;
        if (propostas > 0) score += 20;
        score = Math.min(score, 100);

        // Insert report
        const { error: insertErr } = await supabase.from("one_on_one_reports").insert({
          corretor_id: member.id,
          gerente_id: gerenteId,
          corretor_nome: member.nome,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          dados_semana: dadosSemana,
          contexto_auto: contextoAuto,
          status: "rascunho",
          score_performance: score,
        });

        if (insertErr) {
          L.warn("Failed to insert 1:1 report", { corretor: member.nome, gerente: gerenteId }, insertErr);
        } else {
          totalReports++;
        }
      }

      // Create notification for the gerente
      if (totalReports > 0) {
        const dataFormatada = `${periodoFim.split("-")[2]}/${periodoFim.split("-")[1]}`;
        await supabase.from("notifications").insert({
          user_id: gerenteId,
          categoria: "relatorios",
          tipo: "rascunhos_prontos",
          titulo: "📋 Relatórios 1:1 semanais prontos",
          mensagem: `Os relatórios 1:1 de ${dataFormatada} estão prontos. ${team.length} corretores aguardam revisão.`,
          dados: { periodo_inicio: periodoInicio, periodo_fim: periodoFim, total: team.length },
        });
      }
    }

    const result = { reports_generated: totalReports, skipped_existing: skippedExisting, gestors: gestors.length, periodo: `${periodoInicio}..${periodoFim}` };
    L.info("Run complete", result as unknown as Record<string, unknown>);
    logOps("info", "business", `1:1 reports: ${totalReports} generated, ${skippedExisting} skipped (existing)`, result as unknown as Record<string, unknown>);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    L.error("Unhandled exception", {}, e);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: FN, level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: e instanceof Error ? e.message : String(e) }).then(() => {});
    } catch {}
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
