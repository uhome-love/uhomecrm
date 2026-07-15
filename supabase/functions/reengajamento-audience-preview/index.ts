// Preview de público para o disparo customizado de reengajamento.
// Retorna count + amostra. Não dispara nada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

type AudienceSource = "descartados" | "pipeline_ativo" | "oferta_ativa_lista" | "visita_amanha";
type DedupMode = "cooldown" | "exclude_sent" | "include_all" | "only_sent_before";

interface Audience {
  source?: AudienceSource;
  sources?: AudienceSource[];
  canal?: "meta" | "evolution";
  tipo_descarte?: "reengajavel" | "definitivo" | "todos";
  stage_ids?: string[];
  lista_id?: string;
  lista_ids?: string[];
  data_visita?: string;
  periodo?: { from?: string; to?: string };
  empreendimento?: string;
  empreendimentos?: string[];
  motivos_descarte?: string[];
  dedup_mode?: DedupMode;
  dedup_cutoff?: string;
  dedup_lookback_days?: number;
  cooldown_dias?: number;
  include_archived?: boolean;
  limit?: number;
  template_name?: string;
}

// Teto de segurança para agregação client-side dos breakdowns.
// Suficiente para bases grandes sem estourar memória do worker.
const BREAKDOWN_MAX_ROWS = 20000;
const BREAKDOWN_PAGE = 1000;

function audienceKey(a: Audience): string {
  if (a.source === "descartados") return `descartados:${a.tipo_descarte || "reengajavel"}`;
  if (a.source === "oferta_ativa_lista") {
    const ids = (a.lista_ids && a.lista_ids.length ? a.lista_ids : (a.lista_id ? [a.lista_id] : [])).slice().sort();
    return `oferta_ativa:${ids.join(",") || "?"}`;
  }
  if (a.source === "pipeline_ativo") return `pipeline:${(a.stage_ids || []).slice().sort().join(",")}`;
  if (a.source === "visita_amanha") return `visita_amanha:${a.data_visita || ""}`;
  return a.source;
}

const RESPONDEU_NAO_STATUSES = ["respondeu_nao", "respondeu_nao_wave2", "bloqueado", "telefone_invalido"];

const last8Of = (raw: string | null | undefined): string => {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
};

function normalizePhone(raw: string | null | undefined): string | null {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = p.substring(1);
  if (!p.startsWith("55")) p = "55" + p;
  if (p.length === 12) {
    const ddd = p.substring(2, 4);
    const rest = p.substring(4);
    if (/^[6-9]/.test(rest)) p = `55${ddd}9${rest}`;
  }
  if (p.length < 12 || p.length > 13) return null;
  return p;
}

// Carrega os conjuntos de exclusão (supressão Meta + pipeline ativo + frequência recente) para estimativa fiel.
async function loadGuardSets(supabase: any, freqCooldownDias: number) {
  const supressSet = new Set<string>();
  const phoneSet = new Set<string>();
  const emailSet = new Set<string>();
  const recentSet = new Set<string>();
  const PG = 1000;
  const nowIso = new Date().toISOString();
  let sf = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("meta_supressao")
      .select("telefone_last8, suprimir_ate")
      .or(`suprimir_ate.is.null,suprimir_ate.gt.${nowIso}`)
      .range(sf, sf + PG - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) if (r.telefone_last8) supressSet.add(String(r.telefone_last8));
    if (data.length < PG) break;
    sf += PG;
  }
  let pf = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from("v_pipeline_ativo_contatos").select("telefone_last8, email").range(pf, pf + PG - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      if (r.telefone_last8) phoneSet.add(String(r.telefone_last8));
      if (r.email) emailSet.add(String(r.email).toLowerCase());
    }
    if (data.length < PG) break;
    pf += PG;
  }
  if (freqCooldownDias > 0) {
    const cutoff = new Date(Date.now() - freqCooldownDias * 24 * 3600 * 1000).toISOString();
    let ff = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.from("v_ultimo_marketing_por_telefone").select("last8").gt("ultimo_envio", cutoff).range(ff, ff + PG - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) recentSet.add(String(r.last8));
      if (data.length < PG) break;
      ff += PG;
    }
  }
  return { supressSet, phoneSet, emailSet, recentSet };
}

