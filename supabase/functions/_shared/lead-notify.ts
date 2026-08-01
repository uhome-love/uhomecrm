// Avisos de novo lead (sino no CRM + WhatsApp template Meta + push).
// Usado tanto pelo edge function distribute-lead quanto pela distribuição
// direta (receive-*, crm-webhook, reengajamento, lead-escalation), para que
// TODO lead distribuído gere aviso — independente do caminho de entrada.

type LeadInfo = {
  id: string;
  nome: string | null;
  empreendimento: string | null;
  telefone: string | null;
  origem: string | null;
};

export async function fetchLeadForNotify(supabase: any, leadId: string, fallback?: any): Promise<LeadInfo> {
  let row: any = null;
  try {
    const { data } = await supabase
      .from("pipeline_leads")
      .select("nome, empreendimento, telefone, origem, empreendimentos_canonicos(nome)")
      .eq("id", leadId)
      .maybeSingle();
    row = data;
  } catch (e) {
    console.warn("lead fetch for notifications failed:", (e as Error)?.message);
  }

  return {
    id: leadId,
    nome: row?.nome || fallback?.lead_nome || null,
    empreendimento:
      row?.empreendimentos_canonicos?.nome ||
      row?.empreendimento ||
      fallback?.lead_empreendimento ||
      null,
    telefone: row?.telefone || fallback?.lead_telefone || null,
    origem: row?.origem || fallback?.lead_origem || null,
  };
}

export async function sendLeadWhatsApp(
  supabase: any, supabaseUrl: string, serviceKey: string, authUserId: string, lead: LeadInfo
) {
  const { data: corretor } = await supabase
    .from("profiles")
    .select("telefone")
    .eq("user_id", authUserId)
    .maybeSingle();

  const digits = (corretor?.telefone || "").replace(/\D/g, "");
  if (digits.length < 10) return;

  await fetch(`${supabaseUrl}/functions/v1/whatsapp-notificacao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      telefone: corretor.telefone,
      tipo: "novo_lead",
      // Sem PII do cliente: apenas nome + empreendimento.
      dados: {
        nome: lead.nome || "Lead",
        empreendimento: lead.empreendimento || "Não identificado",
      },
    }),
  });
}

export async function sendLeadPush(
  supabaseUrl: string, serviceKey: string, authUserId: string, lead: LeadInfo
) {
  try {
    const targetUrl = lead?.id ? `/aceite?lead=${lead.id}` : "/aceite";
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: authUserId,
        title: "🚨 Novo Lead!",
        body: `${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}. Aceite em 10 min!`,
        url: targetUrl,
        data: { tag: `lead_novo_${lead.id}`, url: targetUrl, pipeline_lead_id: lead?.id ?? null },
      }),
    });
  } catch (e) {
    console.warn("Push notification error:", e);
  }
}

/**
 * Dispara os três avisos para o corretor que RECEBEU o lead.
 * `authUserId` = auth.users.id do corretor novo (nunca o anterior).
 */
export async function notifyLeadDistribuido(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  authUserId: string,
  leadId: string,
  fallback?: any,
) {
  const lead = await fetchLeadForNotify(supabase, leadId, fallback);

  supabase.from("notifications").insert({
    user_id: authUserId,
    tipo: "lead",
    categoria: "lead_novo",
    titulo: `🚨 Novo Lead! ${lead.nome || ""}`.trim(),
    mensagem: `Você recebeu o lead ${lead.nome || "Lead"}${lead.empreendimento ? ` — ${lead.empreendimento}` : ""}${lead.origem ? ` (${lead.origem})` : ""}. Aceite em 10 minutos!`,
    dados: {
      pipeline_lead_id: leadId,
      lead_nome: lead.nome,
      empreendimento: lead.empreendimento,
      telefone: lead.telefone,
      origem: lead.origem,
    },
    agrupamento_key: `lead_novo_${leadId}`,
  }).then((r: any) => { if (r.error) console.warn("notification insert:", r.error.message); });

  await Promise.allSettled([
    sendLeadWhatsApp(supabase, supabaseUrl, serviceKey, authUserId, lead).catch((e) =>
      console.warn("WhatsApp notify error:", e)
    ),
    sendLeadPush(supabaseUrl, serviceKey, authUserId, lead),
  ]);

  return lead;
}
