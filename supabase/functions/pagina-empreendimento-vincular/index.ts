// pagina-empreendimento-vincular — rotina (cron) que tenta vincular respostas
// da página pública ainda pendentes (lead chegou depois) e avisa o corretor.
// Auth: requireCronAuth (x-cron-secret ou bearer = service role).
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";
import { vincularSeguro } from "../_shared/vincularRespostaPagina.ts";

Deno.serve(async (req) => {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const limite = new Date(Date.now() - 24 * 3600_000).toISOString();

  await sb.from("pagina_empreendimento_respostas").update({ status: "sem_lead" })
    .in("status", ["pendente", "aguardando_corretor"]).lt("created_at", limite);

  const { data: rows } = await sb.from("pagina_empreendimento_respostas")
    .select("id, status, lead_id, telefone_normalizado, telefone_digitado, respostas, periodo_visita")
    .in("status", ["pendente", "aguardando_corretor"]).gte("created_at", limite)
    .order("created_at").limit(100);

  const res: Record<string, number> = {};
  for (const r of rows ?? []) {
    const s = await vincularSeguro(sb, r, "pagina-empreendimento-vincular");
    res[s] = (res[s] ?? 0) + 1;
  }
  return new Response(JSON.stringify({ ok: true, processados: rows?.length ?? 0, res }), {
    headers: { "Content-Type": "application/json" },
  });
});
