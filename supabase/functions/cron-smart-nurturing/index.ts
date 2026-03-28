// =============================================================================
// Edge Function: cron-smart-nurturing (v2)
// Propósito: Motor de Match Noturno — roda diariamente às 07:00 BRT
// Correções v2:
//   - Vitrines criadas no banco do SITE (huigglwvvzuwwyqvpmec) via supabaseSite
//   - Campos corretos da tabela vitrines: imovel_codigos, created_by, corretor_id
//   - pipeline_atividades: usa pipeline_lead_id (não lead_id), sem campo automatico
//   - profiles: usa user_id (não id), campo nome (não full_name)
//   - pipeline_leads: sem campo ativo, sem FK direta para profiles
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cliente do CRM (banco principal da Edge Function)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente do Site (banco separado onde ficam as vitrines)
const UHOMESITE_URL = Deno.env.get("UHOMESITE_URL")!;
const UHOMESITE_SERVICE_KEY = Deno.env.get("UHOMESITE_SERVICE_KEY")!;

const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST")!;
const TYPESENSE_SEARCH_API_KEY = Deno.env.get("TYPESENSE_SEARCH_API_KEY")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

// URL pública do site para montar o link da vitrine
const SITE_PUBLIC_URL = Deno.env.get("UHOMESITE_URL") || "https://uhome.com.br";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cliente separado apontando para o banco do site
const supabaseSite = createClient(
  // O Supabase URL do site é derivado do project ref huigglwvvzuwwyqvpmec
  "https://huigglwvvzuwwyqvpmec.supabase.co",
  UHOMESITE_SERVICE_KEY
);

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface LeadComPerfil {
  id: string;
  nome: string;
  telefone: string;
  corretor_id: string;
  corretor_nome: string;
  stage_tipo: string;
  ultima_acao_at: string;
  perfil: {
    bairros: string[] | null;
    regioes: string[] | null;
    tipos: string[] | null;
    valor_min: number | null;
    valor_max: number | null;
    dormitorios_min: number | null;
    suites_min: number | null;
    vagas_min: number | null;
    area_min: number | null;
    area_max: number | null;
  } | null;
}

interface Imovel {
  id: string;
  codigo: string;
  titulo: string;
  bairro: string;
  tipo: string;
  preco: number;
  dormitorios: number;
  area: number;
  foto_principal: string;
}

// ---------------------------------------------------------------------------
// 1. Buscar leads parados em estágios de qualificação há mais de 48h
// ---------------------------------------------------------------------------
async function buscarLeadsParados(): Promise<LeadComPerfil[]> {
  const quarentaOitoHorasAtras = new Date(
    Date.now() - 48 * 60 * 60 * 1000
  ).toISOString();

  // Busca leads com stage de qualificação/novo/contactado sem interação recente
  const { data: leads, error } = await supabase
    .from("pipeline_leads")
    .select(`
      id,
      nome,
      telefone,
      ultima_acao_at,
      corretor_id,
      stage_id,
      lead_property_profiles (
        bairros,
        regioes,
        tipos,
        valor_min,
        valor_max,
        dormitorios_min,
        suites_min,
        vagas_min,
        area_min,
        area_max
      )
    `)
    .lt("ultima_acao_at", quarentaOitoHorasAtras)
    .not("telefone", "is", null)
    .limit(100);

  if (error) {
    console.error("[nurturing] Erro ao buscar leads:", error);
    return [];
  }

  // Busca os stage_ids de qualificação/novo/contactado
  const { data: stagesElegiveis } = await supabase
    .from("pipeline_stages")
    .select("id")
    .in("tipo", ["qualificacao", "novo", "contactado"]);

  const stageIdsElegiveis = new Set(
    (stagesElegiveis || []).map((s: any) => s.id)
  );

  // Filtra leads que estão em stages elegíveis
  const leadsFiltrados = (leads || []).filter((lead: any) =>
    stageIdsElegiveis.has(lead.stage_id)
  );

  // Busca nomes dos corretores em lote
  const corretorIds = [...new Set(leadsFiltrados.map((l: any) => l.corretor_id).filter(Boolean))];
  const { data: corretores } = await supabase
    .from("profiles")
    .select("user_id, nome")
    .in("user_id", corretorIds);

  const mapaCorretores = new Map(
    (corretores || []).map((c: any) => [c.user_id, c.nome || "Corretor uHome"])
  );

  // Filtra leads que já receberam nurturing nas últimas 72h
  const leadsElegiveis: LeadComPerfil[] = [];
  for (const lead of leadsFiltrados) {
    const jaRecebeu = await verificarNurturingRecente(lead.id);
    if (!jaRecebeu) {
      leadsElegiveis.push({
        id: lead.id,
        nome: lead.nome || "Cliente",
        telefone: lead.telefone,
        corretor_id: lead.corretor_id,
        corretor_nome: mapaCorretores.get(lead.corretor_id) || "Corretor uHome",
        stage_tipo: "qualificacao",
        ultima_acao_at: lead.ultima_acao_at,
        perfil: (lead.lead_property_profiles as any)?.[0] || null,
      });
    }
  }

  console.log(`[nurturing] ${leadsElegiveis.length} leads elegíveis encontrados`);
  return leadsElegiveis;
}

