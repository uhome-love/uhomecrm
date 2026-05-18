// Preview de público para o disparo customizado de reengajamento.
// Retorna count + amostra. Não dispara nada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

type AudienceSource = "descartados" | "pipeline_ativo" | "oferta_ativa_lista" | "visita_amanha";
type DedupMode = "exclude_sent" | "include_all" | "only_sent_before";

interface Audience {
  source: AudienceSource;
  canal?: "meta" | "evolution";
  tipo_descarte?: "reengajavel" | "definitivo" | "todos";
  stage_ids?: string[];
  lista_id?: string;
  data_visita?: string;
  periodo?: { from?: string; to?: string };
  empreendimento?: string;
  dedup_mode?: DedupMode;
  dedup_cutoff?: string;
  dedup_lookback_days?: number;
  cooldown_dias?: number; // NOVO: cooldown entre disparos para o mesmo lead (default 7)
  include_archived?: boolean;
  limit?: number;
}

function audienceKey(a: Audience): string {
  if (a.source === "descartados") return `descartados:${a.tipo_descarte || "reengajavel"}`;
  if (a.source === "oferta_ativa_lista") return `oferta_ativa:${a.lista_id || "?"}`;
  if (a.source === "pipeline_ativo") return `pipeline:${(a.stage_ids || []).slice().sort().join(",")}`;
  if (a.source === "visita_amanha") return `visita_amanha:${a.data_visita || ""}`;
  return a.source;
}

const RESPONDEU_NAO_STATUSES = ["respondeu_nao", "respondeu_nao_wave2", "bloqueado", "telefone_invalido"];

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
    if (!audience.source) {
      return new Response(JSON.stringify({ error: "audience.source obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(Math.max(Number(audience.limit || 500), 1), 2000);
    const dedupMode: DedupMode = audience.dedup_mode || "exclude_sent";
    const dedupLookbackDays = Math.max(1, Number(audience.dedup_lookback_days || 30));
    const includeArchived = audience.include_archived === true;
    const audSource = audienceKey(audience);

    let leads: Array<{ id: string; nome: string; telefone: string | null; ref: string }> = [];

    if (audience.source === "descartados") {
      // ─── Funil completo (auditoria) ───
      // 1. Bruto em Descarte
      const baseDescarte = () => supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", STAGE_DESCARTE_ID);

      const totalBrutoDescarte = (await baseDescarte()).count ?? 0;

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

      // 2. Query de elegíveis aplicando filtros do usuário
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, stage_changed_at, tipo_descarte, reengajamento_status, reengajamento_enviado_at, empreendimento, arquivado", { count: "exact" })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .not("telefone", "is", null);

      // Inativados (respondeu não / definitivo) SEMPRE excluídos quando tipo = reengajavel
      const tipo = audience.tipo_descarte || "reengajavel";
      if (tipo === "reengajavel") {
        q = q.neq("tipo_descarte", "definitivo")
             .not("reengajamento_status", "in", `(${RESPONDEU_NAO_STATUSES.join(",")})`);
      } else if (tipo === "definitivo") {
        q = q.eq("tipo_descarte", "definitivo");
      }
      // tipo === "todos" → sem filtro de tipo

      // Arquivado: por padrão INCLUI tudo (era o bug); usuário pode forçar só não-arquivado
      if (!includeArchived) {
        // includeArchived=false agora significa "só não arquivados" (compatibilidade)
        // mas para descartados, default desejado é INCLUIR. UI envia include_archived=true.
        q = q.eq("arquivado", false);
      }

      if (audience.periodo?.from) q = q.gte("stage_changed_at", audience.periodo.from);
      if (audience.periodo?.to) q = q.lte("stage_changed_at", audience.periodo.to);
      if (audience.empreendimento) q = q.eq("empreendimento", audience.empreendimento);

      if (dedupMode === "exclude_sent") q = q.is("reengajamento_enviado_at", null);
      else if (dedupMode === "only_sent_before" && audience.dedup_cutoff) {
        q = q.not("reengajamento_enviado_at", "is", null).lte("reengajamento_enviado_at", audience.dedup_cutoff);
      }

      const { data, error, count } = await q.order("stage_changed_at", { ascending: false }).limit(limit);
      if (error) throw error;
      leads = (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "pipeline_lead" }));

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
          elegiveis: count ?? leads.length,
        },
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
      if (audience.empreendimento) q = q.eq("empreendimento", audience.empreendimento);

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
      if (!audience.lista_id) {
        return new Response(JSON.stringify({ error: "lista_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let q = supabase
        .from("oferta_ativa_leads")
        .select("id, nome, telefone, created_at, empreendimento", { count: "exact" })
        .eq("lista_id", audience.lista_id)
        .not("telefone", "is", null);
      if (audience.periodo?.from) q = q.gte("created_at", audience.periodo.from);
      if (audience.periodo?.to) q = q.lte("created_at", audience.periodo.to);
      if (audience.empreendimento) q = q.eq("empreendimento", audience.empreendimento);

      const { data, error, count } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      let candidatos = (data || []).map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone, ref: "oferta_ativa_lead" }));

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
      if (audience.empreendimento) q = q.eq("empreendimento", audience.empreendimento);

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
