/**
 * lia-whatsapp — liga o WhatsApp (360dialog, API oficial) no cérebro da LIA.
 *
 * Recebe o webhook do 360dialog (formato WhatsApp Cloud API), pega a mensagem do
 * lead, monta o histórico (lia_conversas = memória), chama a lia-chat pra gerar a
 * resposta E o SINAL de triagem, envia de volta (texto + as 7 mídias), e age pelo sinal:
 *   - quente/morno/frio   -> cria/atualiza o lead na Fila CEO com a temperatura certa
 *                            (quente=alta, morno=media, frio=baixa) + resumo pro corretor.
 *                            Notifica o Lucas em morno/quente; frio entra sem push.
 *   - descartar           -> marca o estado como descartado (fica FORA da fila; o CEO
 *                            pode retomar depois). Não cria lead.
 *   - seguindo            -> só conversa; nada entra na fila ainda.
 * Respeita a TRAVA DE OPT-OUT (lia_estado.optout). Idempotência por wa_message_id.
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
// Documentos (PDF) que a LIA pode enviar por marcador [[midia:CHAVE]].
const DOC: Record<string, { link: string; filename: string }> = {
  ebook: { link: `${MEDIA_BASE}/guia-casa-tua-santos-ferreira.pdf`, filename: "Guia Casa Tua Santos Ferreira.pdf" },
};
const OPTOUT_RE = /n[aã]o quero (mais )?(receber|falar)|me tira|sai(r)? da lista|para de (me )?mandar|me bloqueia|descadastr|remover? da lista|n[aã]o me mand/i;

// Temperatura do lead -> como ele entra na Fila CEO (fonte única: coluna temperatura).
const NIVEL_MAP: Record<string, { temperatura: string; prioridade: string; emoji: string; label: string; rank: number }> = {
  quente: { temperatura: "quente", prioridade: "alta", emoji: "🔥", label: "Quente", rank: 3 },
  morno: { temperatura: "morno", prioridade: "media", emoji: "🟡", label: "Morno", rank: 2 },
  frio: { temperatura: "frio", prioridade: "baixa", emoji: "🧊", label: "Frio", rank: 1 },
};

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
const sendDoc = (to: string, link: string, filename: string) => send360(to, { type: "document", document: { link, filename } });

const nowISO = () => new Date().toISOString();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("no", { status: 405, headers: cors });

  try {
    const body = await req.json().catch(() => ({} as any));
    const sb = svc();

    const changes = (body?.entry ?? []).flatMap((e: any) => e?.changes ?? []);
    for (const ch of changes) {
      const value = ch?.value ?? {};
      const contactName = value?.contacts?.[0]?.profile?.name ?? null;
      const messages = value?.messages ?? [];
      for (const m of messages) {
        if (!m?.from || !m?.id) continue; // ignora status delivered/read etc.
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

        // estado do lead (memória)
        const { data: estRows } = await sb.from("lia_estado").select("*").eq("telefone", from).limit(1);
        let est = estRows?.[0] ?? null;

        // grava a mensagem de entrada
        await sb.from("lia_conversas").insert({ telefone: from, role: "user", conteudo, wa_message_id: waId });

        // TRAVA DE OPT-OUT: quem já saiu não recebe mais resposta.
        if (est?.optout) continue;

        // cria o estado na primeira mensagem (ainda NÃO cria lead na Fila CEO)
        const referral = m.referral ?? null;
        if (!est) {
          const { data: novo } = await sb.from("lia_estado").insert({
            telefone: from, nome: contactName, referral,
            status: "novo", last_user_at: nowISO(), last_msg_em: nowISO(),
          }).select("*").single();
          est = novo ?? { telefone: from, nome: contactName, referral, status: "novo", lead_id: null, followup_count: 0 };
        } else {
          await sb.from("lia_estado").update({
            last_user_at: nowISO(), last_msg_em: nowISO(),
            nome: est.nome ?? contactName,
            status: est.status === "novo" ? "em_conversa" : est.status,
            updated_at: nowISO(),
          }).eq("telefone", from);
        }

        // monta histórico e chama o cérebro da LIA
        const { data: hist } = await sb
          .from("lia_conversas").select("role, conteudo")
          .eq("telefone", from).order("created_at", { ascending: true }).limit(40);
        const msgs = (hist ?? []).map((h: any) => ({ role: h.role, content: h.conteudo }));

        let reply = "";
        let sinal = "seguindo";
        try {
          const r = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
            body: JSON.stringify({ messages: msgs }),
          });
          const d = await r.json();
          reply = String(d?.content ?? "").trim();
          if (typeof d?.sinal === "string") sinal = d.sinal;
        } catch (e) { console.error("[lia-whatsapp] lia-chat falhou", e); }

        // envia a resposta (texto + mídias), ignorando qualquer marcador interno que sobre
        if (reply) {
          await sb.from("lia_conversas").insert({ telefone: from, role: "assistant", conteudo: reply });
          const parts = reply.split(/\s*\|\|\|\s*/).map((p) => p.trim()).filter(Boolean);
          let media = 0;
          for (const p of parts) {
            const mm = p.match(/^\[\[\s*midia\s*:\s*(\w+)\s*\]\]$/i);
            if (mm) {
              const k = mm[1].toLowerCase();
              if (DOC[k] && media < 3) { media++; await sendDoc(from, DOC[k].link, DOC[k].filename); }
              else if (MEDIA[k] && media < 3) { media++; await sendImage(from, MEDIA[k]); }
            } else if (/^\[\[.*\]\]$/.test(p)) {
              continue; // marcador interno (ex.: sinal) que por acaso vazou: nunca envia
            } else {
              await sendText(from, p);
            }
          }
          await sb.from("lia_estado").update({ last_msg_em: nowISO() }).eq("telefone", from);
        }

        // AGE PELO SINAL DE TRIAGEM
        const jaOptout = OPTOUT_RE.test(texto);
        if (!jaOptout) {
          if ((sinal === "quente" || sinal === "morno" || sinal === "frio") && est.status !== "descartado") {
            await qualificar(sb, from, est, contactName, referral, sinal);
          } else if (sinal === "descartar" && est.status !== "qualificado" && !est.lead_id) {
            await sb.from("lia_estado").update({
              status: "descartado", descartado_em: nowISO(), motivo: "Descartado pela LIA (não serve)", updated_at: nowISO(),
            }).eq("telefone", from);
          }
        }

        // opt-out: a resposta de encerramento já foi enviada; trava daqui pra frente
        if (jaOptout) {
          await sb.from("lia_estado").update({ optout: true, status: "opt_out", updated_at: nowISO() }).eq("telefone", from);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[lia-whatsapp] erro:", e);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});

/**
 * Qualifica o lead: cria (ou promove) na Fila CEO com temperatura + tag, marca o
 * estado, e NOTIFICA o Lucas na hora. Só notifica na transição (primeira vez que
 * qualifica, e de novo se subir pra QUENTE), nunca a cada mensagem.
 */
async function qualificar(sb: any, from: string, est: any, nome: string | null, referral: any, nivel: string) {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    const jaEra = est.status === "qualificado";
    const oldRank = (est.nivel && NIVEL_MAP[est.nivel]?.rank) || 0;
    const subiu = map.rank > oldRank; // esquentou desde a última leitura

    // resumo pro corretor continuar o contato (gera na 1ª qualificação, ou se ainda não tem)
    let resumo: string = est.resumo ?? "";
    if (!jaEra || !resumo) {
      const novo = await gerarResumo(sb, from);
      if (novo) resumo = novo;
    }

    let leadId: string | null = est.lead_id ?? null;
    if (!leadId) {
      leadId = await criarLeadFila(sb, from, est.nome ?? nome, referral, nivel, resumo);
    } else {
      // já estava na fila: atualiza a temperatura se subiu
      await sb.from("pipeline_leads").update({
        temperatura: map.temperatura, prioridade_lead: map.prioridade,
      }).eq("id", leadId);
    }

    await sb.from("lia_estado").update({
      status: "qualificado",
      nivel,
      lead_id: leadId,
      qualificado_em: est.qualificado_em ?? nowISO(),
      resumo: resumo || est.resumo || null,
      updated_at: nowISO(),
    }).eq("telefone", from);

    // notifica o Lucas só pra lead acionável (morno/quente) e na transição/quando esquenta;
    // frio entra na Fila CEO sem push (ele vê e dispara quando quiser).
    if (leadId && map.rank >= 2 && (!jaEra || subiu)) {
      await notificar(sb, leadId, est.nome ?? nome, nivel);
    }
  } catch (e) { console.error("[lia-whatsapp] qualificar erro", e); }
}

