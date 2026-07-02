/**
 * receive-imovelweb-lead — Public webhook for ImovelWeb leads via Make.com.
 * Receives normalized payloads, applies dedup, inserts into pipeline_leads,
 * registers activity history, and distributes through the roleta.
 *
 * POST body (from Make.com):
 * {
 *   "nome": "string",
 *   "email": "string",
 *   "telefone_1": "string",
 *   "telefone_2": "string (optional)",
 *   "mensagem": "string",
 *   "codigo_anuncio": "string",
 *   "codigo_anunciante": "string",
 *   "origem": "imovelweb"
 * }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { PostgrestError } from "https://esm.sh/@supabase/supabase-js@2";
import { distributeLeadDirect } from "../_shared/roleta-distribution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IW-3a: Anonimização inline para logging seguro em ops_events.
// Duplicado de receive-meta-lead — será consolidado em _shared/anon.ts
// (ver mem://cleanup/fase-0.5-backlog).
function anonPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  return `${digits.slice(0, 4)}***(${digits.length})`;
}
function anonEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const s = String(email);
  const at = s.indexOf("@");
  if (at < 0) return `${s.slice(0, 4)}***`;
  return `${s.slice(0, Math.min(4, at))}***${s.slice(at)}`;
}
async function sha256Short(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).slice(0, 4).map(b => b.toString(16).padStart(2, "0")).join("");
}

function _emit(level: string, msg: string, traceId?: string, ctx?: Record<string, unknown>, err?: unknown) {
  const payload = {
    fn: "receive-imovelweb-lead", level, msg, traceId, ctx,
    err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined,
    ts: new Date().toISOString(),
  };
  level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
}

function makeLogger(traceId: string) {
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => _emit("info", msg, traceId, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("warn", msg, traceId, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => _emit("error", msg, traceId, ctx, err),
  };
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Handle concatenated phones: if too long, take first valid phone (10-11 digits, optionally with 55 prefix)
  if (digits.length > 13) {
    // Try to extract first valid Brazilian phone (with or without country code)
    const match = digits.match(/^(55)?(\d{10,11})/);
    if (match) {
      return match[2]; // return without country code
    }
    return null;
  }
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

function normalizeTimelineText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSameTimelineText(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeTimelineText(a);
  const nb = normalizeTimelineText(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
}

function addTimelineDetail(parts: string[], label: string, value: string | null | undefined, blocked: Array<string | null | undefined> = []) {
  const clean = (value || "").trim();
  if (!clean) return;
  if (blocked.some((b) => isSameTimelineText(clean, b))) return;
  parts.push(`${label}: ${clean}`);
}

/** Extract a second phone number from a concatenated string (e.g., "5199876123555199371479") */
function extractSecondPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 13) return null; // Only one phone
  // After first phone (10-13 digits), try to extract second
  const firstLen = digits.startsWith("55") ? (digits.length >= 24 ? 13 : 12) : 11;
  const rest = digits.slice(firstLen);
  return normalizePhone(rest);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = makeLogger(traceId);

  // IW-2: Feature flag para reclassificar orphan leads (Distribution failed) de
  // error/integration → info/business "queued_fila_ceo". Default ativo.
  // Override explícito com IMOVELWEB_FALLBACK_FILA_CEO=false (case-insensitive).
  const fallbackFilaCeo = (Deno.env.get("IMOVELWEB_FALLBACK_FILA_CEO") ?? "true").toLowerCase() !== "false";

  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    supabase.from("ops_events").insert({ fn: "receive-imovelweb-lead", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
  };

  try {
    const body = await req.json();
    L.info("Raw body received", { keys: Object.keys(body) });

    // ── Parse fields ──
    const name = body.nome || body.name || "";
    const email = body.email || "";
    const rawTelefone1 = body.telefone_1 || body.telefone || body.phone || "";
    const rawTelefone2 = body.telefone_2 || "";
    
    // Clean ImovelWeb boilerplate from message
    let mensagem = body.mensagem || body.message || "";
    mensagem = mensagem
      .replace(/¡Após entrar em contato.*$/s, "")
      .replace(/https:\/\/www\.imovelweb\.com\.br\/panel\/feedback\/\S*/g, "")
      .trim();
    
    const codigoAnuncio = body.codigo_anuncio || "";
    const codigoAnunciante = body.codigo_anunciante || "";

    // Normalize phones — handle concatenated numbers
    const telefone1 = normalizePhone(rawTelefone1);
    const telefone2 = normalizePhone(rawTelefone2) || extractSecondPhone(rawTelefone1);

    // Use telefone_1 as primary
    const telefone = telefone1;

    if (!name && !telefone) {
      L.warn("Validation failed — missing name and phone", { body: { nome: body.nome, telefone_1: body.telefone_1 } });
      return new Response(
        JSON.stringify({ error: "Nome ou telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Block test leads (name/email containing "teste" or "test") ──
    const emailLower = (email || "").toLowerCase();
    const nameLower = (name || "").toLowerCase();
    const isTestLead =
      /\btest(e)?\d*\b/.test(nameLower) ||
      /\btest(e)?\d*@/.test(emailLower) ||
      emailLower === "t@t.com" ||
      emailLower === "t2@t.com" ||
      /^teste@teste\./.test(emailLower);
    if (isTestLead) {
      L.warn("Test lead blocked", { nome: name, email });
      return new Response(
        JSON.stringify({ ok: true, blocked: "test_lead", message: "Lead de teste ignorado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve empreendimento from codigo_anuncio ──
    let empreendimento: string | null = null;
    let segmentoId: string | null = null;

    if (codigoAnuncio) {
      const cleanCode = codigoAnuncio.replace(/-UH$/i, "").trim();
      const codeWithSuffix = cleanCode.includes("-") ? cleanCode : `${cleanCode}-UH`;

      const { data: overrideRow } = await supabase
        .from("empreendimento_overrides")
        .select("nome")
        .or(`codigo.eq.${codeWithSuffix},codigo.eq.${cleanCode}`)
        .limit(1)
        .maybeSingle();
      if (overrideRow) empreendimento = overrideRow.nome;

      if (!empreendimento) {
        const { data: rcByCode } = await supabase
          .from("roleta_campanhas")
          .select("empreendimento, segmento_id")
          .ilike("empreendimento", `%${cleanCode}%`)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (rcByCode) empreendimento = rcByCode.empreendimento;
      }
    }

    if (!empreendimento) empreendimento = "Avulso - ImovelWeb";

    // ── Resolve segmento ──
    if (!segmentoId && empreendimento) {
      const { data: rc } = await supabase
        .from("roleta_campanhas")
        .select("segmento_id")
        .ilike("empreendimento", empreendimento)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (rc?.segmento_id) {
        const { data: rs } = await supabase
          .from("roleta_segmentos")
          .select("id, nome")
          .eq("id", rc.segmento_id)
          .maybeSingle();
        if (rs) {
          const { data: ps } = await supabase
            .from("pipeline_segmentos")
            .select("id")
            .ilike("nome", rs.nome)
            .limit(1)
            .maybeSingle();
          if (ps) segmentoId = ps.id;
        }
      }
    }

    // ── Fallback: leads ImovelWeb sem campanha mapeada (Avulso) são de moradia → S1 - Moradia ──
    if (!segmentoId) {
      const { data: s1 } = await supabase
        .from("pipeline_segmentos")
        .select("id")
        .ilike("nome", "S1 - Moradia")
        .limit(1)
        .maybeSingle();
      if (s1) segmentoId = s1.id;
    }



    // ── Dedup by phone ──
    if (telefone) {
      const { data: alreadyProcessed } = await supabase
        .from("jetimob_processed")
        .select("jetimob_lead_id")
        .eq("telefone", telefone)
        .limit(1)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("pipeline_leads")
        .select("id, corretor_id, nome, empreendimento, observacoes, stage_id, arquivado")
        .eq("telefone", telefone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (!existing.corretor_id) {
          // IW-3b: dedup event — lead já existe mas ainda pendente de distribuição.
          L.info("Dedup: pending distribution", { telefone, leadId: existing.id });
          logOps("info", "business", "lead_dedup_skipped_pending", {
            lead_id: existing.id,
            anon_phone: anonPhone(telefone),
            phone_hash: await sha256Short(telefone),
          });
          return new Response(
            JSON.stringify({ success: true, action: "skipped_duplicate_pending", lead_id: existing.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const todayStamp = new Date().toISOString().slice(0, 10);
        const interestLabel = empreendimento || existing.empreendimento || "mesmo imóvel";
        const prevObs = existing.observacoes || "";
        const separator = prevObs ? "\n---\n" : "";
        const newObs = `${prevObs}${separator}[NOVO INTERESSE ${todayStamp}] ${interestLabel} (ImovelWeb)${codigoAnuncio ? ` | Cód: ${codigoAnuncio}` : ""}${mensagem ? ` — "${mensagem}"` : ""}`;

        const DESCARTE_STAGE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";
        const SEM_CONTATO_STAGE_ID = "2fcba9be-1188-4a54-9452-394beefdc330";
        const isDiscarded = existing.stage_id === DESCARTE_STAGE_ID || existing.arquivado === true;

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          observacoes: newObs,
        };
        if (isDiscarded) {
          updatePayload.stage_id = SEM_CONTATO_STAGE_ID;
          updatePayload.stage_changed_at = new Date().toISOString();
          updatePayload.arquivado = false;
          updatePayload.motivo_descarte = null;
        }

        await supabase.from("pipeline_leads").update(updatePayload).eq("id", existing.id);

        // Notification message also includes codigo
        const notifMsg = `${existing.nome || name} demonstrou novo interesse em ${interestLabel} (ImovelWeb).${codigoAnuncio ? ` Cód: ${codigoAnuncio}` : ""}${mensagem ? ` Msg: "${mensagem.slice(0, 100)}"` : ""}`;

        // IW-1: BUGFIX — `fullDesc` antes era usado sem ser declarado, causando
        // "Unhandled exception" em todo lead reativado. Construímos localmente
        // com mesmo formato de notifMsg + contexto temporal BRT.
        const nowBRT = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const fullDesc = `Novo interesse via ImovelWeb (${interestLabel}).${codigoAnuncio ? ` Anúncio: ${codigoAnuncio}.` : ""} Mensagem: ${mensagem || "(sem mensagem)"}. Recebido em: ${nowBRT} BRT.`;

        await Promise.all([
          supabase.from("notifications").insert({
            user_id: existing.corretor_id,
            tipo: "lead",
            categoria: "lead_retorno",
            titulo: `🔄 Lead reativado! ${existing.nome || name}`,
            mensagem: notifMsg,
            dados: { pipeline_lead_id: existing.id, lead_nome: existing.nome || name, novo_empreendimento: interestLabel, codigo_anuncio: codigoAnuncio || null },
            agrupamento_key: `lead_retorno_${existing.id}_${todayStamp}`,
          }),
          supabase.from("pipeline_atividades").insert({
            pipeline_lead_id: existing.id,
            tipo: "entrada",
            titulo: `🔄 Novo interesse via ImovelWeb`,
            descricao: fullDesc,
            data: todayStamp,
            prioridade: "alta",
            status: "completed",
            created_by: existing.corretor_id,
          }),
        ]);

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: existing.corretor_id,
              title: "🔄 Lead reativado!",
              body: `${existing.nome || name} — ${interestLabel}`,
              url: `/pipeline-leads?lead=${existing.id}`,
            }),
          });
        } catch (e) { L.warn("Push error", {}, e); }

        // IW-3b: dedup event — reativação efetiva (descartado ou ativo recebendo novo touch).
        L.info("Reactivated existing lead", { telefone, leadId: existing.id });
        logOps("info", "business", "lead_dedup_reactivated", {
          lead_id: existing.id,
          was_discarded: isDiscarded,
          anon_phone: anonPhone(telefone),
          phone_hash: await sha256Short(telefone),
          empreendimento: interestLabel,
          codigo_anuncio: codigoAnuncio || null,
        });
        return new Response(
          JSON.stringify({ success: true, action: "reactivated", lead_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Skip if phone was ever processed before (permanent dedup)
      if (alreadyProcessed) {
        // IW-3b: dedup event — telefone já registrado em jetimob_processed (permanente).
        L.info("Dedup: permanent registry", { telefone });
        logOps("info", "business", "lead_dedup_skipped_permanent", {
          source: "jetimob_processed_phone",
          anon_phone: anonPhone(telefone),
          phone_hash: await sha256Short(telefone),
        });
        return new Response(
          JSON.stringify({ success: true, action: "skipped_permanent_dedup" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Stage ──
    const { data: stageData } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("tipo", "novo_lead")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (!stageData) {
      return new Response(
        JSON.stringify({ error: "Estágio novo_lead não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Register in permanent dedup BEFORE insert ──
    if (telefone) {
      const dedupRegistryId = `imovelweb-phone:${telefone}`;
      const { error: registryError } = await supabase
        .from("jetimob_processed")
        .upsert({ jetimob_lead_id: dedupRegistryId, telefone }, { onConflict: "jetimob_lead_id" });

      if (registryError) {
        if (registryError.code === "23505") {
          // IW-3b: dedup event — race condition resolvida pelo unique constraint.
          L.info("Dedup: race condition caught by registry", { dedupRegistryId, telefone });
          logOps("info", "business", "lead_dedup_skipped_permanent", {
            source: "race_constraint_23505",
            anon_phone: anonPhone(telefone),
            phone_hash: await sha256Short(telefone),
          });
          return new Response(
            JSON.stringify({ success: true, action: "skipped_race_dedup" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        L.warn("Registry upsert warn", { dedupRegistryId }, registryError);
      }
    }

    // ── Build observacoes with full ImovelWeb context ──
    const obsLines: string[] = [];
    obsLines.push("Lead recebido via ImovelWeb");
    if (codigoAnuncio) obsLines.push(`Imóvel: ${codigoAnuncio}`);
    if (codigoAnunciante) obsLines.push(`Anunciante: ${codigoAnunciante}`);
    if (mensagem) obsLines.push(`Mensagem do interessado: ${mensagem}`);
    if (telefone1) obsLines.push(`Telefone 1: ${telefone1}`);
    if (telefone2) obsLines.push(`Telefone 2: ${telefone2}`);
    if (email) obsLines.push(`E-mail: ${email}`);
    const obsText = obsLines.join("\n");

    // ── Insert lead ──
    const { data: insertedLead, error: insertError } = await supabase
      .from("pipeline_leads")
      .insert({
        nome: name || "Lead ImovelWeb",
        telefone,
        email: email || null,
        empreendimento,
        segmento_id: segmentoId,
        stage_id: stageData.id,
        origem: "imovelweb",
        origem_detalhe: codigoAnuncio ? `Anúncio: ${codigoAnuncio}` : null,
        campanha: "ImovelWeb",
        plataforma: "ImovelWeb",
        observacoes: obsText,
        corretor_id: null,
        aceite_status: "pendente_distribuicao",
        prioridade_lead: mensagem && mensagem.length > 10 ? "alta" : "media",
      })
      .select("id")
      .single();

    if (insertError) {
      // IW-3a: error_detail estruturado (code/hint/details) + payload anonimizado.
      const pgErr = insertError as PostgrestError;
      const errorDetail = {
        message: pgErr.message,
        code: pgErr.code,
        details: pgErr.details,
        hint: pgErr.hint,
        payload_anon: {
          name_first4: (name || "").slice(0, 4),
          anon_phone: anonPhone(telefone),
          anon_email: anonEmail(email),
          phone_hash: telefone ? await sha256Short(telefone) : null,
          empreendimento,
          codigo_anuncio: codigoAnuncio || null,
        },
      };
      L.error("Lead insert failed", { name, telefone, empreendimento }, insertError);
      logOps("error", "system", "Lead insert failed", { name_first4: (name || "").slice(0, 4), empreendimento }, JSON.stringify(errorDetail));
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    L.info("Lead created", { leadId: insertedLead.id, name, empreendimento, codigoAnuncio });
    logOps("info", "business", "Lead created via ImovelWeb", { lead_id: insertedLead.id, name, empreendimento, codigo_anuncio: codigoAnuncio });

    // ── Register entry activity ──
    const entryPrimary = codigoAnuncio ? `Imóvel ${codigoAnuncio}` : empreendimento;
    const atividadeDescricaoParts: string[] = [];
    addTimelineDetail(atividadeDescricaoParts, "Empreendimento", empreendimento, [entryPrimary, "Avulso - ImovelWeb"]);
    addTimelineDetail(atividadeDescricaoParts, "Mensagem", mensagem, [entryPrimary]);

    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: insertedLead.id,
      tipo: "entrada",
      titulo: `Lead gerado via Imóvel Web${entryPrimary ? ` — ${entryPrimary}` : ""}`,
      descricao: atividadeDescricaoParts.length ? atividadeDescricaoParts.join(" • ") : null,
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    }).then(r => { if (r.error) L.warn("Entry activity insert failed", {}, r.error); });

    // ── Auto-distribute via roleta ──
    const distribution = await distributeLeadDirect(supabaseUrl, serviceKey, insertedLead.id, traceId, L);
    if (!distribution.success) {
      // IW-2: orphan path — com flag ativa, classifica como info/business "queued_fila_ceo"
      // (lead persistiu, será distribuído manualmente pela Fila CEO). Sem flag: mantém o
      // comportamento legado de error/integration para alarme imediato.
      if (fallbackFilaCeo) {
        logOps("info", "business", "queued_fila_ceo", {
          lead_id: insertedLead.id,
          name_first4: (name || "").slice(0, 4),
          empreendimento,
          reason: distribution.reason || null,
          detail: distribution.error || null,
          source: "imovelweb",
        });
      } else {
        logOps("error", "integration", "Distribution failed after retries — lead orphaned", { lead_id: insertedLead.id, name, empreendimento, reason: distribution.reason || null, detail: distribution.error || null });
      }
    }

    // ── Audit ──
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      modulo: "pipeline",
      acao: "imovelweb_webhook",
      descricao: `Lead ImovelWeb: ${name} — ${empreendimento} (anúncio: ${codigoAnuncio})`,
      origem: "webhook",
      request_id: traceId,
    }).then(r => { if (r.error) L.warn("Audit insert failed", {}, r.error); });

    return new Response(
      JSON.stringify({ success: true, lead_id: insertedLead.id, empreendimento, distributed: distribution.success, distribution, trace_id: traceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    L.error("Unhandled exception", {}, err);
    logOps("error", "system", "Unhandled exception", {}, err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
