// Lia · cérebro.
//
// Ordem inegociável: contexto montado por CÓDIGO → prompt lido do arquivo com
// verificação de hash → modelo → TODAS as travas → só então envio.
// Nada do que o modelo diz vira ação sem passar pelas travas.
//
// Ações:
//   turno            (serviço/cron) monta e propõe o próximo turno de um lead
//   enviar_turno     (admin)        envia o turno proposto, com edição opcional
//   descartar_turno  (admin)        descarta o turno proposto

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ETAPAS_IA_EMISSIVEIS, isEtapaIaEmissivel, LIA_PROMPT_VERSAO } from "./etapas.ts";
import { avaliarTravasDeSaida, type Trava } from "./travas.ts";
import { alertarAdminsLia } from "../_shared/liaAlert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
const CRON_SECRET = Deno.env.get("LIA_CRON_SECRET");

const PROMPT_PATH = new URL("./prompt/lia-canoas-v3.1.txt", import.meta.url);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── BRT helpers ────────────────────────────────────────────────────────────
const BRT_OFFSET_MS = -3 * 3600_000;
function agoraBrt(): Date {
  return new Date(Date.now() + BRT_OFFSET_MS);
}
function hhmm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function dentroDaJanela(inicio: string, fim: string): boolean {
  const agora = hhmm(agoraBrt());
  const i = String(inicio).slice(0, 5);
  const f = String(fim).slice(0, 5);
  return agora >= i && agora <= f;
}

// ── Prompt com verificação de hash ─────────────────────────────────────────
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function carregarPrompt(supabase: SupabaseClient): Promise<
  { ok: true; texto: string; hash: string } | { ok: false; motivo: string }
> {
  const bytes = await Deno.readFile(PROMPT_PATH);
  const hash = await sha256Hex(bytes);

  const { data: versao } = await supabase
    .from("ia_prompt_versoes")
    .select("versao, hash_sha256")
    .eq("versao", LIA_PROMPT_VERSAO)
    .maybeSingle();

  if (!versao?.hash_sha256) {
    return { ok: false, motivo: `Versão ${LIA_PROMPT_VERSAO} sem hash registrado.` };
  }
  if (versao.hash_sha256 !== hash) {
    // Divergência ALERTA, não só registra.
    await alertarAdminsLia(supabase, {
      dedupKey: `lia_prompt_hash_divergente:${LIA_PROMPT_VERSAO}`,
      titulo: "Lia parada: prompt divergente",
      mensagem:
        `O arquivo do prompt ${LIA_PROMPT_VERSAO} não bate com o hash registrado. ` +
        `A Lia está bloqueada até alguém revisar. Esperado ${versao.hash_sha256.slice(0, 12)}…, ` +
        `encontrado ${hash.slice(0, 12)}….`,
      ctx: { versao: LIA_PROMPT_VERSAO, hash_esperado: versao.hash_sha256, hash_arquivo: hash },
      dedupHoras: 6,
    });
    return { ok: false, motivo: "hash_divergente" };
  }

  return { ok: true, texto: new TextDecoder().decode(bytes), hash };
}