// Gera o resumo da conversa pro corretor. A chamada acontece logo depois da resposta,
// então pode pegar rate limit do gateway: re-tenta com espaçamento e, se ainda falhar,
// cai num fallback com o que o lead falou (nunca deixa o corretor sem contexto).
async function gerarResumo(sb: any, from: string): Promise<string> {
  try {
    const { data: hist } = await sb
      .from("lia_conversas").select("role, conteudo")
      .eq("telefone", from).order("created_at", { ascending: true }).limit(60);
    const msgs = (hist ?? []).map((h: any) => ({ role: h.role, content: h.conteudo }));
    if (!msgs.length) return "";

    // tenta o resumo por IA, com re-tentativas espaçadas (evita o rate limit da 2ª chamada)
    for (let i = 0; i < 3; i++) {
      if (i) await new Promise((r) => setTimeout(r, 2500));
      try {
        const r = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
          body: JSON.stringify({ messages: msgs, mode: "resumo" }),
        });
        const d = await r.json();
        const resumo = String(d?.resumo ?? "").trim();
        if (resumo) return resumo;
      } catch (e) { console.error("[lia-whatsapp] gerarResumo tentativa", i, e); }
    }

    // fallback: sem IA, monta com o que o lead falou (últimas falas dele)
    const ditos = msgs
      .filter((m: any) => m.role === "user")
      .map((m: any) => String(m.content).trim())
      .filter((c: string) => c && !/gostaria de mais informa|informações do casa tua/i.test(c))
      .slice(-6);
    if (!ditos.length) return "";
    return "Resumo automático indisponível agora. O lead disse: " + ditos.map((d: string) => `“${d}”`).join("; ") + ".";
  } catch (e) { console.error("[lia-whatsapp] gerarResumo erro", e); return ""; }
}

