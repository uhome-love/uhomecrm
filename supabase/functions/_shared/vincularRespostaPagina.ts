// Vincula uma resposta da página pública (/v/*) ao lead existente no pipeline
// e avisa o corretor. Só ADICIONA anotação + notificação: nunca muda etapa,
// corretor, roleta ou outros dados do lead. Idempotente via `status`.
// Status: pendente -> vinculado | aguardando_corretor -> vinculado | sem_lead
// deno-lint-ignore-file no-explicit-any
type SB = any;

const CANOAS_CANONICO = "5f28344e-41e2-4f0c-901d-81455145f6ee";

const LABELS: Record<string, string> = {
  casal: "Casal", familia_filhos: "Família com filhos", familia_pets: "Família + pets", so_eu: "Só eu",
  quanto_antes: "O quanto antes", ate_1_ano: "Em até 1 ano", pesquisando: "Só pesquisando",
  patio_espaco: "Pátio / espaço", seguranca: "Segurança", localizacao: "Localização", lazer: "Lazer do condomínio",
  sabado_manha: "Sábado de manhã", sabado_tarde: "Sábado à tarde", domingo: "Domingo", dia_semana: "Dia de semana",
};
const lbl = (v?: string | null) => (v ? LABELS[v] ?? v : null);

export interface RespostaRow {
  id: string;
  status: string;
  lead_id: string | null;
  telefone_normalizado: string | null;
  telefone_digitado: string;
  respostas: Record<string, string> | null;
  periodo_visita: string | null;
}

export async function vincularResposta(sb: SB, r: RespostaRow): Promise<string> {
  let leadId = r.lead_id;
  let lead: { id: string; nome: string | null; corretor_id: string | null } | null = null;

  if (!leadId) {
    const tel = r.telefone_normalizado || r.telefone_digitado;
    const { data: cands } = await sb
      .from("pipeline_leads")
      .select("id, nome, corretor_id, empreendimento_canonico_id, created_at")
      .eq("telefone_normalizado", tel)
      .eq("arquivado", false)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!cands?.length) return "pendente";
    lead = cands.find((c: any) => c.empreendimento_canonico_id === CANOAS_CANONICO) ?? cands[0];
    leadId = lead!.id;

    const q = r.respostas ?? {};
    const partes = [lbl(q.quem), lbl(q.quando), lbl(q.peso)].filter(Boolean).join(" · ");
    const texto = `🏠 Preencheu a página do Casa Tua Canoas${partes ? `: ${partes}` : ""}` +
      `${r.periodo_visita ? ` · Quer visitar: ${lbl(r.periodo_visita)}` : ""}`;
    await sb.from("pipeline_anotacoes").insert({
      pipeline_lead_id: leadId, conteudo: texto, autor_nome: "Página Casa Tua", fixada: true,
    });
  } else {
    const { data } = await sb.from("pipeline_leads").select("id, nome, corretor_id").eq("id", leadId).maybeSingle();
    lead = data;
  }

  if (!lead?.corretor_id) {
    await sb.from("pagina_empreendimento_respostas").update({ lead_id: leadId, status: "aguardando_corretor" }).eq("id", r.id);
    return "aguardando_corretor";
  }

  const periodo = lbl(r.periodo_visita);
  const { error: nErr } = await sb.from("notifications").insert({
    user_id: lead.corretor_id,
    titulo: `🏠 ${lead.nome || "Lead"} quer visitar o Casa Tua${periodo ? ` — ${periodo}` : ""}`,
    mensagem: "Preencheu a página do Casa Tua Canoas com mais informações. Veja a anotação no lead e confirme o horário pelo WhatsApp.",
    tipo: "pagina_empreendimento",
    categoria: "leads",
    dados: { pipeline_lead_id: leadId, resposta_id: r.id, periodo_visita: r.periodo_visita },
  });
  if (nErr) throw nErr;
  await sb.from("pagina_empreendimento_respostas").update({ lead_id: leadId, status: "vinculado" }).eq("id", r.id);
  return "vinculado";
}

export async function vincularSeguro(sb: SB, r: RespostaRow, fn: string): Promise<string> {
  try {
    return await vincularResposta(sb, r);
  } catch (e) {
    try {
      await sb.from("ops_events").insert({
        fn, level: "error", category: "pagina_publica", message: "vinculo_falhou",
        ctx: { resposta_id: r.id }, error_detail: String((e as Error)?.message || e).slice(0, 300),
      });
    } catch (_) { /* best-effort */ }
    return "erro";
  }
}
