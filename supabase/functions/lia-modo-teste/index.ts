/**
 * lia-modo-teste — envia a 1ª mensagem da recuperação (lia_recupera_a, 3 botões) SÓ para o
 * número de teste configurado em ia_config. Exige modo teste ligado. Segue o caminho do envio
 * real: reinicia a conversa de teste, guarda o texto enviado no histórico e marca a conversa
 * como recuperação de teste (sem lead). Não cria fila, run, lead, Fila CEO nem corretor.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRealUser } from "../_shared/ai-auth.ts";
import { liaPodeEnviarModoTeste } from "../_shared/liaModoTeste.ts";
import { MODELO_TEXTO } from "../_shared/liaRecuperaModelos.ts";

const TESTE_NOME = "Lucas";
const TESTE_PRODUTO = { slug: "open-bosque", nome: "Open Bosque" };

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
  // reinicia a conversa de teste (só as linhas do número de teste)
  const tel8 = to.slice(-8);
  const del1 = await sb.from("lia_conversas").delete().ilike("telefone", `%${tel8}`);
  const del2 = await sb.from("lia_estado").delete().ilike("telefone", `%${tel8}`);
  if (del1.error || del2.error) return json({ ok: false, motivo: "Não foi possível reiniciar a conversa de teste." }, 500);
  const r = await fetch(D360_URL, {
    method: "POST",
    headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: { name: "lia_recupera_a", language: { code: "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: TESTE_NOME }, { type: "text", text: TESTE_PRODUTO.nome }] }] },
    }),
  });
  const t = await r.text().catch(() => "");
  await sb.from("ops_events").insert({ fn: "lia-modo-teste", level: r.ok ? "info" : "error", category: "lia", message: r.ok ? "teste_enviado" : "teste_falhou", ctx: { status: r.status, final: to.slice(-4) }, error_detail: r.ok ? null : t.slice(0, 400) }).then(() => {}, () => {});
  if (!r.ok) return json({ ok: false, motivo: `WhatsApp recusou (${r.status})`, detalhe: t.slice(0, 300) }, 502);
  let waId: string | null = null;
  try { waId = JSON.parse(t)?.messages?.[0]?.id ?? null; } catch { waId = null; }
  const texto = MODELO_TEXTO.lia_recupera_a.replace("{{1}}", TESTE_NOME).replace("{{2}}", TESTE_PRODUTO.nome);
  const agora = new Date().toISOString();
  const est = await sb.from("lia_estado").insert({
    telefone: to, nome: TESTE_NOME, status: "em_conversa", recuperacao: true, lead_id: null,
    produto_slug: TESTE_PRODUTO.slug, last_msg_em: agora, updated_at: agora,
  });
  const conv = await sb.from("lia_conversas").insert({ telefone: to, role: "assistant", conteudo: texto, wa_message_id: waId });
  if (est.error || conv.error) {
    await sb.from("ops_events").insert({ fn: "lia-modo-teste", level: "error", category: "lia", message: "teste_registro_falhou", ctx: { final: to.slice(-4) }, error_detail: (est.error?.message ?? conv.error?.message ?? "").slice(0, 400) }).then(() => {}, () => {});
    return json({ ok: false, motivo: "Mensagem enviada, mas a conversa de teste não foi registrada. Não responda e me avise." }, 500);
  }
  return json({ ok: true, final: to.slice(-4) });
});
