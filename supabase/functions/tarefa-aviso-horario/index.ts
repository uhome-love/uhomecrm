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

const ANTES_MIN = 15; // avisa só tarefas que vão vencer nos próximos 15 min (cron roda a cada 15 min)
const LOTE_MIN = 3;   // 3+ tarefas no mesmo horário viram 1 aviso só

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
  let body: { dry_run?: boolean; agora?: string } = {};
  try { body = await req.json(); } catch (_) { /* opcional */ }
  const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

  const agora = body.agora ? new Date(body.agora).getTime() : Date.now();
  const hojeBRT = new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);

  const { data: tarefas, error } = await sb.from("pipeline_tarefas")
    .select("id, titulo, descricao, tipo, responsavel_id, vence_em, hora_vencimento, created_at, updated_at, pipeline_lead_id, lead:pipeline_leads(nome, empreendimento)")
    .eq("status", "pendente").eq("vence_em", hojeBRT).not("hora_vencimento", "is", null)
    .not("responsavel_id", "is", null).limit(2000);
  if (error) return json({ ok: false, error: error.message });

  // Só tarefas que VÃO vencer (próximos 15 min). Nunca avisa tarefa criada/alterada
  // em cima da hora nem tarefa já vencida/atrasada.
  const vencendo = (tarefas ?? []).flatMap((t) => {
    if ((t.tipo || "").startsWith("visita") || t.tipo === "confirmar_visita") return [];
    const ts = new Date(`${t.vence_em}T${String(t.hora_vencimento).slice(0, 5)}:00-03:00`).getTime();
    if (!(ts > agora && ts <= agora + ANTES_MIN * 60_000)) return [];
    const limite = ts - ANTES_MIN * 60_000;
    const mexida = Math.max(new Date(t.created_at).getTime(), new Date(t.updated_at || t.created_at).getTime());
    if (mexida > limite) return [];
    return [{ ...t, ts }];
  });
  if (!vencendo.length) return json({ ok: true, enviados: 0 });

  // Agrupa por corretor + horário
  const grupos = new Map<string, typeof vencendo>();
  for (const t of vencendo) {
    const g = `${t.responsavel_id}|${String(t.hora_vencimento).slice(0, 5)}`;
    grupos.set(g, [...(grupos.get(g) ?? []), t]);
  }

  const keysIndiv = vencendo.map((t) => `tarefa_hora_${t.id}`);
  const keysLote = [...grupos.keys()].map((g) => { const [u, h] = g.split("|"); return `tarefa_lote_${u}_${hojeBRT}_${h}`; });
  const { data: ja } = await sb.from("notifications").select("agrupamento_key")
    .eq("tipo", "tarefa_horario").in("agrupamento_key", [...keysIndiv, ...keysLote]);
  const jaSet = new Set((ja ?? []).map((n) => n.agrupamento_key));

  let enviados = 0; let lotes = 0;
  // O push sai pelo gatilho do sino (trg_push_on_notification) — 1 push por aviso.
  for (const [g, lista] of grupos) {
    const [userId, hora] = g.split("|");
    if (lista.length >= LOTE_MIN) {
      const ak = `tarefa_lote_${userId}_${hojeBRT}_${hora}`;
      if (jaSet.has(ak) || lista.every((t) => jaSet.has(`tarefa_hora_${t.id}`))) continue;
      enviados++; lotes++;
      if (body.dry_run) continue;
      const nomes = lista.map((t) => (t.lead as { nome?: string } | null)?.nome).filter(Boolean).slice(0, 3).join(", ");
      await sb.from("notifications").insert({
        user_id: userId, tipo: "tarefa_horario", categoria: "tarefas",
        titulo: `⏰ ${hora} · ${lista.length} tarefas para fazer`,
        mensagem: nomes ? `${nomes}${lista.length > 3 ? ` e mais ${lista.length - 3}` : ""}` : "Abra suas tarefas",
        agrupamento_key: ak,
        dados: { tarefa_ids: lista.map((t) => t.id), url: "/tarefas" },
      });
      continue;
    }
    for (const t of lista) {
      const ak = `tarefa_hora_${t.id}`;
      if (jaSet.has(ak)) continue;
      enviados++;
      if (body.dry_run) continue;
      const lead = t.lead as { nome?: string; empreendimento?: string | null } | null;
      const nome = lead?.nome;
      const titulo = `⏰ ${hora} · ${nome || "Tarefa"}`;
      const acao = nome ? acaoDaTarefa(t.tipo, t.titulo, nome) : (t.titulo || "Tarefa").split(" — ")[0];
      const nota = (t.descricao || "").trim().slice(0, 120);
      const mensagem = `${acao}${lead?.empreendimento ? ` — ${lead.empreendimento}` : ""}${nota ? `\n"${nota}"` : ""}`;
      await sb.from("notifications").insert({
        user_id: userId, tipo: "tarefa_horario", categoria: "tarefas",
        titulo, mensagem, agrupamento_key: ak,
        dados: { tarefa_id: t.id, lead_id: t.pipeline_lead_id, url: "/tarefas" },
      });
    }
  }
  try {
    if (!body.dry_run && enviados) await sb.from("ops_events").insert({
      fn: "tarefa-aviso-horario", level: "info", category: "tarefa_push",
      message: "avisos_enviados", ctx: { enviados, lotes, vencendo: vencendo.length },
    });
  } catch (_) { /* best-effort */ }
  return json({ ok: true, vencendo: vencendo.length, enviados, lotes, dry_run: !!body.dry_run });
});
