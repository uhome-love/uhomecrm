// =============================================================================
// Edge Function: cron-smart-nurturing
// Propósito: Motor de Match Noturno — roda diariamente às 07:00 BRT
// Varre leads parados há mais de 7 dias, busca os melhores imóveis no Typesense
// e dispara vitrine via WhatsApp usando Template Oficial da Meta.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  cidade: string;
  tipo: string;
  valor_venda: number;       // campo real no Typesense
  dormitorios: number;
  area_privativa: number;
  foto_principal: string;
}

// ---------------------------------------------------------------------------
// Helper: gera slug no formato real do site uhome.com.br
// Padrão: [tipo]-[dormitorios]-quartos-[bairro]-[CODIGO]
// Exemplo: casa-3-quartos-petropolis-52101-UH
// ---------------------------------------------------------------------------
function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // remove acentos
    .replace(/[^a-z0-9\s-]/g, "")    // remove caracteres especiais
    .trim()
    .replace(/\s+/g, "-")            // espaços → hífens
    .replace(/-+/g, "-");             // hífens duplos → simples
}

function gerarSlugImovel(imovel: Imovel): string {
  // Extrai o tipo principal (primeira palavra do tipo)
  // Ex: "casa de condominio" → "casa", "apartamento" → "apartamento"
  const tipoPrincipal = slugify(imovel.tipo.split(" ")[0]);

  // Dormitórios
  const dorms = imovel.dormitorios > 0 ? `${imovel.dormitorios}-quartos` : "";

  // Bairro
  const bairro = slugify(imovel.bairro);

  // Monta slug: tipo-dorms-bairro-CODIGO
  const partes = [tipoPrincipal, dorms, bairro, imovel.codigo].filter(Boolean);
  return partes.join("-");
}

