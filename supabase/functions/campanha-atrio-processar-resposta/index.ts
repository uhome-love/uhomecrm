// Processa resposta de lead Átrio: chamado pelo whatsapp-webhook quando wamid bate.
// Body: { wamid, from, message } onde message é o objeto cru do WhatsApp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { distributeLeadDirect } from "../_shared/roleta-distribution.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

const FOLLOW_SIM = "Perfeito! Em instantes um especialista entra em contato para te apresentar o Átrio Boutique Haus. 🙏";
const FOLLOW_NAO = "Entendido. Obrigado pelo retorno! Se mudar de ideia, estamos por aqui.";

async function sendText(to: string, text: string) {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
  } catch (e) { console.error("sendText error", e); }
}

function classify(message: any): { tipo: "sim"|"nao"|"texto_livre", conteudo: string } {
  // 1) interactive.button_reply: title (preferido) OU id
  const br = message?.interactive?.button_reply;
  const btn = message?.button;
  let payload = "";
  if (br) payload = br.title || br.id || "";
  else if (btn) payload = btn.text || btn.payload || "";
  else if (message?.text?.body) payload = message.text.body;
  else payload = "";

  const norm = (payload || "").trim().toLowerCase();
  if (!norm) return { tipo: "texto_livre", conteudo: payload };

  // SIM
  if (norm === "sim, pode enviar" || norm === "sim pode enviar" || /^sim\b/.test(norm)) {
    return { tipo: "sim", conteudo: payload };
  }
  // NÃO
  if (
    norm === "não tenho interesse" || norm === "nao tenho interesse" ||
    /^n[aã]o\b/.test(norm)
  ) {
    return { tipo: "nao", conteudo: payload };
  }
  return { tipo: "texto_livre", conteudo: payload };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { return errorResponse("body inválido", 400); }
  const { wamid, from, message } = body || {};
  if (!from || !message) return errorResponse("from e message são obrigatórios", 400);

  try {
    // 1) Localizar evento: por context wamid OU por telefone (últimos 8 dígitos, 24h)
    let evento: any = null;
    if (wamid) {
      const { data } = await supabase
        .from("campanha_atrio_eventos")
        .select("id, lead_id, telefone, nome, onda, empreendimento_origem")
        .eq("mensagem_id_meta", wamid).maybeSingle();
      if (data) evento = data;
    }
    if (!evento) {
      const last8 = (from || "").replace(/\D/g, "").slice(-8);
      if (last8.length === 8) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("campanha_atrio_eventos")
          .select("id, lead_id, telefone, nome, onda, empreendimento_origem")
          .eq("status_envio", "sucesso").gte("enviado_em", cutoff)
          .ilike("telefone", `%${last8}`)
          .order("enviado_em", { ascending: false }).limit(1).maybeSingle();
        if (data) evento = data;
      }
    }
    if (!evento) {
      return jsonResponse({ ok: false, reason: "no_event_match" }, 200);
    }

    // 1b) Lote 2+: se o disparo não tinha pipeline_lead, criar agora.
    //     Reaproveita lead já existente com o mesmo telefone (qualquer estado).
    if (!evento.lead_id) {
      const { data: existente } = await supabase
        .from("pipeline_leads")
        .select("id")
        .eq("telefone_normalizado", evento.telefone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let novoLeadId: string | null = existente?.id || null;
      if (!novoLeadId) {
        const { data: stage } = await supabase
          .from("pipeline_stages").select("id").eq("nome", "Sem Contato").maybeSingle();
        const stageId = stage?.id || null;
        const { data: ins, error: insErr } = await supabase
          .from("pipeline_leads")
          .insert({
            nome: evento.nome || "Cliente",
            telefone: evento.telefone,
            telefone_normalizado: evento.telefone,
            empreendimento: evento.empreendimento_origem || "Átrio - ABF",
            stage_id: stageId,
            origem: "campanha_atrio",
            arquivado: false,
            aceite_status: "pendente",
            reativado_por_nutricao: true,
            reativado_em: new Date().toISOString(),
          })
          .select("id").single();
        if (insErr) {
          console.error("erro criando pipeline_lead da resposta Átrio", insErr);
          throw insErr;
        }
        novoLeadId = ins.id;
      }

      evento.lead_id = novoLeadId;
      // Vincula o evento ao lead recém-criado/reaproveitado
      await supabase.from("campanha_atrio_eventos").update({ lead_id: novoLeadId }).eq("id", evento.id);
    }


    // 2) Dedup por wamid_origem
    if (wamid) {
      const { data: dup } = await supabase
        .from("campanha_atrio_respostas").select("id").eq("wamid_origem", wamid).maybeSingle();
      if (dup) return jsonResponse({ ok: true, deduped: true });
    }

    // 3) Classificar
    const { tipo, conteudo } = classify(message);

    // 3b) Idempotência por lead: se já houve resposta SIM/livre processada
    // com sucesso pelo mesmo lead nas últimas 4h, NÃO redistribuímos de novo
    // (evita dupla notificação/dupla atribuição em respostas em sequência).
    let suppressRedistribuicao = false;
    if (tipo === "sim" || tipo === "texto_livre") {
      const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: jaProcessada } = await supabase
        .from("campanha_atrio_respostas")
        .select("id")
        .eq("lead_id", evento.lead_id)
        .eq("enviado_para_roleta", true)
        .gte("recebido_em", since)
        .limit(1)
        .maybeSingle();
      if (jaProcessada) suppressRedistribuicao = true;
    }

    // 4) Inserir resposta
    const { data: respIns, error: respErr } = await supabase
      .from("campanha_atrio_respostas").insert({
        lead_id: evento.lead_id, telefone: evento.telefone,
        tipo_resposta: tipo, conteudo_resposta: conteudo?.slice(0, 1000),
        wamid_origem: wamid || null,
      }).select("id").single();
    if (respErr) throw respErr;

    const hoje = new Date().toISOString().slice(0,10);

    // Helper: se o lead está arquivado/Descarte, limpa vínculo antigo
    // para a roleta poder redistribuir (corretor anterior já não tem mais o lead).
    async function liberarVinculoSeDescarte(leadId: string) {
      const { data: pl } = await supabase
        .from("pipeline_leads")
        .select("arquivado, stage_id, corretor_id, pipeline_stages!inner(nome)")
        .eq("id", leadId).maybeSingle();
      const stageNome = (pl as any)?.pipeline_stages?.nome || "";
      const ehDescarteOuArquivado = pl?.arquivado === true || /descarte/i.test(stageNome);
      if (ehDescarteOuArquivado && pl?.corretor_id) {
        const { error: updErr } = await supabase.from("pipeline_leads").update({
          corretor_id: null,
          aceite_status: 'pendente',
          arquivado: false,
        }).eq("id", leadId);
        if (updErr) {
          console.error(`❌ Falha ao liberar lead ${leadId}:`, updErr);
          throw new Error(`liberar_vinculo_falhou: ${updErr.message}`);
        }
        console.log(`🔓 Lead ${leadId} liberado (estava em ${stageNome}, arquivado=${pl?.arquivado})`);
      }
    }

    // Recategoriza o lead para "Átrio - ABF" antes da roleta.
    // Assim distribuir_lead_atomico casa com roleta_campanhas → S5 - Produto Foco.
    async function recategorizarParaAtrio(leadId: string) {
      const { error } = await supabase.from("pipeline_leads").update({
        empreendimento: "Átrio - ABF",
      }).eq("id", leadId);
      if (error) {
        console.error(`❌ Falha ao recategorizar lead ${leadId} para Átrio:`, error);
      } else {
        console.log(`🏷️ Lead ${leadId} recategorizado para Átrio - ABF`);
      }
    }

    if (tipo === "sim") {
      // Recategoriza para Átrio + libera vínculo antigo → roleta vai para S5 (Produto Foco)
      await recategorizarParaAtrio(evento.lead_id);
      await liberarVinculoSeDescarte(evento.lead_id);
      const traceId = `atrio_${respIns.id}`;
      const dist = await distributeLeadDirect(SUPABASE_URL, SERVICE_KEY, evento.lead_id, traceId, console as any);

      const sucesso = !!dist?.success;
      await supabase.from("campanha_atrio_respostas").update({
        enviado_para_roleta: sucesso,
        corretor_designado_id: dist?.corretor_id || null,
        motivo_falha_roleta: sucesso ? null : (dist?.reason || dist?.error || "falha_distribuicao"),
      }).eq("id", respIns.id);
      await supabase.from("pipeline_leads").update({
        reengajamento_status: "respondido_sim",
        reativado_por_nutricao: true,
        reativado_em: new Date().toISOString(),
      }).eq("id", evento.lead_id);

      // Marca como "Novo Interesse" no painel CEO
      try {
        await supabase.from("campaign_clicks").insert({
          telefone: from,
          nome: evento.nome || null,
          origem: "campanha_atrio",
          canal: "whatsapp",
          campanha: "atrio_disparo",
          pipeline_lead_id: evento.lead_id,
          lead_action: "updated",
          status: "respondido_sim",
        });
      } catch (e) { console.error("campaign_clicks insert err:", e); }


      // Atividade no lead (não move stage — apenas log)
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: evento.lead_id, tipo: "campanha_atrio",
        titulo: "Resposta SIM — Disparo Átrio",
        descricao: sucesso
          ? `Lead respondeu "Sim, pode enviar" (Átrio). Distribuído para corretor via roleta.`
          : `Lead respondeu SIM (Átrio). Falha na roleta: ${dist?.reason || dist?.error}`,
        data: hoje, status: "concluida",
      });

      // Tag
      try {
        await supabase.rpc("add_lead_tag", { p_lead_id: evento.lead_id, p_tag: "disparo_atrio_2026_05_21" });
      } catch { /* RPC opcional */ }

      await sendText(from, FOLLOW_SIM);
      return jsonResponse({ ok: true, tipo, distribuido: sucesso, corretor_id: dist?.corretor_id || null });
    }

    if (tipo === "nao") {
      await supabase.from("pipeline_leads").update({
        reengajamento_status: "respondido_nao",
      }).eq("id", evento.lead_id);
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: evento.lead_id, tipo: "campanha_atrio",
        titulo: "Resposta NÃO — Disparo Átrio",
        descricao: `Lead respondeu "Não tenho interesse" (Átrio).`,
        data: hoje, status: "concluida",
      });

      try {
        await supabase.rpc("add_lead_tag", { p_lead_id: evento.lead_id, p_tag: "desinteresse_atrio_2026_05_21" });
      } catch {}
      await sendText(from, FOLLOW_NAO);
      return jsonResponse({ ok: true, tipo });
    }

    // texto livre → recategoriza + roleta (S5 Produto Foco)
    await recategorizarParaAtrio(evento.lead_id);
    await liberarVinculoSeDescarte(evento.lead_id);
    const traceId = `atrio_tl_${respIns.id}`;
    const dist = await distributeLeadDirect(SUPABASE_URL, SERVICE_KEY, evento.lead_id, traceId, console as any);

    const sucesso = !!dist?.success;
    await supabase.from("campanha_atrio_respostas").update({
      enviado_para_roleta: sucesso,
      corretor_designado_id: dist?.corretor_id || null,
      motivo_falha_roleta: sucesso ? null : (dist?.reason || dist?.error || "falha_distribuicao"),
    }).eq("id", respIns.id);
    await supabase.from("pipeline_leads").update({
      reengajamento_status: "respondido_livre",
      reativado_por_nutricao: true,
      reativado_em: new Date().toISOString(),
    }).eq("id", evento.lead_id);

    try {
      await supabase.from("campaign_clicks").insert({
        telefone: from,
        nome: evento.nome || null,
        origem: "campanha_atrio",
        canal: "whatsapp",
        campanha: "atrio_disparo",
        pipeline_lead_id: evento.lead_id,
        lead_action: "updated",
        status: "respondido_livre",
      });
    } catch (e) { console.error("campaign_clicks insert err:", e); }

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: evento.lead_id, tipo: "campanha_atrio",
      titulo: "Resposta livre — Disparo Átrio",
      descricao: `Lead respondeu texto livre (Átrio): "${conteudo?.slice(0,200)}". ${sucesso ? "Enviado para roleta." : "Falha roleta: " + (dist?.reason || dist?.error)}`,
      data: hoje, status: "concluida",
    });
    return jsonResponse({ ok: true, tipo, distribuido: sucesso });
  } catch (e) {
    console.error("processar-resposta error", e);
    return errorResponse(e instanceof Error ? e.message : String(e), 500);
  }
});
