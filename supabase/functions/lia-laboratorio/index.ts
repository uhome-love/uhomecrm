/**
 * lia-laboratorio — roda UM cenário simulado da Lia Recupera (cliente fictício conduzido por IA)
 * usando o mesmo cérebro de produção (lia-chat). Só admin/diretor. Nunca envia WhatsApp.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { abertura, CENARIOS, conferir, contextoRecuperacao, type Msg } from "../_shared/liaLaboratorio.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_TURNOS = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA indisponível" }, 500);
    const admin = createClient(url, service);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", auth.userId);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "diretor")) return json({ error: "Sem permissão" }, 403);

    const body = await req.json().catch(() => ({}));
    const cenario = CENARIOS.find((c) => c.id === body?.cenario_id);
    if (!cenario) return json({ error: "Cenário inválido" }, 400);

    let ficha = "";
    if (cenario.produto) {
      const { data } = await admin.from("lia_produtos").select("ficha").eq("slug", cenario.produto).eq("ativo", true).maybeSingle();
      ficha = String(data?.ficha ?? "");
    }
    const fichaRecupera = contextoRecuperacao(cenario, ficha);

    const conversa: Msg[] = [{ de: "lia", texto: abertura(cenario) }];
    let sinal = "seguindo";

    for (let t = 0; t < MAX_TURNOS; t++) {
      // 1) cliente simulado
      const transcricao = conversa.map((m) => `${m.de === "lia" ? "Lia" : "Você"}: ${m.texto}`).join("\n");
      const rc = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          temperature: 0.7,
          messages: [
            { role: "system", content: `Você interpreta ${cenario.nomeCliente}, um cliente brasileiro respondendo no WhatsApp a uma imobiliária. Roteiro do personagem: ${cenario.persona}\nResponda como pessoa real: curto, informal, uma mensagem só, sem emoji em excesso. Siga o roteiro aos poucos, uma coisa por vez. Se a conversa já terminou para você (despediu-se, foi atendido ou pediu para parar e a Lia confirmou), responda exatamente FIM.` },
            { role: "user", content: `Conversa até agora:\n${transcricao}\n\nSua próxima mensagem:` },
          ],
        }),
      });
      if (!rc.ok) return json({ error: `IA do cliente falhou (${rc.status})` }, 502);
      const cd = await rc.json();
      const fala = String(cd?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
      if (!fala || /^FIM\.?$/i.test(fala)) break;
      conversa.push({ de: "cliente", texto: fala });

      // 2) Lia (mesmo cérebro da produção)
      const messages = conversa.map((m) => ({ role: m.de === "lia" ? "assistant" : "user", content: m.texto }));
      const rl = await fetch(`${url}/functions/v1/lia-chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${anon}`, apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ messages, ficha: fichaRecupera, nome: cenario.nomeCliente }),
      });
      if (!rl.ok) return json({ error: `Cérebro da Lia falhou (${rl.status})` }, 502);
      const ld = await rl.json();
      const texto = String(ld?.content ?? "").split("|||").map((s: string) => s.trim()).filter(Boolean).join("\n");
      sinal = String(ld?.sinal ?? "seguindo");
      conversa.push({ de: "lia", texto, sinal });
      if (sinal === "descartar" || ld?.repassar === true) break;
    }

    const conferencias = conferir(cenario, conversa, sinal);
    const passou = conferencias.every((c) => c.ok);
    const { data: exec, error } = await admin.from("lia_laboratorio_execucoes").insert({
      cenario_id: cenario.id, produto_slug: cenario.produto, conversa, conferencias,
      sinal_final: sinal, passou_automatico: passou, criado_por: auth.userId,
    }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ execucao: exec });
  } catch (e) {
    console.error("[lia-laboratorio]", e);
    return json({ error: String(e) }, 500);
  }
});
