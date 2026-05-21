// PARAR TUDO: desliga flag e marca onda em curso como pausada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!isAdmin) return errorResponse("forbidden", 403);

  await supabase.from("system_flags").update({
    flag_value: false, reason: `kill_switch_manual por ${auth.userId}`, updated_by: auth.userId,
  }).eq("flag_name", "campanha_atrio_enabled");

  const { data: ondasEmCurso } = await supabase
    .from("campanha_atrio_controle").select("onda").eq("status", "em_curso");
  for (const o of (ondasEmCurso || [])) {
    await supabase.from("campanha_atrio_controle").update({
      status: "pausada", pausada_em: new Date().toISOString(), motivo_pausa: "kill_switch_manual",
    }).eq("onda", o.onda);
  }

  return jsonResponse({ ok: true, pausadas: (ondasEmCurso || []).map(o => o.onda) });
});
