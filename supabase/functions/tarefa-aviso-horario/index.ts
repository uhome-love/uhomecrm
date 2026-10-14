// tarefa-aviso-horario — avisa (sino + push) o corretor quando chega a hora de uma
// tarefa dele (pipeline_tarefas pendente com hora marcada). 1 aviso por tarefa.
// Não altera a tarefa. Auth: cron secret (CAPI_CRON_SECRET) ou requireCronAuth.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";

const POR_TIPO: Record<string, string> = {
  ligacao: "Ligar para o cliente", ligar: "Ligar para o cliente",
  whatsapp: "Mandar WhatsApp", follow_up: "Fazer follow-up",
};
// Igual a src/lib/tarefaAcao.ts
function acaoDaTarefa(tipo: string | null, titulo: string | null, nomeLead?: string | null): string {
  if (tipo && POR_TIPO[tipo]) return POR_TIPO[tipo];
  let t = (titulo || "").split(" — ")[0].trim();
  t = t.replace(/^pr[oó]ximo contato\s*:?\s*/i, "").trim();
  if (nomeLead) {
    const n = nomeLead.trim().toLowerCase();
    const partes = t.split(":").map((p) => p.trim());
    if (partes.length > 1 && n.startsWith(partes[partes.length - 1].toLowerCase())) t = partes.slice(0, -1).join(": ");
    if (t.toLowerCase() === n || (t && n.startsWith(t.toLowerCase()))) t = "";
  }
  return t || "Fazer contato com o cliente";
}

const JANELA_MIN = 60; // só avisa tarefas que venceram há no máximo 1h (sem avalanche de antigas)

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

  const { data: tarefas, error } = await sb.from("pipeline_tarefas")
    .select("id, titulo, descricao, tipo, responsavel_id, vence_em, hora_vencimento, pipeline_lead_id, lead:pipeline_leads(nome, empreendimento)")
    .eq("status", "pendente").eq("vence_em", hojeBRT).not("hora_vencimento", "is", null)
    .not("responsavel_id", "is", null).limit(2000);
  if (error) return json({ ok: false, error: error.message });

  const naHora = (tarefas ?? []).filter((t) => {
    if ((t.tipo || "").startsWith("visita") || t.tipo === "confirmar_visita") return false;
    const ts = new Date(`${t.vence_em}T${String(t.hora_vencimento).slice(0, 5)}:00-03:00`).getTime();
    return ts <= agora && ts > agora - JANELA_MIN * 60_000;
  });
  if (!naHora.length) return json({ ok: true, enviados: 0 });

  const keys = naHora.map((t) => `tarefa_hora_${t.id}`);
  const { data: ja } = await sb.from("notifications").select("agrupamento_key")
    .eq("tipo", "tarefa_horario").in("agrupamento_key", keys);
  const jaSet = new Set((ja ?? []).map((n) => n.agrupamento_key));

  let enviados = 0; let pushEnviados = 0; let pushFalhas = 0;
  for (const t of naHora) {
    const ak = `tarefa_hora_${t.id}`;
    if (jaSet.has(ak)) continue;
    enviados++;
    if (body.dry_run) continue;
    const lead = t.lead as { nome?: string; empreendimento?: string | null } | null;
    const nome = lead?.nome;
    const hora = String(t.hora_vencimento).slice(0, 5);
    const titulo = `⏰ ${hora} · ${nome || "Tarefa"}`;
    const acao = nome ? acaoDaTarefa(t.tipo, t.titulo, nome) : (t.titulo || "Tarefa").split(" — ")[0];
    const nota = ((t as { descricao?: string | null }).descricao || "").trim().slice(0, 120);
    const mensagem = `${acao}${lead?.empreendimento ? ` — ${lead.empreendimento}` : ""}${nota ? `\n"${nota}"` : ""}`;
    await sb.from("notifications").insert({
      user_id: t.responsavel_id, tipo: "tarefa_horario", categoria: "tarefas",
      titulo, mensagem, agrupamento_key: ak,
      dados: { tarefa_id: t.id, lead_id: t.pipeline_lead_id, url: "/tarefas" },
    });
    let pushOk = false; let detalhe = "";
    try {
      const r = await fetch(`${url}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: t.responsavel_id, title: titulo, body: mensagem, url: "/tarefas",
          data: { tag: ak, url: "/tarefas" },
        }),
      });
      detalhe = (await r.text()).slice(0, 300);
      pushOk = r.ok;
    } catch (e) { detalhe = String((e as Error)?.message || e).slice(0, 300); }
    if (pushOk) pushEnviados++; else pushFalhas++;
    try {
      await sb.from("ops_events").insert({
        fn: "tarefa-aviso-horario", level: pushOk ? "info" : "warn", category: "tarefa_push",
        message: pushOk ? "push_ok" : "push_falhou",
        ctx: { tarefa_id: t.id, user_id: t.responsavel_id, resposta: detalhe },
      });
    } catch (_) { /* best-effort */ }
  }
  return json({ ok: true, na_hora: naHora.length, enviados, push_ok: pushEnviados, push_falhas: pushFalhas, dry_run: !!body.dry_run });
});
