import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export type MarketplaceCategory = "script_ligacao" | "whatsapp" | "argumento_empreendimento" | "quebra_objecao" | "template_proposta";
export type MarketplaceStatus = "pendente" | "aprovado" | "rejeitado";
export type MarketplaceSortBy = "mais_usados" | "melhor_avaliados" | "recentes";

export const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  script_ligacao: "📞 Scripts de Ligação",
  whatsapp: "💬 Mensagens WhatsApp",
  argumento_empreendimento: "🏠 Argumentos por Empreendimento",
  quebra_objecao: "🛡️ Quebra de Objeções",
  template_proposta: "📊 Templates de Proposta",
};

export const CATEGORY_ICONS: Record<MarketplaceCategory, string> = {
  script_ligacao: "📞",
  whatsapp: "💬",
  argumento_empreendimento: "🏠",
  quebra_objecao: "🛡️",
  template_proposta: "📊",
};

export function useMarketplace(category?: MarketplaceCategory, sortBy: MarketplaceSortBy = "mais_usados", search?: string) {
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["marketplace-items", category, sortBy, search],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_items")
        .select("*")
        .eq("status", "aprovado");

      if (category) query = query.eq("categoria", category);
      if (search) query = query.ilike("titulo", `%${search}%`);

      if (sortBy === "mais_usados") query = query.order("total_usos", { ascending: false });
      else if (sortBy === "melhor_avaliados") query = query.order("media_avaliacao", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["marketplace-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isGestor || isAdmin,
  });

  const { data: myItems = [] } = useQuery({
    queryKey: ["marketplace-my-items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("*")
        .eq("autor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const submitItem = useMutation({
    mutationFn: async (item: { titulo: string; conteudo: string; categoria: MarketplaceCategory; tags: string[]; origem?: string }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", user!.id).maybeSingle();
      const { error } = await supabase.from("marketplace_items").insert({
        titulo: item.titulo,
        conteudo: item.conteudo,
        categoria: item.categoria,
        tags: item.tags,
        autor_id: user!.id,
        autor_nome: profile?.nome || "Corretor",
        origem: item.origem || "manual",
        status: (isGestor || isAdmin) ? "aprovado" : "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-my-items"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-pending"] });
      toast.success("Material enviado! " + ((isGestor || isAdmin) ? "Publicado automaticamente." : "Aguardando aprovação do gerente."));
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const approveItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("marketplace_items").update({
        status: "aprovado",
        aprovado_por: user!.id,
        aprovado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-pending"] });
      toast.success("Material aprovado!");
    },
  });

  const rejectItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("marketplace_items").update({
        status: "rejeitado",
        updated_at: new Date().toISOString(),
      }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-pending"] });
      toast.success("Material rejeitado.");
    },
  });

  const useItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("increment_marketplace_usage", { p_item_id: itemId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
    },
  });

  const rateItem = useMutation({
    mutationFn: async ({ itemId, nota, comentario }: { itemId: string; nota: number; comentario?: string }) => {
      const { error } = await supabase.rpc("rate_marketplace_item", {
        p_item_id: itemId,
        p_nota: nota,
        p_comentario: comentario || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
      toast.success("Avaliação registrada!");
    },
  });

  // Seed marketplace with HOMI starter content
  const seedMarketplace = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", user!.id).maybeSingle();
      const autorNome = profile?.nome || "HOMI IA";

      const seedItems = [
        // Scripts de Ligação
        {
          titulo: "Primeiro contato — Lead novo",
          categoria: "script_ligacao",
          tags: ["primeiro contato", "lead novo", "abertura"],
          conteudo: `Olá [NOME], tudo bem? Aqui é [SEU NOME] da Uhome! 😊

Vi que você demonstrou interesse no [EMPREENDIMENTO]. Que legal!

Posso te contar rapidinho os diferenciais? São só 2 minutos.

[SE SIM] Perfeito! O [EMPREENDIMENTO] fica em [LOCALIZAÇÃO], com [DIFERENCIAL 1] e [DIFERENCIAL 2]. O que mais te chamou atenção?

[SE NÃO] Sem problemas! Posso te mandar um material pelo WhatsApp pra você ver quando puder?`,
        },
        {
          titulo: "Follow-up após 3 dias sem resposta",
          categoria: "script_ligacao",
          tags: ["follow-up", "reengajamento", "sem resposta"],
          conteudo: `Oi [NOME], aqui é [SEU NOME] da Uhome! 

Te mandei um material do [EMPREENDIMENTO] uns dias atrás, conseguiu dar uma olhada?

[SE SIM] Ótimo! O que achou? Alguma dúvida que eu possa tirar?

[SE NÃO] Tranquilo! Deixa eu te resumir o principal: [BENEFÍCIO-CHAVE]. Vale muito a pena conhecer pessoalmente. Que tal uma visita rápida essa semana?

[RESISTÊNCIA] Entendo perfeitamente. Olha, sem compromisso — a visita leva só 20 minutinhos e você conhece o local. Qual dia fica melhor, [DIA1] ou [DIA2]?`,
        },
        {
          titulo: "Ligação pós-visita — Fechamento",
          categoria: "script_ligacao",
          tags: ["pós-visita", "fechamento", "proposta"],
          conteudo: `[NOME]! Tudo bem? Aqui é [SEU NOME] 😊

Queria saber: o que você achou da visita ao [EMPREENDIMENTO]?

[GOSTOU] Que bom! Qual unidade te agradou mais? A [UNIDADE] está com uma condição especial essa semana.

[INDECISO] Entendo! O que te deixou na dúvida? Às vezes a gente consegue resolver com uma condição diferenciada.

[NÃO GOSTOU] Poxa, sinto muito! O que não atendeu sua expectativa? Tenho outros empreendimentos que podem ser mais a sua cara.

[PROPOSTA] Posso montar uma simulação pra você? Sem compromisso, só pra você ter os números na mão.`,
        },
        // WhatsApp
        {
          titulo: "Primeira mensagem — Lead de campanha",
          categoria: "whatsapp",
          tags: ["primeiro contato", "campanha", "ads"],
          conteudo: `Oi [NOME], tudo bem? 😊

Vi que você se interessou pelo [EMPREENDIMENTO]! Sou [SEU NOME] da Uhome e vou te ajudar.

Pra eu entender melhor o que você procura: é pra morar ou investir? 🏠`,
        },
        {
          titulo: "Reengajamento — Lead frio (7+ dias)",
          categoria: "whatsapp",
          tags: ["reengajamento", "lead frio", "follow-up"],
          conteudo: `Oi [NOME]! 👋

Sei que a rotina é corrida, mas não queria deixar de te contar: o [EMPREENDIMENTO] teve uma novidade essa semana → [NOVIDADE: condição, lançamento de fase, etc.]

Quer que eu te mande os detalhes? 😊`,
        },
        {
          titulo: "Confirmação de visita — Dia anterior",
          categoria: "whatsapp",
          tags: ["visita", "confirmação", "lembrete"],
          conteudo: `[NOME], tudo certo pra amanhã? 😊

📍 [EMPREENDIMENTO] — [ENDEREÇO]
🕐 [HORÁRIO]

Vou te receber pessoalmente! Qualquer dúvida é só me chamar.

Confirma pra mim? ✅`,
        },
        // Quebra de Objeções
        {
          titulo: "Objeção: \"Tá caro demais\"",
          categoria: "quebra_objecao",
          tags: ["preço", "objeção", "negociação"],
          conteudo: `Entendo sua preocupação com o valor, [NOME]. 

Mas deixa eu te mostrar por outro ângulo: o m² do [EMPREENDIMENTO] está em R$ [VALOR/M²], enquanto a média da região é R$ [VALOR REGIÃO]. Ou seja, você está comprando abaixo do mercado.

Além disso, com a valorização prevista de [X]% nos próximos 2 anos, quem compra agora está fazendo um investimento inteligente.

Quer que eu monte uma simulação de parcelas pra você ver como fica no bolso?`,
        },
        {
          titulo: "Objeção: \"Preciso pensar / Vou ver com minha esposa\"",
          categoria: "quebra_objecao",
          tags: ["indecisão", "casal", "objeção"],
          conteudo: `Claro, é uma decisão importante e faz todo sentido conversar!

[NOME], posso sugerir uma coisa? Que tal vocês dois virem juntos pra uma visita? Assim os dois veem pessoalmente e podem decidir juntos, sem pressão.

Eu separo um horário especial só pra vocês. Preferem sábado de manhã ou à tarde?

💡 Dica: Não insista no fechamento. Facilite a decisão do casal oferecendo a visita a dois.`,
        },
        {
          titulo: "Objeção: \"Não é o momento / Vou esperar\"",
          categoria: "quebra_objecao",
          tags: ["timing", "urgência", "objeção"],
          conteudo: `Entendo perfeitamente, [NOME]. 

Mas olha só um dado importante: o [EMPREENDIMENTO] já vendeu [X]% das unidades em [TEMPO]. As melhores unidades — com sol da manhã e vista livre — são as primeiras a ir.

Não estou te pedindo pra fechar agora. Só pra garantir a reserva enquanto avalia. Se mudar de ideia, cancela sem custo.

Faz sentido pra você?`,
        },
        // Argumentos por Empreendimento
        {
          titulo: "Argumentário — Empreendimento Premium",
          categoria: "argumento_empreendimento",
          tags: ["premium", "alto padrão", "diferenciação"],
          conteudo: `🏠 ARGUMENTÁRIO — EMPREENDIMENTO PREMIUM

ABERTURA:
"Esse é um dos poucos projetos da cidade com [DIFERENCIAL ÚNICO]. Não é só um apartamento, é um estilo de vida."

3 PILARES DE VENDA:
1. Localização: [descrever vantagens da localização]
2. Acabamento: [descrever diferenciais de acabamento]
3. Valorização: [dados de valorização da região]

OBJEÇÕES COMUNS:
• "Muito caro" → Comparar com m² da região
• "Longe do centro" → Destacar infraestrutura do bairro
• "Não conheço a construtora" → Cases de sucesso anteriores

FECHAMENTO:
"Posso reservar a unidade [X] pra você? É a que tem a melhor vista e condição especial até [DATA]."`,
        },
        // Template de Proposta
        {
          titulo: "Template — Proposta comercial completa",
          categoria: "template_proposta",
          tags: ["proposta", "template", "comercial"],
          conteudo: `📊 PROPOSTA COMERCIAL — [EMPREENDIMENTO]

Cliente: [NOME]
Data: [DATA]
Corretor: [SEU NOME]

━━━━━━━━━━━━━━━━━━━━━
UNIDADE SELECIONADA
━━━━━━━━━━━━━━━━━━━━━
Unidade: [NÚMERO]
Andar: [ANDAR]
Área privativa: [X] m²
Vagas: [X]
Posição solar: [ORIENTAÇÃO]

━━━━━━━━━━━━━━━━━━━━━
CONDIÇÃO COMERCIAL
━━━━━━━━━━━━━━━━━━━━━
Valor total: R$ [VALOR]
Entrada: R$ [VALOR] ([X]%)
Saldo financiamento: R$ [VALOR]
Parcelas estimadas: R$ [VALOR]/mês

━━━━━━━━━━━━━━━━━━━━━
DIFERENCIAIS
━━━━━━━━━━━━━━━━━━━━━
✅ [DIFERENCIAL 1]
✅ [DIFERENCIAL 2]
✅ [DIFERENCIAL 3]

Validade da proposta: [X] dias
Próximo passo: [AÇÃO]`,
        },
      ];

      for (const item of seedItems) {
        const { error } = await supabase.from("marketplace_items").insert({
          titulo: item.titulo,
          conteudo: item.conteudo,
          categoria: item.categoria,
          tags: item.tags,
          autor_id: user!.id,
          autor_nome: autorNome,
          origem: "homi",
          status: "aprovado",
          aprovado_por: user!.id,
          aprovado_em: new Date().toISOString(),
        });
        if (error) console.error("Seed error:", error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-my-items"] });
      toast.success("🚀 11 scripts profissionais carregados no Marketplace!");
    },
    onError: (e: any) => toast.error("Erro ao carregar scripts: " + e.message),
  });

  // Stats for manager dashboard
  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalUsos = items.reduce((s, i) => s + (i.total_usos || 0), 0);
    const avgRating = items.length > 0
      ? (items.reduce((s, i) => s + Number(i.media_avaliacao || 0), 0) / items.length).toFixed(1)
      : "0";
    const topUsed = [...items].sort((a, b) => (b.total_usos || 0) - (a.total_usos || 0)).slice(0, 5);
    const topRated = [...items].sort((a, b) => Number(b.media_avaliacao || 0) - Number(a.media_avaliacao || 0)).slice(0, 5);
    return { totalItems, totalUsos, avgRating, topUsed, topRated, pendingCount: pendingItems.length };
  }, [items, pendingItems]);

  return {
    items,
    pendingItems,
    myItems,
    isLoading,
    pendingLoading,
    submitItem,
    approveItem,
    rejectItem,
    useItem,
    rateItem,
    stats,
    seedMarketplace,
    isSeeding: seedMarketplace.isPending,
  };
}
