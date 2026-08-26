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
  planta3: `${MEDIA_BASE}/planta3-v2.jpg`,
  planta4: `${MEDIA_BASE}/planta4-v2.jpg`,
  aerea: `${MEDIA_BASE}/invest.jpg`,
  comparativo: `${MEDIA_BASE}/comparativo.jpg`,
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

async function send360(to: string, payload: Record<string, unknown>): Promise<boolean> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) { console.error("[lia-whatsapp] D360_API_KEY ausente"); return false; }
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    });
    if (!r.ok) { console.error("[lia-whatsapp] 360dialog send falhou", r.status, await r.text().catch(() => "")); return false; }
    return true;
  } catch (e) { console.error("[lia-whatsapp] erro no send", e); return false; }
}
const sendText = (to: string, body: string) => send360(to, { type: "text", text: { body } });
const sendImage = (to: string, link: string) => send360(to, { type: "image", image: { link } });

const D360_BASE = "https://waba-v2.360dialog.io";
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
// Baixa a mídia de áudio do 360dialog (metadados -> url -> binário) e devolve base64 + formato.
async function baixarAudio(mediaId: string): Promise<{ b64: string; fmt: string } | null> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return null;
  try {
    const meta = await fetch(`${D360_BASE}/${mediaId}`, { headers: { "D360-API-KEY": key } });
    if (!meta.ok) { console.error("[audio] meta", meta.status); return null; }
    const md = await meta.json();
    const url: string | undefined = md?.url;
    const mime: string = md?.mime_type || "audio/ogg";
    if (!url) return null;
    const bin = await fetch(url, { headers: { "D360-API-KEY": key } });
    if (!bin.ok) { console.error("[audio] download", bin.status); return null; }
    const buf = new Uint8Array(await bin.arrayBuffer());
    const fmt = /mp3|mpeg/.test(mime) ? "mp3" : /wav/.test(mime) ? "wav" : /m4a|mp4|aac/.test(mime) ? "m4a" : "ogg";
    return { b64: bytesToB64(buf), fmt };
  } catch (e) { console.error("[audio] baixar erro", e); return null; }
}
// Transcreve um áudio do WhatsApp usando o gateway (Gemini). Fallback: "" (nunca quebra o fluxo).
async function transcreverAudio(mediaId: string): Promise<string> {
  const audio = await baixarAudio(mediaId);
  if (!audio) return "";
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio em português do Brasil. Responda SÓ com a transcrição, sem comentários nem aspas." },
            { type: "input_audio", input_audio: { data: audio.b64, format: audio.fmt } },
          ],
        }],
      }),
    });
    if (!r.ok) { console.error("[audio] gateway", r.status, await r.text().catch(() => "")); return ""; }
    const d = await r.json();
    return String(d?.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) { console.error("[audio] transcrever erro", e); return ""; }
}
const sendDoc = (to: string, link: string, filename: string) => send360(to, { type: "document", document: { link, filename } });

const nowISO = () => new Date().toISOString();

