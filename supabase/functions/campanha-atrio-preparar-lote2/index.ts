// Prepara Lote 2 da Campanha Átrio — SEM criar pipeline_leads.
// Fonte: oferta_ativa_leads. Audiência fica com lead_id=NULL.
// Pipeline_lead só é criado em campanha-atrio-processar-resposta quando o lead responde.
//
// Inputs (POST body):
//   force: boolean (default false) — limpa lote 2 existente antes
//   empreendimentos: string[] (obrigatório) — lista priorizada (ordem importa)
//   cap: number (default 1000)
//   ondas: [{onda, size}] (default 4=100, 5=300, 6=600)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

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
      const { data: ctrls } = await supabase.from("campanha_atrio_controle").select("status").eq("lote", LOTE);
      const started = (ctrls || []).some((c: any) => !["aguardando", "pending"].includes(c.status));
      if (started) return errorResponse("Alguma onda do lote 2 já iniciou — não posso regenerar.", 409);
      await supabase.from("campanha_atrio_audiencia").delete().eq("lote", LOTE);
    }

    // 1) Stages bloqueados — telefones em pipeline ATIVO não recebem disparo
    const ACTIVE_STAGE_NAMES = ["Novo Lead","Boas-vindas","Contrato Gerado","Envio de Oportunidades",
      "Atualização Bem-estar","Contato Iniciado","Busca","Qualificação","Indicações",
      "Possível Visita","Aquecimento","Visita Marcada","Visita","Proposta",
      "Visita Realizada","Pós-Visita","Negócio Criado","Negociação","Venda"];
    const { data: stages } = await supabase.from("pipeline_stages").select("id, nome").in("nome", ACTIVE_STAGE_NAMES);
    const activeStageIds = new Set((stages || []).map((s: any) => s.id));

    // 2) Telefones já em qualquer audiência Átrio (lote 1 ou 2)
    const { data: jaAud } = await supabase.from("campanha_atrio_audiencia").select("telefone_normalizado");
    const jaAudSet = new Set((jaAud || []).map((r: any) => r.telefone_normalizado));

    // 3) Para cada empreendimento, na ordem, pega telefones únicos de oferta_ativa_leads
    type Candidato = { telefone: string; nome: string; empreendimento: string };
    const usadosNesteLote = new Set<string>();
    const candidatosOrdenados: Candidato[] = [];

    for (const emp of empreendimentos) {
      const { data: oa } = await supabase
        .from("oferta_ativa_leads")
        .select("telefone_normalizado, nome")
        .eq("empreendimento", emp)
        .not("telefone_normalizado", "is", null);

      const seen = new Set<string>();
      for (const row of (oa || [])) {
        const tel = row.telefone_normalizado as string;
        if (!tel || seen.has(tel) || usadosNesteLote.has(tel) || jaAudSet.has(tel)) continue;
        seen.add(tel);
        usadosNesteLote.add(tel);
        candidatosOrdenados.push({ telefone: tel, nome: row.nome || "", empreendimento: emp });
      }
    }

    // 4) Checa quais telefones já estão em pipeline ATIVO (bloqueia esses)
    const todosTelefones = candidatosOrdenados.map(c => c.telefone);
    const telAtivos = new Set<string>();
    for (let i = 0; i < todosTelefones.length; i += 200) {
      const slice = todosTelefones.slice(i, i + 200);
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("telefone_normalizado, stage_id, arquivado")
        .in("telefone_normalizado", slice);
      for (const l of (leads || [])) {
        if (!l.arquivado && l.stage_id && activeStageIds.has(l.stage_id)) {
          telAtivos.add(l.telefone_normalizado as string);
        }
      }
    }

    // 5) Filtra: exclui telefones em pipeline ativo, aplica cap
    const elegiveis: Candidato[] = [];
    let bloq_pipeline_ativo = 0;
    for (const c of candidatosOrdenados) {
      if (telAtivos.has(c.telefone)) { bloq_pipeline_ativo++; continue; }
      elegiveis.push(c);
      if (elegiveis.length >= cap) break;
    }

    // 6) Distribui em ondas (sem lead_id — pipeline_lead nasce só na resposta)
    const audienciaRows: any[] = [];
    let cursor = 0;
    for (const o of ondas) {
      const fatia = elegiveis.slice(cursor, cursor + Number(o.size));
      fatia.forEach((c, idx) => {
        audienciaRows.push({
          lead_id: null,
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

    // 7) Atualiza total_alvo dos controles do lote 2
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
      fonte: "oferta_ativa_leads (sem criar pipeline_leads)",
      candidatos_avaliados: candidatosOrdenados.length,
      bloq_pipeline_ativo,
      amostra_10: audienciaRows.slice(0, 10).map(r => ({ nome: r.nome, onda: r.onda, emp: r.empreendimento_origem })),
    });
  } catch (e) {
    console.error("preparar-lote2 error", e);
    return errorResponse(e instanceof Error ? e.message : String(e), 500);
  }
});
