// Handoff da LIA disparado pelo FOLLOW-UP (cron): cria/ressuscita o lead na Fila CEO e
// distribui pela ROLETA (mesmo destino do qualificar do lia-whatsapp), para o lead que
// ENGAJOU (morno/quente) e parou de responder. Auto-contido de propósito: duplica
// NIVEL_MAP/telBR (poucas linhas) em troca de NÃO tocar no hot-path do webhook.
//
// Dedup FORTE por últimos-8 dígitos: nunca cria um segundo lead se já existe um pro telefone
// (de qualquer origem). Lead já com corretor NÃO é redistribuído (o humano já assumiu).

const NIVEL_MAP: Record<string, { temperatura: string; prioridade: string; emoji: string; label: string; rank: number }> = {
  quente: { temperatura: "quente", prioridade: "alta", emoji: "🔥", label: "Quente", rank: 3 },
  morno: { temperatura: "morno", prioridade: "media", emoji: "🟡", label: "Morno", rank: 2 },
  frio: { temperatura: "frio", prioridade: "baixa", emoji: "🧊", label: "Frio", rank: 1 },
};

function telBR(from: string): string {
  let d = String(from).replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  return "+55" + d;
}

const nowISO = () => new Date().toISOString();

async function empurrarRoleta(leadId: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/distribute-lead`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !leadId) return;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ action: "dispatch_fila_ceo", pipeline_lead_id: leadId }),
    });
    if (!r.ok) console.error("[liaHandoff] empurrarRoleta status", r.status, await r.text().catch(() => ""));
  } catch (e) { console.error("[liaHandoff] empurrarRoleta erro (nao critico)", e); }
}

// Cria (ou ressuscita) o lead na Fila CEO, origem 'LIA'. Espelha criarLeadFila do lia-whatsapp.
// Retorna { leadId, jaTemCorretor }: se já existe um lead VIVO com corretor, NÃO mexe no dono.
async function criarLead(
  sb: any,
  opts: { telefone: string; nome: string | null; nivel: string; produto: any | null; resumo: string },
): Promise<{ leadId: string | null; jaTemCorretor: boolean }> {
  const map = NIVEL_MAP[opts.nivel] ?? NIVEL_MAP.morno;
  const telefone = telBR(opts.telefone);
  const resumoTxt = (opts.resumo ?? "").trim();

  const { data: stage } = await sb
    .from("pipeline_stages").select("id").eq("tipo", "novo_lead").eq("ativo", true).limit(1).single();
  if (!stage) { console.error("[liaHandoff] stage novo_lead ausente"); return { leadId: null, jaTemCorretor: false }; }

  const l8 = telefone.replace(/\D/g, "").slice(-8);
  const { data: exist } = await sb
    .from("pipeline_leads").select("id, corretor_id, aceite_status, arquivado")
    .ilike("telefone", `%${l8}`)
    .order("arquivado", { ascending: true })
    .order("created_at", { ascending: false }).limit(1);

  if (exist && exist.length) {
    const lead = exist[0];
    // lead VIVO que já tem corretor aceito: o humano já assumiu. Não duplica, não redistribui.
    if (!lead.arquivado && lead.corretor_id && lead.aceite_status === "aceito") {
      return { leadId: lead.id, jaTemCorretor: true };
    }
    const patch: Record<string, unknown> = { temperatura: map.temperatura, prioridade_lead: map.prioridade };
    if (lead.arquivado) {
      patch.arquivado = false;
      patch.stage_id = stage.id;
      patch.stage_changed_at = nowISO();
      patch.aceite_status = "pendente_distribuicao";
      patch.corretor_id = null;
      patch.motivo_descarte = null;
      patch.motivo_descarte_code = null;
      patch.tipo_descarte = null;
      patch.tags = ["qualificado_lia", `lia_${opts.nivel}`, "reengajado"];
    }
    await sb.from("pipeline_leads").update(patch).eq("id", lead.id);
    await sb.from("pipeline_atividades").insert({
      pipeline_lead_id: lead.id,
      tipo: "entrada",
      titulo: `${map.emoji} Lead ${map.label} · ${lead.arquivado ? "RESSUSCITADO e qualificado" : "qualificado"} pela LIA (follow-up)`,
      descricao: resumoTxt || "A LIA atendeu, o lead engajou e parou de responder; passado pro time seguir.",
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(() => {}).catch(() => {});
    return { leadId: lead.id, jaTemCorretor: false };
  }

  const { data: ins, error } = await sb.from("pipeline_leads").insert({
    nome: opts.nome || "Lead LIA",
    telefone,
    empreendimento: opts.produto?.empreendimento ?? "Casa Tua Santos Ferreira",
    empreendimento_canonico_id: opts.produto?.empreendimento_canonico_id ?? null,
    stage_id: stage.id,
    origem: "LIA",
    origem_detalhe: "whatsapp",
    corretor_id: null,
    aceite_status: "pendente_distribuicao",
    prioridade_lead: map.prioridade,
    temperatura: map.temperatura,
    tags: ["qualificado_lia", `lia_${opts.nivel}`],
    observacoes: `Resumo da LIA (${map.label}):\n${resumoTxt || "Lead engajou e parou de responder; passado pro time seguir."}`,
  }).select("id").single();
  if (error || !ins) { console.error("[liaHandoff] insert lead falhou", error); return { leadId: null, jaTemCorretor: false }; }

  try {
    await sb.from("pipeline_atividades").insert({
      pipeline_lead_id: ins.id,
      tipo: "entrada",
      titulo: `${map.emoji} Lead ${map.label} · atendido pela LIA (follow-up)`,
      descricao: resumoTxt || "Lead engajou e parou de responder; passado pro time seguir.",
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    });
  } catch (e) { console.error("[liaHandoff] atividade falhou (nao critico)", e); }
  return { leadId: ins.id, jaTemCorretor: false };
}

/** Cria/ressuscita o lead e distribui pela roleta (se ainda não tem dono). Retorna o leadId. */
export async function handoffEngajado(
  sb: any,
  opts: { telefone: string; nome: string | null; nivel: string; produto: any | null; resumo: string },
): Promise<string | null> {
  const { leadId, jaTemCorretor } = await criarLead(sb, opts);
  if (leadId && !jaTemCorretor) await empurrarRoleta(leadId);
  return leadId;
}
