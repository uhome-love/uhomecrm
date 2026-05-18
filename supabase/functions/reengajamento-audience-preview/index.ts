// Preview de público para o disparo customizado de reengajamento.
// Retorna count + amostra. Não dispara nada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

type AudienceSource = "descartados" | "pipeline_ativo" | "oferta_ativa_lista";
type DedupMode = "exclude_sent" | "include_all" | "only_sent_before";

interface Audience {
  source: AudienceSource;
  tipo_descarte?: "reengajavel" | "definitivo" | "todos";
  stage_ids?: string[];
  lista_id?: string;
  periodo?: { from?: string; to?: string };
  empreendimento?: string;
  dedup_mode?: DedupMode;
  dedup_cutoff?: string;
  dedup_lookback_days?: number;
  limit?: number;
}

function audienceKey(a: Audience): string {
  if (a.source === "descartados") return `descartados:${a.tipo_descarte || "reengajavel"}`;
  if (a.source === "oferta_ativa_lista") return `oferta_ativa:${a.lista_id || "?"}`;
  if (a.source === "pipeline_ativo") return `pipeline:${(a.stage_ids || []).slice().sort().join(",")}`;
  return a.source;
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
    const audSource = audienceKey(audience);

    let leads: Array<{ id: string; nome: string; telefone: string | null; ref: string }> = [];

    if (audience.source === "descartados") {
      let q = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, stage_changed_at, tipo_descarte, reengajamento_enviado_at, empreendimento", { count: "exact" })
        .eq("stage_id", STAGE_DESCARTE_ID)
        .eq("arquivado", false)
        .not("telefone", "is", null);

      if (audience.tipo_descarte && audience.tipo_descarte !== "todos") {
        q = q.eq("tipo_descarte", audience.tipo_descarte);
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