// Cria o lead SEM DONO na Fila CEO (mesmo padrão do receive-quiz-lead), origem 'LIA'.
async function criarLeadFila(sb: any, from: string, nome: string | null, referral: any, nivel: string, resumo: string): Promise<string | null> {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    let telefone = from;
    if (telefone.startsWith("55") && telefone.length > 11) telefone = telefone.slice(2);

    const { data: stage } = await sb
      .from("pipeline_stages").select("id").eq("tipo", "novo_lead").eq("ativo", true).limit(1).single();
    if (!stage) { console.error("[lia-whatsapp] stage novo_lead ausente"); return null; }

    const resumoTxt = (resumo ?? "").trim();

    // dedup: já existe lead 'LIA' com esse telefone sem dono?
    const { data: exist } = await sb
      .from("pipeline_leads").select("id")
      .eq("telefone", telefone).eq("origem", "LIA").eq("arquivado", false).limit(1);
    if (exist && exist.length) {
      await sb.from("pipeline_leads").update({ temperatura: map.temperatura, prioridade_lead: map.prioridade }).eq("id", exist[0].id);
      return exist[0].id;
    }

    const campanha = (referral?.headline || referral?.source_id) ? `Anúncio: ${referral?.headline ?? referral?.source_id}` : null;
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
      prioridade_lead: map.prioridade,
      temperatura: map.temperatura,
      tags: ["qualificado_lia", `lia_${nivel}`],
      observacoes: `Resumo da LIA (${map.label}):\n${resumoTxt || "A LIA validou interesse e enviou pra Fila CEO."}${referral ? `\n\nVeio de anúncio (Click-to-WhatsApp). ${referral?.source_url ?? ""}` : ""}`,
      event_source_url: referral?.source_url ?? null,
    }).select("id").single();
    if (error || !ins) { console.error("[lia-whatsapp] insert lead falhou", error); return null; }

    try {
      await sb.from("pipeline_atividades").insert({
        pipeline_lead_id: ins.id,
        tipo: "entrada",
        titulo: `${map.emoji} Lead ${map.label} · atendido pela LIA (WhatsApp)`,
        descricao: resumoTxt
          ? `${resumoTxt}${campanha ? `\n\n${campanha}` : ""}`
          : `A LIA validou interesse e enviou pra Fila CEO.${campanha ? `\n${campanha}` : ""}`,
        status: "concluida",
        created_by: "00000000-0000-0000-0000-000000000000",
      });
    } catch (e) { console.error("[lia-whatsapp] atividade falhou (nao critico)", e); }

    return ins.id;
  } catch (e) {
    console.error("[lia-whatsapp] criarLeadFila erro", e);
    return null;
  }
}

// Notifica admin/diretor na hora — é assim que o Lucas fica sabendo pra repassar.
async function notificar(sb: any, leadId: string, nome: string | null, nivel: string) {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    const { data: tops } = await sb.from("user_roles").select("user_id").in("role", ["admin", "diretor"]);
    const seen = new Set<string>();
    for (const t of (tops ?? []) as Array<{ user_id: string }>) {
      if (!t.user_id || seen.has(t.user_id)) continue;
      seen.add(t.user_id);
      await sb.rpc("criar_notificacao", {
        p_user_id: t.user_id,
        p_tipo: "lead",
        p_categoria: "lead_qualificado_lia",
        p_titulo: `${map.emoji} Lead ${map.label} da LIA`,
        p_mensagem: `${nome || "Lead"} · Casa Tua Santos Ferreira · pronto pra repassar`,
        p_dados: { pipeline_lead_id: leadId, nivel, url: "/ceo" },
        p_agrupamento_key: `lead_lia:${leadId}:${nivel}`,
      });
    }
  } catch (e) { console.error("[lia-whatsapp] notificacao falhou (nao critico)", e); }
}