// ── MULTIPRODUTO (Etapa B, aditivo) ────────────────────────────────────────
// Resolve de qual imóvel é a conversa. Ordem: (1) produto já fixado na conversa
// (lia_estado.produto_slug); (2) pelo anúncio (referral) casando contra
// lia_produtos.campanha_ids; (3) null = Canoas (comportamento de hoje, intocado).
async function resolverProduto(sb: any, telefone: string, est: any, referral: any): Promise<any | null> {
  try {
    if (est?.produto_slug) {
      // conversa JÁ existente continua no produto dela mesmo se o produto for desligado pra leads
      // NOVOS (ativo=false). Desligar um produto para de ENTRAR lead, nunca abandona conversa em curso.
      const { data } = await sb.from("lia_produtos").select("*").eq("slug", est.produto_slug).maybeSingle();
      if (data) return data;
    }
    // pelo anúncio: source_id / ad_id / campanha do referral vs campanha_ids do produto
    const cands = [referral?.source_id, referral?.ad_id, referral?.campaign_id]
      .filter(Boolean).map((x: any) => String(x));
    if (cands.length) {
      const { data: prods } = await sb.from("lia_produtos").select("*").eq("ativo", true);
      for (const p of (prods ?? [])) {
        const camps = (p.campanha_ids ?? []).map(String);
        if (cands.some((c: string) => camps.includes(c))) {
          await sb.from("lia_estado").update({ produto_slug: p.slug, updated_at: nowISO() }).eq("telefone", telefone);
          return p;
        }
      }
    }
    // (3) pelo TEXTO da conversa: quando não veio referral (lead orgânico) ou o anúncio não casou,
    // reconhece o imóvel pelo que a pessoa escreveu. O 1º "oi" quase sempre traz o nome do imóvel
    // ("Casa Tua POA", "AWA"...). Evita o erro de assumir Canoas e dar tipologia/preço errados.
    const { data: msgs } = await sb.from("lia_conversas")
      .select("conteudo").eq("telefone", telefone).eq("role", "user")
      .order("created_at", { ascending: true }).limit(6);
    // inclui o TEXTO DO ANÚNCIO (referral body/headline) além do que a pessoa escreveu:
    // o anúncio quase sempre nomeia o imóvel ("Carlos Gomes / Nilo Peçanha", "Protásio", "Canoas"),
    // então mesmo um anúncio NÃO mapeado em campanha_ids resolve pelo próprio conteúdo dele.
    const refTxt = [referral?.body, referral?.headline].filter(Boolean).map(String).join(" ");
    const texto = ((msgs ?? []).map((m: any) => String(m.conteudo || "")).join(" ") + " " + refTxt).toLowerCase();
    if (texto) {
      const REGRAS: { slug: string; re: RegExp }[] = [
        { slug: "awa-wellness", re: /\bawa\b|wellness|carlos gomes|nilo pe[çc]/ },
        { slug: "connect-joao-wallig", re: /connect|jo[aã]o wallig|wallig/ },
        { slug: "casa-tua-porto-alegre", re: /porto alegre|\bpoa\b|petr[oó]polis|prot[aá]sio/ },
        { slug: "casa-tua-canoas", re: /canoas|santos ferreira/ },
      ];
      for (const rg of REGRAS) {
        if (rg.re.test(texto)) {
          const { data } = await sb.from("lia_produtos").select("*").eq("slug", rg.slug).maybeSingle();
          if (data) {
            await sb.from("lia_estado").update({ produto_slug: data.slug, updated_at: nowISO() }).eq("telefone", telefone);
            return data;
          }
        }
      }
    }
  } catch (e) { console.error("[lia-whatsapp] resolverProduto erro", e); }
  return null; // desconhecido → Canoas (default)
}

// Monta o mapa de mídias da conversa: do produto (lia_produtos.midias) quando há
// produto; senão, o hardcoded do Casa Tua (MEDIA + DOC). Chave → url; .pdf vira documento.
function montarMidias(produto: any | null): Record<string, { url: string; doc: boolean; filename?: string }> {
  const map: Record<string, { url: string; doc: boolean; filename?: string }> = {};
  if (produto?.midias && typeof produto.midias === "object" && Object.keys(produto.midias).length > 0) {
    for (const [k, v] of Object.entries(produto.midias as Record<string, string>)) {
      const url = String(v);
      const isDoc = /\.pdf(\?|$)/i.test(url);
      map[k.toLowerCase()] = { url, doc: isDoc, filename: isDoc ? `${produto.nome || "Material"}.pdf` : undefined };
    }
    return map;
  }
  // O acervo hardcoded (MEDIA/DOC) é do CANOAS. Só usa como fallback pra Canoas ou quando não há
  // produto resolvido. Um produto resolvido SEM mídia configurada não deve mandar imagem do Canoas
  // (imóvel errado): devolve vazio e o marcador [[midia:]] simplesmente não envia nada.
  const slug = String(produto?.slug ?? "");
  if (slug && slug !== "casa-tua-canoas") return map;
  for (const [k, url] of Object.entries(MEDIA)) map[k.toLowerCase()] = { url, doc: false };
  for (const [k, d] of Object.entries(DOC)) map[k.toLowerCase()] = { url: d.link, doc: true, filename: d.filename };
  return map;
}

