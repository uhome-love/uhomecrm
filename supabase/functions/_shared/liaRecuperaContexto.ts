import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CENARIOS, contextoRecuperacao } from "./liaLaboratorio.ts";
import { handoffRecupera } from "./liaHandoff.ts";
import { ehConversaDeTeste } from "./liaModoTeste.ts";

/** Identificação pelo disparo efetivo ou estado; nunca presume que todo WhatsApp é Recupera. */
export async function contextoRealRecupera(sb: SupabaseClient, telefone: string, ficha: string, mensagemRespondida?: string | null) {
  const tel8 = telefone.replace(/\D/g, "").slice(-8);
  const { data: estado, error: estadoErr } = await sb.from("lia_estado").select("recuperacao,lead_id,nome,produto_slug").eq("telefone",telefone).maybeSingle();
  if (estadoErr) throw new Error("Estado da recuperação indisponível");
  let query = sb.from("lia_reengajamento_fila")
    .select("pipeline_lead_id,template_key").eq("tel8",tel8).eq("status","enviado")
    .order("enviado_em",{ascending:false}).limit(1);
  if (mensagemRespondida) query = query.eq("wa_message_id",mensagemRespondida);
  const { data: linha, error } = await query.maybeSingle();
  if (error) throw new Error("Origem da recuperação indisponível");
  const leadId = estado?.recuperacao ? estado.lead_id : linha?.template_key?.startsWith("lia_recupera_") ? linha.pipeline_lead_id : null;
  if (!leadId) {
    // RECUPERAÇÃO DE TESTE (botão "Enviar teste"): sem lead real, só com modo teste ligado e número de teste.
    if (estado?.recuperacao && !estado.lead_id && await ehConversaDeTeste(sb, telefone)) {
      const base = CENARIOS[0];
      if (!base) return null;
      let produtoNome = "imóveis";
      if (estado.produto_slug) {
        const { data: p } = await sb.from("lia_produtos").select("nome").eq("slug", estado.produto_slug).maybeSingle();
        if (p?.nome) produtoNome = p.nome;
      }
      const contexto = contextoRecuperacao({ ...base, nomeCliente: estado.nome || "cliente", produtoNome, motivo: "sem motivo informado", dias: 40 }, ficha);
      return { leadId: null as string | null, teste: true, ficha: `${contexto}\n\nQUALIFICAÇÃO JÁ REGISTRADA (não pergunte de novo):\nNão registrada; perguntar somente o que falta.` };
    }
    return null;
  }
  const { data: lead, error: leadErr } = await sb.from("pipeline_leads")
    .select("id,nome,empreendimento,motivo_descarte,stage_changed_at,objetivo_cliente,bairro_regiao,radar_quartos,radar_valor_max,prazo_decisao,forma_pagamento")
    .eq("id",leadId).maybeSingle();
  if (leadErr || !lead) throw new Error("Histórico da recuperação indisponível");
  const base = CENARIOS[0];
  if (!base) return null;
  const dias = lead.stage_changed_at ? Math.max(0,Math.floor((Date.now()-new Date(lead.stage_changed_at).getTime())/86400000)) : 0;
  const fatos = Object.entries({objetivo:lead.objetivo_cliente,regiao:lead.bairro_regiao,dormitorios:lead.radar_quartos,valor_maximo:lead.radar_valor_max,prazo:lead.prazo_decisao,pagamento:lead.forma_pagamento})
    .filter(([,v])=>v!==null && v!=="").map(([k,v])=>`${k}: ${v}`).join("\n");
  const contexto = contextoRecuperacao({...base,nomeCliente:lead.nome,produtoNome:lead.empreendimento||"imóveis",motivo:lead.motivo_descarte||"sem motivo informado",dias},ficha);
  return {leadId:lead.id as string | null,teste:false,ficha:`${contexto}\n\nQUALIFICAÇÃO JÁ REGISTRADA (não pergunte de novo):\n${fatos||"Não registrada; perguntar somente o que falta."}`};
}

/** Follow-up genérico nunca pode redistribuir um cliente da Recupera pela Roleta. */
export async function handoffRecuperaSeAplicavel(sb: SupabaseClient, telefone: string, nivel: string, resumo: string) {
  const ctx = await contextoRealRecupera(sb,telefone,"");
  if (!ctx) return {recupera:false,leadId:null};
  if (ctx.teste || !ctx.leadId) {
    await sb.from("ops_events").insert({ fn: "lia-followup", level: "info", category: "lia_teste_handoff", message: "teste: cliente seria passado ao especialista (nada criado)", ctx: { final: telefone.slice(-4), nivel } }).then(() => {}, () => {});
    return {recupera:true,leadId:null};
  }
  const leadId = await handoffRecupera(sb,{leadId:ctx.leadId,telefone,nivel,resumo:resumo||"Cliente demonstrou interesse em atendimento com especialista."});
  return {recupera:true,leadId};
}