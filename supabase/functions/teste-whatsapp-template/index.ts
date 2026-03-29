// =============================================================================
// Edge Function: teste-whatsapp-template (cron-smart-nurturing)
// Propósito: Motor de Match Noturno — roda diariamente às 07:00 BRT
// Varre leads parados há mais de 7 dias, busca os melhores imóveis no Typesense
// e dispara vitrine via WhatsApp usando Template Oficial da Meta.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST")!;
const TYPESENSE_SEARCH_API_KEY = Deno.env.get("TYPESENSE_SEARCH_API_KEY")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const UHOMESITE_URL = Deno.env.get("UHOMESITE_URL") || "https://uhome.com.br";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface LeadComPerfil {
  id: string;
  nome: string;
  telefone: string;
  corretor_id: string;
  corretor_nome: string;
  corretor_telefone: string;
  stage_tipo: string;
  updated_at: string;
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
// 1. Buscar leads parados há mais de 7 dias (Limite: 200/dia)
// ---------------------------------------------------------------------------
async function buscarLeadsParados(): Promise<LeadComPerfil[]> {
  const seteDiasAtras = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("pipeline_leads")
    .select(`
      id,
      nome,
      telefone,
      updated_at,
      corretor_id,
      profiles!pipeline_leads_corretor_id_fkey (
        full_name,
        phone
      ),
      pipeline_stages!inner (
        tipo
      ),
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
    .in("pipeline_stages.tipo", ["novo_lead", "sem_contato", "contato_inicial", "qualificacao"])
    .not("corretor_id", "is", null)
    .not("telefone", "is", null)
    .lt("updated_at", seteDiasAtras)
    .or("lead_score.is.null,lead_score.lt.5")
    .eq("ativo", true)
    .order("updated_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[nurturing] Erro ao buscar leads:", error);
    return [];
  }

  // Filtra leads que já receberam nurturing automático nos últimos 15 dias
  const leadsElegiveis: LeadComPerfil[] = [];
  for (const lead of data || []) {
    const jaRecebeuRecente = await verificarNurturingRecente(lead.id);
    if (!jaRecebeuRecente) {
      leadsElegiveis.push({
        id: lead.id,
        nome: lead.nome || "Cliente",
        telefone: lead.telefone,
        corretor_id: lead.corretor_id,
        corretor_nome: (lead.profiles as any)?.full_name || "Corretor uHome",
        corretor_telefone: (lead.profiles as any)?.phone || "",
        stage_tipo: (lead.pipeline_stages as any)?.tipo || "qualificacao",
        updated_at: lead.updated_at,
        perfil: (lead.lead_property_profiles as any)?.[0] || null,
      });
    }
  }

  console.log(`[nurturing] ${leadsElegiveis.length} leads elegíveis encontrados`);
  return leadsElegiveis;
}

// ---------------------------------------------------------------------------
// 2. Verificar se o lead já recebeu nurturing automático recentemente (15 dias)
// ---------------------------------------------------------------------------
async function verificarNurturingRecente(leadId: string): Promise<boolean> {
  const quinzeDiasAtras = new Date(
    Date.now() - 15 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("pipeline_atividades")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("tipo", "nurturing_automatico")
    .gte("created_at", quinzeDiasAtras);

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
      {
        headers: {
          "X-TYPESENSE-API-KEY": TYPESENSE_SEARCH_API_KEY,
        },
      }
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
// 4. Criar vitrine no banco do site e obter URL pública
// ---------------------------------------------------------------------------
async function criarVitrine(
  leadId: string,
  corretorId: string,
  imoveis: Imovel[]
): Promise<string | null> {
  const codigos = imoveis.map((i) => i.codigo);

  const { data, error } = await supabase
    .from("vitrines")
    .insert({
      lead_id: leadId,
      corretor_id: corretorId,
      imovel_codigos: codigos,
      origem: "nurturing_automatico",
      titulo: "Seleção especial para você",
      ativo: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[nurturing] Erro ao criar vitrine:", error);
    return null;
  }

  return `${UHOMESITE_URL}/vitrine/${data.id}`;
}

// ---------------------------------------------------------------------------
// 5. Enviar mensagem via WhatsApp (Meta Cloud API) usando Template
// ---------------------------------------------------------------------------
async function enviarWhatsAppTemplate(
  telefone: string,
  leadNome: string,
  imovelPrincipal: Imovel,
  urlVitrine: string
): Promise<boolean> {
  const telefoneLimpo = telefone.replace(/\D/g, "");
  const telefoneComDDI = telefoneLimpo.startsWith("55")
    ? telefoneLimpo
    : `55${telefoneLimpo}`;

  const primeiroNome = leadNome.split(" ")[0] || "Cliente";
  
  const precoFormatado = new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    maximumFractionDigits: 0 
  }).format(imovelPrincipal.preco || 0);

  const payload = {
    messaging_product: "whatsapp",
    to: telefoneComDDI,
    type: "template",
    template: {
      name: "vitrine_imoveis_personalizada",
      language: {
        code: "pt_BR"
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: primeiroNome },
            { type: "text", text: imovelPrincipal.titulo || "Imóvel selecionado" },
            { type: "text", text: imovelPrincipal.bairro || "Sua região" },
            { type: "text", text: imovelPrincipal.tipo || "Imóvel" },
            { type: "text", text: precoFormatado },
            { type: "text", text: urlVitrine }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const erro = await response.text();
      console.error(`[nurturing] WhatsApp erro para ${telefoneComDDI}:`, erro);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[nurturing] Falha ao enviar WhatsApp:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 6. Registrar atividade no histórico do lead
// ---------------------------------------------------------------------------
async function registrarAtividade(
  leadId: string,
  corretorId: string,
  urlVitrine: string,
  imoveisEnviados: number
): Promise<void> {
  await supabase.from("pipeline_atividades").insert({
    lead_id: leadId,
    corretor_id: corretorId,
    tipo: "nurturing_automatico",
    descricao: `🤖 IA enviou vitrine automática com ${imoveisEnviados} imóvel(is). Link: ${urlVitrine}`,
    automatico: true,
  });

  // Atualiza updated_at do lead para ele ir pro final da fila
  await supabase
    .from("pipeline_leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", leadId);
}

// ---------------------------------------------------------------------------
// 7. Notificar corretor via push notification
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[nurturing] Iniciando Motor de Match Noturno...");

  const leads = await buscarLeadsParados();

  if (leads.length === 0) {
    console.log("[nurturing] Nenhum lead elegível. Encerrando.");
    return new Response(
      JSON.stringify({ success: true, processados: 0, mensagem: "Nenhum lead elegível" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let enviados = 0;
  let semPerfil = 0;
  let semImoveis = 0;
  let erros = 0;

  for (const lead of leads) {
    try {
      if (!lead.telefone) {
        erros++;
        continue;
      }

      const imoveis = await buscarImoveisTypesense(lead.perfil);

      if (imoveis.length === 0) {
        semImoveis++;
        console.log(`[nurturing] Lead ${lead.id} (${lead.nome}): sem imóveis compatíveis`);
        continue;
      }

      const urlVitrine = await criarVitrine(lead.id, lead.corretor_id, imoveis);
      if (!urlVitrine) {
        erros++;
        continue;
      }

      const enviou = await enviarWhatsAppTemplate(
        lead.telefone,
        lead.nome,
        imoveis[0],
        urlVitrine
      );

      if (enviou) {
        await registrarAtividade(lead.id, lead.corretor_id, urlVitrine, imoveis.length);
        await notificarCorretor(lead.corretor_id, lead.nome);
        enviados++;
        console.log(`[nurturing] ✅ Lead ${lead.nome}: vitrine enviada com ${imoveis.length} imóveis`);
      } else {
        erros++;
      }

      // Pausa de 1 segundo entre envios para segurança da API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`[nurturing] Erro ao processar lead ${lead.id}:`, err);
      erros++;
    }
  }

  const resultado = {
    success: true,
    total_leads: leads.length,
    enviados,
    sem_perfil: semPerfil,
    sem_imoveis: semImoveis,
    erros,
    timestamp: new Date().toISOString(),
  };

  console.log("[nurturing] Resultado final:", resultado);

  return new Response(JSON.stringify(resultado), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
