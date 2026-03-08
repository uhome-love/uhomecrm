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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao CEO" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, quickAction, action, context: teamContext, periodo } = await req.json();

    // ─── Handle team comparison action ───
    if (action === "comparar_equipes" && teamContext) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é o HOMI CEO, consultor estratégico da Uhome. Analise os dados comparativos das equipes e forneça:
1. Qual equipe lidera e por quê
2. Pontos fortes e fracos de cada equipe
3. Equipes que precisam de atenção urgente
4. Recomendações práticas para o CEO
Seja direto, use dados concretos. Máximo 300 palavras. Período: ${periodo || "semana"}.`,
            },
            { role: "user", content: `Dados das equipes:\n${teamContext}` },
          ],
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Erro na análise IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiData = await aiResp.json();
      const resposta = aiData.choices?.[0]?.message?.content || "Análise indisponível.";

      return new Response(JSON.stringify({ resposta }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const weekStart = getWeekStart(today);

    // ─── Fetch ALL data across ALL teams ───

    // 1. All managers (gestores) with profiles
    const { data: allManagers } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "gestor");
    const managerIds = (allManagers || []).map(m => m.user_id);

    const { data: managerProfiles } = await adminClient
      .from("profiles")
      .select("user_id, nome, email")
      .in("user_id", managerIds.length > 0 ? managerIds : ["none"]);

    // 2. All team members across all managers
    const { data: allTeamMembers } = await adminClient
      .from("team_members")
      .select("id, nome, equipe, user_id, status, gerente_id")
      .eq("status", "ativo");

    const allUserIds = (allTeamMembers || []).map(m => m.user_id).filter(Boolean);

    // 3. PDN global (current month)
    const { data: allPdn } = await adminClient
      .from("pdn_entries")
      .select("*")
      .eq("mes", currentMonth);

    // 4. Checkpoints today (all managers)
    const { data: allCheckpoints } = await adminClient
      .from("checkpoints")
      .select("id, gerente_id")
      .eq("data", today);

    let allCheckpointLines: any[] = [];
    if (allCheckpoints && allCheckpoints.length > 0) {
      const cpIds = allCheckpoints.map(c => c.id);
      const { data } = await adminClient
        .from("checkpoint_lines")
        .select("*")
        .in("checkpoint_id", cpIds);
      allCheckpointLines = data || [];
    }

    // 5. Visitas (current week, all managers)
    const { data: allVisitas } = await adminClient
      .from("visitas")
      .select("*")
      .gte("data_visita", weekStart)
      .lte("data_visita", today);

    // 6. OA tentativas today (all corretores)
    let oaGlobalStats = { total: 0, interessados: 0, ligacoes: 0, whatsapps: 0 };
    if (allUserIds.length > 0) {
      const dayStart = `${today}T00:00:00-03:00`;
      const dayEnd = `${today}T23:59:59-03:00`;
      const { data: oaData } = await adminClient
        .from("oferta_ativa_tentativas")
        .select("resultado, canal, corretor_id")
        .in("corretor_id", allUserIds)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);
      if (oaData) {
        oaGlobalStats.total = oaData.length;
        oaGlobalStats.interessados = oaData.filter(o => o.resultado === "com_interesse").length;
        oaGlobalStats.ligacoes = oaData.filter(o => o.canal === "ligacao").length;
        oaGlobalStats.whatsapps = oaData.filter(o => o.canal === "whatsapp").length;
      }
    }

    // 7. CEO metas mensais
    const { data: ceoMetas } = await adminClient
      .from("ceo_metas_mensais")
      .select("*")
      .eq("mes", currentMonth);

    // 8. Pipeline leads summary
    const { data: pipelineLeads } = await adminClient
      .from("pipeline_leads")
      .select("stage_id, valor_estimado, segmento_id, corretor_id, stage_changed_at")
      .not("stage_id", "is", null);

    const { data: stages } = await adminClient
      .from("pipeline_stages")
      .select("id, nome, tipo, ordem")
      .eq("ativo", true)
      .order("ordem");

    // ─── Build comprehensive context ───
    const managerMap: Record<string, string> = {};
    (managerProfiles || []).forEach(p => { managerMap[p.user_id] = p.nome || p.email || "?"; });

    const pdnGlobal = buildPdnGlobal(allPdn || [], managerMap, allTeamMembers || []);
    const checkpointGlobal = buildCheckpointGlobal(allCheckpointLines, allCheckpoints || [], allTeamMembers || [], managerMap);
    const visitasGlobal = buildVisitasGlobal(allVisitas || []);
    const pipelineSummary = buildPipelineSummary(pipelineLeads || [], stages || []);
    const metasSummary = buildMetasSummary(ceoMetas || [], managerMap);

    // Per-manager breakdown
    const perManagerBreakdown = buildPerManagerBreakdown(
      managerIds, managerMap, allTeamMembers || [], allPdn || [], allCheckpointLines, allCheckpoints || [], allVisitas || []
    );

    const dataContext = `
