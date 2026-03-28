// =============================================================================
// Edge Function: cron-smart-nurturing
// Propósito: Motor de Match Noturno — roda diariamente às 07:00 BRT
// Varre leads parados em "Qualificação" há mais de 48h, busca os 3 melhores
// imóveis no Typesense com base no perfil do lead e dispara vitrine via WhatsApp.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST")!;
const TYPESENSE_SEARCH_API_KEY = Deno.env.get("TYPESENSE_SEARCH_API_KEY")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const UHOMESITE_URL = Deno.env.get("UHOMESITE_URL")!;

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

  // Busca leads em stages do tipo "qualificacao" ou "novo" sem interação recente
  const { data, error } = await supabase
    .from("pipeline_leads")
    .select(`
      id,
      nome,
      telefone,
      ultima_acao_at,
      corretor_id,
      profiles!pipeline_leads_corretor_id_fkey (
        full_name,
        phone
      ),
      pipeline_stages!pipeline_leads_stage_id_fkey (
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
    .in("pipeline_stages.tipo", ["qualificacao", "novo", "contactado"])
    .lt("ultima_acao_at", quarentaOitoHorasAtras)
    .eq("ativo", true)
    .limit(100); // Processa até 100 leads por rodada para não sobrecarregar

  if (error) {
    console.error("[nurturing] Erro ao buscar leads:", error);
    return [];
  }

  // Filtra leads que já receberam nurturing automático nas últimas 72h
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
        ultima_acao_at: lead.ultima_acao_at,
        perfil: (lead.lead_property_profiles as any)?.[0] || null,
      });
    }
  }

  console.log(`[nurturing] ${leadsElegiveis.length} leads elegíveis encontrados`);
  return leadsElegiveis;
}

// ---------------------------------------------------------------------------
// 2. Verificar se o lead já recebeu nurturing automático recentemente
// ---------------------------------------------------------------------------
async function verificarNurturingRecente(leadId: string): Promise<boolean> {
  const setentaDuasHorasAtras = new Date(
    Date.now() - 72 * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("pipeline_atividades")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
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

  // Monta filtro dinâmico baseado no perfil
  const filtros: string[] = [];

  if (perfil.valor_max) {
    filtros.push(`preco:<=${perfil.valor_max}`);
  }
  if (perfil.valor_min) {
    filtros.push(`preco:>=${perfil.valor_min}`);
  }
  if (perfil.dormitorios_min) {
    filtros.push(`dormitorios:>=${perfil.dormitorios_min}`);
  }

  // Monta query de busca com bairros ou tipos
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
// 5. Montar mensagem personalizada com IA (ou template fixo como fallback)
// ---------------------------------------------------------------------------
function montarMensagem(
  nomeCliente: string,
  nomeCorretor: string,
  urlVitrine: string,
  imoveis: Imovel[]
): string {
  const primeiroNome = nomeCliente.split(" ")[0];
  const nomePrimeiroImovel = imoveis[0]?.titulo || "imóvel";
  const bairro = imoveis[0]?.bairro || "Porto Alegre";

  return (
    `Oi ${primeiroNome}! 👋 Aqui é ${nomeCorretor} da uHome.\n\n` +
    `Estava analisando o mercado hoje cedo e separei ${imoveis.length} imóveis ` +
    `em ${bairro} que acabaram de entrar na nossa vitrine e combinam muito com o que você busca.\n\n` +
    `🏠 *${nomePrimeiroImovel}* e mais ${imoveis.length - 1} opção(ões) estão aqui:\n` +
    `👉 ${urlVitrine}\n\n` +
    `O que achou? Algum chamou atenção? 😊`
  );
}

// ---------------------------------------------------------------------------
// 6. Enviar mensagem via WhatsApp (Meta Cloud API)
// ---------------------------------------------------------------------------
async function enviarWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  // Normaliza telefone: remove tudo que não é número e garante DDI 55
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
// 7. Registrar atividade no histórico do lead
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

  // Atualiza ultima_acao_at do lead
  await supabase
    .from("pipeline_leads")
    .update({ ultima_acao_at: new Date().toISOString() })
    .eq("id", leadId);
}

// ---------------------------------------------------------------------------
// 8. Notificar corretor via push notification
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
  // Permite chamada via cron (GET) ou manual (POST)
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  console.log("[nurturing] Iniciando Motor de Match Noturno...");

  const leads = await buscarLeadsParados();

  if (leads.length === 0) {
    console.log("[nurturing] Nenhum lead elegível. Encerrando.");
    return new Response(
      JSON.stringify({ success: true, processados: 0, mensagem: "Nenhum lead elegível" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  let enviados = 0;
  let semPerfil = 0;
  let semImoveis = 0;
  let erros = 0;

  for (const lead of leads) {
    try {
      // Pula leads sem telefone
      if (!lead.telefone) {
        erros++;
        continue;
      }

      // Busca imóveis compatíveis
      const imoveis = await buscarImoveisTypesense(lead.perfil);

      if (imoveis.length === 0) {
        semImoveis++;
        console.log(`[nurturing] Lead ${lead.id} (${lead.nome}): sem imóveis compatíveis`);
        continue;
      }

      // Cria vitrine pública
      const urlVitrine = await criarVitrine(lead.id, lead.corretor_id, imoveis);
      if (!urlVitrine) {
        erros++;
        continue;
      }

      // Monta e envia mensagem
      const mensagem = montarMensagem(
        lead.nome,
        lead.corretor_nome,
        urlVitrine,
        imoveis
      );

      const enviou = await enviarWhatsApp(lead.telefone, mensagem);

      if (enviou) {
        // Registra no histórico e notifica o corretor
        await registrarAtividade(lead.id, lead.corretor_id, urlVitrine, imoveis.length);
        await notificarCorretor(lead.corretor_id, lead.nome);
        enviados++;
        console.log(`[nurturing] ✅ Lead ${lead.nome}: vitrine enviada com ${imoveis.length} imóveis`);
      } else {
        erros++;
      }

      // Pequena pausa para não sobrecarregar a API do WhatsApp
      await new Promise((resolve) => setTimeout(resolve, 500));
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
    headers: { "Content-Type": "application/json" },
  });
});
