// roleta-lembrete-credenciamento — 30 min antes de fechar o credenciamento,
// avisa (sino + push) corretores ativos que ainda não se credenciaram no turno.
// Não credencia ninguém nem mexe na roleta. Auth: cron secret ou service role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cron-auth.ts";

const FECHA: Record<string, string> = { manha: "09:30", tarde: "13:30", noturna: "21:30" };
const LABEL: Record<string, string> = { manha: "da manhã", tarde: "da tarde", noturna: "noturna" };

function agoraBRT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { data: `${g("year")}-${g("month")}-${g("day")}`, hora: Number(g("hour")) % 24, dow: g("weekday") };
}

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

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* opcional */ }
  const now = agoraBRT();
  const dryRun = body?.dry_run === true;
  const onlyUser: string | null = body?.only_user ?? null;
  const janela: string = body?.janela ??
    (now.hora < 11 ? "manha" : now.hora < 16 ? "tarde" : "noturna");
  const data = now.data;

  const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
  if (!FECHA[janela]) return json({ ok: false, error: "janela inválida" });
  if (now.dow === "Sun" && !body?.janela) return json({ ok: true, skip: "domingo" });
  const { data: feriado } = await sb.from("feriados").select("*").eq("data", data).maybeSingle();
  if (feriado && !body?.janela) return json({ ok: true, skip: "feriado" });

  const { data: roles } = await sb.from("user_roles").select("user_id").eq("role", "corretor");
  const ids = (roles ?? []).map((r: any) => r.user_id).filter((id: string) => !onlyUser || id === onlyUser);
  if (!ids.length) return json({ ok: true, enviados: 0 });

  const [{ data: profs }, { data: creds }, { data: faltas }, { data: jaAvisados }] = await Promise.all([
    sb.from("profiles").select("id, user_id, nome, ativo").in("user_id", ids),
    sb.from("roleta_credenciamentos").select("auth_user_id, corretor_id, status").eq("data", data).eq("janela", janela),
    sb.from("roleta_presencas").select("corretor_id").eq("data", data).eq("status", "falta"),
    sb.from("notifications").select("user_id").eq("tipo", "lembrete_credenciamento")
      .eq("agrupamento_key", `lembrete_cred_${data}_${janela}`),
  ]);

  const credSet = new Set<string>();
  for (const c of creds ?? []) {
    if (c.status === "rejeitado" || c.status === "recusado") continue;
    if (c.auth_user_id) credSet.add(c.auth_user_id);
    if (c.corretor_id) credSet.add(c.corretor_id);
  }
  const faltaSet = new Set((faltas ?? []).map((f: any) => f.corretor_id));
  const avisadoSet = new Set((jaAvisados ?? []).map((n: any) => n.user_id));

  const enviados: string[] = [];
  const pulados: Record<string, number> = { credenciado: 0, falta: 0, bloqueado: 0, ja_avisado: 0, inativo: 0 };

  for (const p of profs ?? []) {
    if (p.ativo === false) { pulados.inativo++; continue; }
    if (credSet.has(p.user_id) || credSet.has(p.id)) { pulados.credenciado++; continue; }
    if (faltaSet.has(p.id) || faltaSet.has(p.user_id)) { pulados.falta++; continue; }
    if (avisadoSet.has(p.user_id)) { pulados.ja_avisado++; continue; }
    const { data: motivo } = await sb.rpc("roleta_motivo_bloqueio", { p_auth_user_id: p.user_id, p_janela: janela });
    if ((motivo as any)?.bloqueado) { pulados.bloqueado++; continue; }

    enviados.push(p.nome ?? p.user_id);
    if (dryRun) continue;

    const titulo = "⏰ Não esquece de se credenciar!";
    const mensagem = `Está na empresa, em visita ou no plantão? O credenciamento da roleta ${LABEL[janela]} fecha às ${FECHA[janela]}.`;
    await sb.from("notifications").insert({
      user_id: p.user_id, tipo: "lembrete_credenciamento", categoria: "roleta",
      titulo, mensagem, agrupamento_key: `lembrete_cred_${data}_${janela}`,
      dados: { janela, data, url: "/roleta" },
    });
    try {
      await fetch(`${url}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: p.user_id, title: titulo, body: mensagem, url: "/roleta",
          data: { tag: `lembrete_cred_${data}_${janela}`, url: "/roleta" },
        }),
      });
    } catch (e) { console.warn("push falhou", (e as Error)?.message); }
  }

  return json({ ok: true, data, janela, dry_run: dryRun, enviados: enviados.length, nomes: enviados, pulados });
});
