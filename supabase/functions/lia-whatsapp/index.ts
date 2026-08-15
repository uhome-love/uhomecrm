/**
 * lia-whatsapp — liga o WhatsApp (360dialog, API oficial) no cérebro da LIA.
 *
 * Recebe o webhook do 360dialog (formato WhatsApp Cloud API), pega a mensagem do
 * lead, monta o histórico (lia_conversas), chama a função lia-chat pra gerar a
 * resposta, envia de volta pelo 360dialog (texto + as 7 mídias), cria/qualifica o
 * lead SEM DONO na Fila CEO (origem 'LIA'), e respeita a TRAVA DE OPT-OUT
 * (lia_estado.optout): quem pediu pra sair não recebe mais resposta, de verdade.
 *
 * Público (verify_jwt=false) — o 360dialog posta aqui sem auth. Segredo D360_API_KEY.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const D360_URL = "https://waba-v2.360dialog.io/messages";
const EDGE_BASE = "https://hunbxqzhvuemgntklyzb.supabase.co";
const MEDIA_BASE = "https://uhomesales.com/casatua";
const MEDIA: Record<string, string> = {
  mapa: `${MEDIA_BASE}/mapa.jpg`,
  clubhouse: `${MEDIA_BASE}/club.jpg`,
  salao: `${MEDIA_BASE}/salao.jpg`,
  academia: `${MEDIA_BASE}/academia.jpg`,
  planta3: `${MEDIA_BASE}/planta3.jpg`,
  planta4: `${MEDIA_BASE}/planta4.jpg`,
  aerea: `${MEDIA_BASE}/invest.jpg`,
};
const OPTOUT_RE = /n[aã]o quero (mais )?(receber|falar)|me tira|sai(r)? da lista|para de (me )?mandar|me bloqueia|descadastr|remover? da lista|n[aã]o me mand/i;

const svc = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function send360(to: string, payload: Record<string, unknown>) {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) { console.error("[lia-whatsapp] D360_API_KEY ausente"); return; }
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    });
    if (!r.ok) console.error("[lia-whatsapp] 360dialog send falhou", r.status, await r.text().catch(() => ""));
  } catch (e) { console.error("[lia-whatsapp] erro no send", e); }
}
const sendText = (to: string, body: string) => send360(to, { type: "text", text: { body } });
const sendImage = (to: string, link: string) => send360(to, { type: "image", image: { link } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Alguns provedores validam o webhook com um GET; responde 200.
  if (req.method === "GET") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("no", { status: 405, headers: cors });

  // Sempre responde 200 rápido pro 360dialog não re-tentar em massa; processa dentro do try.
  try {
    const body = await req.json().catch(() => ({} as any));
    const sb = svc();

    const changes = (body?.entry ?? []).flatMap((e: any) => e?.changes ?? []);
    for (const ch of changes) {
      const value = ch?.value ?? {};
      const contactName = value?.contacts?.[0]?.profile?.name ?? null;
      const messages = value?.messages ?? [];
      for (const m of messages) {
        // só mensagens de entrada (ignora status delivered/read etc.)
        if (!m?.from || !m?.id) continue;
        const from = String(m.from).replace(/\D/g, "");
        const waId = String(m.id);
        const texto =
          m.type === "text" ? (m.text?.body ?? "") :
          m.type === "button" ? (m.button?.text ?? "") :
          m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "") :
          "";
        const conteudo = texto || `(o cliente enviou ${m.type || "uma mídia"})`;

        // idempotência: já processado?
        const { data: dup } = await sb.from("lia_conversas").select("id").eq("wa_message_id", waId).limit(1);
        if (dup && dup.length) continue;

        // estado do lead (opt-out / lead_id)
        const { data: estRows } = await sb.from("lia_estado").select("*").eq("telefone", from).limit(1);
        const est = estRows?.[0] ?? null;

        // grava a entrada
        await sb.from("lia_conversas").insert({ telefone: from, role: "user", conteudo, wa_message_id: waId });

        // TRAVA DE OPT-OUT: quem já saiu não recebe mais resposta.
        if (est?.optout) continue;

        // cria/atualiza estado + lead na Fila CEO (uma vez)
        const referral = m.referral ?? null;
        let leadId = est?.lead_id ?? null;
        if (!est) {
          await sb.from("lia_estado").insert({ telefone: from, nome: contactName, referral });
        }
        if (!leadId) {
          leadId = await criarLead(sb, from, contactName, referral);
          if (leadId) await sb.from("lia_estado").update({ lead_id: leadId, updated_at: new Date().toISOString() }).eq("telefone", from);
        }

        // monta histórico e chama o cérebro da LIA
        const { data: hist } = await sb
          .from("lia_conversas").select("role, conteudo")
          .eq("telefone", from).order("created_at", { ascending: true }).limit(40);
        const msgs = (hist ?? []).map((h: any) => ({ role: h.role, content: h.conteudo }));

        let reply = "";
        try {
          const r = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
            body: JSON.stringify({ messages: msgs }),
          });
          const d = await r.json();
          reply = String(d?.content ?? "").trim();
        } catch (e) { console.error("[lia-whatsapp] lia-chat falhou", e); }

        if (reply) {
          await sb.from("lia_conversas").insert({ telefone: from, role: "assistant", conteudo: reply });
          const parts = reply.split(/\s*\|\|\|\s*/).map((p) => p.trim()).filter(Boolean);
          let media = 0;
          for (const p of parts) {
            const mm = p.match(/^\[\[\s*midia\s*:\s*(\w+)\s*\]\]$/i);
            if (mm) {
              const k = mm[1].toLowerCase();
              if (MEDIA[k] && media < 3) { media++; await sendImage(from, MEDIA[k]); }
            } else {
              await sendText(from, p);
            }
          }
        }

        // opt-out: se o lead pediu pra sair, trava daqui pra frente (a resposta de encerramento já foi enviada)
        if (OPTOUT_RE.test(texto)) {
          await sb.from("lia_estado").update({ optout: true, updated_at: new Date().toISOString() }).eq("telefone", from);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[lia-whatsapp] erro:", e);
    // ainda responde 200 pro provedor não re-tentar em loop
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});

