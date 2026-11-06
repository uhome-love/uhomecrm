import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CENARIOS, contextoRecuperacao } from "./liaLaboratorio.ts";
import { handoffRecupera } from "./liaHandoff.ts";

/** Identificação pelo disparo efetivo ou estado; nunca presume que todo WhatsApp é Recupera. */
export async function contextoRealRecupera(sb: SupabaseClient, telefone: string, ficha: string) {
  const tel8 = telefone.replace(/\D/g, "").slice(-8);
  const { data: linha, error } = await sb.from("lia_reengajamento_fila")
    .select("pipeline_lead_id,template_key").eq("tel8",tel8).eq("status","enviado")
    .order("enviado_em",{ascending:false}).limit(1).maybeSingle();
  if (error) throw new Error("Origem da recuperação indisponível");
  if (!linha?.template_key?.startsWith("lia_recupera_")) return null;
  const { data: lead, error: leadErr } = await sb.from("pipeline_leads")
    .select("id,nome,empreendimento,motivo_descarte,stage_changed_at,objetivo_cliente,bairro_regiao,radar_quartos,radar_valor_max,prazo_decisao,forma_pagamento")
    .eq("id",linha.pipeline_lead_id).maybeSingle();
  if (leadErr || !lead) throw new Error("Histórico da recuperação indisponível");
  const base = CENARIOS[0];
  if (!base) return null;
  const dias = lead.stage_changed_at ? Math.max(0,Math.floor((Date.now()-new Date(lead.stage_changed_at).getTime())/86400000)) : 0;
  const fatos = Object.entries({objetivo:lead.objetivo_cliente,regiao:lead.bairro_regiao,dormitorios:lead.radar_quartos,valor_maximo:lead.radar_valor_max,prazo:lead.prazo_decisao,pagamento:lead.forma_pagamento})
    .filter(([,v])=>v!==null && v!=="").map(([k,v])=>`${k}: ${v}`).join("\n");
  const contexto = contextoRecuperacao({...base,nomeCliente:lead.nome,produtoNome:lead.empreendimento||"imóveis",motivo:lead.motivo_descarte||"sem motivo informado",dias},ficha);
  return {leadId:lead.id,ficha:`${contexto}\n\nQUALIFICAÇÃO JÁ REGISTRADA (não pergunte de novo):\n${fatos||"Não registrada; perguntar somente o que falta."}`};
}

/** Follow-up genérico nunca pode redistribuir um cliente da Recupera pela Roleta. */
export async function handoffRecuperaSeAplicavel(sb: SupabaseClient, telefone: string, nivel: string, resumo: string) {
  const ctx = await contextoRealRecupera(sb,telefone,"");
  if (!ctx) return {recupera:false,leadId:null};
  const leadId = await handoffRecupera(sb,{leadId:ctx.leadId,telefone,nivel,resumo:resumo||"Cliente demonstrou interesse em atendimento com especialista."});
  return {recupera:true,leadId};
}