// Prepara audiência da Campanha Átrio Boutique Haus.
// Idempotente por default. Use ?force=1 (ou body { force: true }) para limpar e regenerar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

// Whitelist expandida com TODAS as variantes conhecidas no banco.
const WHITELIST = [
  // Shift
  "Shift", "shift", "Shift - Vanguard",
  // Casa Bastian
  "Casa Bastian",
  // Compactos
  "Melnick Day Compactos", "Melnick Day - Compactos",
  // Skyline Menino Deus
  "Skyline Menino Deus", "Skyline",
  // Alfa
  "Alfa",
  // Connect JW
  "Connect JW",
  // Vista Nova Carlos Gomes
  "Vista Nova Carlos Gomes",
  // Vista Praia de Belas
  "Vista Praia de Belas",
  // Caiz React / Caiz
  "Caiz React", "Caiz", "Caiz Downtown",
  // Vista Menino Deus
  "Vista Menino Deus",
  // Demetrio
  "Demétrio ABF", "Demetrio", "Demétrio",
  // Go Bom Fim
  "Go Bom Fim",
  // Go Home Design
  "Go Home Design",
  // Ora Studios
  "Ora Studios do Cais", "Ora",
  // Trend DT
  "Trend DT Home", "Trend DT",
  // Go Moinhos
  "Go Moinhos",
  // Magno Menino Deus
  "Magno Menino Deus",
  // Estrela / Connect PUCRS / Hola (cobre caso apareçam)
  "Estrela Arista", "Connect PUCRS", "Hola",
];

// Stages que indicam pipeline ATIVO — leads nesses stages NUNCA entram na campanha.
const ACTIVE_STAGE_NAMES = new Set([
  "Novo Lead","Boas-vindas","Contrato Gerado","Envio de Oportunidades",
  "Atualização Bem-estar","Contato Iniciado","Busca","Qualificação","Indicações",
  "Possível Visita","Aquecimento","Visita Marcada","Visita","Proposta",
  "Visita Realizada","Pós-Visita","Negócio Criado","Negociação","Venda",
]);
// Stages elegíveis (inativos/descartados).
const ELIGIBLE_STAGE_NAMES = new Set(["Descarte","Sem Contato","Caiu"]);

function prioridade(emp: string | null): number {
  if (!emp) return 9;
  if (["Connect JW","Shift","Shift - Vanguard"].includes(emp)) return 1;
  if (["Casa Bastian","Skyline Menino Deus","Skyline"].includes(emp)) return 2;
  return 3;
}