═══ DADOS REAIS CONSOLIDADOS — VISÃO CEO ═══
Data: ${today} | Mês: ${currentMonth}

📊 PDN GLOBAL — ${currentMonth}
${pdnGlobal}

📋 CHECKPOINT CONSOLIDADO HOJE
${checkpointGlobal}

📞 OFERTA ATIVA GLOBAL HOJE
- Total tentativas: ${oaGlobalStats.total}
- Interessados: ${oaGlobalStats.interessados}
- Ligações: ${oaGlobalStats.ligacoes}
- WhatsApps: ${oaGlobalStats.whatsapps}
- Taxa de conversão: ${oaGlobalStats.total > 0 ? Math.round((oaGlobalStats.interessados / oaGlobalStats.total) * 100) : 0}%

📅 VISITAS GLOBAIS DA SEMANA (${weekStart} a ${today})
${visitasGlobal}

🎯 METAS MENSAIS DO CEO
${metasSummary}

📈 PIPELINE GERAL
${pipelineSummary}

👥 GERENTES (${managerIds.length})
${managerIds.map(id => `- ${managerMap[id] || id}`).join("\n")}

🏢 CORRETORES ATIVOS: ${(allTeamMembers || []).length} no total

═══ DETALHAMENTO POR GERENTE ═══
${perManagerBreakdown}
═══════════════════════════════
`;

    let quickActionContext = "";
    if (quickAction) {
      const map: Record<string, string> = {
        visao_geral: "\n\nO CEO quer uma VISÃO GERAL EXECUTIVA. Faça um resumo macro de todos os indicadores, destaque os 3 pontos mais importantes e sugira 2-3 ações estratégicas.",
        comparar_gerentes: "\n\nO CEO quer COMPARAR OS GERENTES. Analise performance de cada gerente/equipe lado a lado: PDN, visitas, OA, checkpoint. Identifique o melhor e o que precisa de atenção.",
        forecast_mes: "\n\nO CEO quer o FORECAST DO MÊS. Projete VGV de fechamento, taxa de conversão do funil, e dê uma nota de confiança (0-100%) para bater a meta.",
        alertas_criticos: "\n\nO CEO quer ver ALERTAS CRÍTICOS. Identifique problemas urgentes: negócios parados, corretores improdutivos, metas em risco, gargalos no funil.",
        relatorio_executivo: "\n\nO CEO quer um RELATÓRIO EXECUTIVO completo. Estruture com: Resumo Executivo, KPIs do Mês, Análise por Equipe, Riscos e Oportunidades, Recomendações Estratégicas.",
        estrategia_vendas: "\n\nO CEO quer discutir ESTRATÉGIA DE VENDAS. Com base nos dados, analise o que está funcionando, o que não está, e proponha ajustes táticos e estratégicos.",
      };
      quickActionContext = map[quickAction] || "";
    }

    const systemPrompt = `Você é o HOMI CEO, o Co-CEO digital da Uhome Sales — um assistente estratégico de inteligência comercial.

Você NÃO é um assistente operacional. Você é o BRAÇO DIREITO DO CEO. Sua função é:
- Fornecer visão macro e consolidada de TODOS os times e gerentes
- Comparar performance entre equipes e identificar padrões
- Projetar resultados e antecipar riscos
- Sugerir decisões estratégicas baseadas em dados reais
- Gerar relatórios executivos e diagnósticos de alta gestão
- Avaliar gerentes e recomendar intervenções