// ── Slots de agenda gerados pelo SISTEMA ───────────────────────────────────
// A lista existe para que o texto do modelo possa ser conferido contra ela.
function gerarHorarios(cfg: Record<string, unknown>): string[] {
  const inicio = Number(String(cfg.agenda_inicio ?? "10:00").slice(0, 2));
  const fim = Number(String(cfg.agenda_fim ?? "20:00").slice(0, 2));
  const antecedencia = Number(cfg.agenda_antecedencia_horas ?? 3);
  const agora = agoraBrt();
  const minimoHoje = agora.getUTCHours() + antecedencia;

  const slots: string[] = [];
  for (let h = inicio; h <= fim; h++) {
    if (h < minimoHoje) continue; // hoje só a partir da antecedência
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  // Amanhã a agenda abre inteira; os mesmos rótulos de hora valem.
  for (let h = inicio; h <= fim; h++) {
    const rotulo = `${String(h).padStart(2, "0")}:00`;
    if (!slots.includes(rotulo)) slots.push(rotulo);
  }
  return slots.sort();
}

// ── Contexto montado por código ────────────────────────────────────────────
async function montarContexto(supabase: SupabaseClient, iaLeadId: string) {
  const [lead, mensagens, perfil, apresentacoes, midias] = await Promise.all([
    supabase.from("ia_leads").select("*").eq("id", iaLeadId).maybeSingle(),
    supabase
      .from("ia_mensagens")
      .select("direcao, autor, conteudo, tipo, created_at")
      .eq("ia_lead_id", iaLeadId)
      .order("created_at", { ascending: true })
      .limit(60),
    supabase.from("ia_perfil_busca").select("*").eq("ia_lead_id", iaLeadId).maybeSingle(),
    supabase
      .from("ia_apresentacoes")
      .select("*")
      .eq("ia_lead_id", iaLeadId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("ia_midias").select("rotulo, gatilho, tipo, url, ordem").eq("ativo", true)
      .order("ordem"),
  ]);

  const historico = mensagens.data ?? [];
  const enviadas = historico.filter((m) => m.direcao === "out").map((m) => m.conteudo ?? "");
  const midiasEnviadas = historico.filter((m) => m.tipo === "image" && m.direcao === "out").length;

  return {
    lead: lead.data,
    historico,
    enviadas,
    perfil: perfil.data,
    apresentacoes: apresentacoes.data ?? [],
    midias: midias.data ?? [],
    midiasEnviadas,
  };
}

// ── Modelo ─────────────────────────────────────────────────────────────────
type SaidaModelo = {
  mensagem: string;
  etapa_ia: string;
  midias?: string[];
  apresentacao_aceita?: boolean;
  visita_confirmada_em?: string | null;
};

async function chamarModelo(
  modelo: string,
  systemPrompt: string,
  contextoTexto: string,
): Promise<{ ok: true; saida: SaidaModelo } | { ok: false; motivo: string }> {
  if (!LOVABLE_API_KEY) return { ok: false, motivo: "LOVABLE_API_KEY ausente" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextoTexto },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) return { ok: false, motivo: "rate_limit" };
  if (res.status === 402) return { ok: false, motivo: "sem_creditos" };
  if (!res.ok) return { ok: false, motivo: `gateway_${res.status}: ${(await res.text()).slice(0, 200)}` };

  const data = await res.json();
  try {
    const saida = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as SaidaModelo;
    return { ok: true, saida };
  } catch {
    return { ok: false, motivo: "resposta_nao_json" };
  }
}

// ── Envio ──────────────────────────────────────────────────────────────────
async function urlDeEnvio(supabase: SupabaseClient, url: string): Promise<string | null> {
  if (/^https?:\/\//i.test(url)) return url;
  const { data } = await supabase.storage.from("lia-midias").createSignedUrl(url, 3600);
  return data?.signedUrl ?? null;
}

async function enviarTexto(numero: string, instancia: string, texto: string) {
  const res = await fetch(`${EVO_URL}/message/sendText/${instancia}`, {
    method: "POST",
    headers: { apikey: EVO_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  return { ok: res.ok, body: (await res.text()).slice(0, 300) };
}

async function enviarMidia(numero: string, instancia: string, url: string, legenda?: string) {
  const res = await fetch(`${EVO_URL}/message/sendMedia/${instancia}`, {
    method: "POST",
    headers: { apikey: EVO_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ number: numero, mediatype: "image", media: url, caption: legenda ?? "" }),
  });
  return { ok: res.ok, body: (await res.text()).slice(0, 300) };
}

// ── Ação: montar turno ─────────────────────────────────────────────────────
async function acaoTurno(supabase: SupabaseClient, iaLeadId: string) {
  const { data: cfg } = await supabase.from("ia_config").select("*").eq("id", true).maybeSingle();
  if (!cfg) return json({ ok: false, motivo: "ia_config ausente" }, 500);

  const ctx = await montarContexto(supabase, iaLeadId);
  const lead = ctx.lead;
  if (!lead) return json({ ok: false, motivo: "lead inexistente" }, 404);

  // Freios de lead, antes de gastar modelo.
  if (lead.pausado) return json({ ok: true, status: "pausado" });
  if (lead.opt_out) return json({ ok: true, status: "opt_out" });
  if (lead.assumido_por) return json({ ok: true, status: "assumido_por_humano" });
  if (["bloqueado", "migrado", "desqualificado"].includes(lead.etapa)) {
    return json({ ok: true, status: `etapa_${lead.etapa}` });
  }

  // Debounce: agrupa rajada. Espera o silêncio, respeitando o teto.
  // "Pendente" = mensagem do cliente posterior ao último turno montado.
  const { data: ultimoTurno } = await supabase
    .from("ia_turnos")
    .select("created_at")
    .eq("ia_lead_id", iaLeadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let entradas = ctx.historico.filter((m) => m.direcao === "in");
  let pendentes = entradas.filter(
    (m) => !ultimoTurno || new Date(m.created_at) > new Date(ultimoTurno.created_at),
  );
  if (pendentes.length === 0) return json({ ok: true, status: "sem_mensagem_nova" });

  const debounceSeg = cfg.debounce_segundos ?? 12;
  const tetoSeg = cfg.debounce_teto_segundos ?? 45;
  const corte = pendentes[0].created_at;

  // Espera o silêncio aqui mesmo, com corte no teto. Devolver "aguardando" e
  // torcer por outra chamada deixaria o cliente sem resposta quando ele manda
  // uma mensagem só.
  for (;;) {
    const idadeSeg = (Date.now() - new Date(pendentes[pendentes.length - 1].created_at).getTime()) / 1000;
    const esperaTotal = (Date.now() - new Date(corte).getTime()) / 1000;
    if (idadeSeg >= debounceSeg || esperaTotal >= tetoSeg) break;
    await new Promise((r) => setTimeout(r, 2000));
    const { data: novas } = await supabase
      .from("ia_mensagens")
      .select("direcao, autor, conteudo, tipo, created_at")
      .eq("ia_lead_id", iaLeadId)
      .eq("direcao", "in")
      .gte("created_at", corte)
      .order("created_at", { ascending: true });
    if (novas && novas.length > 0) {
      pendentes = novas;
      entradas = novas;
    }
  }

  // Recarrega a conversa: a rajada pode ter crescido durante a espera.
  const ctxFinal = await montarContexto(supabase, iaLeadId);
  ctx.historico = ctxFinal.historico;
  ctx.enviadas = ctxFinal.enviadas;
  ctx.midiasEnviadas = ctxFinal.midiasEnviadas;
  void entradas;



  // Lock por lead (compare-and-swap em updated_at): dois turnos ao mesmo tempo
  // viram duas respostas, e duas respostas quebram a conversa.
  const { data: travado } = await supabase
    .from("ia_leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", iaLeadId)
    .eq("updated_at", lead.updated_at)
    .select("id");
  if (!travado || travado.length === 0) return json({ ok: true, status: "lock_ocupado" });

  // Prompt com hash conferido. Divergência para tudo e alerta.
  const prompt = await carregarPrompt(supabase);
  if (!prompt.ok) return json({ ok: false, status: "prompt_bloqueado", motivo: prompt.motivo }, 409);

  const horarios = gerarHorarios(cfg);
  const midiasDisponiveis = ctx.midias.filter(() => ctx.midiasEnviadas < (cfg.max_midias_conversa ?? 3));

  const contextoTexto = [
    `LEAD: ${lead.nome ?? "sem nome"} | etapa atual: ${lead.etapa} | toques: ${lead.toques_enviados ?? 0}`,
    `PERFIL DE BUSCA: ${ctx.perfil ? JSON.stringify(ctx.perfil) : "ainda não levantado"}`,
    `APRESENTAÇÕES: ${ctx.apresentacoes.length ? JSON.stringify(ctx.apresentacoes) : "nenhuma"}`,
    `HORÁRIOS DISPONÍVEIS (use SOMENTE estes, texto exato): ${horarios.join(", ") || "nenhum hoje"}`,
    `MÍDIAS DISPONÍVEIS (rótulo → gatilho), teto ${cfg.max_midias_conversa ?? 3} por conversa, já enviadas ${ctx.midiasEnviadas}:`,
    midiasDisponiveis.map((m) => `- ${m.rotulo}: ${m.gatilho}`).join("\n") || "- nenhuma disponível",
    "",
    "CONVERSA:",
    ctx.historico
      .map((m) => `${m.direcao === "in" ? "CLIENTE" : "LIA"}: ${m.conteudo ?? `[${m.tipo}]`}`)
      .join("\n"),
    "",
    `Responda em JSON: { "mensagem": "texto para o WhatsApp", "etapa_ia": "${ETAPAS_IA_EMISSIVEIS.join("|")}", "midias": ["rótulo"], "apresentacao_aceita": false, "visita_confirmada_em": null }`,
  ].join("\n");

  const resposta = await chamarModelo(cfg.lia_model ?? "google/gemini-3.6-flash", prompt.texto, contextoTexto);
  if (!resposta.ok) {
    await supabase.from("ia_eventos").insert({
      ia_lead_id: iaLeadId, tipo: "falha_modelo", motivo: resposta.motivo, ator: "lia",
    });
    return json({ ok: false, status: "falha_modelo", motivo: resposta.motivo }, 502);
  }

  const saida = resposta.saida;
  const texto = String(saida.mensagem ?? "").trim();
  const travas: Trava[] = [];

  // TRAVAS — todas depois do modelo, todas antes do envio.
  if (!texto) travas.push({ codigo: "texto_vazio", detalhe: "Modelo devolveu mensagem vazia." });

  if (!isEtapaIaEmissivel(saida.etapa_ia)) {
    travas.push({
      codigo: "etapa_invalida",
      detalhe: `Etapa "${saida.etapa_ia}" fora das seis emissíveis (${ETAPAS_IA_EMISSIVEIS.join(", ")}).`,
    });
  }

  travas.push(...avaliarTravasDeSaida(texto, {
    mensagensEnviadas: ctx.enviadas,
    horariosOfertados: horarios,
  }));

  const rotulosPedidos = (saida.midias ?? []).filter(Boolean);
  const midiasResolvidas = rotulosPedidos
    .map((r) => ctx.midias.find((m) => m.rotulo === r))
    .filter(Boolean) as Array<{ rotulo: string; url: string }>;
  if (rotulosPedidos.length !== midiasResolvidas.length) {
    travas.push({ codigo: "midia_inexistente", detalhe: `Mídia pedida fora do catálogo: ${rotulosPedidos.join(", ")}.` });
  }
  if (ctx.midiasEnviadas + midiasResolvidas.length > (cfg.max_midias_conversa ?? 3)) {
    travas.push({ codigo: "teto_midias", detalhe: `Teto de ${cfg.max_midias_conversa ?? 3} mídias por conversa.` });
  }

  if (!cfg.enviar_habilitado) {
    travas.push({ codigo: "envio_desligado", detalhe: "Interruptor global de envio desligado." });
  }
  if (!dentroDaJanela(cfg.janela_envio_inicio ?? "08:00", cfg.janela_envio_fim ?? "23:59")) {
    travas.push({ codigo: "fora_janela_envio", detalhe: "Fora da janela de mensagens (BRT)." });
  }

  const bloqueado = travas.length > 0;

  const { data: turno, error: erroTurno } = await supabase
    .from("ia_turnos")
    .insert({
      ia_lead_id: iaLeadId,
      status: bloqueado ? "bloqueado" : "proposto",
      texto_proposto: texto,
      midias: midiasResolvidas,
      etapa_proposta: saida.etapa_ia ?? null,
      travas,
      bloqueado_por: bloqueado ? travas.map((t) => t.codigo).join(",") : null,
      modelo: cfg.lia_model,
      prompt_versao: LIA_PROMPT_VERSAO,
      horarios_ofertados: horarios,
      contexto: {
        apresentacao_aceita: saida.apresentacao_aceita ?? false,
        visita_confirmada_em: saida.visita_confirmada_em ?? null,
        midias_ja_enviadas: ctx.midiasEnviadas,
      },
    })
    .select("id")
    .single();

  if (erroTurno) return json({ ok: false, motivo: erroTurno.message }, 500);

  // O marcador de "já processado" é o próprio turno; ultima_mensagem_em fica
  // reservado ao tráfego real de mensagens.


  // Conversões de volta ao Meta: aceite da apresentação e confirmação da data.
  await registrarConversoes(supabase, iaLeadId, saida);

  // Modo sombra: nunca envia sozinha. A sala ao vivo decide.
  if (cfg.modo_liberacao === "sombra" || bloqueado) {
    return json({ ok: true, status: bloqueado ? "bloqueado" : "proposto", turno_id: turno.id, travas });
  }

  return await despacharTurno(supabase, turno.id, null, null);
}

// ── Conversões CAPI ────────────────────────────────────────────────────────
async function registrarConversoes(supabase: SupabaseClient, iaLeadId: string, saida: SaidaModelo) {
  if (saida.apresentacao_aceita) {
    await supabase.rpc("enqueue_meta_capi_event_lia", {
      p_ia_lead_id: iaLeadId,
      p_event_name: "LeadQualificado",
    });
  }
  if (saida.visita_confirmada_em) {
    await supabase.rpc("enqueue_meta_capi_event_lia", {
      p_ia_lead_id: iaLeadId,
      p_event_name: "VisitaMarcada",
    });
  }
}

// ── Despacho de um turno (usado pelo automático e pela sala ao vivo) ───────
async function despacharTurno(
  supabase: SupabaseClient,
  turnoId: string,
  textoEditado: string | null,
  usuarioId: string | null,
) {
  const { data: turno } = await supabase.from("ia_turnos").select("*").eq("id", turnoId).maybeSingle();
  if (!turno) return json({ ok: false, motivo: "turno inexistente" }, 404);
  if (turno.status === "enviado") return json({ ok: true, status: "ja_enviado" });

  const { data: cfg } = await supabase.from("ia_config").select("*").eq("id", true).maybeSingle();
  const { data: lead } = await supabase.from("ia_leads").select("*").eq("id", turno.ia_lead_id).maybeSingle();
  if (!cfg || !lead) return json({ ok: false, motivo: "config/lead ausente" }, 500);
  if (!cfg.enviar_habilitado) return json({ ok: false, motivo: "envio_desligado" }, 409);
  if (lead.opt_out || lead.pausado) return json({ ok: false, motivo: "lead_freado" }, 409);
  if (!EVO_URL || !EVO_KEY) return json({ ok: false, motivo: "evolution_nao_configurada" }, 500);

  const editado = textoEditado !== null && textoEditado.trim() !== turno.texto_proposto?.trim();
  const texto = (editado ? textoEditado! : turno.texto_proposto ?? "").trim();

  // Texto editado à mão também passa pelas travas: edição não é passe livre,
  // exceto pelas travas que só o automático precisa (janela/etapa já avaliadas).
  const { data: enviadasRows } = await supabase
    .from("ia_mensagens").select("conteudo").eq("ia_lead_id", lead.id).eq("direcao", "out");
  const travas = avaliarTravasDeSaida(texto, {
    mensagensEnviadas: (enviadasRows ?? []).map((r) => r.conteudo ?? ""),
    horariosOfertados: (turno.horarios_ofertados as string[]) ?? [],
  });
  if (travas.length > 0) {
    await supabase.from("ia_turnos").update({
      status: "bloqueado", travas, bloqueado_por: travas.map((t) => t.codigo).join(","),
      texto_editado: editado ? texto : turno.texto_editado, editado: editado || turno.editado,
    }).eq("id", turnoId);
    return json({ ok: false, status: "bloqueado", travas }, 409);
  }

  const numero = lead.telefone_normalizado ?? lead.telefone;
  const instancia = cfg.instancia ?? "uhome-lia-canoas";

  // Mídias primeiro, texto depois: a imagem contextualiza a frase.
  for (const midia of ((turno.midias as Array<{ rotulo: string; url: string }>) ?? [])) {
    const url = await urlDeEnvio(supabase, midia.url);
    if (!url) continue;
    const r = await enviarMidia(numero, instancia, url);
    await supabase.from("ia_mensagens").insert({
      ia_lead_id: lead.id, direcao: "out", autor: "lia", tipo: "image",
      conteudo: midia.rotulo, media_url: midia.url,
      idempotency_key: `turno:${turnoId}:midia:${midia.rotulo}`,
      delivery_status: r.ok ? "enviado" : "falhou", erro: r.ok ? null : r.body,
    });
  }

  const envio = await enviarTexto(numero, instancia, texto);
  await supabase.from("ia_mensagens").insert({
    ia_lead_id: lead.id, direcao: "out", autor: "lia", tipo: "text",
    conteudo: texto, idempotency_key: `turno:${turnoId}:texto`,
    delivery_status: envio.ok ? "enviado" : "falhou", erro: envio.ok ? null : envio.body,
  });

  if (!envio.ok) {
    await supabase.from("ia_turnos").update({ status: "bloqueado", bloqueado_por: "falha_envio" }).eq("id", turnoId);
    return json({ ok: false, status: "falha_envio", detalhe: envio.body }, 502);
  }

  await supabase.from("ia_turnos").update({
    status: "enviado",
    texto_editado: editado ? texto : null,
    editado,
    enviado_por: usuarioId,
    enviado_em: new Date().toISOString(),
    etapa_aplicada: isEtapaIaEmissivel(turno.etapa_proposta),
  }).eq("id", turnoId);

  const patch: Record<string, unknown> = {
    toques_enviados: (lead.toques_enviados ?? 0) + 1,
    ultima_mensagem_em: new Date().toISOString(),
  };
  if (isEtapaIaEmissivel(turno.etapa_proposta)) patch.etapa = turno.etapa_proposta;
  await supabase.from("ia_leads").update(patch).eq("id", lead.id);

  await supabase.from("ia_eventos").insert({
    ia_lead_id: lead.id,
    tipo: "mensagem_enviada",
    etapa_para: isEtapaIaEmissivel(turno.etapa_proposta) ? turno.etapa_proposta : null,
    motivo: editado ? "enviada com edição" : "enviada sem edição",
    trecho: texto.slice(0, 300),
    ator: usuarioId ? "humano" : "lia",
    ator_user_id: usuarioId,
    detalhe: { turno_id: turnoId, editado },
  });

  return json({ ok: true, status: "enviado", turno_id: turnoId, editado });
}

// ── HTTP ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "turno");
    const authHeader = req.headers.get("authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? req.headers.get("x-lia-secret") ?? "";
    const ehServico =
      (CRON_SECRET && cronHeader === CRON_SECRET) || authHeader === `Bearer ${SERVICE_KEY}`;

    if (action === "turno") {
      if (!ehServico) return json({ error: "nao autorizado" }, 401);
      if (!body.ia_lead_id) return json({ error: "ia_lead_id obrigatório" }, 400);
      return await acaoTurno(supabase, String(body.ia_lead_id));
    }

    // Ações da sala ao vivo: exigem admin de verdade.
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "nao autorizado" }, 401);
    const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!ehAdmin) return json({ error: "somente admin" }, 403);

    if (action === "enviar_turno") {
      if (!body.turno_id) return json({ error: "turno_id obrigatório" }, 400);
      const texto = typeof body.texto === "string" ? body.texto : null;
      return await despacharTurno(supabase, String(body.turno_id), texto, user.id);
    }

    if (action === "descartar_turno") {
      await supabase
        .from("ia_turnos")
        .update({ status: "descartado", bloqueado_por: "descartado_por_humano", enviado_por: user.id })
        .eq("id", String(body.turno_id));
      return json({ ok: true, status: "descartado" });
    }

    return json({ error: `ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
