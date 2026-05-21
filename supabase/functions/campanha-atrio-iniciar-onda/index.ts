// Inicia uma onda da Campanha Átrio: loop sequencial com cadência 5s,
// kill switch a cada 20 envios (>5% erro), guard de volume, códigos Meta 132016/131056/131057.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const TEMPLATE_NAME = "atrio_disparo";
const TEMPLATE_LANG = "pt_BR";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/campaign-images/atrio/atrio_disparo_2026_05.jpg`;
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const VOLUME_GUARD = 500;
const CADENCIA_MS = 5000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function sendTemplate(phone: string, nome: string) {
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        { type: "header", parameters: [{ type: "image", image: { link: IMAGE_URL } }] },
        { type: "body", parameters: [{ type: "text", text: nome || "olá" }] },
      ],
    },
  };
  const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  const json: any = await resp.json();
  if (!resp.ok) {
    return { ok: false, code: String(json?.error?.code || resp.status), detail: json?.error?.message || JSON.stringify(json) };
  }
  return { ok: true, wamid: json?.messages?.[0]?.id || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCors();

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: auth.userId, _role: "admin" });
  if (!isAdmin) return errorResponse("forbidden", 403);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const onda = Number(body?.onda);
  if (![1,2,3].includes(onda)) return errorResponse("onda inválida (1, 2 ou 3)", 400);

  // 1) Kill switch global
  const { data: flag } = await supabase
    .from("system_flags").select("flag_value").eq("flag_name", "campanha_atrio_enabled").maybeSingle();
  if (!flag?.flag_value) return errorResponse("Kill switch desligado. Ative a flag campanha_atrio_enabled.", 403);

  // 2) Validações de estado
  const { data: ctrl } = await supabase.from("campanha_atrio_controle").select("*").eq("onda", onda).maybeSingle();
  if (!ctrl) return errorResponse("onda não encontrada", 404);
  if (ctrl.status !== "aguardando") return errorResponse(`onda ${onda} está ${ctrl.status}, não pode iniciar`, 409);
  if (onda > 1) {
    const { data: prev } = await supabase.from("campanha_atrio_controle").select("*").eq("onda", onda - 1).maybeSingle();
    if (prev?.status !== "concluida") return errorResponse(`onda ${onda - 1} ainda não concluída`, 409);
    if (prev?.concluida_em) {
      const diff = Date.now() - new Date(prev.concluida_em).getTime();
      if (diff < 20 * 60 * 1000) return errorResponse(`aguarde 20min após conclusão da onda anterior (faltam ${Math.ceil((20*60*1000 - diff)/60000)}min)`, 409);
    }
  }

  // 3) Guard de volume
  if ((ctrl.total_alvo || 0) > VOLUME_GUARD) return errorResponse(`volume ${ctrl.total_alvo} > ${VOLUME_GUARD}`, 400);

  // 4) Buscar audiência pending
  const { data: audiencia, error: audErr } = await supabase
    .from("campanha_atrio_audiencia")
    .select("lead_id, nome, telefone_normalizado, empreendimento_origem, ordem")
    .eq("onda", onda).eq("status", "pending").order("ordem");
  if (audErr) return errorResponse(audErr.message, 500);
  if (!audiencia || audiencia.length === 0) return errorResponse("nenhum lead pending nesta onda", 400);

  // 5) Marcar onda em curso
  await supabase.from("campanha_atrio_controle").update({
    status: "em_curso", iniciada_em: new Date().toISOString(), pausada_em: null, motivo_pausa: null,
  }).eq("onda", onda);

  // Resposta imediata + processamento em background
  const bgRun = async () => {
    let enviados = 0, erros = 0, processados = 0;
    const hoje = new Date().toISOString().slice(0,10);
    for (const lead of audiencia) {
      // Re-checa kill switch a cada iteração
      const { data: f } = await supabase.from("system_flags").select("flag_value").eq("flag_name","campanha_atrio_enabled").maybeSingle();
      if (!f?.flag_value) {
        await supabase.from("campanha_atrio_controle").update({
          status: "pausada", pausada_em: new Date().toISOString(), motivo_pausa: "kill_switch_manual",
        }).eq("onda", onda);
        console.log(`🛑 Onda ${onda} pausada (kill switch)`);
        return;
      }

      // Sanitização defensiva: remove " | Profissão" caso tenha escapado
      const nomeLimpo = (lead.nome || "").split("|")[0].split("/")[0].split(" - ")[0].trim().slice(0, 60);
      const res = await sendTemplate(lead.telefone_normalizado, nomeLimpo);
      processados++;

      if (res.ok) {
        enviados++;
        await supabase.from("campanha_atrio_eventos").insert({
          lead_id: lead.lead_id, telefone: lead.telefone_normalizado, nome: lead.nome,
          onda, empreendimento_origem: lead.empreendimento_origem,
          status_envio: "sucesso", mensagem_id_meta: res.wamid,
        });
        await supabase.from("campanha_atrio_audiencia").update({ status: "sent" }).eq("lead_id", lead.lead_id);
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: lead.lead_id, tipo: "campanha_atrio",
          titulo: `Disparo Átrio — Onda ${onda}`,
          descricao: `Template ${TEMPLATE_NAME} enviado.`,
          data: hoje, status: "concluida",
        });
      } else {
        erros++;
        await supabase.from("campanha_atrio_eventos").insert({
          lead_id: lead.lead_id, telefone: lead.telefone_normalizado, nome: lead.nome,
          onda, empreendimento_origem: lead.empreendimento_origem,
          status_envio: "erro", codigo_erro_meta: res.code, detalhe_erro: res.detail?.slice(0, 500),
        });
        await supabase.from("campanha_atrio_audiencia").update({ status: "failed" }).eq("lead_id", lead.lead_id);

        // Códigos fatais Meta → pausa imediata
        if (["132016","131056","131057"].includes(res.code || "")) {
          await supabase.from("campanha_atrio_controle").update({
            status: "pausada", pausada_em: new Date().toISOString(),
            motivo_pausa: `meta_error_${res.code}`, total_enviado: enviados, total_erros: erros,
          }).eq("onda", onda);
          console.log(`🛑 Onda ${onda} pausada por código fatal ${res.code}`);
          return;
        }
      }

      // Kill switch automático: >5% erro a cada 20 envios
      if (processados >= 20 && processados % 20 === 0) {
        const taxa = erros / processados;
        if (taxa > 0.05) {
          await supabase.from("system_flags").update({ flag_value: false, reason: `auto-killswitch: ${(taxa*100).toFixed(1)}% erro` }).eq("flag_name", "campanha_atrio_enabled");
          await supabase.from("campanha_atrio_controle").update({
            status: "pausada", pausada_em: new Date().toISOString(),
            motivo_pausa: `auto_killswitch_${(taxa*100).toFixed(1)}pct`,
            total_enviado: enviados, total_erros: erros,
          }).eq("onda", onda);
          console.log(`🛑 Auto kill switch acionado (${(taxa*100).toFixed(1)}% erro)`);
          return;
        }
      }

      // Update contadores a cada 10
      if (processados % 10 === 0) {
        await supabase.from("campanha_atrio_controle").update({
          total_enviado: enviados, total_erros: erros,
        }).eq("onda", onda);
      }

      await sleep(CADENCIA_MS);
    }

    // Concluído
    await supabase.from("campanha_atrio_controle").update({
      status: "concluida", concluida_em: new Date().toISOString(),
      total_enviado: enviados, total_erros: erros,
    }).eq("onda", onda);
    console.log(`✅ Onda ${onda} concluída: ${enviados} enviados / ${erros} erros`);
  };

  // background sem aguardar (Edge runtime: usar EdgeRuntime.waitUntil quando disponível)
  // @ts-ignore
  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") waitUntil(bgRun()); else bgRun();

  return jsonResponse({ ok: true, onda, total_a_processar: audiencia.length, message: "Onda iniciada em background." });
});
