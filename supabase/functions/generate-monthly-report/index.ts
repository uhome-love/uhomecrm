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

    // ═══ AGGREGATE DATA ═══

    // 1. Checkpoints data
    const { data: checkpoints } = await supabase
      .from("checkpoints")
      .select("id, gerente_id, data")
      .gte("data", startDate)
      .lte("data", endDate);

    const cpIds = (checkpoints || []).map(c => c.id);
    let lines: any[] = [];
    if (cpIds.length > 0) {
      const { data: linesData } = await supabase
        .from("checkpoint_lines")
        .select("checkpoint_id, corretor_id, real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas, real_vgv_gerado, real_vgv_assinado")
        .in("checkpoint_id", cpIds);
      lines = linesData || [];
    }

    // 2. Team members
    const { data: teams } = await supabase.from("team_members").select("id, nome, gerente_id, equipe, user_id").eq("status", "ativo");
    const teamMap = new Map((teams || []).map(t => [t.id, t]));

    // 3. Gerentes (profiles)
    const gerenteIds = [...new Set((checkpoints || []).map(c => c.gerente_id))];
    const { data: gerenteProfiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", gerenteIds);
    const gerenteMap = new Map((gerenteProfiles || []).map(p => [p.user_id, p.nome]));

    // 4. Aggregate by team/gerente
    const byGerente: Record<string, any> = {};
    const byCorretor: Record<string, any> = {};
    const totals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };

    // Map checkpoint to gerente
    const cpGerenteMap = new Map((checkpoints || []).map(c => [c.id, c.gerente_id]));

    for (const l of lines) {
      const gerenteId = cpGerenteMap.get(l.checkpoint_id);
      const member = teamMap.get(l.corretor_id);
      const nome = member?.nome || "Desconhecido";
      const gerNome = gerenteMap.get(gerenteId || "") || "Desconhecido";

      if (gerenteId && !byGerente[gerenteId]) {
        byGerente[gerenteId] = { nome: gerNome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
      }
      if (!byCorretor[l.corretor_id]) {
        byCorretor[l.corretor_id] = { nome, equipe: member?.equipe || gerNome, leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };
      }

      const fields = ["leads", "ligacoes", "visitas_marcadas", "visitas_realizadas", "propostas"];
      for (const f of fields) {
        const val = l[`real_${f}`] || 0;
        if (gerenteId) byGerente[gerenteId][f] += val;
        byCorretor[l.corretor_id][f] += val;
        (totals as any)[f] += val;
      }
      const vgvG = l.real_vgv_gerado || 0;
      const vgvA = l.real_vgv_assinado || 0;
      if (gerenteId) { byGerente[gerenteId].vgv_gerado += vgvG; byGerente[gerenteId].vgv_assinado += vgvA; }
      byCorretor[l.corretor_id].vgv_gerado += vgvG;
      byCorretor[l.corretor_id].vgv_assinado += vgvA;
      totals.vgv_gerado += vgvG;
      totals.vgv_assinado += vgvA;
    }

    // 5. Negocios data
    const { data: pdns } = await supabase.from("negocios").select("*").gte("created_at", `${targetMes}-01`).lt("created_at", `${targetMes}-32`);
    const pdnCount = (pdns || []).length;
    const pdnVgv = (pdns || []).reduce((s, p: any) => s + Number(p.vgv_final || p.vgv_estimado || 0), 0);
    const pdnAssinado = (pdns || []).filter((p: any) => p.fase === "assinado").reduce((s, p: any) => s + Number(p.vgv_final || p.vgv_estimado || 0), 0);

    // 6. Previous month data for comparison
    const prevMonth = new Date(year, month - 2, 1);
    const prevMes = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const prevStart = `${prevMes}-01`;
    const prevEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: prevCps } = await supabase.from("checkpoints").select("id").gte("data", prevStart).lte("data", prevEnd);
    const prevCpIds = (prevCps || []).map(c => c.id);
    let prevTotals = { leads: 0, ligacoes: 0, visitas_marcadas: 0, visitas_realizadas: 0, propostas: 0, vgv_gerado: 0, vgv_assinado: 0 };

    if (prevCpIds.length > 0) {
      const { data: prevLines } = await supabase
        .from("checkpoint_lines")
        .select("real_leads, real_ligacoes, real_visitas_marcadas, real_visitas_realizadas, real_propostas, real_vgv_gerado, real_vgv_assinado")
        .in("checkpoint_id", prevCpIds);
      for (const l of (prevLines || [])) {
        prevTotals.leads += l.real_leads || 0;
        prevTotals.ligacoes += l.real_ligacoes || 0;
        prevTotals.visitas_marcadas += l.real_visitas_marcadas || 0;
        prevTotals.visitas_realizadas += l.real_visitas_realizadas || 0;
        prevTotals.propostas += l.real_propostas || 0;
        prevTotals.vgv_gerado += l.real_vgv_gerado || 0;
        prevTotals.vgv_assinado += l.real_vgv_assinado || 0;
      }
    }

    // 7. Marketing/campaign data
    const { data: mktEntries } = await supabase
      .from("marketing_entries")
      .select("campanha, empreendimento, canal, investimento, leads_gerados, visitas, propostas, vendas")
      .gte("created_at", startDate)
      .lte("created_at", endDate + "T23:59:59");

    const campanhas: Record<string, any> = {};
    for (const e of (mktEntries || [])) {
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
    const metricas = { ...totals, pdnCount, pdnVgv, pdnAssinado, ticketMedio };

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
- Negócios PDN: ${pdnCount} | VGV PDN: ${fmtCurrency(pdnVgv)} | PDN Assinado: ${fmtCurrency(pdnAssinado)}

COMPARATIVO MÊS ANTERIOR:
${Object.entries(comparativo).map(([k, v]: [string, any]) => `- ${k}: ${v.anterior} → ${v.atual} (${v.variacao > 0 ? "+" : ""}${v.variacao}%)`).join("\n")}

RANKING EQUIPES:
${Object.entries(byGerente).map(([id, g]: [string, any]) => `- ${g.nome}: ${g.ligacoes} lig, ${g.visitas_marcadas} vmar, ${g.visitas_realizadas} vreal, ${g.propostas} prop, VGV Ass: ${fmtCurrency(g.vgv_assinado)}`).join("\n")}

TOP 5 CORRETORES:
${topCorretores.map((c: any, i) => `${i + 1}. ${c.nome} (${c.equipe}): ${c.ligacoes} lig, ${c.visitas_realizadas} vreal, ${c.propostas} prop, VGV: ${fmtCurrency(c.vgv_assinado)}`).join("\n")}

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
    for (const admin of (admins || [])) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        categoria: "relatorio",
        tipo: "relatorio_mensal",
        titulo: `📊 Relatório de ${mesLabel} está pronto`,
        mensagem: `O relatório executivo mensal de ${mesLabel} foi gerado automaticamente pelo HOMI CEO e está disponível para consulta.`,
        dados: { mes: targetMes },
      });
    }

    return new Response(JSON.stringify({ success: true, mes: targetMes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-monthly-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
