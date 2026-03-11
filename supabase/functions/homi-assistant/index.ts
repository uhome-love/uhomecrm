import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREENDIMENTOS_INFO: Record<string, string> = {
  "Casa Tua": `EMPREENDIMENTO: Casa Tua – Condomínio de Casas
CONSTRUTORA: Encorp Empreendimentos
LOCALIZAÇÃO: Av. Protásio Alves, 10.431 – Alto Petrópolis / Morro Santana – Porto Alegre/RS
CONCEITO: Condomínio fechado de casas para quem busca conforto e liberdade de morar em casa, com segurança e infraestrutura de condomínio. Combina espaço, natureza, lazer e qualidade de vida. Ideal para famílias. Produto muito procurado por quem quer sair do apartamento e ter mais privacidade.
TIPOLOGIAS: Casas de 2 e 3 dormitórios. Metragens: 99m², 127m², 176m² (com terraço). Todas com pátio privativo e projeto moderno.
CARACTERÍSTICAS: Pátio privativo com espaço para churrasqueira, espera para lareira, espera para piscina ou spa, opção com terraço no 3º pavimento, vagas de garagem, layout moderno e funcional.
LAZER DO CONDOMÍNIO: Piscina adulto e infantil, academia, salão de festas, salão gourmet, brinquedoteca, sala de jogos, playground, fogo de chão, pet place, quadra esportiva, beach tennis, áreas de convivência ao ar livre.
LOCALIZAÇÃO DETALHADA: Av. Protásio Alves, uma das principais vias da cidade. Fácil acesso para Zona Norte, Av. Ipiranga, Centro de POA. Próximo de escolas, supermercados, academias, restaurantes. Combina mobilidade com região tranquila e residencial.
PERFIL DE CLIENTE IDEAL: Quem quer sair do apto e morar em casa; busca mais espaço para família; valoriza segurança de condomínio; quer pátio privativo; quer qualidade de vida; casa nova com lazer. Famílias com filhos, casais que querem mais espaço, quem trabalha em home office.
DIFERENCIAIS PRINCIPAIS: Condomínio fechado de casas, casas novas com arquitetura moderna, pátio privativo, lazer completo, segurança de condomínio, boa mobilidade. Argumento-chave: "ter casa com pátio, mas dentro de um condomínio seguro".
OBJEÇÕES E RESPOSTAS:
- "Localização afastada" → Comparar com qualidade de vida e espaço que não encontra em regiões centrais.
- "Prefiro algo mais central" → Casas centrais custam muito mais e não têm infraestrutura de condomínio.
- "Casas são geminadas" → Projeto pensado para privacidade e conforto + segurança do condomínio.
- "Obra demora" → Valorização durante obra + melhores condições de pagamento.
ARGUMENTOS DE VENDA: Morar em casa com segurança de condomínio, mais espaço para família, pátio para lazer e pets, infraestrutura de clube, casa nova com padrão moderno.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil do cliente. 2) Explicar conceito de condomínio de casas. 3) Mostrar diferenciais. 4) Convidar para visita. Pergunta final: "Faz sentido eu te mostrar o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita aumenta muito a conversão porque o cliente entende o conceito e visualiza o espaço.`,

  "Open Bosque": `EMPREENDIMENTO: Open Bosque – Parque do Arvoredo
CONSTRUTORA: Open Construtora (grupo Melnick)
LOCALIZAÇÃO: Rua Pedro Waine, 75 – Passo d'Areia / Santa Maria Goretti – Zona Norte – Porto Alegre/RS
CONCEITO: Condomínio-parque pensado para unir moradia, lazer e natureza dentro da cidade. Faz parte do projeto urbano do Parque do Arvoredo, área com mais de 22.000m² que transforma a região em novo polo residencial moderno da Zona Norte. Voltado para primeiro imóvel, custo-benefício e qualidade de vida com infraestrutura completa.
TIPOLOGIAS: Apartamentos de 1, 2 e 3 dormitórios. Metragens: 31m² a 63m². Plantas modernas e funcionais com ótima iluminação natural.
CARACTERÍSTICAS: Plantas inteligentes com ambientes integrados, churrasqueira nas unidades, vaga de garagem, opções de unidades garden, boa iluminação natural, acabamento moderno.
LAZER DO CONDOMÍNIO: Piscina, salão de festas, espaço gourmet, playground, brinquedoteca, quadra esportiva, pet place, bicicletário, quiosques, mini market, horta comunitária, áreas de convivência.
LOCALIZAÇÃO DETALHADA: Zona Norte de POA, região estratégica. Próximo de Av. Assis Brasil, Bourbon Shopping, Shopping Iguatemi, Parque Germânia, Aeroporto Salgado Filho. Mercados, escolas, farmácias e serviços próximos.
PERFIL DE CLIENTE IDEAL: Primeiro imóvel, sair do aluguel, bom custo-benefício, financiamento facilitado, infraestrutura de lazer. Jovens casais, famílias pequenas, investidores que buscam imóveis compactos.
DIFERENCIAIS PRINCIPAIS: Condomínio-parque integrado a grande área verde, infraestrutura completa, plantas funcionais, localização estratégica na Zona Norte, financiamento facilitado, alto potencial de valorização.
OBJEÇÕES E RESPOSTAS:
- "Apartamento pequeno" → Plantas pensadas para aproveitar bem o espaço + condomínio oferece grande área de lazer para ampliar conforto.
- "Prefiro algo maior" → Existem opções de 2 e 3 dormitórios e unidades garden com mais espaço.
- "Não conheço a região" → Projeto de revitalização da área + proximidade com grandes avenidas e serviços.
ARGUMENTOS DE VENDA: Primeiro condomínio-parque da região, morar perto de tudo com lazer completo, oportunidade para sair do aluguel, financiamento facilitado, excelente custo-benefício.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil do cliente. 2) Explicar conceito de condomínio-parque. 3) Mostrar diferenciais de lazer e localização. 4) Convidar para conhecer o decorado. Pergunta final: "Faz sentido você conhecer o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas ao stand ou decorado. A visita aumenta muito a conversão porque o cliente visualiza o conceito e a estrutura de lazer.`,

  "Melnick Day": `TIPO: EVENTO DE VENDAS (não é um empreendimento, é o maior evento de vendas do mercado imobiliário do Sul do Brasil)
EMPRESA: Melnick
DATA: 21 de março de 2026 (evento de UM DIA)
CONCEITO: Maior evento de vendas do mercado imobiliário do Sul do Brasil, realizado anualmente pela Melnick. Condições comerciais EXCLUSIVAS para aquisição de imóveis em diversos empreendimentos. Oportunidade ÚNICA no ano. Reúne oportunidades para moradia e investimento. Imóveis prontos, em obras e lançamentos.
CONDIÇÕES ESPECIAIS: Descontos de até ~30% em unidades selecionadas, negociação direta com a incorporadora, parcelamento da entrada, financiamento facilitado, possibilidade de usar FGTS, possibilidade de aceitar imóvel ou veículo no negócio. Condições VÁLIDAS APENAS durante o evento.
URGÊNCIA: Acontece em data específica, condições NÃO se repetem após o evento. Melhores unidades são as primeiras a serem vendidas. Imóveis de médio, alto e altíssimo padrão em diferentes regiões de POA.
PERFIL DE CLIENTE IDEAL: Comprar imóvel com desconto, condições especiais, investir em Melnick, antecipar oportunidades. Investidores, clientes que já procuravam imóvel, quem aguarda boas oportunidades.
DIFERENCIAIS: Descontos exclusivos, condições especiais de pagamento, negociação direta com construtora, oportunidades normalmente indisponíveis, grande variedade de empreendimentos.
OBJEÇÕES E RESPOSTAS:
- "Vou pensar" → Condições válidas APENAS durante o evento, melhores unidades esgotam primeiro.
- "Quero ver depois" → Após o evento valores e condições retornam ao padrão normal de mercado.
- "Não sei qual empreendimento escolher" → Oferecer ajuda para entender perfil e apresentar melhores oportunidades.
ARGUMENTOS DE VENDA: Oportunidade única no ano, descontos que não se repetem, condições especiais direto com construtora, diversos empreendimentos, comprar antes que melhores unidades acabem.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil. 2) Explicar que evento tem oportunidades únicas. 3) Mostrar empreendimentos participantes. 4) Convidar para conhecer opções ANTES do evento. Pergunta final: "Faz sentido eu te mostrar quais empreendimentos estão com as melhores condições no Melnick Day?"
OBJETIVO: Gerar visita ou reunião para apresentar oportunidades do evento. Criar URGÊNCIA real (evento é um dia só).`,

  "Alto Lindóia": `EMPREENDIMENTO: Alto Lindóia Resort
INCORPORADORA: Florença Incorporadora
LOCALIZAÇÃO: Rua Monsenhor Antônio Guilherme Grings, 100 – Bairro Sarandi – Porto Alegre/RS
CONCEITO: Condomínio residencial com conceito de resort urbano. Lazer, conforto e qualidade de vida dentro do condomínio. Experiência de viver com infraestrutura completa como se estivesse em férias todos os dias. Voltado para famílias e compradores que buscam custo-benefício com estrutura completa.
TIPOLOGIAS: Apartamentos de 1, 2 e 3 dormitórios. Metragens: 36m² a 78m². Todas com sacada, churrasqueira e vaga de garagem.
CARACTERÍSTICAS: Plantas modernas e funcionais, sacada com churrasqueira, boa iluminação natural, vaga de garagem, layout prático.
LAZER DO CONDOMÍNIO: ~7.298m² de área de lazer com +25 espaços: piscina adulto e infantil, academia, salão de festas, espaço gourmet, playground, quadra esportiva, beach tennis, sala de jogos, coworking, pet place, pet care, brinquedoteca, bicicletário, horta, quiosques com churrasqueira, espaços de convivência.
LOCALIZAÇÃO DETALHADA: Zona Norte de POA, bairro Sarandi. Fácil acesso a Av. Assis Brasil, centros comerciais, supermercados, escolas, serviços. Região em desenvolvimento e valorização imobiliária.
PERFIL DE CLIENTE IDEAL: Sair do aluguel, primeiro imóvel, condomínio com lazer completo, bom custo-benefício, financiamento facilitado. Famílias jovens, casais com filhos, investidores de médio padrão.
DIFERENCIAIS PRINCIPAIS: Conceito de condomínio resort, +25 itens de lazer, plantas funcionais, sacada com churrasqueira, vaga de garagem, excelente custo-benefício, localização estratégica Zona Norte.
OBJEÇÕES E RESPOSTAS:
- "Apartamento pequeno" → Condomínio possui grande área de lazer que amplia o espaço de convivência.
- "Prefiro algo mais central" → Região com boa mobilidade e valores mais acessíveis que regiões centrais.
- "Dúvida sobre valorização" → Zona Norte em crescimento com grande procura por imóveis com infraestrutura completa.
ARGUMENTOS DE VENDA: Morar em condomínio com estrutura de resort, lazer completo para toda a família, ótimo custo-benefício, oportunidade para sair do aluguel, infraestrutura completa.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil. 2) Apresentar conceito de condomínio resort. 3) Destacar estrutura de lazer. 4) Convidar para conhecer. Pergunta final: "Faz sentido você conhecer o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita aumenta significativamente a conversão porque o cliente visualiza a infraestrutura completa.`,

  "Orygem": `EMPREENDIMENTO: Orygem Residence Club
INCORPORADORA: Encorp Empreendimentos
LOCALIZAÇÃO: Av. Engenheiro Ludolfo Boehl, 931 – Bairro Teresópolis – Porto Alegre/RS
CONCEITO: Condomínio fechado de casas que combina natureza, segurança e infraestrutura de lazer completa. Para quem quer morar em casa com mais espaço e privacidade dentro de condomínio seguro com estrutura de clube. Qualidade de vida, áreas verdes e ambiente ideal para famílias.
TIPOLOGIAS: Casas de 2 e 3 dormitórios. Metragens: 150m² e 173m². Todas com 3 pavimentos e 2 vagas de garagem.
CARACTERÍSTICAS: Pátio privativo com churrasqueira, opção de terraço no 3º pavimento, espera para lareira, espera para piscina ou spa, ambientes amplos e integrados, projeto moderno com 3 pavimentos.
LAZER DO CONDOMÍNIO: Piscina adulto e infantil, spa, academia, salão de festas, espaço gourmet, brinquedoteca, playground, quadra esportiva, beach tennis, sala de jogos, coworking, quiosques gourmet, fogo de chão, pet place, áreas de convivência ao ar livre.
LOCALIZAÇÃO DETALHADA: Bairro Teresópolis, região residencial com fácil acesso às principais vias. Acesso rápido à zona sul e zona norte. Próximo de escolas, supermercados e serviços.
PERFIL DE CLIENTE IDEAL: Sair do apartamento e morar em casa, mais espaço para família, segurança de condomínio, pátio privativo, natureza e áreas verdes, qualidade de vida. Famílias com filhos, casais que buscam mais espaço, upgrade de moradia.
DIFERENCIAIS PRINCIPAIS: Condomínio fechado de casas, casas amplas com 3 pavimentos, pátio privativo, lazer completo, contato com natureza, projeto moderno, segurança.
OBJEÇÕES E RESPOSTAS:
- "Prefiro apartamento" → Orygem oferece liberdade de morar em casa COM segurança de condomínio.
- "Região mais afastada" → Bairro com boa mobilidade, mais espaço e qualidade de vida que regiões centrais.
- "Valor mais alto que apartamento" → Comparar com custo de casas em regiões centrais + destacar espaço e infraestrutura.
ARGUMENTOS DE VENDA: Morar em casa com segurança de condomínio, mais espaço para família, pátio privativo, lazer completo, qualidade de vida e natureza.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil. 2) Explicar conceito de condomínio de casas. 3) Mostrar diferenciais de espaço e lazer. 4) Convidar para visita. Pergunta final: "Faz sentido eu te mostrar o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita é essencial para entender o conceito e visualizar o espaço das casas.`,

  "Casa Bastian": `EMPREENDIMENTO: Casa Bastian
INCORPORADORA: ABF Developments
LOCALIZAÇÃO: Av. Praia de Belas / Av. Bastian – Bairro Menino Deus – Porto Alegre/RS
CONCEITO: Empreendimento contemporâneo de lofts e apartamentos compactos no Menino Deus, um dos bairros mais tradicionais e valorizados de POA. Combina arquitetura moderna com preservação histórica do entorno, incorporando construções antigas ao projeto. Proposta urbana diferenciada. Unidades compactas, funcionais, altamente procuradas para moradia e investimento.
TIPOLOGIAS: Lofts compactos: 14-30m². Lofts com office: 33-36m². Apartamentos 1 dormitório: 29-36m². Plantas otimizadas para praticidade urbana.
CARACTERÍSTICAS: Plantas compactas e inteligentes, design moderno, ambientes integrados, ideais para moradia individual ou investimento, alta liquidez para locação.
LAZER DO CONDOMÍNIO: Coworking, áreas de convivência, lounge, espaços compartilhados, áreas para trabalho remoto. Proposta integra moradia, trabalho e vida urbana.
LOCALIZAÇÃO DETALHADA: Menino Deus, um dos bairros mais completos de POA. Próximo do Shopping Praia de Belas, Orla do Guaíba, região central, hospitais, comércio, polos jurídicos e empresariais. Alta demanda de locação e grande procura por compactos.
PERFIL DE CLIENTE IDEAL: Imóveis compactos em região central, praticidade, mobilidade urbana, trabalham na região central. Investidores imobiliários, estudantes, jovens profissionais, executivos.
DIFERENCIAIS PRINCIPAIS: Localização central estratégica (Menino Deus), arquitetura moderna, preservação histórica integrada ao projeto, alta demanda para locação, produto ideal para investimento.
OBJEÇÕES E RESPOSTAS:
- "Apartamento muito pequeno" → Conceito de moradia urbana compacta, ideal para praticidade ou investimento com alta liquidez.
- "Prefiro algo maior" → Existem opções maiores: lofts com office e aptos de 1 dormitório.
- "É mais para investimento?" → Atende tanto investidores quanto moradores que valorizam mobilidade e praticidade.
ARGUMENTOS DE VENDA: Localização central em bairro tradicional, alta demanda de locação, excelente para investimento, arquitetura moderna, conceito urbano contemporâneo.
ESTRATÉGIA DE CONVERSÃO: 1) Entender se busca moradia ou investimento. 2) Destacar localização e liquidez. 3) Explicar conceito de studio moderno. 4) Convidar para visita. Pergunta final: "Faz sentido você conhecer o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita ajuda a entender o conceito de moradia urbana compacta e o potencial de valorização.`,

  "Shift": `EMPREENDIMENTO: Shift
INCORPORADORA: Vanguard (Grupo Plaenge)
LOCALIZAÇÃO: Rua Silva Jardim, 21 – Bairro Auxiliadora – Porto Alegre/RS (esquina com Rua 24 de Outubro)
CONCEITO: Empreendimento contemporâneo de studios e apartamentos compactos. Conceito "Life on Demand": morar com praticidade, mobilidade e flexibilidade em imóvel funcional e bem localizado. Atende quem quer morar sozinho em bairro central E investidores que buscam alta demanda de locação.
TIPOLOGIAS: Studios: ~24m² a 48m². Apartamentos 1 dormitório com suíte: ~75m² a 108m². Plantas otimizadas com ambientes integrados e funcionais. Opções garden.
CARACTERÍSTICAS: Plantas compactas e inteligentes, ambientes integrados, design contemporâneo, ótima iluminação natural, opções de studios e 1 dormitório, unidades garden.
LAZER DO CONDOMÍNIO: Piscina, academia (fitness center), coworking, lavanderia compartilhada, lounge, espaço gourmet, bicicletário, áreas de convivência, market interno.
LOCALIZAÇÃO DETALHADA: Bairro Auxiliadora, uma das regiões mais valorizadas de POA. Restaurantes, cafés, academias, supermercados, hospitais, comércio. Próximo ao Moinhos de Vento e Parcão. Mobilidade a pé e estilo de vida urbano.
PERFIL DE CLIENTE IDEAL: Morar sozinho em região central, praticidade, mobilidade urbana, imóvel moderno e funcional. Investidores, estudantes, jovens profissionais, executivos da região central.
DIFERENCIAIS PRINCIPAIS: Localização premium em bairro nobre (Auxiliadora), projeto moderno, alta demanda para locação, moradia urbana compacta, infraestrutura completa.
OBJEÇÕES E RESPOSTAS:
- "Apartamento pequeno" → Conceito de moradia urbana funcional, infraestrutura complementa o espaço do apto.
- "Prefiro algo maior" → Existem unidades de 1 dormitório maiores + opções garden.
- "É mais para investimento?" → Atende tanto investidores quanto moradores que querem praticidade e mobilidade.
ARGUMENTOS DE VENDA: Morar em região mais valorizada da cidade, alta demanda de locação, conceito moderno, imóvel compacto com infraestrutura, ótima opção para investimento.
ESTRATÉGIA DE CONVERSÃO: 1) Entender se busca moradia ou investimento. 2) Destacar localização e mobilidade. 3) Explicar conceito de studio moderno. 4) Convidar para visita. Pergunta final: "Faz sentido você conhecer o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita ajuda a entender o conceito de studio moderno e visualizar potencial de moradia ou investimento.`,

  "Lake Eyre": `EMPREENDIMENTO: Lake Eyre
LOCALIZAÇÃO: Av. Diário de Notícias – Bairro Cristal – Porto Alegre/RS (dentro do Golden Lake, primeiro bairro privativo de POA)
CONCEITO: Empreendimento residencial de ALTO PADRÃO dentro do bairro planejado Golden Lake (~163 mil m²). Sofisticação, exclusividade e qualidade de vida às margens do Guaíba, próximo ao BarraShoppingSul. Arquitetura contemporânea, infraestrutura completa e integração com natureza.
TIPOLOGIAS: Apartamentos de 3 e 4 suítes. Metragens: 127m², 143m², 176m², 186m². Coberturas até ~326m². Unidades com lareira, churrasqueira, grandes varandas, vista permanente para o Guaíba.
CARACTERÍSTICAS: Amplas áreas sociais integradas, suítes espaçosas, hall privativo, grandes aberturas, iluminação natural, lareira e churrasqueira, vista privilegiada para o Guaíba, plantas amplas e sofisticadas.
LAZER DO CONDOMÍNIO: Piscinas adulto e infantil, piscina aquecida e olímpica, spa e área de relaxamento, beauty center, academia completa, salão de festas, espaço gourmet, brinquedoteca, playground, quadra esportiva, beach tennis, coworking, sala de reuniões, pet place, mini mercado, áreas verdes e bosque, espaços de convivência.
LOCALIZAÇÃO DETALHADA: Bairro Cristal, dentro do Golden Lake, próximo ao BarraShoppingSul e Orla do Guaíba. Fácil acesso ao centro e zona sul. Golden Lake é bairro planejado com diversos condomínios de alto padrão com infraestrutura integrada.
PERFIL DE CLIENTE IDEAL: Imóveis de alto padrão, exclusividade e sofisticação, morar próximo ao Guaíba, apartamentos amplos, condomínio com infraestrutura completa, segurança e qualidade de vida. Famílias de alto padrão, executivos, investidores imobiliários.
DIFERENCIAIS PRINCIPAIS: Localização privilegiada próxima ao Guaíba, dentro do Golden Lake (bairro privativo), aptos amplos 3-4 suítes, vista permanente Guaíba, lazer completo, arquitetura contemporânea, conceito de bairro privativo.
OBJEÇÕES E RESPOSTAS:
- "Valor alto" → Empreendimento de alto padrão dentro de bairro planejado exclusivo com forte potencial de valorização.
- "Prefiro casa" → Apartamentos oferecem metragem ampla + infraestrutura de lazer e segurança que muitas casas não possuem.
- "Não conheço o Golden Lake" → Explicar conceito de bairro privativo com segurança, lazer, natureza e infraestrutura completa.
ARGUMENTOS DE VENDA: Morar em um dos bairros mais exclusivos de POA, vista para o Guaíba, lazer completo, projeto sofisticado, proximidade do BarraShoppingSul, conceito de bairro planejado.
ESTRATÉGIA DE CONVERSÃO: 1) Entender perfil e faixa de investimento. 2) Apresentar conceito do Golden Lake. 3) Destacar exclusividade e vista Guaíba. 4) Convidar para visita. Pergunta final: "Faz sentido você conhecer o projeto pessoalmente? Prefere durante a semana ou no fim de semana?"
OBJETIVO: Converter leads em visitas. A visita é essencial para entender o conceito do Golden Lake e visualizar a exclusividade.`,

  "Las Casas": `EMPREENDIMENTO: Las Casas
TIPO: Bairro planejado – Lotes em condomínio fechado
LOCALIZAÇÃO: Porto Alegre – RS
CONCEITO: Condomínio residencial de lotes para construção de casas, combinando privacidade, espaço e qualidade de vida com infraestrutura de lazer completa e segurança. Projeto para quem busca morar em casa dentro de condomínio planejado, com áreas verdes, lazer e tranquilidade. Alternativa para quem quer sair de apartamento e viver com mais espaço, conforto e contato com natureza.
TIPO DE PRODUTO: Lotes em condomínio fechado projetados para conforto, privacidade, segurança, espaço interno maior e convivência familiar.
DIFERENCIAIS: Condomínio fechado, casas modernas, arquitetura contemporânea, segurança, infraestrutura de lazer, qualidade de vida, contato com natureza. Produto voltado para famílias que desejam mais espaço e tranquilidade.
PERFIL DE CLIENTE IDEAL: Querem sair de apartamento, morar em casa com segurança, valorizam espaço e qualidade de vida, possuem família, desejam condomínio com lazer, procuram algo mais exclusivo. Também atrai quem mora em apartamentos grandes, casas de rua ou condomínios horizontais.
ARGUMENTOS DE VENDA: Morar em casa dentro de condomínio, mais espaço para família, privacidade, segurança, valorização imobiliária, qualidade de vida. Comparação: "É como ter a liberdade de uma casa com a segurança de um condomínio."
OBJEÇÕES E RESPOSTAS:
- "Prefiro apartamento" → Condomínio oferece segurança e infraestrutura semelhante a prédio, mas com espaço e liberdade de casa.
- "Não conheço esse tipo de produto" → Modelo de condomínio horizontal cada vez mais procurado por famílias que querem qualidade de vida.
- "Quero algo mais central" → Condomínios de lotes ficam em regiões mais tranquilas justamente para oferecer mais espaço, silêncio e natureza.
SCRIPT CURTO: "Esse projeto é um condomínio de lotes, pensado para quem quer sair de apartamento e ter mais espaço e qualidade de vida, mas sem abrir mão de segurança e infraestrutura."
ESTRATÉGIA DE CONVERSÃO: 1) Entender se cliente busca casa ou apartamento. 2) Identificar se quer mais espaço. 3) Apresentar conceito do condomínio. 4) Convidar para conhecer. Perguntas de conversão: "Você já pensou em construir sua casa dentro de condomínio?" ou "Faz sentido conhecer um condomínio de lotes que está sendo lançado?"
OBJETIVO: Gerar visita ao empreendimento. A visita ajuda o cliente a visualizar o conceito e entender o potencial do produto.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { acao, empreendimento, situacao, mensagem_cliente, objetivo, role, lead_context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const infoEmpreendimento = EMPREENDIMENTOS_INFO[empreendimento] || "Empreendimento da UHome. Use técnicas de qualificação e convite para visita.";

    const isGerente = role === "gerente";
    const systemPrompt = isGerente
      ? `Você é o HOMI, o assistente de gestão comercial da Uhome.
Você está ajudando um GERENTE DE EQUIPE a criar materiais para seu time de corretores.
Seu papel é gerar scripts, mensagens, quebras de objeção e materiais de treinamento práticos.
Responda de forma prática, operacional e direta. Use formatação markdown com seções claras.
Sempre inclua variáveis {nome} e {empreendimento} nos scripts gerados.
Foque em materiais que o gerente possa distribuir para o time usar na operação diária.

INFORMAÇÕES DO EMPREENDIMENTO:
${infoEmpreendimento}`
      : `Você é o HOMI, o assistente de inteligência comercial da Uhome.

═══════════════════════════════════════
SOBRE A UHOME
═══════════════════════════════════════

A Uhome é uma imobiliária especializada em venda de imóveis de construtora em Porto Alegre, focada em médio e alto padrão.
Os corretores trabalham principalmente com leads vindos de anúncios digitais (Meta Ads, TikTok Ads, portais imobiliários e site).

O objetivo principal do corretor é sempre:
1. Gerar resposta do lead
2. Qualificar o cliente
3. Gerar visita presencial
4. Gerar proposta
5. Fechar venda

═══════════════════════════════════════
SEU PAPEL
═══════════════════════════════════════

Você existe para ajudar os corretores da Uhome a vender mais imóveis.
Você NÃO é um chatbot genérico. Você atua como:
• Treinador de vendas
• Estrategista comercial
• Especialista em conversão de leads
• Especialista em atendimento imobiliário
• Especialista em geração de visitas
• Especialista em negociação

Você fala como um gerente comercial experiente.
Nunca responda como um robô de atendimento.
Sempre pense: "como eu ajudaria esse corretor a vender esse imóvel?"

═══════════════════════════════════════
CONHECIMENTO DO EMPREENDIMENTO
═══════════════════════════════════════

${infoEmpreendimento}

═══════════════════════════════════════
COMO VOCÊ AJUDA
═══════════════════════════════════════

Quando um corretor pedir ajuda, entenda rapidamente:
• Qual produto
• Qual etapa do atendimento
• Qual dificuldade ele está enfrentando

E então entregue respostas PRÁTICAS. Evite respostas teóricas.

Sempre entregue:
• Scripts e mensagens prontas
• Perguntas estratégicas
• Quebras de objeção
• Formas de avançar o cliente no funil

Seu objetivo é sempre mover o lead para a próxima etapa:
sem resposta → gerar resposta
respondeu → qualificar
qualificado → visita
visita → proposta
proposta → fechamento

═══════════════════════════════════════
TIPOS DE AJUDA
═══════════════════════════════════════

• Se pedir ajuda para CONVERTER → mensagem estratégica + pergunta que avance
• Se o cliente SUMIU → mensagem de reativação
• Se o cliente tem OBJEÇÃO → resposta + pergunta de continuação
• Se pedir ajuda para LIGAÇÃO → script curto de abordagem
• Se pedir ajuda para VISITA → argumentos de visita
• Se pedir ajuda para NEGOCIAÇÃO → estratégia de condução

═══════════════════════════════════════
TÉCNICAS DE VENDA
═══════════════════════════════════════

1. ESPELHAMENTO: Reflita a linguagem do cliente. Se é informal, seja informal. Se é técnico, use dados.

2. QUALIFICAÇÃO SPIN:
   - Situação: "Como é sua moradia hoje?"
   - Problema: "O que te incomoda no que tem hoje?"
   - Implicação: "E como isso afeta sua rotina/família?"
   - Necessidade: "Se pudesse resolver isso, o que seria ideal?"

3. GATILHOS MENTAIS:
   - Oportunidade: "Condições especiais disponíveis agora"
   - Escassez: "Temos poucas unidades nessa condição"
   - Valorização: "A região está se valorizando acima da média"
   - Qualidade de vida: "Imagine sua família vivendo assim"
   - Investimento: "Retorno garantido pela localização"
   - Prova Social: "Muitas famílias já escolheram por esse motivo"
   - Autoridade: "A construtora é referência no mercado"

4. CONTORNO DE OBJEÇÕES (método LACE):
   - Listen (Ouça): Valide o que o cliente sente
   - Acknowledge (Reconheça): "Entendo perfeitamente"
   - Counter (Contraponha): Apresente perspectiva diferente
   - Engage (Engaje): Faça uma pergunta que avance a conversa

5. CONVITE PARA VISITA:
   - Sempre ofereça 2 opções de data (semana ou fim de semana)
   - Nunca pergunte "se" quer visitar, pergunte "quando"
   - "Quando fica melhor pra você conhecer pessoalmente?"

6. PERGUNTAS INTELIGENTES: Quando possível, sugira perguntas que façam o cliente falar mais.

═══════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════

1. Mensagens de WhatsApp: MÁXIMO 3-4 linhas. Curtas, naturais e diretas.
2. SEMPRE termine com uma PERGUNTA que avance a conversa
3. NUNCA pareça robô ou use linguagem corporativa artificial
4. Use emojis com moderação (máx 1-2 por mensagem)
5. FOCO PRINCIPAL: Conduzir para VISITA ao empreendimento
6. Adapte o tom ao perfil do cliente (jovem, família, investidor)
7. Use os diferenciais ESPECÍFICOS do empreendimento, não genéricos
8. Quando o cliente objeta, NUNCA confronte — valide e redirecione
9. Scripts de ligação devem ser NATURAIS, como conversa entre amigos
10. Se for ligação em tempo real, respostas CURTAS que o corretor possa falar
11. Se for WhatsApp, mensagens naturais e curtas
12. Sempre use linguagem natural brasileira
13. Quem compra imóvel compra SONHO, segurança e qualidade de vida

═══════════════════════════════════════
PERSONALIDADE
═══════════════════════════════════════

- Confiante: conhece o produto profundamente
- Consultivo: ajuda, não empurra
- Comercial: foca em resultado
- Estratégico: cada frase tem um propósito
- Natural: fala como gente, não como máquina
- Direto: vai ao ponto sem enrolação

Você é o cérebro comercial da Uhome.
Seu objetivo final: ajudar os corretores a vender mais imóveis e gerar mais visitas.

═══════════════════════════════════════
FORMATO DA RESPOSTA (OBRIGATÓRIO — SEGUIR À RISCA)
═══════════════════════════════════════

ATENÇÃO: Você DEVE começar sua resposta SEMPRE com "## 🧠 Análise da Situação". NÃO escreva NADA antes deste header. Cada seção DEVE começar com ##.

## 🧠 Análise da Situação
(MÁXIMO 2 frases. Direto ao ponto. O que está acontecendo e qual a melhor abordagem.)

## 💬 Mensagem WhatsApp
(MÁXIMO 3 LINHAS CURTAS. Exemplo de tamanho ideal:
"Entendo sua preocupação! O Casa Bastian tem um conceito diferente — moradia urbana com localização premium no Menino Deus.
Que tal conhecer pessoalmente? Fica melhor pra você durante a semana ou fim de semana? 😊"
NÃO ULTRAPASSE 3 LINHAS. Sem parágrafos longos. Termina com pergunta.)

## 🔄 Versão Alternativa
(MÁXIMO 3 LINHAS CURTAS com tom ou ângulo diferente. Mesma regra de tamanho.)

## 📞 Script de Ligação
(OBRIGATÓRIO usar este formato com LINHA EM BRANCO entre cada fala:

**Corretor:** "fala de abertura"

**Cliente:** (possível resposta)

**Corretor:** "desenvolvimento"

**Cliente:** (possível resposta)

**Corretor:** "convite para visita"

MÁXIMO 5-6 trocas. Cada fala do corretor em NO MÁXIMO 2 linhas.)

## 🎯 Próxima Ação
(3-4 bullet points curtos com ações concretas. Use • para cada item.)`;

    // Inject lead_context (v2 full history) into all prompts
    const leadCtx = lead_context ? `\n\n═══ CONTEXTO COMPLETO DO LEAD ═══\n${lead_context}\n═══════════════════════════════` : "";

    let userPrompt = "";
    const contextoCliente = mensagem_cliente ? `\n\nO CLIENTE DISSE/ESCREVEU: "${mensagem_cliente}"\n\nIMPORTANTE: Analise a frase do cliente, identifique o sentimento/objeção real por trás dela, e responda de forma estratégica.` : "";

    switch (acao) {
      case "responder_whatsapp":
        userPrompt = `SITUAÇÃO: O corretor precisa responder um lead NO WHATSAPP agora.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere a resposta perfeita considerando:
- O que o cliente já sabe/fez até agora (baseado na situação)
- O melhor ângulo para avançar a conversa
- Use diferenciais ESPECÍFICOS do ${empreendimento}
- A mensagem precisa ser NATURAL e gerar resposta do cliente`;
        break;

      case "criar_followup":
        userPrompt = `SITUAÇÃO: O corretor precisa retomar contato com um lead que esfriou.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere follow-ups que:
- NÃO pareçam spam ou desespero
- Tragam algo NOVO para justificar o contato (novidade, condição, prazo)
- Despertem curiosidade sem dar tudo
- Use gatilhos de escassez ou novidade quando possível`;
        break;

      case "script_ligacao":
        userPrompt = `SITUAÇÃO: O corretor vai LIGAR para um lead agora.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere um script de ligação que:
- Seja NATURAL como conversa, não leitura de roteiro
- Tenha abertura, desenvolvimento e convite para visita
- Inclua possíveis respostas do cliente e como reagir
- Use técnica SPIN de qualificação
- O script de ligação deve ser MAIS DETALHADO neste caso (é o foco)
- Inclua perguntas de qualificação estratégicas`;
        break;

      case "quebrar_objecao":
        userPrompt = `SITUAÇÃO: O lead apresentou uma OBJEÇÃO e o corretor precisa contorná-la.

Empreendimento: ${empreendimento}
Objeção/Situação: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Use a técnica LACE para contornar:
1. OUÇA/VALIDE o sentimento do cliente
2. RECONHEÇA que faz sentido pensar assim
3. CONTRAPONHA com perspectiva diferente usando argumentos e diferenciais ESPECÍFICOS do ${empreendimento}
4. ENGAJE com pergunta que avance a conversa

NUNCA confronte o cliente. Sempre valide primeiro, depois redirecione.
Se o empreendimento tem respostas específicas para essa objeção, USE-AS.`;
        break;

      case "preparar_visita":
        userPrompt = `SITUAÇÃO: O corretor quer conduzir o lead para VISITAR o empreendimento.

Empreendimento: ${empreendimento}
Situação do lead: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Gere mensagens que:
- Criem desejo de conhecer PESSOALMENTE
- Destaquem o que só se percebe ao vivo (espaço, ambiente, vista)
- Usem técnica de oferecer 2 opções de data
- Nunca perguntem "SE" quer visitar, perguntem "QUANDO"
- Mencionem diferenciais que só fazem sentido presencialmente
- Criem urgência leve (condições, disponibilidade)`;
        break;

      default:
        userPrompt = `Empreendimento: ${empreendimento}
Situação: ${situacao}
Objetivo: ${objetivo}${contextoCliente}

Ajude o corretor com a melhor estratégia para esta situação.`;
    }

    // Append full lead context to prompt for v2 contextual responses
    userPrompt += leadCtx;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