// Cria o lead SEM DONO na Fila CEO (mesmo padrão do receive-quiz-lead), origem 'LIA'.
async function criarLead(sb: any, from: string, nome: string | null, referral: any): Promise<string | null> {
  try {
    let telefone = from;
    if (telefone.startsWith("55") && telefone.length > 11) telefone = telefone.slice(2);

    const { data: stage } = await sb
      .from("pipeline_stages").select("id").eq("tipo", "novo_lead").eq("ativo", true).limit(1).single();
    if (!stage) { console.error("[lia-whatsapp] stage novo_lead ausente"); return null; }

    // dedup: já existe lead 'LIA' com esse telefone sem dono?
    const { data: exist } = await sb
      .from("pipeline_leads").select("id")
      .eq("telefone", telefone).eq("origem", "LIA").eq("arquivado", false).limit(1);
    if (exist && exist.length) return exist[0].id;

    const campanha = referral?.headline || referral?.source_id ? `Anúncio: ${referral?.headline ?? referral?.source_id}` : null;
    const { data: ins, error } = await sb.from("pipeline_leads").insert({
      nome: nome || "Lead LIA",
      telefone,
      empreendimento: "Casa Tua Santos Ferreira",
      stage_id: stage.id,
      origem: "LIA",
      origem_detalhe: "whatsapp",
      campanha,
      corretor_id: null,
      aceite_status: "pendente_distribuicao",
      prioridade_lead: "media",
      observacoes: referral ? `Veio de anúncio (Click-to-WhatsApp). ${referral?.source_url ?? ""}` : "Atendimento LIA no WhatsApp",
      event_source_url: referral?.source_url ?? null,
    }).select("id").single();
    if (error || !ins) { console.error("[lia-whatsapp] insert lead falhou", error); return null; }

    try {
      await sb.from("pipeline_atividades").insert({
        pipeline_lead_id: ins.id,
        tipo: "entrada",
        titulo: "📣 Lead atendido pela LIA (WhatsApp)",
        descricao: `Origem: LIA (assistente de WhatsApp).${campanha ? `\n${campanha}` : ""}`,
        status: "concluida",
        created_by: "00000000-0000-0000-0000-000000000000",
      });
    } catch (e) { console.error("[lia-whatsapp] atividade falhou (nao critico)", e); }

    try {
      const { data: tops } = await sb.from("user_roles").select("user_id").in("role", ["admin", "diretor"]);
      const seen = new Set<string>();
      for (const t of (tops ?? []) as Array<{ user_id: string }>) {
        if (!t.user_id || seen.has(t.user_id)) continue;
        seen.add(t.user_id);
        await sb.rpc("criar_notificacao", {
          p_user_id: t.user_id,
          p_tipo: "lead",
          p_categoria: "lead_qualificado_lia",
          p_titulo: "🔥 Novo lead da LIA (WhatsApp)",
          p_mensagem: `${nome || "Lead"} · Casa Tua Santos Ferreira`,
          p_dados: { pipeline_lead_id: ins.id, url: "/ceo" },
          p_agrupamento_key: `lead_lia:${ins.id}`,
        });
      }
    } catch (e) { console.error("[lia-whatsapp] notificacao falhou (nao critico)", e); }

    return ins.id;
  } catch (e) {
    console.error("[lia-whatsapp] criarLead erro", e);
    return null;
  }
}