// Sanitiza nome: remove " | Profissão" e similares para template WhatsApp.
function sanitizeNome(raw: string | null): string {
  if (!raw) return "";
  let n = raw.split("|")[0].split("/")[0].split(" - ")[0].trim();
  // limita a 60 chars
  if (n.length > 60) n = n.slice(0, 60).trim();
  return n;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!isAdmin) return errorResponse("forbidden", 403);

  // Parse force flag
  let force = false;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("force") === "1") force = true;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.force) force = true;
    }
  } catch { /* noop */ }

  try {
    // Se já existe e não é force, retorna snapshot
    const { count: existing } = await supabase
      .from("campanha_atrio_audiencia")
      .select("*", { count: "exact", head: true });

    if (existing && existing > 0 && !force) {
      const { data: dist } = await supabase
        .from("campanha_atrio_audiencia")
        .select("onda");
      const porOnda = (dist || []).reduce((acc: Record<number, number>, r: any) => {
        acc[r.onda] = (acc[r.onda] || 0) + 1; return acc;
      }, {});
      return jsonResponse({ ok: true, already_prepared: true, total: existing, por_onda: porOnda, hint: "use force=1 para regenerar" });
    }

    if (force && existing && existing > 0) {
      // wipe — só permitido se nenhuma onda iniciou
      const { data: controle } = await supabase
        .from("campanha_atrio_controle")
        .select("onda, status");
      const started = (controle || []).some((c:any) => !["pending","aguardando"].includes(c.status));
      if (started) return errorResponse("Não posso regenerar: alguma onda já iniciou.", 409);
      const { error: delErr } = await supabase.from("campanha_atrio_audiencia").delete().neq("lead_id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
    }

    // Stages
    const { data: stages } = await supabase.from("pipeline_stages").select("id, nome");
    const stageById = new Map<string, string>();
    (stages || []).forEach((s:any) => stageById.set(s.id, s.nome));
    const activeStageIds = new Set((stages || []).filter((s:any) => ACTIVE_STAGE_NAMES.has(s.nome)).map((s:any) => s.id));
    const eligibleStageIds = new Set((stages || []).filter((s:any) => ELIGIBLE_STAGE_NAMES.has(s.nome)).map((s:any) => s.id));

    const cutoff12mo = new Date(Date.now() - 365*24*60*60*1000).toISOString();
    const cutoffAtividade60d = new Date(Date.now() - 60*24*60*60*1000).toISOString();

    // 1) candidatos paginados
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

    // (filtro de atividade removido — basta não estar em pipeline ativo)


    const telefones = Array.from(new Set(candidatos.map(c => c.telefone_normalizado)));
    const oaHits = new Set<string>();
    for (let i = 0; i < telefones.length; i += 200) {
      const slice = telefones.slice(i, i + 200);
      const { data: oa } = await supabase
        .from("oferta_ativa_leads")
        .select("telefone_normalizado")
        .in("telefone_normalizado", slice);
      (oa || []).forEach((r:any) => r.telefone_normalizado && oaHits.add(r.telefone_normalizado));
    }

    // 4) filtragem
    const seenTelefones = new Set<string>();
    const elegiveis: any[] = [];
    const motivos: Record<string, number> = {
      atividade_60d: 0, pipeline_ativo: 0, sem_elegibilidade: 0, telefone_duplicado: 0,
    };
    for (const c of candidatos) {
      if (atividadeRecente.has(c.id)) { motivos.atividade_60d++; continue; }
      if (c.stage_id && activeStageIds.has(c.stage_id)) { motivos.pipeline_ativo++; continue; }
      const stageOk = c.stage_id && eligibleStageIds.has(c.stage_id);
      const oaOk = oaHits.has(c.telefone_normalizado);
      const descarteOk = !!c.motivo_descarte;
      if (!stageOk && !oaOk && !descarteOk) { motivos.sem_elegibilidade++; continue; }
      if (seenTelefones.has(c.telefone_normalizado)) { motivos.telefone_duplicado++; continue; }
      seenTelefones.add(c.telefone_normalizado);
      elegiveis.push(c);
    }

    // 5) ordenar
    elegiveis.sort((a, b) => {
      const pa = prioridade(a.empreendimento);
      const pb = prioridade(b.empreendimento);
      if (pa !== pb) return pa - pb;
      return (b.updated_at || "").localeCompare(a.updated_at || "");
    });

    // 6) cap 444 + sanitização + atribuir ondas
    const final = elegiveis.slice(0, 444);
    const rows = final.map((c, idx) => ({
      lead_id: c.id,
      onda: idx < 50 ? 1 : idx < 200 ? 2 : 3,
      empreendimento_origem: c.empreendimento,
      telefone_normalizado: c.telefone_normalizado,
      nome: sanitizeNome(c.nome),
      ordem: idx + 1,
      status: "pending",
    }));

    if (rows.length === 0) {
      return jsonResponse({ ok: true, total: 0, candidatos: candidatos.length, motivos, message: "Nenhum lead elegível encontrado." });
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("campanha_atrio_audiencia").insert(rows.slice(i, i + 500));
      if (error) throw error;
    }

    const c1 = rows.filter(r => r.onda === 1).length;
    const c2 = rows.filter(r => r.onda === 2).length;
    const c3 = rows.filter(r => r.onda === 3).length;
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c1 }).eq("onda", 1);
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c2 }).eq("onda", 2);
    await supabase.from("campanha_atrio_controle").update({ total_alvo: c3 }).eq("onda", 3);

    // Amostra de nomes sanitizados (20 primeiros)
    const amostra = rows.slice(0, 20).map(r => ({ nome: r.nome, empreendimento: r.empreendimento_origem, onda: r.onda }));

    return jsonResponse({
      ok: true,
      total: rows.length,
      por_onda: { 1: c1, 2: c2, 3: c3 },
      candidatos: candidatos.length,
      motivos_exclusao: motivos,
      amostra_20: amostra,
      regenerado: force,
    });
  } catch (e) {
    console.error("preparar-audiencia error", e);
    return errorResponse(e instanceof Error ? e.message : String(e), 500);
  }
});
