// receive-quiz-lead — intake de lead vindo dos funis conversacionais (quiz).
//
// Diferente de receive-landing-lead: NÃO distribui pela roleta. O lead entra
// "sem dono" (corretor_id=null, aceite_status='pendente_distribuicao'), marcado
// origem='Quiz', e cai na Fila CEO → aba "Leads qualificado quiz". O CEO repassa
// manualmente pro corretor. O guard do trigger de auto-distribuição respeita
// pendente_distribuicao, então o lead não é sorteado.
//
// Público (verify_jwt=false). Só insere lead — sem segredo (o browser não pode
// guardar segredo). Chamado pelo funil com apikey anon.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseFormRespostas } from "../_shared/formRespostas.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const nome = String((body as any).name ?? (body as any).nome ?? "").trim();
    let telefone = String((body as any).phone ?? (body as any).telefone ?? "").replace(/\D/g, "");
    if (telefone.startsWith("55") && telefone.length > 11) telefone = telefone.slice(2);
    if (!nome && !telefone) return json({ error: "nome ou telefone obrigatório" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Etapa inicial (Novo Lead)
    const { data: stageData, error: stageErr } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .limit(1)
      .single();
    if (stageErr || !stageData) return json({ error: "stage novo_lead não configurado" }, 500);

    const empreendimento = String((body as any).empreendimento ?? "Quiz").trim() || "Quiz";
    const temperatura = String((body as any).temperatura ?? "").toLowerCase();
    const prioridade = temperatura.includes("quente")
      ? "alta"
      : temperatura.includes("frio")
      ? "baixa"
      : "media";

    // Respostas + textos do histórico (reusados no insert e no enriquecimento).
    const respostas = parseFormRespostas(body as any) || [];
    const campanhaNome = String((body as any).campaign_name || empreendimento);
    const detalhesAtiv = respostas.map((r) => `• ${r.pergunta}: ${r.resposta}`).join("\n");
    const tituloAtiv = `📣 Lead gerado pela campanha "${campanhaNome}"`;
    const descricaoAtiv = `Origem: Quiz conversacional (${empreendimento}).${detalhesAtiv ? `\n\nRespostas do quiz:\n${detalhesAtiv}` : ""}`;

    // Se JÁ existe um lead de quiz com esse telefone na Fila CEO (sem dono), ENRIQUECE
    // (2ª chamada = após escolher visita/corretor) em vez de duplicar. Captura acontece
    // no 1º envio (no momento do WhatsApp); esta chamada só atualiza.
    if (telefone) {
      const { data: existing } = await supabase
        .from("pipeline_leads")
        .select("id")
        .eq("telefone", telefone)
        .eq("origem", "Quiz")
        .eq("aceite_status", "pendente_distribuicao")
        .is("corretor_id", null)
        .eq("arquivado", false)
        .limit(1);
      if (existing && existing.length) {
        const leadId = existing[0].id;
        await supabase.from("pipeline_leads").update({
          form_respostas: respostas.length ? respostas : null,
          observacoes: (body as any).message || null,
          prioridade_lead: prioridade,
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
        await supabase.from("pipeline_atividades")
          .update({ titulo: tituloAtiv, descricao: descricaoAtiv })
          .eq("pipeline_lead_id", leadId)
          .eq("tipo", "entrada");
        return json({ success: true, updated: true, lead_id: leadId });
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const { data: inserted, error: insErr } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: nome || "Lead Quiz",
        telefone: telefone || null,
        email: (body as any).email || null,
        empreendimento,
        stage_id: stageData.id,
        origem: "Quiz",
        origem_detalhe: (body as any).source || null,
        campanha: (body as any).campaign_name || null,
        plataforma: (body as any).platform || null,
        observacoes: (body as any).message || null,
        form_respostas: respostas.length ? respostas : null,
        corretor_id: null,
        aceite_status: "pendente_distribuicao",
        prioridade_lead: prioridade,
        fbc: (body as any).fbc || null,
        fbp: (body as any).fbp || null,
        client_user_agent: (body as any).user_agent || null,
        client_ip_address: ip,
        event_source_url: (body as any).event_source_url || null,
      })
      .select("id")
      .single();

    if (insErr || !inserted) return json({ error: insErr?.message || "insert_failed" }, 500);

    // Notifica o topo (CEO/diretor/admin) que chegou lead qualificado de quiz.
    try {
      const { data: tops } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "diretor"]);
      const seen = new Set<string>();
      for (const t of (tops || []) as Array<{ user_id: string }>) {
        if (!t.user_id || seen.has(t.user_id)) continue;
        seen.add(t.user_id);
        await supabase.rpc("criar_notificacao", {
          p_user_id: t.user_id,
          p_tipo: "lead",
          p_categoria: "lead_qualificado_quiz",
          p_titulo: "🔥 Novo lead qualificado (quiz)",
          p_mensagem: `${nome || "Lead"} · ${empreendimento}${temperatura ? ` · ${temperatura}` : ""}`,
          p_dados: { pipeline_lead_id: inserted.id, empreendimento, temperatura, url: "/ceo" },
          p_agrupamento_key: `lead_qualificado_quiz:${inserted.id}`,
        });
      }
    } catch (e) {
      console.error("[receive-quiz-lead] notificação falhou (não crítico):", e);
    }

    // Escreve no histórico do lead (aba "Histórico" do modal): campanha de origem + respostas do quiz.
    try {
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: inserted.id,
        tipo: "entrada",
        titulo: tituloAtiv,
        descricao: descricaoAtiv,
        status: "concluida",
        created_by: "00000000-0000-0000-0000-000000000000",
      });
    } catch (e) {
      console.error("[receive-quiz-lead] atividade de entrada falhou (não crítico):", e);
    }

    return json({ success: true, lead_id: inserted.id });
  } catch (e) {
    console.error("[receive-quiz-lead] erro:", e);
    return json({ error: String(e) }, 500);
  }
});