// ---------------------------------------------------------------------------
// 2. Verificar se o lead já recebeu nurturing automático nas últimas 72h
// ---------------------------------------------------------------------------
async function verificarNurturingRecente(leadId: string): Promise<boolean> {
  const setentaDuasHorasAtras = new Date(
    Date.now() - 72 * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("pipeline_atividades")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_lead_id", leadId)
    .eq("tipo", "nurturing_automatico")
    .gte("created_at", setentaDuasHorasAtras);

  return (count || 0) > 0;
}

// ---------------------------------------------------------------------------
// 3. Buscar imóveis no Typesense com base no perfil do lead
// ---------------------------------------------------------------------------
async function buscarImoveisTypesense(
  perfil: LeadComPerfil["perfil"]
): Promise<Imovel[]> {
  if (!perfil) return [];

  const filtros: string[] = [];

  if (perfil.valor_max) filtros.push(`preco:<=${perfil.valor_max}`);
  if (perfil.valor_min) filtros.push(`preco:>=${perfil.valor_min}`);
  if (perfil.dormitorios_min) filtros.push(`dormitorios:>=${perfil.dormitorios_min}`);

  const termoBusca =
    [
      ...(perfil.bairros || []),
      ...(perfil.regioes || []),
      ...(perfil.tipos || []),
    ]
      .slice(0, 3)
      .join(" ") || "apartamento";

  const params = new URLSearchParams({
    q: termoBusca,
    query_by: "bairro,tipo,titulo,descricao",
    filter_by: filtros.join(" && ") || "",
    sort_by: "destaque:desc,created_at:desc",
    per_page: "3",
    page: "1",
  });

  try {
    const response = await fetch(
      `https://${TYPESENSE_HOST}/collections/properties/documents/search?${params}`,
      { headers: { "X-TYPESENSE-API-KEY": TYPESENSE_SEARCH_API_KEY } }
    );

    if (!response.ok) {
      console.error("[nurturing] Typesense erro:", await response.text());
      return [];
    }

    const resultado = await response.json();
    return (resultado.hits || []).map((hit: any) => hit.document as Imovel);
  } catch (err) {
    console.error("[nurturing] Falha ao consultar Typesense:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 4. Criar vitrine no banco do SITE (não do CRM)
// ---------------------------------------------------------------------------
async function criarVitrine(
  lead: LeadComPerfil,
  imoveis: Imovel[]
): Promise<string | null> {
  const codigos = imoveis.map((i) => i.codigo);

  // Busca o corretor_slug para montar a URL personalizada
  const { data: corretorProfile } = await supabase
    .from("profiles")
    .select("slug")
    .eq("user_id", lead.corretor_id)
    .single();

  const corretorSlug = (corretorProfile as any)?.slug || null;

  // Insere a vitrine no banco do SITE via supabaseSite
  const { data, error } = await supabaseSite
    .from("vitrines")
    .insert({
      created_by: lead.corretor_id,
      corretor_id: lead.corretor_id,
      corretor_slug: corretorSlug,
      titulo: `Seleção especial para ${lead.nome.split(" ")[0]}`,
      subtitulo: "Imóveis selecionados especialmente para você",
      mensagem: `Olá ${lead.nome.split(" ")[0]}! Separei esses imóveis que combinam com o que você busca.`,
      imovel_codigos: codigos,
      imovel_ids: JSON.stringify(imoveis.map((i) => i.id)),
      lead_nome: lead.nome,
      lead_telefone: lead.telefone,
      tipo: "nurturing_automatico",
      tema_visual: "default",
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    console.error("[nurturing] Erro ao criar vitrine no site:", error);
    return null;
  }

  // Usa slug se disponível, senão usa o ID
  const identificador = (data as any).slug || (data as any).id;
  return `${SITE_PUBLIC_URL}/vitrine/${identificador}`;
}

// ---------------------------------------------------------------------------
// 5. Montar mensagem personalizada para WhatsApp
// ---------------------------------------------------------------------------
function montarMensagem(
  nomeCliente: string,
  nomeCorretor: string,
  urlVitrine: string,
  imoveis: Imovel[]
): string {
  const primeiroNome = nomeCliente.split(" ")[0];
  const bairro = imoveis[0]?.bairro || "Porto Alegre";

  return (
    `Oi ${primeiroNome}! 👋 Aqui é ${nomeCorretor} da uHome.\n\n` +
    `Estava analisando o mercado hoje cedo e separei ${imoveis.length} imóvel(is) ` +
    `em ${bairro} que combinam com o que você busca.\n\n` +
    `🏠 Veja a seleção especial que preparei para você:\n` +
    `👉 ${urlVitrine}\n\n` +
    `Algum chamou atenção? Me conta! 😊`
  );
}

// ---------------------------------------------------------------------------
// 6. Enviar mensagem via WhatsApp (Meta Cloud API)
// ---------------------------------------------------------------------------
async function enviarWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const telefoneLimpo = telefone.replace(/\D/g, "");
  const telefoneComDDI = telefoneLimpo.startsWith("55")
    ? telefoneLimpo
    : `55${telefoneLimpo}`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefoneComDDI,
          type: "text",
          text: { body: mensagem },
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `[nurturing] WhatsApp erro para ${telefoneComDDI}:`,
        await response.text()
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("[nurturing] Falha ao enviar WhatsApp:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 7. Registrar atividade no CRM (pipeline_atividades com campos reais)
// ---------------------------------------------------------------------------
async function registrarAtividade(
  leadId: string,
  corretorId: string,
  urlVitrine: string,
  imoveisEnviados: number
): Promise<void> {
  // Registra no histórico do lead (pipeline_atividades)
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: leadId,
    tipo: "nurturing_automatico",
    titulo: `🤖 Vitrine automática enviada (${imoveisEnviados} imóvel(is))`,
    descricao: `IA enviou vitrine automática. Link: ${urlVitrine}`,
    data: new Date().toISOString().split("T")[0],
    status: "concluida",
    prioridade: "normal",
    created_by: corretorId,
  });

  // Atualiza ultima_acao_at do lead
  await supabase
    .from("pipeline_leads")
    .update({ ultima_acao_at: new Date().toISOString() })
    .eq("id", leadId);
}

// ---------------------------------------------------------------------------
// 8. Notificar corretor via notifications
// ---------------------------------------------------------------------------
async function notificarCorretor(
  corretorId: string,
  nomeCliente: string
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: corretorId,
    title: "🤖 Vitrine automática enviada",
    body: `A IA enviou uma vitrine para ${nomeCliente}. Fique de olho na resposta!`,
    type: "nurturing",
    read: false,
  });
}

// ---------------------------------------------------------------------------
// HANDLER PRINCIPAL
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Permite chamada manual para um lead específico (modo: "manual")
  let leadIdManual: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body.lead_id && body.modo === "manual") {
        leadIdManual = body.lead_id;
      }
    } catch {
      // ignora body inválido
    }
  }

  console.log("[nurturing] Iniciando Motor de Match Noturno...");

  let leads: LeadComPerfil[];

  if (leadIdManual) {
    // Modo manual: processa apenas o lead específico (chamado pelo botão "Follow-up IA")
    const { data: leadData } = await supabase
      .from("pipeline_leads")
      .select(`
        id, nome, telefone, ultima_acao_at, corretor_id, stage_id,
        lead_property_profiles (
          bairros, regioes, tipos, valor_min, valor_max,
          dormitorios_min, suites_min, vagas_min, area_min, area_max
        )
      `)
      .eq("id", leadIdManual)
      .single();

    if (!leadData) {
      return new Response(
        JSON.stringify({ success: false, erro: "Lead não encontrado" }),
        { headers: { "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { data: corretorData } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", (leadData as any).corretor_id)
      .single();

    leads = [{
      id: (leadData as any).id,
      nome: (leadData as any).nome || "Cliente",
      telefone: (leadData as any).telefone,
      corretor_id: (leadData as any).corretor_id,
      corretor_nome: (corretorData as any)?.nome || "Corretor uHome",
      stage_tipo: "qualificacao",
      ultima_acao_at: (leadData as any).ultima_acao_at,
      perfil: ((leadData as any).lead_property_profiles as any)?.[0] || null,
    }];
  } else {
    // Modo automático: busca todos os leads elegíveis
    leads = await buscarLeadsParados();
  }

  if (leads.length === 0) {
    return new Response(
      JSON.stringify({ success: true, processados: 0, mensagem: "Nenhum lead elegível" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  let enviados = 0;
  let semImoveis = 0;
  let erros = 0;

  for (const lead of leads) {
    try {
      if (!lead.telefone) { erros++; continue; }

      const imoveis = await buscarImoveisTypesense(lead.perfil);

      if (imoveis.length === 0) {
        semImoveis++;
        console.log(`[nurturing] Lead ${lead.nome}: sem imóveis compatíveis`);
        continue;
      }

      const urlVitrine = await criarVitrine(lead, imoveis);
      if (!urlVitrine) { erros++; continue; }

      const mensagem = montarMensagem(lead.nome, lead.corretor_nome, urlVitrine, imoveis);
      const enviou = await enviarWhatsApp(lead.telefone, mensagem);

      if (enviou) {
        await registrarAtividade(lead.id, lead.corretor_id, urlVitrine, imoveis.length);
        await notificarCorretor(lead.corretor_id, lead.nome);
        enviados++;
        console.log(`[nurturing] ✅ ${lead.nome}: vitrine enviada com ${imoveis.length} imóveis`);
      } else {
        erros++;
      }

      // Pausa para não sobrecarregar a API do WhatsApp
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[nurturing] Erro ao processar lead ${lead.id}:`, err);
      erros++;
    }
  }

  const resultado = {
    success: true,
    total_leads: leads.length,
    enviados,
    sem_imoveis: semImoveis,
    erros,
    timestamp: new Date().toISOString(),
  };

  console.log("[nurturing] Resultado final:", resultado);

  return new Response(JSON.stringify(resultado), {
    headers: { "Content-Type": "application/json" },
  });
});
