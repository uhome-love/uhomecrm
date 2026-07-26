// reengajamento-worker-tick
// Worker sem auto-chain. Cron chama a cada minuto; envia no MÁXIMO 1 mensagem por tick
// (batch_size=1 durante warm-up). Pacing controlado por delay entre invocações via
// reengajamento_config.ultimo_envio_at, não por sleep interno (evita duplo envio
// quando row fica >6 min em 'processing' e é re-reclamada).
//
// Regras:
// - Gate global (system_flags.campaign_dispatch_enabled) obrigatório (é worker automático).
// - Respeita paused, paused_until_release, janela horária e cap_do_dia().
// - Escolhe o run mais antigo com fila viva (pending ou processing estagnada) e claima
//   SÓ dele — RPC exige p_run_id.
// - Grava heartbeat em reengajamento_worker_heartbeat a cada execução.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendMetaTemplate,
  uploadMetaMediaFromUrl,
} from "../_shared/metaSend.ts";
import {
  isCampaignDispatchEnabled,
  pausedResponse,
} from "../_shared/campaign-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HEARTBEAT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_BATCH = 1; // durante warm-up: 1 por tick

type HeartbeatPatch = {
  status: string;
  reason?: string | null;
  batch_size?: number;
  sent?: number;
  error?: string | null;
};

