/**
 * lia-modo-teste — envia a 1ª mensagem da recuperação (lia_recupera_a, 3 botões) SÓ para o
 * número de teste configurado em ia_config. Exige modo teste ligado. Não cria fila, run,
 * lead, Fila CEO nem corretor. Só CEO/diretora logados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRealUser } from "../_shared/ai-auth.ts";
import { liaPodeEnviarModoTeste } from "../_shared/liaModoTeste.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const D360_URL = "https://waba-v2.360dialog.io/messages";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = await requireRealUser(req, { roles: ["admin", "diretor"] });
  if (auth.error) return auth.error;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await sb.from("ia_config").select("modo_teste, numero_teste").limit(1).maybeSingle();
  if (!cfg?.modo_teste) return json({ ok: false, motivo: "Ligue o modo teste antes de enviar." }, 409);
  const to = String(cfg.numero_teste ?? "").replace(/\D/g, "");
  if (to.length < 10) return json({ ok: false, motivo: "Número de teste inválido." }, 400);
  if (!await liaPodeEnviarModoTeste(sb, to, "teste")) return json({ ok: false, motivo: "Bloqueado pela trava." }, 409);
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return json({ ok: false, motivo: "WhatsApp da Lia sem chave configurada." }, 500);
  const r = await fetch(D360_URL, {
    method: "POST",
    headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: { name: "lia_recupera_a", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: "Lucas" }, { type: "text", text: "Open Bosque" }] }] },
    }),
  });
  const t = await r.text().catch(() => "");
  await sb.from("ops_events").insert({ fn: "lia-modo-teste", level: r.ok ? "info" : "error", category: "lia", message: r.ok ? "teste_enviado" : "teste_falhou", ctx: { status: r.status, final: to.slice(-4) }, error_detail: r.ok ? null : t.slice(0, 400) }).then(() => {}, () => {});
  if (!r.ok) return json({ ok: false, motivo: `WhatsApp recusou (${r.status})`, detalhe: t.slice(0, 300) }, 502);
  return json({ ok: true, final: to.slice(-4) });
});
