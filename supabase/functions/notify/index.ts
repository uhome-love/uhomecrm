import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  evento: string;
  dados: Record<string, any>;
}

// Map events to notification config per role
const EVENT_CONFIG: Record<string, {
  roles: string[];
  tipo: string;
  categoria: string;
  titulo: (d: any) => string;
  mensagem: (d: any) => string;
  agrupamento_key?: (d: any) => string;
}> = {
  // Corretor notifications
  novo_lead: {
    roles: ["corretor"],
    tipo: "leads",
    categoria: "novo_lead",
    titulo: () => "Novo lead recebido!",
    mensagem: (d) => `Lead ${d.nome || ""} foi distribuído para você.`,
    agrupamento_key: () => "novo_lead",
  },
  lead_aguardando: {
    roles: ["corretor"],
    tipo: "leads",
    categoria: "lead_aguardando",
    titulo: () => "Lead aguardando contato",
    mensagem: (d) => `${d.nome || "Lead"} está aguardando seu contato há ${d.minutos || "?"} minutos.`,
    agrupamento_key: (d) => `lead_aguardando_${d.lead_id}`,
  },
  lead_redistribuido: {
    roles: ["corretor"],
    tipo: "leads",
    categoria: "lead_redistribuido",
    titulo: () => "Lead redistribuído",
    mensagem: (d) => `${d.nome || "Lead"} foi redistribuído por falta de atendimento.`,
  },
  visita_confirmada: {
    roles: ["corretor"],
    tipo: "visitas",
    categoria: "visita_confirmada",
    titulo: () => "Visita confirmada!",
    mensagem: (d) => `Visita com ${d.nome || "cliente"} confirmada para ${d.data || "hoje"}.`,
  },
  proposta_enviada: {
    roles: ["corretor"],
    tipo: "propostas",
    categoria: "proposta_enviada",
    titulo: () => "Proposta enviada",
    mensagem: (d) => `Proposta para ${d.nome || "cliente"} foi enviada com sucesso.`,
  },
  // Gerente notifications
  lead_sem_atendimento: {
    roles: ["gestor"],
    tipo: "alertas",
    categoria: "lead_sem_atendimento",
    titulo: () => "⚠️ Lead sem atendimento",
    mensagem: (d) => `${d.nome || "Lead"} está sem atendimento há ${d.minutos || "?"} minutos.`,
    agrupamento_key: () => "lead_sem_atendimento",
  },
  corretor_parado: {
    roles: ["gestor"],
    tipo: "alertas",
    categoria: "corretor_parado",
    titulo: () => "Corretor parado",
    mensagem: (d) => `${d.corretor_nome || "Corretor"} está sem atividade há ${d.minutos || "?"} minutos.`,
    agrupamento_key: (d) => `corretor_parado_${d.corretor_id}`,
  },
  visita_marcada: {
    roles: ["gestor"],
    tipo: "visitas",
    categoria: "visita_marcada",
    titulo: () => "Nova visita marcada",
    mensagem: (d) => `${d.corretor_nome || "Corretor"} marcou visita com ${d.nome || "cliente"}.`,
    agrupamento_key: () => "visita_marcada",
  },
  proposta_criada: {
    roles: ["gestor"],
    tipo: "propostas",
    categoria: "proposta_criada",
    titulo: () => "Nova proposta criada",
    mensagem: (d) => `${d.corretor_nome || "Corretor"} criou proposta para ${d.nome || "cliente"}.`,
    agrupamento_key: () => "proposta_criada",
  },
  meta_abaixo: {
    roles: ["gestor"],
    tipo: "alertas",
    categoria: "meta_abaixo",
    titulo: () => "⚠️ Meta do dia abaixo",
    mensagem: (d) => `A equipe está com ${d.percentual || 0}% da meta de ${d.tipo_meta || "atividades"}.`,
  },
  // CEO notifications
  venda_assinada: {
    roles: ["admin"],
    tipo: "vendas",
    categoria: "venda_assinada",
    titulo: () => "🎉 Venda assinada!",
    mensagem: (d) => `${d.corretor_nome || "Corretor"} fechou venda de ${d.empreendimento || "imóvel"}. VGV: R$ ${d.vgv || 0}`,
  },
  volume_leads: {
    roles: ["admin"],
    tipo: "leads",
    categoria: "volume_leads",
    titulo: () => "Volume alto de leads",
    mensagem: (d) => `${d.quantidade || 0} leads entraram nas últimas ${d.horas || 1}h.`,
    agrupamento_key: () => "volume_leads",
  },
  problema_atendimento: {
    roles: ["admin"],
    tipo: "alertas",
    categoria: "problema_atendimento",
    titulo: () => "⚠️ Problema de atendimento",
    mensagem: (d) => `${d.leads_sem_atendimento || 0} leads sem atendimento no segmento ${d.segmento || "N/A"}.`,
    agrupamento_key: () => "problema_atendimento",
  },
  alerta_previsao: {
    roles: ["admin"],
    tipo: "alertas",
    categoria: "alerta_previsao",
    titulo: () => "Alerta de previsão de vendas",
    mensagem: (d) => `Previsão de vendas está ${d.percentual || 0}% abaixo da meta mensal.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: validate JWT ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const _supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const _token = authHeader.replace("Bearer ", "");
  const { data: _claims, error: _claimsErr } = await _supabaseAuth.auth.getClaims(_token);
  if (_claimsErr || !_claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "notify", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "notify", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "notify", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: "notify", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    const { evento, dados } = (await req.json()) as NotifyRequest;

    const config = EVENT_CONFIG[evento];
    if (!config) {
      L.warn("Unknown event", { evento });
      logOps("warn", "validation", `Unknown notification event: ${evento}`, { evento });
      return new Response(JSON.stringify({ error: "Evento desconhecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find target users by role
    const targetUserIds: string[] = [];

    // If there's a specific user_id in dados, use it directly
    if (dados.target_user_id) {
      targetUserIds.push(dados.target_user_id);
    } else if (dados.target_user_ids && Array.isArray(dados.target_user_ids)) {
      targetUserIds.push(...dados.target_user_ids);
    } else {
      // For gestor role: only notify the corretor's gerente, not all gestores
      const corretorId = dados.corretor_id || dados.target_corretor_id;
      let gerenteResolved = false;

      if (corretorId && config.roles.includes("gestor")) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("gerente_id")
          .eq("user_id", corretorId)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();
        if (tm?.gerente_id) {
          targetUserIds.push(tm.gerente_id);
          gerenteResolved = true;
        }
      }

      // Find users with matching roles (skip gestor if already resolved)
      for (const role of config.roles) {
        if (role === "gestor" && gerenteResolved) continue;
        const { data: roleUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", role);
        if (roleUsers) {
          targetUserIds.push(...roleUsers.map((r: any) => r.user_id));
        }
      }
    }

    // Deduplicate
    const uniqueUsers = [...new Set(targetUserIds)];

    // Create notifications via RPC (respects anti-spam)
    const results = [];
    for (const userId of uniqueUsers) {
      const { data, error } = await supabase.rpc("criar_notificacao", {
        p_user_id: userId,
        p_tipo: config.tipo,
        p_categoria: config.categoria,
        p_titulo: config.titulo(dados),
        p_mensagem: config.mensagem(dados),
        p_dados: dados,
        p_agrupamento_key: config.agrupamento_key ? config.agrupamento_key(dados) : null,
      });
      results.push({ user_id: userId, notification_id: data, error: error?.message });
    }

    L.info("Notified", { evento, count: uniqueUsers.length });
    return new Response(
      JSON.stringify({ success: true, notified: uniqueUsers.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    L.error("Unhandled exception", {}, err);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: "notify", level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: err instanceof Error ? err.message : String(err) }).then(() => {});
    } catch {}
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