function nowBRT(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${
      get("minute")
    }:${get("second")}`,
  );
}

function withinWindow(cfg: any): boolean {
  try {
    const now = nowBRT();
    const dow = now.getDay(); // 0=dom
    const dias: number[] = Array.isArray(cfg.dias_semana) ? cfg.dias_semana : [];
    if (dias.length > 0 && !dias.includes(dow)) return false;
    const [hi, mi] = String(cfg.horario_inicio || "08:00:00").split(":").map(
      Number,
    );
    const [hf, mf] = String(cfg.horario_fim || "20:00:00").split(":").map(
      Number,
    );
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= hi * 60 + mi && cur <= hf * 60 + mf;
  } catch {
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const workerId = crypto.randomUUID();

  const writeHeartbeat = async (patch: HeartbeatPatch) => {
    await supabase.from("reengajamento_worker_heartbeat").upsert({
      id: HEARTBEAT_ID,
      last_run_at: new Date().toISOString(),
      last_status: patch.status,
      last_reason: patch.reason ?? null,
      last_batch_size: patch.batch_size ?? DEFAULT_BATCH,
      last_sent: patch.sent ?? 0,
      last_error: patch.error ?? null,
      updated_at: new Date().toISOString(),
    });
  };

  const respond = async (
    body: Record<string, unknown>,
    heartbeat: HeartbeatPatch,
    status = 200,
  ) => {
    await writeHeartbeat(heartbeat);
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  // 1) Gate global (kill-switch de campanhas)
  const gate = await isCampaignDispatchEnabled();
  if (!gate.enabled) {
    await writeHeartbeat({ status: "skipped", reason: "gate_disabled" });
    return pausedResponse("reengajamento-worker-tick", gate, corsHeaders);
  }

  // 2) Config
  const { data: cfg, error: cfgErr } = await supabase
    .from("reengajamento_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (cfgErr || !cfg) {
    return respond(
      { skipped: true, reason: "no_config" },
      { status: "error", reason: "no_config", error: cfgErr?.message ?? null },
      500,
    );
  }

  if (!cfg.enabled) {
    return respond({ skipped: true, reason: "disabled" }, {
      status: "skipped",
      reason: "config_disabled",
    });
  }
  if (cfg.paused) {
    return respond({ skipped: true, reason: "paused" }, {
      status: "skipped",
      reason: "config_paused",
    });
  }
  if ((cfg as any).paused_until_release) {
    return respond({
      skipped: true,
      reason: "quality_locked",
      motivo: (cfg as any).paused_reason ?? null,
    }, { status: "skipped", reason: "quality_locked" });
  }
  if (!withinWindow(cfg)) {
    return respond({ skipped: true, reason: "out_of_window" }, {
      status: "skipped",
      reason: "out_of_window",
    });
  }

  // 3) Pacing: se o último envio foi há menos que o intervalo alvo, pula.
  const minS = Math.max(1, Number(cfg.delay_min_seconds || 240));
  const maxS = Math.max(minS, Number(cfg.delay_max_seconds || 480));
  const targetGapSec = Math.floor(minS + Math.random() * (maxS - minS));
  if (cfg.ultimo_envio_at) {
    const sinceMs = Date.now() - new Date(cfg.ultimo_envio_at).getTime();
    if (sinceMs < targetGapSec * 1000) {
      return respond({
        skipped: true,
        reason: "aguardando_intervalo",
        proximo_em_s: Math.ceil((targetGapSec * 1000 - sinceMs) / 1000),
      }, {
        status: "skipped",
        reason: "aguardando_intervalo",
      });
    }
  }

  // 4) Cap do dia
  const { data: capRow } = await supabase.rpc("cap_do_dia");
  const cap = Number(capRow ?? 0);
  const { data: sentRow } = await supabase.rpc("enviados_hoje_reengajamento");
  const enviadosHoje = Number(sentRow ?? 0);
  if (cap > 0 && enviadosHoje >= cap) {
    return respond({
      skipped: true,
      reason: "cap_atingido",
      enviados_hoje: enviadosHoje,
      cap_do_dia: cap,
    }, {
      status: "skipped",
      reason: `cap_atingido ${enviadosHoje}/${cap}`,
    });
  }

  // 5) Escolhe o run MAIS ANTIGO com fila viva (pending OU processing estagnada).
  //    RPC claim exige p_run_id, então o worker é agnóstico de run mas resolve 1 por vez.
  const { data: runIdRow, error: pickErr } = await supabase.rpc(
    "reengajamento_pick_next_run",
  );
  if (pickErr) {
    return respond({ error: "pick_run_failed", detail: pickErr.message }, {
      status: "error",
      reason: "pick_run_failed",
      error: pickErr.message,
    }, 500);
  }
  const runId: string | null = (runIdRow as any) ?? null;
  if (!runId) {
    return respond({ skipped: true, reason: "no_live_run" }, {
      status: "idle",
      reason: "no_live_run",
    });
  }

  // 6) Claim 1 item deste run
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_reengajamento_dispatch_queue",
    {
      p_run_id: runId,
      p_batch_size: DEFAULT_BATCH,
      p_worker_id: workerId,
    },
  );
  if (claimErr) {
    return respond({ error: "claim_failed", detail: claimErr.message }, {
      status: "error",
      reason: "claim_failed",
      error: claimErr.message,
    }, 500);
  }
  const items: any[] = Array.isArray(claimed) ? claimed : [];
  if (items.length === 0) {
    return respond({ skipped: true, reason: "empty_claim", run_id: runId }, {
      status: "idle",
      reason: "empty_claim",
    });
  }

  const item = items[0];

  // 7) Envio Meta
  const metaPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const metaToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  if (!metaPhoneId || !metaToken) {
    // devolve item para pending
    await supabase.from("reengajamento_dispatch_queue").update({
      status: "pending",
      locked_at: null,
      locked_by: null,
    } as any).eq("id", item.id);
    return respond({ error: "meta_env_missing" }, {
      status: "error",
      reason: "meta_env_missing",
    }, 500);
  }

  const templateName = item.template_name ||
    String(cfg.meta_template_name || "");
  const templateLang = item.template_language ||
    String(cfg.meta_template_language || "pt_BR");
  const headerUrl = String(cfg.meta_header_image_url || "").trim() ||
    undefined;
  let headerMediaId: string | undefined;
  if (headerUrl) {
    headerMediaId =
      (await uploadMetaMediaFromUrl(metaPhoneId, metaToken, headerUrl)) ||
        undefined;
  }

  const toPhone: string = item.phone_normalized || item.telefone;
  const nome: string = (item.nome || "").split(" ")[0] || "tudo bem";

  const sendRes = await sendMetaTemplate({
    phoneNumberId: metaPhoneId,
    accessToken: metaToken,
    to: toPhone,
    templateName,
    lang: templateLang,
    nome,
    headerImageUrl: headerUrl,
    headerMediaId,
  });

  const nowIso = new Date().toISOString();
  if (sendRes.ok) {
    await supabase.from("reengajamento_dispatch_queue").update({
      status: "sent",
      processed_at: nowIso,
      wamid: sendRes.wamid ?? null,
      error_text: null,
    } as any).eq("id", item.id);

    await supabase.from("reengajamento_config").update({
      ultimo_envio_at: nowIso,
      updated_at: nowIso,
    } as any).eq("id", cfg.id);

    await supabase.from("reengajamento_dispatch_runs").update({
      enviados: (await supabase.rpc("reengajamento_run_bump_enviados", {
        p_run_id: runId,
      })).data ?? undefined,
      ultimo_lead_id: item.lead_id,
      ultimo_lead_nome: item.nome,
    } as any).eq("id", runId);

    return respond(
      {
        ok: true,
        sent: 1,
        run_id: runId,
        lead_id: item.lead_id,
        wamid: sendRes.wamid,
        enviados_hoje: enviadosHoje + 1,
        cap_do_dia: cap,
      },
      {
        status: "sent",
        reason: `run=${runId.slice(0, 8)}`,
        sent: 1,
      },
    );
  }

  // Falha
  const errText = (sendRes.error || "unknown").slice(0, 500);
  await supabase.from("reengajamento_dispatch_queue").update({
    status: "failed",
    processed_at: nowIso,
    error_text: errText,
    attempts: (Number(item.attempts) || 0) + 1,
  } as any).eq("id", item.id);

  return respond(
    { ok: false, error: errText, run_id: runId, lead_id: item.lead_id },
    { status: "failed", reason: errText.slice(0, 200), error: errText },
    200,
  );
});
