// visita-pendente-lembrete — avisa (sino + push) o corretor quando uma visita dele
// segue "marcada" 2h após o horário. 1 aviso por visita. Não altera a visita.
// Auth: cron secret (CAPI_CRON_SECRET) ou requireCronAuth.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";

const HORAS = 2;
const DIAS = 7;

Deno.serve(async (req) => {
  const capiSecret = Deno.env.get("CAPI_CRON_SECRET");
  const enviado = req.headers.get("x-cron-secret");
  if (!(capiSecret && enviado && enviado === capiSecret)) {
    const denied = requireCronAuth(req);
    if (denied) return denied;
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);
  let body: { dry_run?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* opcional */ }
  const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

  const agora = Date.now();
  const hojeBRT = new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);
  const inicio = new Date(agora - 3 * 3600_000 - DIAS * 86400_000).toISOString().slice(0, 10);

  const { data: visitas, error } = await sb.from("visitas")
    .select("id, corretor_id, nome_cliente, empreendimento, data_visita, hora_visita, tipo")
    .eq("status", "marcada").gte("data_visita", inicio).lte("data_visita", hojeBRT).limit(1000);
  if (error) return json({ ok: false, error: error.message });

  const vencidas = (visitas ?? []).filter((v) => {
    if (!v.corretor_id || (v.tipo || "lead") !== "lead") return false;
    const hora = (v.hora_visita || "23:59").slice(0, 5);
    return new Date(`${v.data_visita}T${hora}:00-03:00`).getTime() + HORAS * 3600_000 < agora;
  });
  if (!vencidas.length) return json({ ok: true, enviados: 0 });

  const keys = vencidas.map((v) => `visita_pendente_${v.id}`);
  const { data: ja } = await sb.from("notifications").select("agrupamento_key")
    .eq("tipo", "visita_pendente_registro").in("agrupamento_key", keys);
  const jaSet = new Set((ja ?? []).map((n) => n.agrupamento_key));

  let enviados = 0;
  for (const v of vencidas) {
    const ak = `visita_pendente_${v.id}`;
    if (jaSet.has(ak)) continue;
    enviados++;
    if (body.dry_run) continue;
    const [, m, d] = v.data_visita.split("-");
    const quando = v.data_visita === hojeBRT ? "" : ` de ${d}/${m}`;
    const titulo = "📋 Registre o resultado da visita";
    const mensagem = `Visita com ${v.nome_cliente}${quando} às ${(v.hora_visita || "").slice(0, 5)} ainda sem feedback. O CRM fica bloqueado até registrar.`;
    await sb.from("notifications").insert({
      user_id: v.corretor_id, tipo: "visita_pendente_registro", categoria: "visitas",
      titulo, mensagem, agrupamento_key: ak, dados: { visita_id: v.id, url: "/agenda-visitas" },
    });
    try {
      await fetch(`${url}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: v.corretor_id, title: titulo, body: mensagem, url: "/agenda-visitas",
          data: { tag: ak, url: "/agenda-visitas" },
        }),
      });
    } catch (e) { console.warn("push falhou", (e as Error)?.message); }
  }
  return json({ ok: true, vencidas: vencidas.length, enviados, dry_run: !!body.dry_run });
});
