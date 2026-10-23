import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { contratoAtrasado, contratoChave, type ContratoAcompanhado } from "./contratoRegra.ts";

export async function avisarContratos(supabase: SupabaseClient, somenteLead?: string) {
  const etapas = await supabase.from("pipeline_stages").select("id").eq("tipo", "contrato_gerado");
  if (etapas.error) throw etapas.error;
  const ids = (etapas.data ?? []).map(e => e.id);
  let criadas = 0;
  let suprimidas = 0;
  let repetidas = 0;
  if (!ids.length) return { criadas, suprimidas, repetidas };
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("pipeline_leads").select("id,nome,empreendimento,stage_id,negocio_id,gerente_id,corretor_id,flag_status").in("stage_id", ids).eq("arquivado", false).not("negocio_id", "is", null).order("id");
    if (somenteLead) query = query.eq("id", somenteLead);
    const leads = await query.range(offset, offset + 499);
    if (leads.error) throw leads.error;
    if (!leads.data?.length) break;
    const negocios = await supabase.from("negocios").select("id,pipeline_lead_id,jornada").in("id", leads.data.map(l => l.negocio_id)).eq("fase", "contrato").eq("status", "ativo");
    if (negocios.error) throw negocios.error;
    for (const lead of leads.data) {
      const negocio = negocios.data?.find(n => n.id === lead.negocio_id && n.pipeline_lead_id === lead.id);
      const raw = negocio?.jornada?.contrato;
      const contrato: ContratoAcompanhado | null = raw && typeof raw.status === "string" && typeof raw.desde === "string" && typeof raw.etapa_id === "string" ? raw : null;
      if (!contratoAtrasado(contrato, lead.stage_id, Date.now()) || !contrato || lead.flag_status?.status_contrato !== contrato.status) continue;
      let gerenteId = lead.gerente_id;
      if (!gerenteId && lead.corretor_id) {
        const equipe = await supabase.from("team_members").select("gerente_id").eq("user_id", lead.corretor_id).eq("status", "ativo").maybeSingle();
        if (equipe.error) throw equipe.error;
        gerenteId = equipe.data?.gerente_id;
      }
      if (!gerenteId) continue;
      const perfil = await supabase.from("profiles").select("id,user_id").or(`user_id.eq.${gerenteId},id.eq.${gerenteId}`).limit(1).maybeSingle();
      if (perfil.error) throw perfil.error;
      gerenteId = perfil.data?.user_id;
      if (!gerenteId) continue;
      const key = contratoChave(lead.id, gerenteId, contrato);
      const repetida = await supabase.from("notifications").select("id").eq("user_id", gerenteId).eq("agrupamento_key", key).limit(1).maybeSingle();
      if (repetida.error) throw repetida.error;
      if (repetida.data) { repetidas++; continue; }
      const situacao = contrato.status === "gerado" ? "gerado" : "em leitura";
      const notificacao = await supabase.rpc("criar_notificacao", {
        p_user_id: gerenteId, p_tipo: "alertas", p_categoria: "contrato_parado",
        p_titulo: `${lead.nome} — Contrato ${situacao} há mais de 7 dias`,
        p_mensagem: `${lead.nome}${lead.empreendimento ? ` · ${lead.empreendimento}` : ""}: contrato ${situacao} sem mudança de situação há mais de 7 dias. Confira a assinatura com o responsável.`,
        p_dados: { pipeline_lead_id: lead.id, negocio_id: negocio.id, status_contrato: contrato.status, desde: contrato.desde },
        p_agrupamento_key: key,
      });
      if (notificacao.error) throw notificacao.error;
      if (notificacao.data) criadas++; else suprimidas++;
    }
    if (leads.data.length < 500) break;
  }
  return { criadas, suprimidas, repetidas };
}