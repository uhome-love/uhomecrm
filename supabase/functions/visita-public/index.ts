import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, token } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch visita by token
    const { data: visita, error: fetchError } = await supabase
      .from("visitas")
      .select("id, nome_cliente, telefone, empreendimento, data_visita, hora_visita, status, corretor_id, gerente_id, local_visita, confirmation_token, confirmed_at, cancel_reason")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (fetchError || !visita) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry: 1h after the visit time
    const visitDateTime = new Date(`${visita.data_visita}T${visita.hora_visita || "23:59"}:00`);
    const expiresAt = new Date(visitDateTime.getTime() + 60 * 60 * 1000);
    if (new Date() > expiresAt) {
      return new Response(JSON.stringify({ error: "Este link já expirou" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET: Return visita data ───
    if (action === "get") {
      // Get corretor info
      let corretorNome = null;
      let corretorAvatar = null;
      if (visita.corretor_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, avatar_url")
          .eq("user_id", visita.corretor_id)
          .maybeSingle();
        corretorNome = profile?.nome || null;
        corretorAvatar = profile?.avatar_url || null;
      }

      return new Response(JSON.stringify({
        nome_cliente: visita.nome_cliente,
        empreendimento: visita.empreendimento,
        data_visita: visita.data_visita,
        hora_visita: visita.hora_visita,
        local_visita: visita.local_visita,
        status: visita.status,
        confirmed_at: visita.confirmed_at,
        cancel_reason: visita.cancel_reason,
        corretor_nome: corretorNome,
        corretor_avatar: corretorAvatar,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CONFIRM ───
    if (action === "confirm") {
      const { error: updateError } = await supabase
        .from("visitas")
        .update({
          status: "confirmada",
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", visita.id);

      if (updateError) throw updateError;

      // Notify corretor
      await supabase.from("notifications").insert({
        user_id: visita.corretor_id,
        titulo: "✅ Visita confirmada",
        mensagem: `${visita.nome_cliente} confirmou a visita de ${formatDate(visita.data_visita)} às ${visita.hora_visita || "—"}`,
        tipo: "visita_confirmada",
        categoria: "visitas",
      });

      return new Response(JSON.stringify({ success: true, status: "confirmada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── RESCHEDULE ───
    if (action === "reschedule") {
      const { nova_data, nova_hora } = body;
      if (!nova_data || !nova_hora) {
        return new Response(JSON.stringify({ error: "Data e hora são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("visitas")
        .update({
          data_visita: nova_data,
          hora_visita: nova_hora,
          status: "reagendada",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visita.id);

      if (updateError) throw updateError;

      // Notify corretor
      await supabase.from("notifications").insert({
        user_id: visita.corretor_id,
        titulo: "📅 Visita reagendada",
        mensagem: `${visita.nome_cliente} reagendou a visita para ${formatDate(nova_data)} às ${nova_hora}`,
        tipo: "visita_reagendada",
        categoria: "visitas",
      });




      return new Response(JSON.stringify({ success: true, status: "reagendada", nova_data, nova_hora }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CANCEL ───
    if (action === "cancel") {
      const { motivo } = body;
      if (!motivo) {
        return new Response(JSON.stringify({ error: "Motivo é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("visitas")
        .update({
          status: "cancelada",
          cancel_reason: motivo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", visita.id);

      if (updateError) throw updateError;

      // Urgent notification to corretor
      await supabase.from("notifications").insert({
        user_id: visita.corretor_id,
        titulo: "❌ Visita cancelada pelo cliente",
        mensagem: `${visita.nome_cliente} cancelou a visita de ${formatDate(visita.data_visita)}. Motivo: ${motivo}`,
        tipo: "visita_cancelada",
        categoria: "visitas",
      });

      // Also notify gerente
      if (visita.gerente_id && visita.gerente_id !== visita.corretor_id) {
        await supabase.from("notifications").insert({
          user_id: visita.gerente_id,
          titulo: "❌ Visita cancelada pelo cliente",
          mensagem: `${visita.nome_cliente} cancelou a visita de ${formatDate(visita.data_visita)}. Motivo: ${motivo}`,
          tipo: "visita_cancelada",
          categoria: "visitas",
        });
      }

      return new Response(JSON.stringify({ success: true, status: "cancelada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("visita-public error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (!clean.startsWith("55")) clean = "55" + clean;
  return clean;
}
