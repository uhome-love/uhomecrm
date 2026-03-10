import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { messages, quickAction } = await req.json();
    const gerenteId = user.id;

    // ─── Fetch real data for the manager's team ───
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const weekStart = getWeekStart(today);

    // 1. Team members
    const { data: teamMembers } = await adminClient
      .from("team_members")
      .select("id, nome, equipe, user_id, status")
      .eq("gerente_id", gerenteId)
      .eq("status", "ativo");

    const teamMemberIds = (teamMembers || []).map(m => m.id);
    const teamUserIds = (teamMembers || []).map(m => m.user_id).filter(Boolean);

    // 2. Negocios data (current month)
    const { data: pdnData } = await adminClient
      .from("negocios")
      .select("*")
      .eq("gerente_id", gerenteId)
      .gte("created_at", `${currentMonth}-01`)
      .lt("created_at", `${currentMonth}-32`);

    // 3. Checkpoint today
    const { data: checkpointToday } = await adminClient
      .from("checkpoints")
      .select("id")
      .eq("gerente_id", gerenteId)
      .eq("data", today)
      .maybeSingle();

    let checkpointLines: any[] = [];
    if (checkpointToday?.id) {
      const { data } = await adminClient
        .from("checkpoint_lines")
        .select("*")
        .eq("checkpoint_id", checkpointToday.id);
      checkpointLines = data || [];
    }

    // 4. Visitas (current week)
    const { data: visitasWeek } = await adminClient
      .from("visitas")
      .select("*")
      .eq("gerente_id", gerenteId)
      .gte("data_visita", weekStart)
      .lte("data_visita", today);

    // 5. OA tentativas (today) for team members
    let oaTodayStats = { total: 0, interessados: 0, ligacoes: 0, whatsapps: 0 };
    if (teamUserIds.length > 0) {
      const dayStart = `${today}T00:00:00-03:00`;
      const dayEnd = `${today}T23:59:59-03:00`;
      const { data: oaData } = await adminClient
        .from("oferta_ativa_tentativas")
        .select("resultado, canal")
        .in("corretor_id", teamUserIds)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      if (oaData) {
        oaTodayStats.total = oaData.length;
        oaTodayStats.interessados = oaData.filter(o => o.resultado === "com_interesse").length;
        oaTodayStats.ligacoes = oaData.filter(o => o.canal === "ligacao").length;
        oaTodayStats.whatsapps = oaData.filter(o => o.canal === "whatsapp").length;
      }
    }

    // ─── Build context summary ───
    const pdnStats = buildPdnSummary(pdnData || []);
    const checkpointSummary = buildCheckpointSummary(checkpointLines, teamMembers || []);
    const visitasSummary = buildVisitasSummary(visitasWeek || []);

    const dataContext = `
═══ DADOS REAIS DO SISTEMA ═══
Data: ${today} | Mês: ${currentMonth}

📊 NEGÓCIOS (Pipeline de Negócios) — ${currentMonth}
${pdnStats}

📋 CHECKPOINT HOJE
${checkpointSummary}

📞 OFERTA ATIVA HOJE
- Total tentativas: ${oaTodayStats.total}
- Interessados: ${oaTodayStats.interessados}
- Ligações: ${oaTodayStats.ligacoes}
- WhatsApps: ${oaTodayStats.whatsapps}
- Taxa de conversão: ${oaTodayStats.total > 0 ? Math.round((oaTodayStats.interessados / oaTodayStats.total) * 100) : 0}%

📅 VISITAS DA SEMANA (${weekStart} a ${today})
${visitasSummary}

👥 EQUIPE (${(teamMembers || []).length} corretores ativos)
${(teamMembers || []).map(m => `- ${m.nome}${m.equipe ? ` (${m.equipe})` : ""}`).join("\n")}
═══════════════════════════════
`;

    // ─── Quick action context enrichment ───
    let quickActionContext = "";
    if (quickAction) {
      switch (quickAction) {
        case "analisar_checkpoint":
          quickActionContext = "\n\nO gerente quer uma ANÁLISE DETALHADA do checkpoint de hoje. Analise quem está acima/abaixo da meta, destaque pontos positivos e de atenção, e sugira ações.";
          break;
        case "analisar_oferta_ativa":
          quickActionContext = "\n\nO gerente quer analisar a OFERTA ATIVA de hoje. Avalie a produtividade, taxa de conversão, e compare com benchmarks (meta: 5% taxa de interesse). Destaque quem está performando bem e quem precisa de apoio.";
          break;
        case "ver_visitas":
          quickActionContext = "\n\nO gerente quer ver a situação das VISITAS da semana. Analise marcadas vs realizadas, identifique cancelamentos, e sugira ações para maximizar visitas realizadas.";
          break;
        case "ver_pdn":
          quickActionContext = "\n\nO gerente quer uma análise do PDN. Avalie o funil de vendas, identifique negócios parados, oportunidades de aceleração, e projete o VGV do mês.";
          break;
        case "gerar_relatorio":
          quickActionContext = "\n\nO gerente quer um RELATÓRIO EXECUTIVO do dia/semana. Gere um relatório estruturado com todas as métricas, destaques positivos, pontos de atenção e plano de ação.";
          break;
        case "criar_treinamento":
          quickActionContext = "\n\nO gerente quer criar um MINI TREINAMENTO para o time. Com base nos dados, identifique a principal fraqueza da equipe e crie um treinamento prático de 10 minutos com roleplay e exemplos.";
          break;
      }
    }

    const systemPrompt = `Você é o HOMI GERENCIAL, o assistente de inteligência de gestão comercial da Uhome Sales.

Você é o braço direito do GERENTE DE EQUIPE. Sua função é ajudá-lo a:
- Analisar a performance do time usando dados reais
- Tomar decisões operacionais baseadas em dados
- Criar materiais e scripts para o time
- Gerar relatórios e diagnósticos
- Treinar e desenvolver corretores

REGRAS IMPORTANTES:
1. SEMPRE use os dados reais fornecidos no contexto — nunca invente números
2. Seja direto, operacional e prático
3. Use formatação markdown com seções claras (##, ###, bullet points)
4. Quando analisar dados, compare com benchmarks: meta de 30 ligações/dia, 5% taxa de interesse, 3 visitas/semana por corretor
5. Identifique problemas e sugira ações específicas
6. Quando gerar scripts/materiais, adapte ao contexto real do time
7. Use emojis para facilitar a leitura (📊 📈 🔴 🟢 🟡 ⚠️ ✅)

EMPREENDIMENTOS DA UHOME:
Casa Tua, Open Bosque, Shift, Casa Bastian, Melnick Day, Alto Lindóia, Lake Eyre, Orygem, Las Casas, Lév, Supreme Altos CP, Terrace, Grand Park Lindóia, High Garden Rio Branco, Go Rio Branco, Botanique, Skyline Menino Deus, Square Garden, Duetto - Morana, Demétrio ABF, Ora Studios do Cais

FUNIL DE VENDAS: Lead → Contato → Qualificação → Interesse → Visita → Proposta → Fechamento

${dataContext}
${quickActionContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("homi-gerencial error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function buildPdnSummary(pdn: any[]): string {
  if (!pdn.length) return "Nenhum negócio registrado este mês.";

  const total = pdn.length;
  const novo = pdn.filter(p => p.fase === "novo_negocio").length;
  const proposta = pdn.filter(p => p.fase === "proposta" || p.fase === "negociacao" || p.fase === "documentacao").length;
  const assinado = pdn.filter(p => p.fase === "assinado").length;
  const perdido = pdn.filter(p => p.status === "perdido").length;

  const vgvAssinado = pdn.filter(p => p.fase === "assinado").reduce((s, p) => s + Number(p.vgv_final || p.vgv_estimado || 0), 0);
  const vgvProjetado = pdn.filter(p => ["proposta", "negociacao", "documentacao", "assinado"].includes(p.fase)).reduce((s, p) => s + Number(p.vgv_final || p.vgv_estimado || 0), 0);

  // Stale deals (no update in 5+ days)
  const now = Date.now();
  const stale = pdn.filter(p => {
    if (["assinado"].includes(p.fase) || p.status === "perdido") return false;
    const lastUpdate = new Date(p.updated_at).getTime();
    return (now - lastUpdate) > 5 * 24 * 60 * 60 * 1000;
  });

  let summary = `- Total negócios: ${total}
