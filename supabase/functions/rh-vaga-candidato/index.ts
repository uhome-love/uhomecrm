/**
 * rh-vaga-candidato — Público (página /vaga).
 * Recebe o candidato do quiz do anúncio, grava em rh_candidatos e agenda a
 * entrevista em rh_entrevistas (com service role — as tabelas seguem com RLS).
 *
 * POST body:
 * {
 *   nome: string,
 *   telefone: string,
 *   email?: string,
 *   respostas: Record<string, unknown>,
 *   temperatura: "quente" | "morno" | "frio",
 *   horario: string  // ISO com timezone, ex "2026-08-12T13:00:00.000Z"
 * }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TZ = "America/Sao_Paulo";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Partes do horário em BRT */
function partesBRT(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[p.weekday] ?? -1,
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    label: `${p.day}/${p.month} às ${p.hour}:${p.minute}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body inválido" }, 400);

    const nome = String(body.nome || "").trim();
    const telefone = String(body.telefone || "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const temperatura = ["quente", "morno", "frio"].includes(String(body.temperatura))
      ? String(body.temperatura)
      : null;
    const respostas = body.respostas && typeof body.respostas === "object" ? body.respostas : {};
    const horarioRaw = String(body.horario || "");

    if (nome.length < 2 || nome.length > 120) return json({ error: "Nome inválido" }, 400);
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 13) return json({ error: "WhatsApp inválido" }, 400);

    const slot = new Date(horarioRaw);
    if (isNaN(slot.getTime())) return json({ error: "Horário inválido" }, 400);

    // ── Validação do horário (regras da agenda do RH, em BRT) ──
    const { weekday, hour, minute, label } = partesBRT(slot);
    if (slot.getTime() < Date.now() + 5 * 60 * 1000) {
      return json({ error: "Esse horário já passou. Escolha outro." }, 400);
    }
    if (weekday < 1 || weekday > 5) {
      return json({ error: "Entrevistas apenas de segunda a sexta." }, 400);
    }
    if (minute !== 0 && minute !== 30) {
      return json({ error: "Horário fora dos blocos de 30 minutos." }, 400);
    }
    if (hour < 9 || hour >= 17) {
      return json({ error: "Horário fora da janela 09:00–17:00." }, 400);
    }
    if (hour === 12) {
      return json({ error: "Horário de almoço indisponível (12:00–13:00)." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Slot ainda livre?
    const { data: ocupado } = await supabase
      .from("rh_entrevistas")
      .select("id")
      .eq("status", "agendada")
      .eq("data_entrevista", slot.toISOString())
      .maybeSingle();

    if (ocupado) {
      return json({ error: "slot_ocupado", message: "Esse horário acabou de ser preenchido. Escolha outro." }, 409);
    }

    // Resumo curto do perfil para observações
    const resumo = [
      temperatura ? `Perfil: ${temperatura}` : null,
      respostas.vendas ? `Vendas: ${respostas.vendas}` : null,
      respostas.imobiliario ? `Imobiliário: ${respostas.imobiliario}` : null,
      respostas.disponibilidade ? `Disponibilidade: ${respostas.disponibilidade}` : null,
      respostas.regiao ? `Região: ${respostas.regiao}` : null,
      respostas.motivacao ? `Motivação: "${String(respostas.motivacao).slice(0, 200)}"` : null,
    ].filter(Boolean).join(" · ");

    const { data: candidato, error: candErr } = await supabase
      .from("rh_candidatos")
      .insert({
        nome,
        telefone,
        email,
        origem: "anuncio",
        etapa: "entrevista_marcada",
        temperatura,
        respostas,
        observacoes: resumo || null,
      })
      .select("id")
      .single();

    if (candErr || !candidato) {
      console.error("[rh-vaga-candidato] insert candidato", candErr);
      return json({ error: "Não foi possível registrar sua inscrição." }, 500);
    }

    const { error: entErr } = await supabase.from("rh_entrevistas").insert({
      candidato_id: candidato.id,
      data_entrevista: slot.toISOString(),
      local: "Entrevista de vaga",
      status: "agendada",
    });

    if (entErr) {
      const conflito = String(entErr.code) === "23505" ||
        /duplicate key|unique/i.test(String(entErr.message));
      console.error("[rh-vaga-candidato] insert entrevista", entErr);
      if (conflito) {
        // candidato fica registrado, mas volta para etapa anterior
        await supabase.from("rh_candidatos").update({ etapa: "interessado" }).eq("id", candidato.id);
        return json({ error: "slot_ocupado", message: "Esse horário acabou de ser preenchido. Escolha outro." }, 409);
      }
      return json({ error: "Não foi possível agendar a entrevista." }, 500);
    }

    return json({
      ok: true,
      candidato_id: candidato.id,
      horario: slot.toISOString(),
      horario_label: label,
      temperatura,
    });
  } catch (e) {
    console.error("[rh-vaga-candidato]", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
