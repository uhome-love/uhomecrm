// Cron diário: envia mensagem de reengajamento aos leads descartados (reengajavel) dos últimos N dias
// via Evolution API. Marca reengajamento_enviado_at e reengajamento_status='enviado'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// stage Descarte
const STAGE_DESCARTE_ID = "1dd66c25-3848-4053-9f66-82e902989b4d";

function nowBRT(): Date {
  // Approx BRT = UTC-3
  const d = new Date();
  return new Date(d.getTime() - 3 * 60 * 60 * 1000);
}

function withinWindow(cfg: any): boolean {
  const brt = nowBRT();
  const dow = brt.getUTCDay() === 0 ? 7 : brt.getUTCDay(); // 1=Mon..7=Sun
  if (!cfg.dias_semana?.includes(dow)) return false;
  const hh = brt.getUTCHours();
  const mm = brt.getUTCMinutes();
  const cur = hh * 60 + mm;
  const [hi, mi] = String(cfg.horario_inicio).split(":").map(Number);
  const [hf, mf] = String(cfg.horario_fim).split(":").map(Number);
  return cur >= hi * 60 + mi && cur <= hf * 60 + mf;
}

function normalizePhone(raw: string): string | null {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let bodyForce = false;
  try {
    if (req.method === "POST") {
      const b = await req.clone().json().catch(() => ({}));
      bodyForce = !!(b as any)?.force;
    }
  } catch { /* ignore */ }
  const force = bodyForce || new URL(req.url).searchParams.get("force") === "1";
  const log: any = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    const { data: cfg } = await supabase.from("reengajamento_config").select("*").limit(1).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: "no config" }), { status: 500, headers: corsHeaders });

    if (!cfg.enabled && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!withinWindow(cfg) && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "out_of_window" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cutoff = new Date(Date.now() - cfg.lookback_days * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads, error: leadsErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, tipo_descarte, stage_changed_at")
      .eq("stage_id", STAGE_DESCARTE_ID)
      .eq("tipo_descarte", "reengajavel")
      .is("reengajamento_enviado_at", null)
      .not("telefone", "is", null)
      .gte("stage_changed_at", cutoff)
      .order("stage_changed_at", { ascending: false })
      .limit(cfg.daily_limit);

    if (leadsErr) throw leadsErr;

    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evoUrl || !evoKey) throw new Error("Evolution env vars missing");

    // Reset paused flag at start of run (so a previously-paused config can run again)
    if (force) {
      await supabase.from("reengajamento_config").update({ paused: false }).eq("id", cfg.id);
    }

    for (const lead of leads || []) {
      // Check pause flag before each send (allows real-time stop from UI)
      const { data: liveCfg } = await supabase
        .from("reengajamento_config")
        .select("paused, enabled")
        .eq("id", cfg.id)
        .maybeSingle();
      if (liveCfg?.paused || (!liveCfg?.enabled && !force)) {
        log.errors.push("paused_by_user");
        (log as any).paused = true;
        break;
      }

      const phone = normalizePhone(lead.telefone || "");
      if (!phone) {
        await supabase.from("pipeline_leads")
          .update({ reengajamento_status: "telefone_invalido", reengajamento_enviado_at: new Date().toISOString() })
          .eq("id", lead.id);
        log.skipped++;
        continue;
      }

      const firstName = (lead.nome || "").split(" ")[0] || "tudo bem";
      const text = (cfg.mensagem_template || "").replace(/\{nome\}/g, firstName);

      try {
        const resp = await fetch(`${evoUrl}/message/sendText/${cfg.evolution_instance}`, {
          method: "POST",
          headers: { apikey: evoKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: phone, text }),
        });
        const result = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          log.failed++;
          log.errors.push(`${lead.id}: ${JSON.stringify(result).slice(0, 120)}`);
          continue;
        }

        const messageId = result?.key?.id || result?.messageId || crypto.randomUUID();

        await supabase.from("pipeline_leads")
          .update({
            reengajamento_enviado_at: new Date().toISOString(),
            reengajamento_status: "enviado",
          })
          .eq("id", lead.id);

        await supabase.from("whatsapp_mensagens").insert({
          lead_id: lead.id,
          instance_name: cfg.evolution_instance,
          direction: "sent",
          body: text,
          whatsapp_message_id: messageId,
          timestamp: new Date().toISOString(),
          delivery_status: "sent",
        });

        await supabase.from("pipeline_historico").insert({
          pipeline_lead_id: lead.id,
          observacao: `📤 Mensagem de reengajamento enviada (nutrição automática)`,
        });

        log.sent++;
        // delay anti-ban 3-5s
        await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
      } catch (e) {
        log.failed++;
        log.errors.push(`${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify(log), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reengajamento-enqueue error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