async function applyMetaTemplateDedup(supabase: any, candidatos: Array<{ telefone: string | null }>, templateName?: string, since?: string) {
  if (!templateName || candidatos.length === 0) return { candidatos, removidos: 0 };
  const phonesSent = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let q = supabase
      .from("reengajamento_meta_disparos")
      .select("phone")
      .eq("template_name", templateName)
      .not("phone", "is", null)
      .range(from, from + PAGE - 1);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const key = last8Of(String(row.phone || ""));
      if (key) phonesSent.add(key);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (phonesSent.size === 0) return { candidatos, removidos: 0 };
  const filtered = candidatos.filter((lead) => !phonesSent.has(last8Of(lead.telefone)));
  return { candidatos: filtered, removidos: candidatos.length - filtered.length };
}

function splitValidPhones<T extends { telefone: string | null }>(candidatos: T[]) {
  const validos = candidatos.filter((lead) => !!normalizePhone(lead.telefone));
  return { validos, invalidos: candidatos.length - validos.length };
}

async function exactCount(supabase: any, build: () => any): Promise<number> {
  const { count } = await build().select("id", { count: "exact", head: true });
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const audience: Audience = (body as any)?.audience || {};
    const sourcesArr: AudienceSource[] = (Array.isArray(audience.sources) && audience.sources.length)
      ? audience.sources
      : (audience.source ? [audience.source] : []);
    if (sourcesArr.length === 0) {
      return new Response(JSON.stringify({ error: "audience.source obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Garante audience.source preenchido para os fluxos single-source existentes
    if (!audience.source) audience.source = sourcesArr[0];

    const limit = Math.min(Math.max(Number(audience.limit || 500), 1), 10000);
    const empList: string[] = (Array.isArray(audience.empreendimentos) && audience.empreendimentos.length)
      ? audience.empreendimentos.filter((s): s is string => typeof s === "string" && s.length > 0)
      : (audience.empreendimento ? [audience.empreendimento] : []);
    const dedupMode: DedupMode = audience.dedup_mode || "exclude_sent";
    const dedupLookbackDays = Math.max(1, Number(audience.dedup_lookback_days || 30));
    const includeArchived = audience.include_archived === true;
    const audSource = audienceKey(audience);
    const isMeta = (audience.canal || "meta") === "meta";
    const { data: cfg } = await supabase
      .from("reengajamento_config")
      .select("freq_cooldown_dias")
      .limit(1)
      .maybeSingle();
    const freqCooldownDias = isMeta ? Math.max(0, Number(cfg?.freq_cooldown_dias ?? 14)) : 0;

    // ─── Público COMBINADO (descartados + oferta ativa + pipeline) com dedup por telefone ───
    if (sourcesArr.length > 1) {
      const last8 = (raw: string | null): string => {
        const d = (raw || "").replace(/\D/g, "");
        return d.length >= 8 ? d.slice(-8) : d;
      };
      type L = { id: string; nome: string; telefone: string | null; ref: string; fonte: string };

      const buildDescartados = async (): Promise<L[]> => {
        const cooldownDias = Math.max(0, Number(audience.cooldown_dias ?? 7));
        const cooldownCutoff = new Date(Date.now() - cooldownDias * 24 * 3600 * 1000).toISOString();
        let q = supabase
          .from("pipeline_leads")
          .select("id, nome, telefone")
          .eq("stage_id", STAGE_DESCARTE_ID)
          .not("telefone", "is", null);
        const tipo = audience.tipo_descarte || "reengajavel";
        if (tipo === "reengajavel") {
          // NULL-safe: leads sem tipo_descarte/status (nunca contatados) SÃO reengajáveis
          q = q.or("tipo_descarte.is.null,tipo_descarte.neq.definitivo")
               .or(`reengajamento_status.is.null,reengajamento_status.not.in.(${RESPONDEU_NAO_STATUSES.join(",")})`);
        } else if (tipo === "definitivo") {
          q = q.eq("tipo_descarte", "definitivo");
        }
        if (!includeArchived) q = q.eq("arquivado", false);
        if (audience.periodo?.from) q = q.gte("stage_changed_at", audience.periodo.from);
        if (audience.periodo?.to) q = q.lte("stage_changed_at", audience.periodo.to);
        if (empList.length) q = q.in("empreendimento", empList);
        if (Array.isArray(audience.motivos_descarte) && audience.motivos_descarte.length) {
          q = q.in("motivo_descarte", audience.motivos_descarte);
        }
        if (dedupMode === "exclude_sent") q = q.is("reengajamento_enviado_at", null);
        else if (cooldownDias > 0) q = q.or(`reengajamento_enviado_at.is.null,reengajamento_enviado_at.lt.${cooldownCutoff}`);
        const { data, error } = await q.order("stage_changed_at", { ascending: false }).limit(limit * 2);
        if (error) throw error;
        return (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead", fonte: "descartados" }));
      };

      const buildOfertaAtiva = async (): Promise<L[]> => {
        const listaIds: string[] = (audience.lista_ids && audience.lista_ids.length)
          ? audience.lista_ids
          : (audience.lista_id ? [audience.lista_id] : []);
        if (listaIds.length === 0) return [];
        let q = supabase.from("oferta_ativa_leads").select("id, nome, telefone, email").in("lista_id", listaIds).not("telefone", "is", null);
        if (audience.periodo?.from) q = q.gte("created_at", audience.periodo.from);
        if (audience.periodo?.to) q = q.lte("created_at", audience.periodo.to);
        if (empList.length) q = q.in("empreendimento", empList);
        const { data, error } = await q.order("created_at", { ascending: false }).limit(limit * 2);
        if (error) throw error;
        return (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, email: l.email, ref: "oferta_ativa_lead", fonte: "oferta_ativa_lista" }));
      };

      const priority: AudienceSource[] = ["descartados", "oferta_ativa_lista"];
      const ordered = priority.filter((s) => sourcesArr.includes(s));
      const porFonte: Record<string, number> = {};
      const seen = new Set<string>();
      const merged: L[] = [];
      let totalBruto = 0;
      for (const src of ordered) {
        const part = src === "descartados" ? await buildDescartados() : await buildOfertaAtiva();
        porFonte[src] = part.length;
        totalBruto += part.length;
        for (const l of part) {
          const key = last8(l.telefone);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(l);
        }
      }
      // Guarda de pipeline ativo + frequência (estimativa fiel ao disparo real)
      const templateDedup = dedupMode === "include_all"
        ? { candidatos: merged, removidos: 0 }
        : await applyMetaTemplateDedup(
          supabase,
          merged,
          isMeta ? audience.template_name : undefined,
          new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString(),
        );
      const phoneSplit = splitValidPhones(templateDedup.candidatos);
      const { supressSet, phoneSet, emailSet, recentSet } = await loadGuardSets(supabase, freqCooldownDias);
      let removidosSupressao = 0, removidosPipeline = 0, removidosFrequencia = 0;
      const guarded = phoneSplit.validos.filter((l) => {
        const ph = last8Of(l.telefone);
        if (isMeta && ph && supressSet.has(ph)) { removidosSupressao++; return false; }
        if ((ph && phoneSet.has(ph)) || (emailSet.size && (l as any).email && emailSet.has(String((l as any).email).toLowerCase()))) { removidosPipeline++; return false; }
        if (isMeta && ph && recentSet.has(ph)) { removidosFrequencia++; return false; }
        return true;
      });
      const finalLeads = guarded.slice(0, limit);
      return new Response(JSON.stringify({
        count: finalLeads.length,
        count_pre_dedup: totalBruto,
        sample_count: finalLeads.length,
        sample: finalLeads.slice(0, 20),
        audience_source: audSource,
        funil: {
          por_fonte: porFonte,
          total_bruto: totalBruto,
          duplicados_removidos: (totalBruto - merged.length) + templateDedup.removidos,
          telefones_invalidos: phoneSplit.invalidos,
          suprimidos_meta: removidosSupressao,
          removidos_pipeline_ativo: removidosPipeline,
          removidos_frequencia: removidosFrequencia,
          elegiveis: finalLeads.length,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let leads: Array<{ id: string; nome: string; telefone: string | null; ref: string }> = [];


    if (audience.source === "descartados") {
      // ─── Funil completo (auditoria) ───
      // Regra nova: elegível = em Descarte, com telefone, não terminal, fora do cooldown.
      // "Quem não respondeu nada continua elegível" — só sai do pool quem respondeu NÃO ou foi marcado terminal.
      const cooldownDias = Math.max(0, Number(audience.cooldown_dias ?? 7));
      const cooldownCutoff = new Date(Date.now() - cooldownDias * 24 * 3600 * 1000).toISOString();

      const totalBrutoDescarte = (await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID)
      ).count ?? 0;

      const inativosCount = (await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .or(`tipo_descarte.eq.definitivo,reengajamento_status.in.(${RESPONDEU_NAO_STATUSES.join(",")})`)
      ).count ?? 0;

      const semTelefoneCount = (await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .is("telefone", null)
      ).count ?? 0;

      const arquivadosCount = (await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .eq("arquivado", true)
      ).count ?? 0;

      // Em cooldown: receberam disparo recente e ainda não passou o cooldown (e não são terminais)
      const emCooldownCount = cooldownDias > 0 ? ((await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .not("telefone", "is", null)
        .or("tipo_descarte.is.null,tipo_descarte.neq.definitivo")
        .or(`reengajamento_status.is.null,reengajamento_status.not.in.(${RESPONDEU_NAO_STATUSES.join(",")})`)
        .not("reengajamento_enviado_at", "is", null)
        .gte("reengajamento_enviado_at", cooldownCutoff)
      ).count ?? 0) : 0;

      // 2. Query de elegíveis aplicando filtros do usuário
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, stage_changed_at, tipo_descarte, reengajamento_status, reengajamento_enviado_at, empreendimento, arquivado", { count: "exact" })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .not("telefone", "is", null);

      // Inativados (respondeu não / definitivo) SEMPRE excluídos quando tipo = reengajavel
      const tipo = audience.tipo_descarte || "reengajavel";
      if (tipo === "reengajavel") {
        // NULL-safe: leads sem tipo_descarte/status (nunca contatados) SÃO reengajáveis
        q = q.or("tipo_descarte.is.null,tipo_descarte.neq.definitivo")
             .or(`reengajamento_status.is.null,reengajamento_status.not.in.(${RESPONDEU_NAO_STATUSES.join(",")})`);
      } else if (tipo === "definitivo") {
        q = q.eq("tipo_descarte", "definitivo");
      }

      if (!includeArchived) {
        q = q.eq("arquivado", false);
      }

      if (audience.periodo?.from) q = q.gte("stage_changed_at", audience.periodo.from);
      if (audience.periodo?.to) q = q.lte("stage_changed_at", audience.periodo.to);
      if (empList.length) q = q.in("empreendimento", empList);

      // Dedup novo: cooldown (default). Mantém modos antigos como override.
      if (dedupMode === "exclude_sent") {
        q = q.is("reengajamento_enviado_at", null);
      } else if (dedupMode === "only_sent_before" && audience.dedup_cutoff) {
        q = q.not("reengajamento_enviado_at", "is", null).lte("reengajamento_enviado_at", audience.dedup_cutoff);
      } else if (dedupMode === "include_all") {
        // sem filtro de envio
      } else if (cooldownDias > 0) {
        // Default: elegível se nunca recebeu OU se passou o cooldown
        q = q.or(`reengajamento_enviado_at.is.null,reengajamento_enviado_at.lt.${cooldownCutoff}`);
      }


      const { data, error, count } = await q.order("stage_changed_at", { ascending: false }).limit(limit);
      if (error) throw error;
      leads = (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" }));

      // ── Breakdowns (empreendimento / recência / motivo) sobre a MESMA base filtrada ──
      // Reaplicamos a mesma cláusula em queries agregadas leves para dar mapa ao operador.
      const buildBase = () => {
        let b = supabase
          .from("pipeline_leads")
          .select("empreendimento, stage_changed_at, motivo_descarte", { count: "exact" })
          .eq("stage_id", STAGE_DESCARTE_ID)
          .not("telefone", "is", null);
        if (tipo === "reengajavel") {
          b = b.or("tipo_descarte.is.null,tipo_descarte.neq.definitivo")
               .or(`reengajamento_status.is.null,reengajamento_status.not.in.(${RESPONDEU_NAO_STATUSES.join(",")})`);
        } else if (tipo === "definitivo") {
          b = b.eq("tipo_descarte", "definitivo");
        }
        if (!includeArchived) b = b.eq("arquivado", false);
        if (audience.periodo?.from) b = b.gte("stage_changed_at", audience.periodo.from);
        if (audience.periodo?.to) b = b.lte("stage_changed_at", audience.periodo.to);
        if (empList.length) b = b.in("empreendimento", empList);
        if (dedupMode === "exclude_sent") b = b.is("reengajamento_enviado_at", null);
        else if (dedupMode === "only_sent_before" && audience.dedup_cutoff) {
          b = b.not("reengajamento_enviado_at", "is", null).lte("reengajamento_enviado_at", audience.dedup_cutoff);
        } else if (dedupMode !== "include_all" && cooldownDias > 0) {
          b = b.or(`reengajamento_enviado_at.is.null,reengajamento_enviado_at.lt.${cooldownCutoff}`);
        }
        return b;
      };

      // Amostra grande (até 5000) só para agregar client-side — leve e evita RPC dedicado.
      const { data: aggData } = await buildBase()
        .order("stage_changed_at", { ascending: false })
        .range(0, 4999);

      const breakdown_por_empreendimento: Array<{ empreendimento: string; total: number }> = [];
      const breakdown_por_motivo_descarte: Array<{ motivo: string; total: number }> = [];
      const breakdown_por_recencia = { "7d": 0, "30d": 0, "90d": 0, "180d": 0, "mais": 0 };

      if (Array.isArray(aggData)) {
        const empMap = new Map<string, number>();
        const motMap = new Map<string, number>();
        const now = Date.now();
        const D = (n: number) => n * 24 * 3600 * 1000;
        for (const r of aggData as any[]) {
          const emp = (r.empreendimento || "Sem empreendimento") as string;
          empMap.set(emp, (empMap.get(emp) || 0) + 1);
          const mot = (r.motivo_descarte || "Não informado") as string;
          motMap.set(mot, (motMap.get(mot) || 0) + 1);
          const t = r.stage_changed_at ? new Date(r.stage_changed_at).getTime() : 0;
          const age = now - t;
          if (age <= D(7)) breakdown_por_recencia["7d"]++;
          else if (age <= D(30)) breakdown_por_recencia["30d"]++;
          else if (age <= D(90)) breakdown_por_recencia["90d"]++;
          else if (age <= D(180)) breakdown_por_recencia["180d"]++;
          else breakdown_por_recencia["mais"]++;
        }
        breakdown_por_empreendimento.push(
          ...Array.from(empMap.entries()).map(([empreendimento, total]) => ({ empreendimento, total }))
            .sort((a, b) => b.total - a.total)
        );
        breakdown_por_motivo_descarte.push(
          ...Array.from(motMap.entries()).map(([motivo, total]) => ({ motivo, total }))
            .sort((a, b) => b.total - a.total)
        );
      }

      // Alerta: último disparo do template selecionado
      let ultimo_disparo_template: { template: string; quantos: number; quando: string } | null = null;
      if (audience.template_name) {
        const { data: ult } = await supabase
          .from("reengajamento_meta_disparos")
          .select("created_at")
          .eq("template_name", audience.template_name)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ult?.created_at) {
          const since = new Date(new Date(ult.created_at).getTime() - 24 * 3600 * 1000).toISOString();
          const { count: cQ } = await supabase
            .from("reengajamento_meta_disparos")
            .select("id", { count: "exact", head: true })
            .eq("template_name", audience.template_name)
            .gte("created_at", since);
          ultimo_disparo_template = { template: audience.template_name, quantos: cQ ?? 0, quando: ult.created_at };
        }
      }

      return new Response(JSON.stringify({
        count: count ?? leads.length,
        sample_count: leads.length,
        sample: leads.slice(0, 20),
        audience_source: audSource,
        funil: {
          total_em_descarte: totalBrutoDescarte,
          inativados_definitivos: inativosCount,
          sem_telefone: semTelefoneCount,
          arquivados: arquivadosCount,
          em_cooldown: emCooldownCount,
          cooldown_dias: cooldownDias,
          elegiveis: count ?? leads.length,
        },
        breakdown_por_empreendimento,
        breakdown_por_recencia,
        breakdown_por_motivo_descarte,
        ultimo_disparo_template,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (audience.source === "pipeline_ativo") {
      const stageIds = (audience.stage_ids || []).filter(Boolean);
      if (stageIds.length === 0) {
        return new Response(JSON.stringify({ error: "stage_ids obrigatório para pipeline_ativo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, created_at, empreendimento", { count: "exact" })
        .in("stage_id", stageIds)
        .eq("arquivado", false)
        .not("telefone", "is", null);

      if (audience.periodo?.from) q = q.gte("created_at", audience.periodo.from);
      if (audience.periodo?.to) q = q.lte("created_at", audience.periodo.to);
      if (empList.length) q = q.in("empreendimento", empList);

      const { data, error, count } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      let candidatos = (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" }));

      // dedup via reengajamento_eventos.audience_source
      if (dedupMode !== "include_all" && candidatos.length > 0) {
        const ids = candidatos.map((c) => c.id);
        const since = new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString();
        let evQ = supabase.from("reengajamento_eventos")
          .select("lead_id, created_at")
          .eq("audience_source", audSource)
          .eq("tipo", "enviado")
          .in("lead_id", ids)
          .gte("created_at", since);
        if (dedupMode === "only_sent_before" && audience.dedup_cutoff) {
          evQ = evQ.lte("created_at", audience.dedup_cutoff);
        }
        const { data: evs } = await evQ;
        const enviadosSet = new Set((evs || []).map((e: any) => e.lead_id));
        if (dedupMode === "exclude_sent") candidatos = candidatos.filter((c) => !enviadosSet.has(c.id));
        else if (dedupMode === "only_sent_before") candidatos = candidatos.filter((c) => enviadosSet.has(c.id));
      }

      return new Response(JSON.stringify({
        count: candidatos.length,
        count_pre_dedup: count ?? null,
        sample_count: candidatos.length,
        sample: candidatos.slice(0, 20),
        audience_source: audSource,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (audience.source === "oferta_ativa_lista") {
      const listaIds: string[] = (audience.lista_ids && audience.lista_ids.length)
        ? audience.lista_ids
        : (audience.lista_id ? [audience.lista_id] : []);
      if (listaIds.length === 0) {
        return new Response(JSON.stringify({ error: "lista_id ou lista_ids obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const applyFilters = (q: any) => {
        q = q.in("lista_id", listaIds).not("telefone", "is", null);
        if (audience.periodo?.from) q = q.gte("created_at", audience.periodo.from);
        if (audience.periodo?.to) q = q.lte("created_at", audience.periodo.to);
        if (empList.length) q = q.in("empreendimento", empList);
        return q;
      };

      // Exact total count (head:true bypasses 1000-row cap)
      const { count: totalCount, error: countErr } = await applyFilters(
        supabase.from("oferta_ativa_leads").select("id", { count: "exact", head: true })
      );
      if (countErr) throw countErr;

      // Paginate via .range() in chunks of 1000 up to `limit` (PostgREST default caps at 1000/req)
      const PAGE = 1000;
      const collected: any[] = [];
      for (let offset = 0; offset < limit; offset += PAGE) {
        const to = Math.min(offset + PAGE, limit) - 1;
        const { data: pageData, error: pageErr } = await applyFilters(
          supabase.from("oferta_ativa_leads").select("id, nome, telefone, email, created_at, empreendimento")
        )
          .order("created_at", { ascending: false })
          .range(offset, to);
        if (pageErr) throw pageErr;
        if (!pageData || pageData.length === 0) break;
        collected.push(...pageData);
        if (pageData.length < (to - offset + 1)) break;
      }
      const count = totalCount ?? collected.length;
      let candidatos = collected.map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, email: l.email, ref: "oferta_ativa_lead" }));
      const beforeDedup = candidatos.length;

      if (dedupMode !== "include_all" && candidatos.length > 0) {
        const ids = candidatos.map((c) => c.id);
        const since = new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString();
        let evQ = supabase.from("reengajamento_eventos")
          .select("lead_id, created_at")
          .eq("audience_source", audSource)
          .eq("tipo", "enviado")
          .in("lead_id", ids)
          .gte("created_at", since);
        if (dedupMode === "only_sent_before" && audience.dedup_cutoff) {
          evQ = evQ.lte("created_at", audience.dedup_cutoff);
        }
        const { data: evs } = await evQ;
        const enviadosSet = new Set((evs || []).map((e: any) => e.lead_id));
        if (dedupMode === "exclude_sent") candidatos = candidatos.filter((c) => !enviadosSet.has(c.id));
        else if (dedupMode === "only_sent_before") candidatos = candidatos.filter((c) => enviadosSet.has(c.id));
      }

      const templateDedup = dedupMode === "include_all"
        ? { candidatos, removidos: 0 }
        : await applyMetaTemplateDedup(
          supabase,
          candidatos,
          isMeta ? audience.template_name : undefined,
          new Date(Date.now() - dedupLookbackDays * 24 * 3600 * 1000).toISOString(),
        );
      candidatos = templateDedup.candidatos as typeof candidatos;

      const phoneSplit = splitValidPhones(candidatos);
      let validos = phoneSplit.validos;

      const { supressSet, phoneSet, emailSet, recentSet } = await loadGuardSets(supabase, freqCooldownDias);
      let removidosSupressao = 0;
      let removidosPipeline = 0;
      let removidosFrequencia = 0;
      validos = validos.filter((l) => {
        const ph = last8Of(l.telefone);
        const em = String((l as any).email || "").trim().toLowerCase();
        if (isMeta && ph && supressSet.has(ph)) { removidosSupressao++; return false; }
        if ((ph && phoneSet.has(ph)) || (em && emailSet.has(em))) { removidosPipeline++; return false; }
        if (isMeta && ph && recentSet.has(ph)) { removidosFrequencia++; return false; }
        return true;
      });

      return new Response(JSON.stringify({
        count: validos.length,
        count_pre_dedup: count ?? null,
        sample_count: validos.length,
        sample: validos.slice(0, 20),
        audience_source: audSource,
        funil: {
          total_bruto: count ?? beforeDedup,
          count_pre_dedup: count ?? beforeDedup,
          duplicados_removidos: beforeDedup - candidatos.length,
          telefones_invalidos: phoneSplit.invalidos,
          suprimidos_meta: removidosSupressao,
          removidos_pipeline_ativo: removidosPipeline,
          removidos_frequencia: removidosFrequencia,
          elegiveis: validos.length,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (audience.source === "visita_amanha") {
      // Reusa stages_alvo + config de visita_amanha_config
      const { data: vaCfg } = await supabase
        .from("visita_amanha_config")
        .select("stages_alvo")
        .limit(1)
        .maybeSingle();
      const stagesAlvo: string[] = Array.isArray(vaCfg?.stages_alvo) ? vaCfg!.stages_alvo : [];
      if (stagesAlvo.length === 0) {
        return new Response(JSON.stringify({ error: "visita_amanha_config.stages_alvo vazio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, nome")
        .in("nome", stagesAlvo);
      const stageIds = (stages || []).map((s: { id: string }) => s.id);
      if (stageIds.length === 0) {
        return new Response(JSON.stringify({ count: 0, sample: [], audience_source: audSource }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento", { count: "exact" })
        .in("stage_id", stageIds)
        .eq("arquivado", false)
        .not("telefone", "is", null);
      if (empList.length) q = q.in("empreendimento", empList);

      const { data, error, count } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      let candidatos = (data || []).map((l: { id: string; nome: string; telefone: string | null }) => ({
        id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead",
      }));

      // dedup via visita_amanha_disparos
      if (dedupMode === "exclude_sent" && candidatos.length > 0) {
        const ids = candidatos.map((c) => c.id);
        const { data: existentes } = await supabase
          .from("visita_amanha_disparos")
          .select("pipeline_lead_id")
          .in("pipeline_lead_id", ids);
        const enviados = new Set((existentes || []).map((e: { pipeline_lead_id: string }) => e.pipeline_lead_id));
        candidatos = candidatos.filter((c) => !enviados.has(c.id));
      }

      return new Response(JSON.stringify({
        count: candidatos.length,
        count_pre_dedup: count ?? null,
        sample_count: candidatos.length,
        sample: candidatos.slice(0, 20),
        audience_source: audSource,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "source inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("audience-preview error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
