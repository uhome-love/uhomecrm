import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract campaign/empreendimento name from Jetimob message field */
function extractCampanha(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = message.match(/[Ff]ormul[aá]rio\s+(?:de|do|da|dos|das)\s+(.+)/i);
  return match?.[1]?.trim() || null;
}

/** Normalize empreendimento from any text (origem, campanha, message) */
function normalizeEmpreendimento(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Order matters: more specific patterns first
  if (lower.includes("casa tua")) return "Casa Tua";
  if (lower.includes("orygem")) return "Orygem";
  if (lower.includes("lake eyre")) return "Lake Eyre";
  if (lower.includes("open bosque") || lower.includes("vídeo open") || lower.includes("video open")) return "Open Bosque";
  if (lower.includes("casa bastian")) return "Casa Bastian";
  if (lower.includes("shift")) return "Shift";
  if (lower.includes("seen") && lower.includes("menino")) return "Seen Menino Deus";
  if (lower.includes("botanique")) return "Botanique";
  if (lower.includes("me day")) return "Me Day";
  if (lower.includes("melnick") && lower.includes("day")) return "Melnick Day";
  if (lower.includes("melnick")) return "Melnick Day";
  if (lower.includes("go carlos") && lower.includes("bosque")) return "Go Carlos Bosque";
  if (lower.includes("go carlos")) return "Go Carlos Gomes";
  if (lower.includes("vista menino")) return "Vista Menino Deus";
  if (lower.includes("nilo square") || lower.includes("nilo")) return "Nilo Square";
  if (lower.includes("high garden") && lower.includes("iguatemi")) return "High Garden Iguatemi";
  if (lower.includes("high garden") && lower.includes("rio branco")) return "High Garden Rio Branco";
  if (lower.includes("high garden")) return "High Garden Iguatemi";
  if (lower.includes("vértice") || lower.includes("vertice") || lower.includes("las casas")) return "Las Casas";
  if (lower.includes("essenza")) return "Essenza Club";
  if (lower.includes("prime wish")) return "Prime Wish";
  if (lower.includes("alto lindóia") || lower.includes("alto lindoia")) return "Alto Lindóia";
  if (lower.includes("san andreas")) return "San Andreas";
  if (lower.includes("supreme")) return "Supreme";
  if (lower.includes("boa vista")) return "Boa Vista Country Club";
  if (lower.includes("pontal")) return "Pontal";
  if (lower.includes("alfa")) return "Alfa";
  if (lower.includes("canoas")) return "Avulso Canoas";
  // Website leads (código de imóvel)
  if (lower.includes("código") || lower.includes("codigo") || lower.includes("imóvel") || lower.includes("imovel")) return "Avulso";
  return null;
}

/** Detect origin channel from message/source fields */
function detectCanal(msg: string | null, source: string | null, origin: string | null): string {
  const all = `${msg || ""} ${source || ""} ${origin || ""}`.toLowerCase();
  if (all.includes("tik tok") || all.includes("tiktok")) return "TikTok";
  if (all.includes("meta") || all.includes("facebook") || all.includes("instagram")) return "Meta Ads";
  if (all.includes("google")) return "Google Ads";
  if (all.includes("portal") || all.includes("zap") || all.includes("olx") || all.includes("viva real")) return "Portal";
  if (all.includes("site") || all.includes("website") || all.includes("código")) return "Site";
  if (all.includes("formulário") || all.includes("formulario")) return "Formulário";
  return "Outro";
}

