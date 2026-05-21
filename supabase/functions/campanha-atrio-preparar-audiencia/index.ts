// Prepara audiência da Campanha Átrio Boutique Haus (444 leads em 3 ondas).
// Roda 1x, antes da Onda 1. Idempotente: se já houver linhas em campanha_atrio_audiencia,
// retorna o snapshot atual sem refazer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const WHITELIST = [
  "Connect JW","Shift","Vanguard","Casa Bastian","Skyline Menino Deus",
  "Melnick Day Compactos","Vista Menino Deus","Go Home Design","Go Moinhos",
  "Vista Praia de Belas","Caiz React","Vista Nova Carlos Gomes","Alfa",
];

function prioridade(emp: string | null): number {
  if (!emp) return 9;
  const e = emp;
  if (["Connect JW","Shift","Vanguard"].includes(e)) return 1;
  if (["Casa Bastian","Skyline Menino Deus"].includes(e)) return 2;
  return 3;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // role check
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!isAdmin) return errorResponse("forbidden", 403);

  try {
    // Se já existe, retorna o snapshot
    const { count: existing } = await supabase
      .from("campanha_atrio_audiencia")
      .select("*", { count: "exact", head: true });
    if (existing && existing > 0) {
      const { data: dist } = await supabase
        .from("campanha_atrio_audiencia")
        .select("onda")
        .order("onda");
      const porOnda = (dist || []).reduce((acc: Record<number, number>, r: any) => {
        acc[r.onda] = (acc[r.onda] || 0) + 1; return acc;
      }, {});
      return jsonResponse({ ok: true, already_prepared: true, total: existing, por_onda: porOnda });
    }

    // 1) Buscar leads candidatos (12 meses, whitelist, com telefone)
    const cutoff12mo = new Date(Date.now() - 365*24*60*60*1000).toISOString();
    const cutoffAtividade60d = new Date(Date.now() - 60*24*60*60*1000).toISOString();

    // Stage Descarte id
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, nome");
    const descarteId = stages?.find((s:any) => s.nome === "Descarte")?.id;
    // Stages elegíveis = Descarte, Sem Contato, Caiu (não-ativos)
    const stagesElegiveis = (stages || [])
      .filter((s:any) => ["Descarte","Sem Contato","Caiu"].includes(s.nome))
      .map((s:any) => s.id);

    // Paginar para escapar do cap de 1000
    const candidatos: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone_normalizado, empreendimento, stage_id, motivo_descarte, updated_at, created_at")
        .gte("created_at", cutoff12mo)
        .not("telefone_normalizado", "is", null)
        .in("empreendimento", WHITELIST)
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!page || page.length === 0) break;
      candidatos.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    // 2) Para cada candidato, validar elegibilidade
    // (a) telefone único
    // (b) sem atividade nos últimos 60d
    // (c) stage em Descarte/Sem Contato/Caiu OU motivo_descarte != null OU hit em oferta_ativa_leads
    const seenTelefones = new Set<string>();
    const idsBatch = candidatos.map(c => c.id);
    // Buscar última atividade por lead (em batches)
    const atividadeRecente = new Set<string>();
    for (let i = 0; i < idsBatch.length; i += 500) {
      const slice = idsBatch.slice(i, i + 500);
      const { data: ativs } = await supabase
        .from("pipeline_atividades")
        .select("pipeline_lead_id")
        .in("pipeline_lead_id", slice)
        .gte("created_at", cutoffAtividade60d);
      (ativs || []).forEach((a:any) => atividadeRecente.add(a.pipeline_lead_id));
    }

    // OA hits por telefone
    const telefones = Array.from(new Set(candidatos.map(c => c.telefone_normalizado)));
    const oaHits = new Set<string>();
    for (let i = 0; i < telefones.length; i += 500) {
      const slice = telefones.slice(i, i + 500);
      const { data: oa } = await supabase
        .from("oferta_ativa_leads")
        .select("telefone_normalizado")
        .in("telefone_normalizado", slice);
      (oa || []).forEach((r:any) => r.telefone_normalizado && oaHits.add(r.telefone_normalizado));
    }

    const elegiveis: any[] = [];
    for (const c of candidatos) {
      if (seenTelefones.has(c.telefone_normalizado)) continue;
      if (atividadeRecente.has(c.id)) continue;
      const stageOk = stagesElegiveis.includes(c.stage_id);
      const descarteOk = !!c.motivo_descarte;
      const oaOk = oaHits.has(c.telefone_normalizado);
      if (!stageOk && !descarteOk && !oaOk) continue;
      seenTelefones.add(c.telefone_normalizado);
      elegiveis.push(c);
    }

    // 3) Ordenar por prioridade empreendimento, depois updated_at desc
    elegiveis.sort((a, b) => {
      const pa = prioridade(a.empreendimento);
      const pb = prioridade(b.empreendimento);
      if (pa !== pb) return pa - pb;
      return (b.updated_at || "").localeCompare(a.updated_at || "");
    });

    // 4) Atribuir ondas: 1..50 -> 1; 51..200 -> 2; 201..444 -> 3
    const final = elegiveis.slice(0, 444);
    const rows = final.map((c, idx) => ({
      lead_id: c.id,
      onda: idx < 50 ? 1 : idx < 200 ? 2 : 3,
      empreendimento_origem: c.empreendimento,
      telefone_normalizado: c.telefone_normalizado,
      nome: c.nome,
      ordem: idx + 1,
      status: "pending",
    }));

    if (rows.length === 0) {
      return jsonResponse({ ok: true, total: 0, message: "Nenhum lead elegível encontrado." });
    }

    // 5) Insert em batches
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error } = await supabase.from("campanha_atrio_audiencia").insert(slice);
      if (error) throw error;
    }

    // Ajusta total_alvo do controle conforme realmente disponível
    const c1 = rows.filter(r => r.onda === 1).length;
    const c2 = rows.filter(r => r.onda === 2).length;
    const c3 = rows.filter(r => r.onda === 3).length;
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c1 }).eq("onda", 1);
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c2 }).eq("onda", 2);
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c3 }).eq("onda", 3);

    return jsonResponse({ ok: true, total: rows.length, por_onda: { 1: c1, 2: c2, 3: c3 } });
  } catch (e) {
    console.error("preparar-audiencia error", e);
    return errorResponse(e instanceof Error ? e.message : String(e), 500);
  }
});
