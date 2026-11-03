// natal-central-limpeza — apaga os materiais da Campanha Natal 2026 (bucket + tabela).
// Roda sozinha só a partir de 27/12/2026 (BRT). Antes disso, só admin/diretor com {forcar:true}.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "campanha-natal";
const DATA_LIMPEZA = "2026-12-27";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: { forcar?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* opcional */ }

  const hojeBRT = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  let autorizado = hojeBRT >= DATA_LIMPEZA;

  if (!autorizado && body.forcar) {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (u?.user) {
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", u.user.id);
      autorizado = (roles ?? []).some((r) => r.role === "admin" || r.role === "diretor");
    }
  }
  if (!autorizado) return json({ ok: false, error: "não autorizado" }, 403);

  let arquivos = 0;
  for (const pasta of ["cards", "disparos", "instagram", "molduras", "fotos", "pdfs", ""]) {
    for (;;) {
      const { data } = await sb.storage.from(BUCKET).list(pasta, { limit: 100 });
      const nomes = (data ?? []).filter((f) => f.id).map((f) => (pasta ? `${pasta}/${f.name}` : f.name));
      if (!nomes.length) break;
      const { error } = await sb.storage.from(BUCKET).remove(nomes);
      if (error) return json({ ok: false, error: error.message, arquivos }, 500);
      arquivos += nomes.length;
    }
  }
  const { count } = await sb.from("natal_materiais").delete({ count: "exact" }).not("id", "is", null);
  if (hojeBRT >= DATA_LIMPEZA) await sb.rpc("natal_central_desagendar");
  console.log(`natal-central-limpeza: ${arquivos} arquivos, ${count ?? 0} linhas`);
  return json({ ok: true, arquivos, linhas: count ?? 0 });
});