/** Build a unique ID for deduplication (API has no id field) */
function buildJetimobId(lead: any): string {
  const phone = lead.phones?.[0] || lead.phone || "";
  const campaign = lead.campaign_id || "";
  const created = lead.created_at || "";
  return `${phone}_${campaign}_${created}`.replace(/[^a-zA-Z0-9_\-:.]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // Support both cron (anon key) and manual (user JWT) calls
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== supabaseAnonKey) {
        // Real user JWT — verify role
        try {
          const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: userData } = await userClient.auth.getUser();
          if (userData?.user) {
            userId = userData.user.id;
            const adminCheck = createClient(supabaseUrl, serviceRoleKey);
            const { data: roles } = await adminCheck
              .from("user_roles")
              .select("role")
              .eq("user_id", userId);
            const userRoles = (roles || []).map((r: any) => r.role);
            if (!userRoles.includes("admin") && !userRoles.includes("gestor")) {
              return new Response(
                JSON.stringify({ error: "Sem permissão" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (authErr) {
          console.warn("Auth check failed, proceeding as cron:", authErr);
        }
      }
      // If token === anonKey, it's a cron call — no auth needed
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const { broker_id, fix_existing } = body;

    // --- Fix existing leads with bad campaign names ---
    if (fix_existing) {
      const { data: badLeads } = await adminClient
        .from("pipeline_leads")
        .select("id, observacoes, origem")
        .like("origem", "Campanha %");

      let fixed = 0;
      for (const lead of badLeads || []) {
        const campanha = extractCampanha(lead.observacoes);
        if (campanha) {
          await adminClient.from("pipeline_leads").update({
            origem: campanha,
            empreendimento: campanha,
          }).eq("id", lead.id);
          fixed++;
        }
      }
      return new Response(
        JSON.stringify({ fixed, total: (badLeads || []).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Main sync flow ---
    const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
    const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
    if (!JETIMOB_LEADS_URL_KEY || !JETIMOB_LEADS_PRIVATE_KEY) {
      console.error("JETIMOB_LEADS keys not configured — skipping sync");
      return new Response(
        JSON.stringify({ error: "JETIMOB_LEADS keys not configured", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiResponse: Response;
    try {
      apiResponse = await fetch(`https://api.jetimob.com/leads/${JETIMOB_LEADS_URL_KEY}`, {
        method: "GET",
        headers: { "Authorization-Key": JETIMOB_LEADS_PRIVATE_KEY },
      });
    } catch (fetchErr) {
      console.error("Jetimob API fetch failed:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Falha na conexão com Jetimob", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiResponse.ok) {
      const text = await apiResponse.text().catch(() => "");
      console.error("Jetimob API error:", apiResponse.status, text);
      return new Response(
        JSON.stringify({ error: `Erro Jetimob: ${apiResponse.status}`, synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResponse.json();
    let apiLeads = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];

    // CRITICAL: Only import leads created from 2026-03-07 onwards (today forward)
    const SYNC_CUTOFF = "2026-03-07T00:00:00.000000Z";
    apiLeads = apiLeads.filter((lead: any) => {
      const createdAt = lead.created_at || "";
      return createdAt >= SYNC_CUTOFF;
    });

    if (broker_id) {
      apiLeads = apiLeads.filter((lead: any) => {
        const rid = lead.broker_id || lead.responsavel_id || lead.user_id;
        return String(rid) === String(broker_id);
      });
    }

    if (apiLeads.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, skipped: 0, message: "Nenhum lead encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load empreendimento → pipeline_segmento mapping
    // roleta_campanhas uses roleta_segmentos IDs, but pipeline_leads FK references pipeline_segmentos
    // We resolve by matching segment names between the two tables
    const [campanhasRes, roletaSegsRes, pipelineSegsRes] = await Promise.all([
      adminClient.from("roleta_campanhas").select("empreendimento, segmento_id").eq("ativo", true),
      adminClient.from("roleta_segmentos").select("id, nome"),
      adminClient.from("pipeline_segmentos").select("id, nome"),
    ]);

    // Build roleta_segmento_id → pipeline_segmento_id mapping
    const roletaToPipeline = new Map<string, string>();
    for (const rs of roletaSegsRes.data || []) {
      const ps = (pipelineSegsRes.data || []).find(
        (p: any) => p.nome.toLowerCase().trim() === rs.nome.toLowerCase().trim()
      );
      if (ps) roletaToPipeline.set(rs.id, ps.id);
    }

    // Build empreendimento → pipeline_segmento_id mapping
    const empToSegmento = new Map<string, string>();
    for (const c of campanhasRes.data || []) {
      if (c.empreendimento && c.segmento_id) {
        const pipelineSegId = roletaToPipeline.get(c.segmento_id);
        if (pipelineSegId) {
          empToSegmento.set(c.empreendimento.toLowerCase().trim(), pipelineSegId);
        }
      }
    }

    // Helper: resolve segmento from empreendimento name
    function resolveSegmentoId(emp: string | null): string | null {
      if (!emp) return null;
      const lower = emp.toLowerCase().trim();
      if (empToSegmento.has(lower)) return empToSegmento.get(lower)!;
      // Fuzzy: check if any key is contained
      for (const [key, segId] of empToSegmento.entries()) {
        if (lower.includes(key) || key.includes(lower)) return segId;
      }
      return null;
    }

    // Get the "novo_lead" stage
    const { data: stageData } = await adminClient
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (!stageData) {
      console.error("Stage 'novo_lead' not found");
      return new Response(
        JSON.stringify({ error: "Estágio inicial não configurado", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const novoLeadStageId = stageData.id;

    // Deduplication: check existing jetimob_lead_ids
    const jetimobIds = apiLeads.map(buildJetimobId).filter((id: string) => id && id.length > 2);
    
    // Also deduplicate by phone number to catch leads with old "undefined" IDs
    const phones = apiLeads
      .map((l: any) => l.phones?.[0] || l.phone || null)
      .filter(Boolean);

    const [existingByJetimob, existingByPhone] = await Promise.all([
      jetimobIds.length > 0
        ? adminClient.from("pipeline_leads").select("jetimob_lead_id").in("jetimob_lead_id", jetimobIds)
        : Promise.resolve({ data: [] }),
      phones.length > 0
        ? adminClient.from("pipeline_leads").select("telefone").in("telefone", phones)
        : Promise.resolve({ data: [] }),
    ]);

    const existingIds = new Set((existingByJetimob.data || []).map((l: any) => l.jetimob_lead_id));
    const existingPhones = new Set((existingByPhone.data || []).map((l: any) => l.telefone));

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const lead of apiLeads) {
      try {
        const jetimobId = buildJetimobId(lead);
        const phone = lead.phones?.[0] || lead.phone || null;

        // Skip if already exists by ID or phone
        if (existingIds.has(jetimobId) || (phone && existingPhones.has(phone))) {
          skipped++;
          continue;
        }

        const nome = lead.full_name || lead.name || lead.nome || "Lead sem nome";
        const telefone = phone;
        const telefone2 = lead.phones?.[1] || null;
        const email = lead.emails?.[0] || lead.email || null;
        const msg = lead.message || "";
        const campanhaNome = extractCampanha(msg);

        // Resolve empreendimento: campanha name → normalize from origem/message/source
        const origemText = campanhaNome || msg || lead.source || lead.origin || "";
        let empreendimento = campanhaNome ? normalizeEmpreendimento(campanhaNome) || campanhaNome : null;
        if (!empreendimento) {
          empreendimento = normalizeEmpreendimento(origemText) || normalizeEmpreendimento(lead.source) || normalizeEmpreendimento(lead.origin) || null;
        }
        // Fallback: leads without empreendimento go to "Avulso" so distribution doesn't fail
        if (!empreendimento) {
          empreendimento = "Avulso";
        }

        // Determine lead priority based on content
        let prioridadeLead = "media";
        if (msg && msg.length > 10) {
          prioridadeLead = "alta";
        }

        // Resolve segmento from empreendimento
        // For campaign-specific segments (e.g. "Melnick Day Compactos" → Investimento),
        // try the full campanha name first before falling back to empreendimento
        let segmentoId = campanhaNome ? resolveSegmentoId(campanhaNome) : null;
        if (!segmentoId) {
          segmentoId = resolveSegmentoId(empreendimento);
        }

        // origem = channel (TikTok, Meta Ads, etc.) — detected from message/source
        const canalOrigem = detectCanal(msg, lead.source, lead.origin);
        // origem_detalhe = full campaign name from the form (e.g. "Melnick Day Compactos (Video Gabriel)")
        const campanhaDetalhe = campanhaNome || null;

        const { data: insertedLead, error: insertError } = await adminClient
          .from("pipeline_leads")
          .insert({
            nome,
            telefone,
            telefone2,
            email,
            empreendimento,
            segmento_id: segmentoId,
            stage_id: novoLeadStageId,
            origem: canalOrigem,
            origem_detalhe: campanhaDetalhe,
            jetimob_lead_id: jetimobId,
            observacoes: msg || null,
            corretor_id: null,
            created_by: userId,
            prioridade_lead: prioridadeLead,
            aceite_status: "pendente_distribuicao",
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`Insert error for ${jetimobId}:`, insertError.message);
          errors.push(`${nome}: ${insertError.message}`);
          skipped++;
        } else {
          synced++;
          if (phone) existingPhones.add(phone);

          // Auto-distribute via distribute-lead edge function (fire and forget)
          if (insertedLead?.id) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "distribute_single",
                  pipeline_lead_id: insertedLead.id,
                }),
              });
            } catch (distErr) {
              console.warn(`Auto-distribute failed for ${insertedLead.id}:`, distErr);
            }
          }
        }
      } catch (leadErr) {
        console.error("Error processing lead:", leadErr);
        skipped++;
      }
    }

    // Audit log (don't let this fail the whole sync)
    try {
      await adminClient.from("audit_log").insert({
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        modulo: "pipeline",
        acao: "jetimob_sync",
        descricao: `Sync: ${synced} novos, ${skipped} ignorados de ${apiLeads.length} total.${errors.length > 0 ? ` Erros: ${errors.length}` : ""}`,
        origem: userId ? "manual" : "cron",
      });
    } catch (auditErr) {
      console.warn("Audit log insert failed:", auditErr);
    }

    console.log(`Jetimob sync: ${synced} synced, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ synced, skipped, total: apiLeads.length, errors: errors.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("jetimob-sync critical error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", synced: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
