import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmtCurrency(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: "generate-monthly-report", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // Determine target month — default: previous month
    let targetMes: string;
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    
    if (body.mes) {
      targetMes = body.mes;
    } else {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetMes = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }

    const [year, month] = targetMes.split("-").map(Number);
    const startDate = `${targetMes}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // last day
    const mesLabel = new Date(year, month - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

    // Check if report already exists
    const { data: existing } = await supabase
      .from("executive_reports")
      .select("id, status")
      .eq("mes", targetMes)
      .maybeSingle();

    if (existing?.status === "completo") {
      return new Response(JSON.stringify({ success: true, message: "Relatório já existe", id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update report entry as "gerando"
    const reportId = existing?.id || undefined;
    if (!reportId) {
      await supabase.from("executive_reports").insert({
        mes: targetMes,
        titulo: `Relatório Executivo — ${mesLabel}`,
        status: "gerando",
      });
    } else {
      await supabase.from("executive_reports").update({ status: "gerando", updated_at: new Date().toISOString() }).eq("id", reportId);
    }

    // ═══ AGGREGATE DATA via canonical view ═══

    // 1. Checkpoint data via v_checkpoint_lines_canonical (single query, no joins)
    const { data: lines } = await supabase
      .from("v_checkpoint_lines_canonical")
      .select("team_member_id, corretor_nome, checkpoint_gerente_id, real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas, real_vgv_gerado, real_vgv_assinado, gerente_id")
      .gte("checkpoint_date", startDate)
      .lte("checkpoint_date", endDate);

    // 2. Gerente names for context
    const gerenteIds = [...new Set((lines || []).map((l: any) => l.checkpoint_gerente_id).filter(Boolean))];
    const { data: gerenteProfiles } = gerenteIds.length > 0
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", gerenteIds)
      : { data: [] };
    const gerenteMap = new Map((gerenteProfiles || []).map((p: any) => [p.user_id, p.nome]));

    // 3. Aggregate by team/gerente and by corretor
    const byGerente: Record<string, any> = {};
    const byCorretor: Record<string, any> = {};
    const totals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };

    for (const l of (lines || []) as any[]) {
      const gerenteId = l.checkpoint_gerente_id;
      const nome = l.corretor_nome || "Desconhecido";
      const gerNome = gerenteMap.get(gerenteId) || "Desconhecido";

      if (gerenteId && !byGerente[gerenteId]) {
        byGerente[gerenteId] = { nome: gerNome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
      }
      if (!byCorretor[l.team_member_id]) {
        byCorretor[l.team_member_id] = { nome, equipe: gerNome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
      }

      const fields = ["leads", "ligacoes", "visitas_marcadas", "visitas_realizadas", "propostas"];
      for (const f of fields) {
        const val = l[`real_${f}`] || 0;
        if (gerenteId) byGerente[gerenteId][f] += val;
        byCorretor[l.team_member_id][f] += val;
        (totals as any)[f] += val;
      }
      const vgvG = l.real_vgv_gerado || 0;
      const vgvA = l.real_vgv_assinado || 0;
      if (gerenteId) { byGerente[gerenteId].vgv_gerado += vgvG; byGerente[gerenteId].vgv_assinado += vgvA; }
      byCorretor[l.team_member_id].vgv_gerado += vgvG;
      byCorretor[l.team_member_id].vgv_assinado += vgvA;
      totals.vgv_gerado += vgvG;
      totals.vgv_assinado += vgvA;
    }

    // 4. Negocios data via v_kpi_negocios for partnership-aware + deduplicated lost deals
    const { data: kpiNegocios } = await supabase
      .from("v_kpi_negocios")
      .select("id, auth_user_id, vgv_rateado, fase, conta_venda, conta_perdido")
      .gte("created_at", `${targetMes}-01`)
      .lt("created_at", `${targetMes}-32`);

    const pdnRows = kpiNegocios || [];
    // Unique deal count (deduplicated by id)
    const uniqueDealIds = new Set(pdnRows.map((r: any) => r.id));
    const pdnCount = uniqueDealIds.size;
    const pdnVgv = pdnRows.reduce((s: number, p: any) => s + Number(p.vgv_rateado || 0), 0);
    const pdnAssinado = pdnRows.filter((p: any) => p.conta_venda === 1).reduce((s: number, p: any) => s + Number(p.vgv_rateado || 0), 0);
    // Executive lost deals: deduplicated by deal id
    const uniqueLostIds = new Set(pdnRows.filter((p: any) => p.conta_perdido === 1).map((r: any) => r.id));
    const perdidosUnicos = uniqueLostIds.size;

    // 5. Previous month data via canonical view
    const prevMonth = new Date(year, month - 2, 1);
    const prevMes = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const prevStart = `${prevMes}-01`;
    const prevEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: prevLines } = await supabase
      .from("v_checkpoint_lines_canonical")
      .select("real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas, real_vgv_gerado, real_vgv_assinado")
      .gte("checkpoint_date", prevStart)
      .lte("checkpoint_date", prevEnd);

    let prevTotals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
    for (const l of (prevLines || []) as any[]) {
      prevTotals.leads += l.real_leads || 0;
      prevTotals.ligacoes += l.real_ligacoes || 0;
      prevTotals.visitas_marcadas += l.real_visitas_marcadas || 0;
      prevTotals.visitas_realizadas += l.real_visitas_realizadas || 0;
      prevTotals.propostas += l.real_propostas || 0;
      prevTotals.vgv_gerado += l.real_vgv_gerado || 0;
      prevTotals.vgv_assinado += l.real_vgv_assinado || 0;
    }

    // 6. Marketing/campaign data
    const { data: mktEntries } = await supabase
      .from("marketing_entries")
      .select("campanha, empreendimento, canal, investimento, leads_gerados, visitas, propostas, vendas")
      .gte("created_at", startDate)
      .lte("created_at", endDate + "T23:59:59");

    const campanhas: Record<string, any> = {};
    for (const e of (mktEntries || []) as any[]) {
      const key = e.campanha || e.empreendimento || e.canal;
      if (!campanhas[key]) campanhas[key] = { nome: key, investimento: 0, leads: 0, visitas: 0, propostas: 0, vendas: 0 };
      campanhas[key].investimento += e.investimento || 0;
      campanhas[key].leads += e.leads_gerados || 0;
      campanhas[key].visitas += e.visitas || 0;
      campanhas[key].propostas += e.propostas || 0;
      campanhas[key].vendas += e.vendas || 0;
    }

    // Top corretores
    const topCorretores = Object.values(byCorretor)
      .sort((a: any, b: any) => b.vgv_assinado - a.vgv_assinado || b.propostas - a.propostas)
      .slice(0, 5);

    // Build comparison
    const comparativo: Record<string, any> = {};
    for (const key of Object.keys(totals)) {
      const curr = (totals as any)[key];
      const prev = (prevTotals as any)[key];
      comparativo[key] = { atual: curr, anterior: prev, variacao: prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0 };
    }

    // Funnel rates
    const funil = {
      leads: totals.leads,
      ligacoes: totals.ligacoes,
      visitas_marcadas: totals.visitas_marcadas,
      visitas_realizadas: totals.visitas_realizadas,
      propostas: totals.propostas,
      vgv_assinado: totals.vgv_assinado,
      taxa_lead_visita: totals.leads > 0 ? Math.round((totals.visitas_marcadas / totals.leads) * 100) : 0,
      taxa_visita_proposta: totals.visitas_realizadas > 0 ? Math.round((totals.propostas / totals.visitas_realizadas) * 100) : 0,
    };

    // Metricas summary
    const ticketMedio = totals.propostas > 0 ? Math.round(totals.vgv_assinado / totals.propostas) : 0;
    const metricas = { ...totals, pdnCount, pdnVgv, pdnAssinado, perdidosUnicos, ticketMedio };

    // ═══ AI DIAGNOSIS ═══
    const aiPrompt = `Gere um relatório executivo mensal COMPLETO para apresentação em reunião de diretoria.

MÊS: ${mesLabel}

MÉTRICAS DO MÊS:
- Leads aproveitados: ${totals.leads}
- Ligações: ${totals.ligacoes}
- Visitas Marcadas: ${totals.visitas_marcadas}
- Visitas Realizadas: ${totals.visitas_realizadas}
- Propostas: ${totals.propostas}
- VGV Gerado: ${fmtCurrency(totals.vgv_gerado)}
- VGV Assinado: ${fmtCurrency(totals.vgv_assinado)}
- Ticket Médio: ${fmtCurrency(ticketMedio)}
- Negócios ativos: ${pdnCount} | VGV PDN: ${fmtCurrency(pdnVgv)} | PDN Assinado: ${fmtCurrency(pdnAssinado)}
- Negócios perdidos (únicos): ${perdidosUnicos}

COMPARATIVO MÊS ANTERIOR:
${Object.entries(comparativo).map(([k, v]: [string, any]) => `- ${k}: ${v.anterior} → ${v.atual} (${v.variacao > 0 ? "+" : ""}${v.variacao}%)`).join("\n")}

RANKING EQUIPES:
${Object.entries(byGerente).map(([id, g]: [string, any]) => `- ${g.nome}: ${g.ligacoes} lig, ${g.visitas_marcadas} vmar, ${g.visitas_realizadas} vreal, ${g.propostas} prop, VGV Ass: ${fmtCurrency(g.vgv_assinado)}`).join("\n")}

TOP 5 CORRETORES:
${topCorretores.map((c: any, i: number) => `${i + 1}. ${c.nome} (${c.equipe}): ${c.ligacoes} lig, ${c.visitas_realizadas} vreal, ${c.propostas} prop, VGV: ${fmtCurrency(c.vgv_assinado)}`).join("\n")}

CAMPANHAS:
${Object.values(campanhas).slice(0, 5).map((c: any) => `- ${c.nome}: Invest ${fmtCurrency(c.investimento)}, ${c.leads} leads, ${c.visitas} visitas, ${c.vendas} vendas`).join("\n") || "Sem dados de campanha no período"}

ESTRUTURA OBRIGATÓRIA:

## 📋 Sumário Executivo
(Parágrafo de 5-8 linhas analisando o mês como um todo)

## 🏆 Principais Conquistas
(3-5 destaques positivos com dados)

## ⚠️ Pontos de Atenção
(3-5 problemas identificados com evidências)

## 🎯 Análise de Funil
(Taxa de conversão entre cada etapa, comparando com mês anterior)

## 👔 Performance por Equipe
(1 parágrafo por equipe)

## 🏅 Destaques Individuais
(Top 5 corretores e por quê)

## 📊 Diagnóstico de Campanhas
(Análise de ROI e eficiência)

## 💡 Recomendações Estratégicas
(3-5 ações práticas para o próximo mês)

## 🔮 Forecast Próximo Mês
(Projeção baseada em tendências)

Use emojis, seja direto e objetivo. Dados concretos.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é o HOMI CEO, assistente estratégico da Uhome Sales. Gere relatórios executivos profissionais em markdown para apresentação em reunião de diretoria." },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    let diagnosticoIa = "Análise IA indisponível.";
    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      diagnosticoIa = aiResult.choices?.[0]?.message?.content || diagnosticoIa;
    } else {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
    }

    // Build full report content
    const conteudoCompleto = `# 📊 Relatório Executivo — ${mesLabel}
*Gerado automaticamente pelo HOMI CEO | Uhome Sales*
*Data: ${new Date().toLocaleDateString("pt-BR")}*

---

${diagnosticoIa}

---
*Gerado automaticamente pelo HOMI CEO | Uhome Sales*`;

    // Upsert report
    const reportData = {
      mes: targetMes,
      titulo: `Relatório Executivo — ${mesLabel}`,
      sumario_executivo: diagnosticoIa.split("\n\n")[0] || "",
      metricas,
      comparativo,
      ranking_equipes: Object.entries(byGerente).map(([id, g]: [string, any]) => ({ id, ...g })),
      ranking_corretores: topCorretores,
      funil,
      campanhas: Object.values(campanhas).slice(0, 10),
      diagnostico_ia: diagnosticoIa,
      conteudo_completo: conteudoCompleto,
      status: "completo",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from("executive_reports").update(reportData).eq("id", existing.id);
    } else {
      await supabase.from("executive_reports").insert(reportData);
    }

    // Notify admins
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    for (const admin of (admins || []) as any[]) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        categoria: "relatorio",
        tipo: "relatorio_mensal",
        titulo: `📊 Relatório de ${mesLabel} está pronto`,
        mensagem: `O relatório executivo mensal de ${mesLabel} foi gerado automaticamente pelo HOMI CEO e está disponível para consulta.`,
        dados: { mes: targetMes },
      });
    }

    logOps("info", "business", `Monthly report generated: ${targetMes}`, { mes: targetMes });

    return new Response(JSON.stringify({ success: true, mes: targetMes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-monthly-report error:", e);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: "generate-monthly-report", level: "error", category: "system", message: "Report generation failed", trace_id: null, ctx: {}, error_detail: e instanceof Error ? e.message : String(e) }).then(() => {});
    } catch {}
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