- Novo: ${novo} | Proposta: ${proposta} | Assinado: ${assinado} | Perdido: ${perdido}
- VGV Assinado: R$ ${(vgvAssinado / 1000).toFixed(0)}k
- VGV Projetado: R$ ${(vgvProjetado / 1000).toFixed(0)}k`;

  if (stale.length > 0) {
    summary += `\n- ⚠️ ${stale.length} negócios PARADOS (sem atualização há +5 dias):`;
    stale.slice(0, 5).forEach(s => {
      summary += `\n  • ${s.nome_cliente} — ${s.empreendimento || "?"} — ${s.fase}`;
    });
  }

  return summary;
}

function buildCheckpointSummary(lines: any[], members: any[]): string {
  if (!lines.length) return "Nenhum checkpoint registrado hoje.";

  const memberMap: Record<string, string> = {};
  members.forEach(m => { memberMap[m.id] = m.nome; });

  let totalLig = 0, totalLeads = 0, totalVM = 0, totalVR = 0, totalProp = 0;

  const perCorretor = lines.map(l => {
    const nome = memberMap[l.corretor_id] || "?";
    const lig = l.real_ligacoes || 0;
    const leads = l.real_leads || 0;
    const vm = l.real_visitas_marcadas || 0;
    const vr = l.real_visitas_realizadas || 0;
    const prop = l.real_propostas || 0;
    totalLig += lig; totalLeads += leads; totalVM += vm; totalVR += vr; totalProp += prop;

    const metaLig = l.meta_ligacoes || 30;
    const statusLig = lig >= metaLig ? "🟢" : lig >= metaLig * 0.5 ? "🟡" : "🔴";

    return `  • ${nome}: ${statusLig} ${lig} lig (meta ${metaLig}) | ${leads} interes. | ${vm} vis.marc | ${vr} vis.real | ${prop} prop`;
  });

  return `- TOTAIS: ${totalLig} ligações | ${totalLeads} interessados | ${totalVM} vis. marcadas | ${totalVR} vis. realizadas | ${totalProp} propostas
${perCorretor.join("\n")}`;
}

function buildVisitasSummary(visitas: any[]): string {
  if (!visitas.length) return "Nenhuma visita registrada na semana.";

  const marcadas = visitas.filter(v => v.status === "marcada").length;
  const realizadas = visitas.filter(v => v.status === "realizada").length;
  const canceladas = visitas.filter(v => v.status === "cancelada").length;
  const noShow = visitas.filter(v => v.status === "no_show").length;

  let summary = `- Total: ${visitas.length} | Marcadas: ${marcadas} | Realizadas: ${realizadas} | Canceladas: ${canceladas} | No-show: ${noShow}`;

  // Per day
  const byDay: Record<string, number> = {};
  visitas.forEach(v => {
    byDay[v.data_visita] = (byDay[v.data_visita] || 0) + 1;
  });
  summary += "\n- Por dia:";
  Object.entries(byDay).sort().forEach(([d, c]) => {
    summary += `\n  • ${d}: ${c} visitas`;
  });

  return summary;
}