// ---------------------------------------------------------------------------
// 1. Buscar leads parados há mais de 7 dias (Limite: 200/dia)
// CORREÇÃO: corretor_id não tem FK — busca o nome do corretor separadamente
// ---------------------------------------------------------------------------
async function buscarLeadsParados(): Promise<LeadComPerfil[]> {
  const seteDiasAtras = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Busca leads elegíveis sem tentar join via FK inexistente
  const { data: leads, error } = await supabase
    .from("pipeline_leads")
    .select(`
      id,
      nome,
      telefone,
      updated_at,
      corretor_id,
      lead_score,
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

  if (!leads || leads.length === 0) return [];

  // Busca nomes dos corretores em lote (sem FK, faz query separada)
  const corretorIds = [...new Set(leads.map((l) => l.corretor_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", corretorIds);

  const mapaCorretores: Record<string, string> = {};
  for (const p of profiles || []) {
    mapaCorretores[p.id] = p.full_name || "Corretor uHome";
  }

  // Filtra leads que já receberam nurturing automático nos últimos 15 dias
  const leadsElegiveis: LeadComPerfil[] = [];
  for (const lead of leads) {
    const jaRecebeuRecente = await verificarNurturingRecente(lead.id);
    if (!jaRecebeuRecente) {
      leadsElegiveis.push({
        id: lead.id,
        nome: lead.nome || "Cliente",
        telefone: lead.telefone,
        corretor_id: lead.corretor_id,
        corretor_nome: mapaCorretores[lead.corretor_id] || "Corretor uHome",
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
// 2. Verificar se o lead já recebeu nurturing automático nos últimos 15 dias
// ---------------------------------------------------------------------------
async function verificarNurturingRecente(leadId: string): Promise<boolean> {
  const quinzeDiasAtras = new Date(
    Date.now() - 15 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("pipeline_atividades")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_lead_id", leadId)           // CORRIGIDO: pipeline_lead_id
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
  // CORRIGIDO: campo de preço é valor_venda no Typesense
  if (perfil.valor_max) filtros.push(`valor_venda:<=${perfil.valor_max}`);
  if (perfil.valor_min) filtros.push(`valor_venda:>=${perfil.valor_min}`);
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
    // CORRIGIDO: coleção chama-se 'imoveis', não 'properties'
    const response = await fetch(
      `https://${TYPESENSE_HOST}/collections/imoveis/documents/search?${params}`,
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
// 4. Criar vitrine no banco com o schema real da tabela vitrines
// Campos obrigatórios: created_by, titulo, imovel_ids, tipo
// ---------------------------------------------------------------------------
async function criarVitrine(
  lead: LeadComPerfil,
  imoveis: Imovel[]
): Promise<string | null> {
  // imovel_ids é jsonb (array de IDs), imovel_codigos é ARRAY (opcional)
  const imovelIds = imoveis.map((i) => i.id);
  const imovelCodigos = imoveis.map((i) => i.codigo);

  const { data, error } = await supabase
    .from("vitrines")
    .insert({
      created_by: lead.corretor_id,           // obrigatório
      titulo: `Seleção especial para ${lead.nome.split(" ")[0]}`, // obrigatório
      subtitulo: "Imóveis selecionados especialmente para você",
      imovel_ids: imovelIds,                  // obrigatório (jsonb)
      imovel_codigos: imovelCodigos,          // array opcional
      tipo: "nurturing",                      // obrigatório
      lead_nome: lead.nome,
      lead_telefone: lead.telefone,
      corretor_id: lead.corretor_id,
      mensagem: `Olá ${lead.nome.split(" ")[0]}! Separei esses imóveis especialmente para você.`,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    console.error("[nurturing] Erro ao criar vitrine:", error);
    return null;
  }

  // Usa slug da vitrine se disponível, senão usa id
  const identificador = data.slug || data.id;
  return `${UHOMESITE_URL}/vitrine/${identificador}`;
}

// ---------------------------------------------------------------------------
// Helper: monta URL pública do imóvel no site uhome.com.br
// Formato real: /imovel/[slug-titulo]-[CODIGO]
// ---------------------------------------------------------------------------
function urlImovel(imovel: Imovel): string {
  return `${UHOMESITE_URL}/imovel/${gerarSlugImovel(imovel)}`;
}

// ---------------------------------------------------------------------------
// 5. Enviar template WhatsApp via Meta Cloud API
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

  const precoFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  // CORRIGIDO: campo de preço é valor_venda
  }).format(imovelPrincipal.valor_venda || 0);

  // Link do imóvel principal (URL real do site)
  const linkImovel = urlImovel(imovelPrincipal);

  const payload = {
    messaging_product: "whatsapp",
    to: telefoneComDDI,
    type: "template",
    template: {
      name: "vitrine_imoveis_personalizada",
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: primeiroNome },
            { type: "text", text: imovelPrincipal.titulo || "Imóvel selecionado" },
            { type: "text", text: imovelPrincipal.bairro || "Sua região" },
            { type: "text", text: imovelPrincipal.tipo || "Imóvel" },
            { type: "text", text: precoFormatado },
            { type: "text", text: linkImovel },  // link direto para o imóvel no site
          ],
        },
      ],
    },
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
// Schema real: pipeline_lead_id, tipo, titulo, data, prioridade, status, created_by
// ---------------------------------------------------------------------------
async function registrarAtividade(
  lead: LeadComPerfil,
  urlVitrine: string,
  imoveisEnviados: number
): Promise<void> {
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: lead.id,               // CORRIGIDO
    tipo: "nurturing_automatico",
    titulo: `🤖 Vitrine automática enviada (${imoveisEnviados} imóvel${imoveisEnviados > 1 ? "is" : ""})`,
    descricao: `IA enviou vitrine com ${imoveisEnviados} imóvel(is). Link: ${urlVitrine}`,
    data: new Date().toISOString().split("T")[0],  // CORRIGIDO: campo date obrigatório
    prioridade: "baixa",                     // CORRIGIDO: obrigatório
    status: "concluida",                     // CORRIGIDO: obrigatório
    created_by: lead.corretor_id,            // CORRIGIDO: created_by, não corretor_id
    responsavel_id: lead.corretor_id,
  });

  // Atualiza updated_at do lead para ir pro final da fila
  await supabase
    .from("pipeline_leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", lead.id);
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
      if (!lead.telefone) {
        erros++;
        continue;
      }

      // Leads sem perfil recebem busca genérica por "apartamento"
      if (!lead.perfil) semPerfil++;

      const imoveis = await buscarImoveisTypesense(lead.perfil);

      if (imoveis.length === 0) {
        semImoveis++;
        console.log(`[nurturing] Lead ${lead.nome}: sem imóveis compatíveis`);
        continue;
      }

      const urlVitrine = await criarVitrine(lead, imoveis);
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
        await registrarAtividade(lead, urlVitrine, imoveis.length);
        await notificarCorretor(lead.corretor_id, lead.nome);
        enviados++;
        console.log(`[nurturing] ✅ ${lead.nome}: vitrine enviada (${imoveis.length} imóveis)`);
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
    headers: { "Content-Type": "application/json" },
  });
});