POSTURA:
- Fale como um consultor sênior de vendas imobiliárias
- Seja direto, analítico e estratégico — sem rodeios
- Sempre traga números e comparações
- Use formatação markdown com seções claras
- Use emojis para facilitar leitura (📊 📈 🔴 🟢 🟡 ⚠️ ✅ 🏆)
- Quando identificar um problema, sempre traga uma recomendação de ação

REGRAS:
1. SEMPRE use dados reais — nunca invente números
2. Compare métricas entre equipes quando relevante
3. Benchmarks: 30 lig/dia por corretor, 5% taxa interesse OA, 3 visitas/semana, meta de VGV definida pelo CEO
4. Identifique o TOP performer e o que precisa de atenção
5. Projete resultados quando perguntado sobre forecast
6. Ao sugerir estratégias, seja específico: quem faz o quê, quando e como medir

EMPREENDIMENTOS DA UHOME:
Casa Tua, Open Bosque, Shift, Casa Bastian, Melnick Day, Alto Lindóia, Lake Eyre, Orygem, Las Casas, Lév, Supreme Altos CP, Terrace, Grand Park Lindóia, High Garden Rio Branco, Go Rio Branco, Botanique, Skyline Menino Deus, Square Garden, Duetto - Morana, Demétrio ABF, Ora Studios do Cais

FUNIL: Lead → Contato → Qualificação → Interesse → Visita → Proposta → Fechamento