// Normaliza o telefone do WhatsApp pro formato brasileiro +55 DDD 9XXXXXXXX.
// O WhatsApp entrega alguns números do RS SEM o 9 do celular (12 dígitos), então recolocamos.
function telBR(from: string): string {
  let d = String(from).replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // tira o código do país
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2); // DDD + 8 dígitos -> insere o 9
  return "+55" + d;
}

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
        if (m.type === "reaction" || m.type === "system") continue; // reação (emoji) não é mensagem, não responde
        const from = String(m.from).replace(/\D/g, "");
        const waId = String(m.id);
        let texto =
          m.type === "text" ? (m.text?.body ?? "") :
          m.type === "button" ? (m.button?.text ?? "") :
          m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "") :
          "";

        // idempotência: já processado?
        const { data: dup } = await sb.from("lia_conversas").select("id").eq("wa_message_id", waId).limit(1);
        if (dup && dup.length) continue;

        // áudio/voz: transcreve com o gateway (Gemini) e trata como se a pessoa tivesse digitado.
        // Se a transcrição falhar, cai no placeholder (nunca quebra o atendimento).
        if (!texto && (m.type === "audio" || m.type === "voice") && m.audio?.id) {
          const t = await transcreverAudio(m.audio.id);
          if (t) texto = `🎤 ${t}`;
        }
        // se não deu pra transcrever, guarda o id da mídia no placeholder pra permitir recuperar depois
        const idMidia = m.audio?.id ? ` · id:${m.audio.id}` : "";
        const conteudo = texto || `(o cliente enviou ${m.type || "uma mídia"}${idMidia})`;

        // estado do lead (memória): casa por telefone exato; se não achar, tenta pelo FINAL
        // (últimos 8 dígitos) — rede pro pré-cadastro do formulário, que pode ter formato
        // levemente diferente do que o WhatsApp entrega. Ao achar por final, realinha o
        // telefone pro formato real do WhatsApp pra as próximas buscas casarem exato.
        let est: any = null;
        {
          const { data: exato } = await sb.from("lia_estado").select("*").eq("telefone", from).limit(1);
          est = exato?.[0] ?? null;
          if (!est && from.length >= 8) {
            const l8 = from.slice(-8);
            const { data: porFinal } = await sb.from("lia_estado").select("*")
              .ilike("telefone", `%${l8}`).order("updated_at", { ascending: false }).limit(1);
            if (porFinal?.[0]) {
              est = porFinal[0];
              if (est.telefone !== from) {
                const antigo = est.telefone;
                await sb.from("lia_estado").update({ telefone: from, updated_at: nowISO() }).eq("telefone", antigo);
                // leva as mensagens (ex.: o 1º contato semeado) pro número realinhado, senão somem do hub
                await sb.from("lia_conversas").update({ telefone: from }).eq("telefone", antigo);
                est.telefone = from;
              }
            }
          }
        }

        // grava a mensagem de entrada. DEDUP ATÔMICO: índice único parcial em wa_message_id garante
        // que só UMA execução processa cada mensagem. Se o 360dialog reentregar o mesmo id (retry por
        // timeout) e duas execuções correrem juntas, a segunda bate no conflito 23505 e ABORTA aqui,
        // eliminando a resposta dupla (o dedup por SELECT antes era read-then-write, não atômico).
        if (waId) {
          const { error: insErr } = await sb.from("lia_conversas").insert({ telefone: from, role: "user", conteudo, wa_message_id: waId });
          if (insErr) {
            if ((insErr as any).code === "23505") continue; // já processada por outra execução
            console.error("[lia-whatsapp] insert msg entrada erro", insErr);
          }
        } else {
          await sb.from("lia_conversas").insert({ telefone: from, role: "user", conteudo, wa_message_id: waId });
        }

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

        // APÓS O REPASSE: o humano é dono. Se um corretor JÁ ACEITOU o lead, a LIA fica 100% quieta
        // (não atropela o corretor ativo). Enquanto ninguém assumiu (Fila CEO), ela dá uma JANELA DE
        // GRAÇA: responde perguntas simples, curta e deferente, até o humano assumir, pro lead não ficar
        // no vácuo (ela NÃO re-qualifica nem re-vende). Opt-out é honrado sempre (LGPD).
        const posRepasse = !!est?.repassado_em;
        if (posRepasse) {
          if (OPTOUT_RE.test(texto)) {
            await sb.from("lia_estado").update({ optout: true, status: "opt_out", updated_at: nowISO() }).eq("telefone", from);
            continue;
          }
          let humanoAssumiu = false;
          if (est.lead_id) {
            const { data: pl } = await sb.from("pipeline_leads").select("corretor_id, aceite_status").eq("id", est.lead_id).limit(1);
            humanoAssumiu = !!(pl?.[0]?.corretor_id && pl[0].aceite_status === "aceito");
          }
          if (humanoAssumiu) continue; // corretor ativo assumiu: silêncio total
        }

        // MULTIPRODUTO: resolve o imóvel desta conversa (null = Canoas, comportamento de hoje)
        const produto = await resolverProduto(sb, from, est, referral);
        const midias = montarMidias(produto);

        // ANTI-TRAVAMENTO (junta a rajada): espera um instante; se chegou uma mensagem
        // mais nova do lead, deixa ELA responder (com o contexto completo) e para esta.
        await new Promise((r) => setTimeout(r, 6000));
        const { data: ultima } = await sb
          .from("lia_conversas").select("wa_message_id")
          .eq("telefone", from).eq("role", "user")
          .order("created_at", { ascending: false }).limit(1);
        if (ultima?.[0]?.wa_message_id && ultima[0].wa_message_id !== waId) continue;

        // monta histórico e chama o cérebro da LIA
        const { data: hist } = await sb
          .from("lia_conversas").select("role, conteudo")
          .eq("telefone", from).order("created_at", { ascending: true }).limit(40);
        const msgs = (hist ?? []).map((h: any) => ({ role: h.role, content: h.conteudo }));

        let reply = "";
        let sinal = "seguindo";
        let repassar = false;
        let erroChat = false;
        try {
          const r = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
            body: JSON.stringify({ messages: msgs, nome: (est?.nome ?? contactName) || null, ...(produto?.ficha ? { ficha: produto.ficha } : {}), ...(posRepasse ? { pos_repasse: true } : {}) }),
          });
          if (!r.ok) { erroChat = true; console.error("[lia-whatsapp] lia-chat HTTP", r.status); }
          else {
            const d = await r.json();
            reply = String(d?.content ?? "").trim();
            if (typeof d?.sinal === "string") sinal = d.sinal;
            repassar = d?.repassar === true;
          }
        } catch (e) { erroChat = true; console.error("[lia-whatsapp] lia-chat falhou", e); }

        // reconfere DEPOIS de gerar: se chegou mensagem mais nova do lead durante a geração,
        // NÃO envia esta (a mais nova vai responder com o contexto completo). Evita resposta dupla.
        const { data: ultima2 } = await sb
          .from("lia_conversas").select("wa_message_id")
          .eq("telefone", from).eq("role", "user")
          .order("created_at", { ascending: false }).limit(1);
        if (ultima2?.[0]?.wa_message_id && ultima2[0].wa_message_id !== waId) continue;

        // RECUPERAÇÃO DE INSTABILIDADE: se o cérebro falhou (429/rede) e não veio resposta, o turno se
        // perderia calado (o 360dialog não reenvia). Em vez de sumir, a LIA pede pra reenviar (gera um
        // novo turno) — nunca deixa o cliente no vácuo por uma instabilidade momentânea.
        if (!reply && erroChat) {
          await sendText(from, "Opa, tive uma instabilidade rapidinha aqui 🙈 me manda de novo tua última mensagem que já te respondo!");
          continue;
        }

        // envia a resposta (texto + mídias), ignorando qualquer marcador interno que sobre
        if (reply) {
          // no LOG do hub, o ||| (separador de bolhas) vira quebra de linha e os marcadores internos
          // ([[midia:]], [[nome:]], [[sinal]]) somem — o cliente recebe as bolhas separadas e limpas.
          const replyLog = reply.split(/\s*\|\|\|\s*/).map((p) => p.trim()).filter((p) => p && !/^\[\[.*\]\]$/.test(p)).join("\n");
          await sb.from("lia_conversas").insert({ telefone: from, role: "assistant", conteudo: replyLog || reply });
          const parts = reply.split(/\s*\|\|\|\s*/).map((p) => p.trim()).filter(Boolean);
          let media = 0;
          let midiaFalhou = false;
          for (const p of parts) {
            const mm = p.match(/^\[\[\s*midia\s*:\s*(\w+)\s*\]\]$/i);
            if (mm) {
              const k = mm[1].toLowerCase();
              const mid = midias[k];
              if (mid && media < 3) {
                media++;
                // send* agora retornam status: se o 360dialog rejeitar (arquivo pesado/URL fora),
                // NÃO deixa o cliente achando que recebeu, avisa e o time reenvia (fim do bug do ebook).
                const ok = mid.doc ? await sendDoc(from, mid.url, mid.filename || "Material.pdf") : await sendImage(from, mid.url);
                if (!ok) midiaFalhou = true;
              }
            } else if (/^\[\[\s*nome\s*:/i.test(p)) {
              // [[nome:Fulano]] — a LIA capturou o nome REAL que a pessoa disse; salva no CRM
              // (o WhatsApp costuma trazer apelido/nome de perfil que não presta). Nunca envia ao cliente.
              const nm = p.match(/^\[\[\s*nome\s*:\s*(.+?)\s*\]\]$/i);
              const novoNome = nm?.[1]?.trim().slice(0, 80);
              if (novoNome) {
                await sb.from("lia_estado").update({ nome: novoNome, updated_at: nowISO() }).eq("telefone", from);
                est.nome = novoNome;
                const l8 = telBR(from).replace(/\D/g, "").slice(-8);
                await sb.from("pipeline_leads").update({ nome: novoNome }).ilike("telefone", `%${l8}`).eq("arquivado", false);
              }
            } else if (/^\[\[.*\]\]$/.test(p)) {
              continue; // marcador interno (ex.: sinal) que por acaso vazou: nunca envia
            } else {
              await sendText(from, p);
            }
          }
          if (midiaFalhou) {
            await sendText(from, "Ops, tive um probleminha aqui pra te enviar o arquivo 🙈 já te reenvio, tá?");
          }
          await sb.from("lia_estado").update({ last_msg_em: nowISO() }).eq("telefone", from);
        }

        // AGE PELO SINAL DE TRIAGEM. Na janela de graça (posRepasse) a LIA NÃO re-qualifica nem re-passa:
        // ela só respondeu por cortesia até o humano assumir.
        const jaOptout = OPTOUT_RE.test(texto);
        if (!jaOptout && !posRepasse) {
          const acionavel = sinal === "quente" || sinal === "morno" || sinal === "frio";
          // DURANTE o pré-atendimento: só registra a TEMPERATURA no estado da LIA (o Lucas vê no
          // inbox), SEM criar lead no pipeline e SEM mandar pra corretor. O lead segue sendo atendido
          // só pela LIA; ninguém do time entra ainda (senão vira briga de atenção no WhatsApp do cliente).
          if (acionavel && est.status !== "descartado" && est.status !== "qualificado") {
            await sb.from("lia_estado").update({ nivel: sinal, updated_at: nowISO() }).eq("telefone", from);
          }
          // REPASSE (uma vez, no FIM do pré-atendimento): o cérebro decidiu que é hora do especialista.
          // Ordem certa: (1) CRIA o lead na Fila CEO com o resumo; (2) só se o lead entrou de fato, a LIA
          // fecha com o cliente (passagem de bastão). Assim nunca promete atendimento humano e deixa o
          // lead órfão. Nesta fase de teste NÃO distribui pela roleta: fica na Fila CEO e o Lucas repassa.
          if (repassar && (sinal === "quente" || sinal === "morno") && est.status !== "descartado") {
            const leadId = await qualificar(sb, from, est, contactName, referral, sinal, produto);
            if (leadId) await passagemDeBastao(sb, from, produto);
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
async function qualificar(sb: any, from: string, est: any, nome: string | null, referral: any, nivel: string, produto: any | null): Promise<string | null> {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    const jaEra = est.status === "qualificado";
    const oldRank = (est.nivel && NIVEL_MAP[est.nivel]?.rank) || 0;
    const subiu = map.rank > oldRank; // esquentou desde a última leitura

    // resumo pro corretor: gera na 1ª qualificação, se ainda não tem, OU quando o lead ESQUENTA
    // (subiu). Regenerar ao esquentar é o que captura o agendamento no momento em que a pessoa
    // marca a apresentação, e mantém o handoff fresco pro corretor.
    let resumo: string = est.resumo ?? "";
    if (!jaEra || !resumo || subiu) {
      const novo = await gerarResumo(sb, from);
      if (novo) resumo = novo;
    }

    let leadId: string | null = est.lead_id ?? null;
    if (!leadId) {
      leadId = await criarLeadFila(sb, from, est.nome ?? nome, referral, nivel, resumo, produto);
      // FILA CEO (fase de teste): NÃO distribui automático pela roleta. O lead nasce sem corretor,
      // fica na Fila CEO com o resumo estruturado, e o Lucas repassa manualmente pra pegar o
      // feedback de cada repasse com o time. (Quando amadurecer, é só religar empurrarParaRoleta.)
      // Se NÃO conseguiu criar o lead, aborta: não marca qualificado nem manda a passagem de bastão
      // (senão o cliente é avisado que um humano vem e o lead fica órfão, sem ninguém na fila).
      if (!leadId) { console.error("[lia-whatsapp] qualificar: criarLeadFila falhou, abortando repasse"); return null; }
    } else {
      // já estava na fila: atualiza a temperatura E o título do histórico pra bater com a fila
      await sb.from("pipeline_leads").update({
        temperatura: map.temperatura, prioridade_lead: map.prioridade,
      }).eq("id", leadId);
      await sb.from("pipeline_atividades").update({
        titulo: `${map.emoji} Lead ${map.label} · atendido pela LIA (WhatsApp)`,
      }).eq("pipeline_lead_id", leadId).eq("tipo", "entrada");
    }

    // marca "agendou apresentação" quando o resumo traz um dia/turno (métrica-norte do funil)
    const ag = lerAgendamento(resumo);
    await sb.from("lia_estado").update({
      status: "qualificado",
      nivel,
      lead_id: leadId,
      qualificado_em: est.qualificado_em ?? nowISO(),
      resumo: resumo || est.resumo || null,
      agendou: ag.agendou || est.agendou || false,
      agendamento: ag.quando ?? est.agendamento ?? null,
      agendou_em: (ag.agendou && !est.agendou) ? nowISO() : (est.agendou_em ?? null),
      updated_at: nowISO(),
    }).eq("telefone", from);

    // notifica o Lucas só pra lead acionável (morno/quente) e na transição/quando esquenta;
    // frio entra na Fila CEO sem push (ele vê e dispara quando quiser). Se o lead JÁ tem corretor
    // dono, re-notifica esse corretor do pré-atendimento da LIA (ele segue de onde a LIA parou).
    if (leadId && map.rank >= 2 && (!jaEra || subiu)) {
      const { data: donoRows } = await sb.from("pipeline_leads").select("corretor_id, aceite_status").eq("id", leadId).limit(1);
      const dono = donoRows?.[0];
      const corretorId = (dono?.corretor_id && dono?.aceite_status === "aceito") ? dono.corretor_id : null;
      await notificar(sb, leadId, est.nome ?? nome, nivel, produto, corretorId);
    }
    return leadId;
  } catch (e) { console.error("[lia-whatsapp] qualificar erro", e); return null; }
}

// PASSAGEM DE BASTÃO: avisa o lead, na hora do desfecho, que um especialista humano
// vai seguir o atendimento. Isso resolve o problema de o corretor ligar e o lead achar
// que é contato duplicado (o humano é a CONTINUAÇÃO da LIA, não um segundo vendedor).
// Roda no MÁXIMO uma vez por conversa (trava: repassado_em) e enquadra o próximo contato
// como o mesmo atendimento, avisando que pode vir de outro número.
async function passagemDeBastao(sb: any, from: string, produto: any | null) {
  try {
    const { data: rows } = await sb
      .from("lia_estado").select("repassado_em, agendou").eq("telefone", from).limit(1);
    const est = rows?.[0];
    if (!est || est.repassado_em) return; // já avisou antes: não repete

    const empNome = produto?.nome ?? produto?.empreendimento ?? "Casa Tua";
    const foco = est.agendou
      ? "pra organizar e confirmar tua visita"
      : "pra seguir de onde a gente parou";
    const msg =
      `Que bom falar contigo! 🙌 Daqui pra frente quem segue com você é o nosso time de especialistas do ${empNome}, ${foco}.` +
      `\n\nEm breve alguém do time te chama por aqui no WhatsApp. Pode ser de um número diferente do meu, mas é o mesmo atendimento e a pessoa já vai com todo o teu contexto, tá? 😉`;

    await sendText(from, msg);
    await sb.from("lia_conversas").insert({ telefone: from, role: "assistant", conteudo: msg });
    await sb.from("lia_estado").update({ repassado_em: nowISO(), last_msg_em: nowISO(), updated_at: nowISO() }).eq("telefone", from);
  } catch (e) { console.error("[lia-whatsapp] passagemDeBastao erro", e); }
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
        if (!r.ok) { console.error("[lia-whatsapp] resumo HTTP", r.status, await r.text().catch(() => "")); continue; }
        const d = await r.json();
        const resumo = String(d?.resumo ?? "").trim();
        if (resumo) return resumo;
        console.error("[lia-whatsapp] resumo veio vazio (tentativa", i, ")");
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

// Lê a linha "Agendamento:" do resumo e diz se a pessoa marcou a apresentação (e quando).
function lerAgendamento(resumo: string): { agendou: boolean; quando: string | null } {
  const m = String(resumo || "").match(/Agendamento:\s*(.+)/i);
  const val = (m?.[1] ?? "").split("\n")[0].trim();
  if (!val || /n[ãa]o\s+agend|n[ãa]o\s+inform|sem\s+agend|nenhum/i.test(val)) return { agendou: false, quando: null };
  return { agendou: true, quando: val.slice(0, 120) };
}

// REPASSE PRA ROLETA: chama a função distribute-lead (ação dispatch_fila_ceo) pra distribuir o
// lead recém-criado usando a roleta EXISTENTE (distribuir_lead_atomico), escopada por produto:
// só vai pra corretor ALOCADO ativo ao empreendimento; sem alocado, permanece na Fila CEO.
// Não altera a lógica da roleta — apenas a aciona na hora, pra não perder velocidade.
async function empurrarParaRoleta(leadId: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/distribute-lead`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !leadId) return;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ action: "dispatch_fila_ceo", pipeline_lead_id: leadId }),
    });
    if (!r.ok) console.error("[lia-whatsapp] empurrarParaRoleta status", r.status, await r.text().catch(() => ""));
  } catch (e) { console.error("[lia-whatsapp] empurrarParaRoleta erro (nao critico)", e); }
}

// Cria o lead SEM DONO na Fila CEO (mesmo padrão do receive-quiz-lead), origem 'LIA'.
async function criarLeadFila(sb: any, from: string, nome: string | null, referral: any, nivel: string, resumo: string, produto: any | null): Promise<string | null> {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    const telefone = telBR(from);

    const { data: stage } = await sb
      .from("pipeline_stages").select("id").eq("tipo", "novo_lead").eq("ativo", true).limit(1).single();
    if (!stage) { console.error("[lia-whatsapp] stage novo_lead ausente"); return null; }

    const resumoTxt = (resumo ?? "").trim();

    // DEDUP FORTE: já existe QUALQUER lead com esse telefone (qualquer origem: ig/fb/LIA/CTWA),
    // INCLUSIVE arquivado? A LIA NUNCA cria outro (evita duplicata). Casa por últimos-8 dígitos.
    // - Lead VIVO: enriquece (temperatura + nota) e retorna. O corretor que já estiver nele permanece.
    // - Lead ARQUIVADO (alvo de reengajamento): RESSUSCITA em vez de duplicar — desarquiva, volta pro
    //   stage de novo lead, limpa o descarte, manda pra Fila CEO, e MANTÉM histórico + observações
    //   (onde às vezes está o orçamento do Jetimob). Nunca insere um lead novo.
    // Se houver um vivo E um arquivado, o vivo tem prioridade (ordena arquivado asc: false vem antes).
    const l8 = telefone.replace(/\D/g, "").slice(-8);
    const { data: exist } = await sb
      .from("pipeline_leads").select("id, corretor_id, arquivado")
      .ilike("telefone", `%${l8}`)
      .order("arquivado", { ascending: true })
      .order("created_at", { ascending: false }).limit(1);
    if (exist && exist.length) {
      const lead = exist[0];
      const patch: Record<string, unknown> = { temperatura: map.temperatura, prioridade_lead: map.prioridade };
      if (lead.arquivado) {
        patch.arquivado = false;
        patch.stage_id = stage.id;
        patch.stage_changed_at = new Date().toISOString();
        patch.aceite_status = "pendente_distribuicao";
        patch.corretor_id = null;            // volta pra Fila CEO qualificado
        patch.motivo_descarte = null;
        patch.motivo_descarte_code = null;
        patch.tipo_descarte = null;
        patch.tags = ["qualificado_lia", `lia_${nivel}`, "reengajado"];
      }
      await sb.from("pipeline_leads").update(patch).eq("id", lead.id);
      await sb.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "entrada",
        titulo: `${map.emoji} Lead ${map.label} · ${lead.arquivado ? "RESSUSCITADO e qualificado" : "qualificado"} pela LIA (WhatsApp)`,
        descricao: resumoTxt || "A LIA conversou e qualificou este lead pelo WhatsApp.",
        status: "concluida",
        created_by: "00000000-0000-0000-0000-000000000000",
      }).then(() => {}).catch(() => {});
      return lead.id;
    }

    const campanha = (referral?.headline || referral?.source_id) ? `Anúncio: ${referral?.headline ?? referral?.source_id}` : null;
    const { data: ins, error } = await sb.from("pipeline_leads").insert({
      nome: nome || "Lead LIA",
      telefone,
      empreendimento: produto?.empreendimento ?? "Casa Tua Santos Ferreira",
      empreendimento_canonico_id: produto?.empreendimento_canonico_id ?? null,
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

// Notifica admin/diretor na hora — é assim que o Lucas fica sabendo pra repassar. E, quando o lead
// JÁ tem um corretor dono (ex.: lead que veio do Instagram e a LIA atendeu depois), RE-NOTIFICA esse
// corretor de que houve um pré-atendimento da LIA, pra ele seguir de onde parou (e não recomeçar do zero).
async function notificar(sb: any, leadId: string, nome: string | null, nivel: string, produto: any | null, corretorId?: string | null) {
  try {
    const map = NIVEL_MAP[nivel] ?? NIVEL_MAP.morno;
    const empNome = produto?.empreendimento ?? "Casa Tua Santos Ferreira";
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
        p_mensagem: `${nome || "Lead"} · ${empNome} · pronto pra repassar`,
        p_dados: { pipeline_lead_id: leadId, nivel, url: "/ceo" },
        p_agrupamento_key: `lead_lia:${leadId}:${nivel}`,
      });
    }
    // corretor DONO do lead: avisa do pré-atendimento da LIA pra ele seguir (não é admin/diretor)
    if (corretorId && !seen.has(corretorId)) {
      await sb.rpc("criar_notificacao", {
        p_user_id: corretorId,
        p_tipo: "lead",
        p_categoria: "pre_atendimento_lia",
        p_titulo: `${map.emoji} A LIA falou com o seu lead`,
        p_mensagem: `${nome || "Lead"} · ${empNome} · pré-atendimento da LIA (${map.label}). Abra a conversa da LIA e siga o atendimento.`,
        p_dados: { pipeline_lead_id: leadId, nivel, url: `/pipeline-leads?lead=${leadId}` },
        p_agrupamento_key: `pre_atend_lia:${leadId}:${nivel}`,
      });
    }
  } catch (e) { console.error("[lia-whatsapp] notificacao falhou (nao critico)", e); }
}
