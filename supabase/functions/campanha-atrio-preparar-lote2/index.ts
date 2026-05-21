// Prepara Lote 2 da Campanha Átrio.
// Inputs (POST body):
//   force: boolean (default false) — limpa lote 2 existente antes
//   empreendimentos: string[] (obrigatório) — lista priorizada (ordem importa)
//   cap: number (default 1000)
//   ondas: [{onda, size}] (default 4=100, 5=300, 6=600)
//
// Fluxo:
// 1) Para cada empreendimento na ordem, pega telefones únicos em oferta_ativa_leads
// 2) Exclui: telefones em pipeline ativo + telefones já em qualquer audiência Átrio (lote 1 ou 2)
// 3) Para quem não existe em pipeline_leads, cria lead novo (Sem Contato, arquivado=true, origem=oferta_ativa, motivo_descarte=oferta_ativa_atrio_lote2)
// 4) Cap total e distribui em ondas (4/5/6)
// 5) Insere em campanha_atrio_audiencia com lote=2

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const STAGE_SEM_CONTATO = "2fcba9be-1188-4a54-9452-394beefdc330";
const LOTE = 2;

function sanitizeNome(raw: string | null): string {
  if (!raw) return "Cliente";
  let n = raw.split("|")[0].split("/")[0].split(" - ")[0].trim();
  if (n.length > 60) n = n.slice(0, 60).trim();
  return n || "Cliente";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!isAdmin) return errorResponse("forbidden", 403);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const force = body?.force === true;
  const empreendimentos: string[] = Array.isArray(body?.empreendimentos) ? body.empreendimentos : [];
  const cap = Number(body?.cap || 1000);
  const ondas = Array.isArray(body?.ondas) && body.ondas.length > 0
    ? body.ondas
    : [{ onda: 4, size: 100 }, { onda: 5, size: 300 }, { onda: 6, size: 600 }];

  if (empreendimentos.length === 0) return errorResponse("empreendimentos[] obrigatório", 400);

  try {
    // Verifica se lote 2 já existe
    const { count: existing } = await supabase
      .from("campanha_atrio_audiencia")
      .select("*", { count: "exact", head: true })
      .eq("lote", LOTE);

    if (existing && existing > 0 && !force) {
      return jsonResponse({ ok: true, already_prepared: true, total: existing, hint: "use force=true para regenerar" });
    }

    if (force && existing && existing > 0) {
      // Só permite limpar se nenhuma onda do lote 2 começou
      const { data: ctrls } = await supabase.from("campanha_atrio_controle").select("status").eq("lote", LOTE);
      const started = (ctrls || []).some((c: any) => !["aguardando", "pending"].includes(c.status));
      if (started) return errorResponse("Alguma onda do lote 2 já iniciou — não posso regenerar.", 409);
      await supabase.from("campanha_atrio_audiencia").delete().eq("lote", LOTE);
    }

    // 1) Stages bloqueados
    const ACTIVE_STAGE_NAMES = ["Novo Lead","Boas-vindas","Contrato Gerado","Envio de Oportunidades",
      "Atualização Bem-estar","Contato Iniciado","Busca","Qualificação","Indicações",
      "Possível Visita","Aquecimento","Visita Marcada","Visita","Proposta",
      "Visita Realizada","Pós-Visita","Negócio Criado","Negociação","Venda"];
    const { data: stages } = await supabase.from("pipeline_stages").select("id, nome").in("nome", ACTIVE_STAGE_NAMES);
    const activeStageIds = new Set((stages || []).map((s: any) => s.id));

    // 2) Telefones já em qualquer audiência Átrio (qualquer lote)
    const { data: jaAud } = await supabase.from("campanha_atrio_audiencia").select("telefone_normalizado");
    const jaAudSet = new Set((jaAud || []).map((r: any) => r.telefone_normalizado));

    // 3) Para cada empreendimento, na ordem, pega telefones únicos
    type Candidato = { telefone: string; nome: string; empreendimento: string; lead_id: string | null };
    const usadosNesteLote = new Set<string>();
    const candidatosOrdenados: Candidato[] = [];

    for (const emp of empreendimentos) {
      const { data: oa } = await supabase
        .from("oferta_ativa_leads")
        .select("telefone_normalizado, nome")
        .eq("empreendimento", emp)
        .not("telefone_normalizado", "is", null);

      // Dedup interno do empreendimento (mantém 1º nome encontrado)
      const seen = new Set<string>();
      for (const row of (oa || [])) {
        const tel = row.telefone_normalizado as string;
        if (!tel || seen.has(tel) || usadosNesteLote.has(tel) || jaAudSet.has(tel)) continue;
        seen.add(tel);
        usadosNesteLote.add(tel);
        candidatosOrdenados.push({ telefone: tel, nome: row.nome || "", empreendimento: emp, lead_id: null });
      }
    }

    // 4) Para todos os telefones, checa pipeline_leads existentes (em qualquer status)
    const todosTelefones = candidatosOrdenados.map(c => c.telefone);
    const telToLead = new Map<string, { id: string; stage_id: string; nome: string }>();
    for (let i = 0; i < todosTelefones.length; i += 200) {
      const slice = todosTelefones.slice(i, i + 200);
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, telefone_normalizado, stage_id, nome")
        .in("telefone_normalizado", slice);
      for (const l of (leads || [])) {
        // Se o telefone tem múltiplos leads (raríssimo), mantém o primeiro
        if (!telToLead.has(l.telefone_normalizado)) telToLead.set(l.telefone_normalizado, l);
      }
    }

    // 5) Filtra: exclui telefones em stage ativo
    const elegiveis: Candidato[] = [];
    let bloq_pipeline_ativo = 0;
    for (const c of candidatosOrdenados) {
      const existing = telToLead.get(c.telefone);
      if (existing && activeStageIds.has(existing.stage_id)) {
        bloq_pipeline_ativo++;
        continue;
      }
      if (existing) {
        c.lead_id = existing.id;
        c.nome = existing.nome || c.nome; // usa nome do CRM se houver
      }
      elegiveis.push(c);
      if (elegiveis.length >= cap) break;
    }

    // 6) Para OA-only (sem lead_id), cria pipeline_leads em lote
    const semLead = elegiveis.filter(c => !c.lead_id);
    const novosLeads: any[] = semLead.map(c => ({
      nome: sanitizeNome(c.nome),
      telefone: c.telefone,
      telefone_normalizado: c.telefone,
      empreendimento: c.empreendimento,
      stage_id: STAGE_SEM_CONTATO,
      origem: "oferta_ativa",
      motivo_descarte: "oferta_ativa_atrio_lote2",
      arquivado: true,
      aceite_status: "descartado", // não entra na Fila CEO / roleta
    }));

    let criados = 0;
    for (let i = 0; i < novosLeads.length; i += 100) {
      const slice = novosLeads.slice(i, i + 100);
      const { data: ins, error: insErr } = await supabase
        .from("pipeline_leads")
        .insert(slice)
        .select("id, telefone_normalizado");
      if (insErr) {
        console.error("insert pipeline_leads error", insErr);
        throw insErr;
      }
      criados += ins?.length || 0;
      // Mapeia de volta
      for (const row of (ins || [])) {
        const target = elegiveis.find(c => c.telefone === row.telefone_normalizado && !c.lead_id);
        if (target) target.lead_id = row.id;
      }
    }

    // 7) Remove qualquer item que (por race ou erro) ainda não tem lead_id
    const final = elegiveis.filter(c => !!c.lead_id);

    // 8) Distribui em ondas
    const audienciaRows: any[] = [];
    let cursor = 0;
    for (const o of ondas) {
      const fatia = final.slice(cursor, cursor + Number(o.size));
      fatia.forEach((c, idx) => {
        audienciaRows.push({
          lead_id: c.lead_id,
          onda: Number(o.onda),
          lote: LOTE,
          empreendimento_origem: c.empreendimento,
          telefone_normalizado: c.telefone,
          nome: sanitizeNome(c.nome),
          ordem: cursor + idx + 1,
          status: "pending",
        });
      });
      cursor += fatia.length;
    }

    if (audienciaRows.length === 0) {
      return jsonResponse({ ok: true, total: 0, message: "Nenhum lead elegível" });
    }

    for (let i = 0; i < audienciaRows.length; i += 500) {
      const { error } = await supabase.from("campanha_atrio_audiencia").insert(audienciaRows.slice(i, i + 500));
      if (error) throw error;
    }

    // 9) Atualiza total_alvo dos controles do lote 2
    const porOnda: Record<number, number> = {};
    for (const r of audienciaRows) porOnda[r.onda] = (porOnda[r.onda] || 0) + 1;
    for (const [onda, total] of Object.entries(porOnda)) {
      await supabase.from("campanha_atrio_controle").update({ total_alvo: total }).eq("onda", Number(onda)).eq("lote", LOTE);
    }

    const porEmpreendimento: Record<string, number> = {};
    for (const r of audienciaRows) porEmpreendimento[r.empreendimento_origem] = (porEmpreendimento[r.empreendimento_origem] || 0) + 1;

    return jsonResponse({
      ok: true,
      total: audienciaRows.length,
      por_onda: porOnda,
      por_empreendimento: porEmpreendimento,
      leads_novos_criados: criados,
      leads_existentes_reutilizados: final.length - criados,
      candidatos_avaliados: candidatosOrdenados.length,
      bloq_pipeline_ativo,
      amostra_10: audienciaRows.slice(0, 10).map(r => ({ nome: r.nome, onda: r.onda, emp: r.empreendimento_origem })),
    });
  } catch (e) {
    console.error("preparar-lote2 error", e);
    return errorResponse(e instanceof Error ? e.message : String(e), 500);
  }
});