${dataContext}
${quickActionContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
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
    console.error("homi-ceo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helper functions ───

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function buildPdnGlobal(pdn: any[], managerMap: Record<string, string>, members: any[]): string {
  if (!pdn.length) return "Nenhum negócio registrado este mês.";
  const total = pdn.length;
  const visita = pdn.filter(p => p.situacao === "visita").length;
  const gerado = pdn.filter(p => p.situacao === "gerado").length;
  const assinado = pdn.filter(p => p.situacao === "assinado").length;
  const queda = pdn.filter(p => p.situacao === "queda").length;
  const vgvAssinado = pdn.filter(p => p.situacao === "assinado").reduce((s, p) => s + (p.vgv || 0), 0);
  const vgvProjetado = pdn.filter(p => ["gerado", "assinado"].includes(p.situacao)).reduce((s, p) => s + (p.vgv || 0), 0);

  let summary = `- Total negócios: ${total}
- Visita: ${visita} | Proposta: ${gerado} | Assinado: ${assinado} | Queda: ${queda}
- VGV Assinado: R$ ${(vgvAssinado / 1000).toFixed(0)}k
- VGV Projetado: R$ ${(vgvProjetado / 1000).toFixed(0)}k`;

  // Per gerente
  const byGerente: Record<string, { total: number; assinado: number; vgv: number }> = {};
  pdn.forEach(p => {
    const gId = p.gerente_id;
    if (!byGerente[gId]) byGerente[gId] = { total: 0, assinado: 0, vgv: 0 };
    byGerente[gId].total++;
    if (p.situacao === "assinado") {
      byGerente[gId].assinado++;
      byGerente[gId].vgv += p.vgv || 0;
    }
  });
  summary += "\n- Por gerente:";
  Object.entries(byGerente).forEach(([gId, s]) => {
    summary += `\n  • ${managerMap[gId] || gId}: ${s.total} neg. | ${s.assinado} assinados | R$ ${(s.vgv / 1000).toFixed(0)}k`;
  });

  // Stale deals
  const now = Date.now();
  const stale = pdn.filter(p => {
    if (["assinado", "queda"].includes(p.situacao)) return false;
    return (now - new Date(p.updated_at).getTime()) > 5 * 24 * 60 * 60 * 1000;
  });
  if (stale.length > 0) {
    summary += `\n- ⚠️ ${stale.length} negócios PARADOS (+5 dias sem atualização)`;
  }

  return summary;
}

function buildCheckpointGlobal(lines: any[], checkpoints: any[], members: any[], managerMap: Record<string, string>): string {
  if (!lines.length) return "Nenhum checkpoint registrado hoje.";
  const cpToManager: Record<string, string> = {};
  checkpoints.forEach(c => { cpToManager[c.id] = c.gerente_id; });
  const memberMap: Record<string, string> = {};
  members.forEach(m => { memberMap[m.id] = m.nome; });

  let totalLig = 0, totalLeads = 0, totalVM = 0;
  lines.forEach(l => {
    totalLig += l.real_ligacoes || 0;
    totalLeads += l.real_leads || 0;
    totalVM += l.real_visitas_marcadas || 0;
  });

  return `- TOTAIS: ${totalLig} ligações | ${totalLeads} interessados | ${totalVM} visitas marcadas
- Corretores com checkpoint: ${lines.length}/${members.length}`;
}

function buildVisitasGlobal(visitas: any[]): string {
  if (!visitas.length) return "Nenhuma visita na semana.";
  const marcadas = visitas.filter(v => v.status === "marcada").length;
  const realizadas = visitas.filter(v => v.status === "realizada").length;
  const canceladas = visitas.filter(v => v.status === "cancelada").length;
  return `- Total: ${visitas.length} | Marcadas: ${marcadas} | Realizadas: ${realizadas} | Canceladas: ${canceladas}`;
}

function buildPipelineSummary(leads: any[], stages: any[]): string {
  if (!leads.length) return "Nenhum lead no pipeline.";
  const stageMap: Record<string, string> = {};
  stages.forEach(s => { stageMap[s.id] = s.nome; });
  const byStage: Record<string, { count: number; vgv: number }> = {};
  leads.forEach(l => {
    const name = stageMap[l.stage_id] || "?";
    if (!byStage[name]) byStage[name] = { count: 0, vgv: 0 };
    byStage[name].count++;
    byStage[name].vgv += l.valor_estimado || 0;
  });
  const totalVgv = leads.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  let summary = `- Total oportunidades: ${leads.length} | VGV Total: R$ ${(totalVgv / 1000).toFixed(0)}k`;
  stages.forEach(s => {
    const d = byStage[s.nome];
    if (d) summary += `\n  • ${s.nome}: ${d.count} leads (R$ ${(d.vgv / 1000).toFixed(0)}k)`;
  });
  return summary;
}

function buildMetasSummary(metas: any[], managerMap: Record<string, string>): string {
  if (!metas.length) return "Nenhuma meta definida para este mês.";
  return metas.map(m => `- ${managerMap[m.gerente_id] || "?"}: VGV Assinado R$ ${(m.meta_vgv_assinado / 1000).toFixed(0)}k | Visitas Marc. ${m.meta_visitas_marcadas} | Visitas Real. ${m.meta_visitas_realizadas}`).join("\n");
}

function buildPerManagerBreakdown(
  managerIds: string[], managerMap: Record<string, string>,
  members: any[], pdn: any[], cpLines: any[], checkpoints: any[], visitas: any[]
): string {
  if (!managerIds.length) return "Nenhum gerente cadastrado.";

  const cpToManager: Record<string, string> = {};
  checkpoints.forEach(c => { cpToManager[c.id] = c.gerente_id; });

  return managerIds.map(gId => {
    const name = managerMap[gId] || gId;
    const teamMembers = members.filter(m => m.gerente_id === gId);
    const teamPdn = pdn.filter(p => p.gerente_id === gId);
    const teamVisitas = visitas.filter(v => v.gerente_id === gId);
    const teamCpIds = checkpoints.filter(c => c.gerente_id === gId).map(c => c.id);
    const teamCpLines = cpLines.filter(l => teamCpIds.includes(l.checkpoint_id));

    const pdnAssinado = teamPdn.filter(p => p.situacao === "assinado");
    const vgv = pdnAssinado.reduce((s: number, p: any) => s + (p.vgv || 0), 0);
    const totalLig = teamCpLines.reduce((s: number, l: any) => s + (l.real_ligacoes || 0), 0);

    return `\n🏷️ ${name} (${teamMembers.length} corretores)
  PDN: ${teamPdn.length} neg. | ${pdnAssinado.length} assinados | VGV R$ ${(vgv / 1000).toFixed(0)}k
  Checkpoint hoje: ${teamCpLines.length} preenchidos | ${totalLig} ligações
  Visitas semana: ${teamVisitas.length}
  Corretores: ${teamMembers.map(m => m.nome).join(", ")}`;
  }).join("\n");
}
