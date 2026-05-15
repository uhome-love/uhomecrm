import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Hook providing automatic lead progression between modules:
 * Pipeline → Agenda → Negócios → Pós-Vendas
 */
export function useLeadProgression() {
  const { user } = useAuth();

  /**
   * GATILHO 1: Agendar visita → move lead to "agenda" module
   */
  const onVisitaAgendada = useCallback(async (pipelineLeadId: string, visitaId?: string) => {
    if (!user) return;

    // Update pipeline_leads module
    await supabase
      .from("pipeline_leads")
      .update({
        modulo_atual: "agenda",
        ultima_acao_at: new Date().toISOString(),
      } as any)
      .eq("id", pipelineLeadId);

    // Register progression
    await supabase.from("lead_progressao").insert({
      lead_id: pipelineLeadId,
      modulo_origem: "pipeline",
      modulo_destino: "agenda",
      fase_destino: "visita",
      triggered_by: "agendar_visita",
      corretor_id: user.id,
      visita_id: visitaId || null,
    });

    toast("📅 Visita criada na agenda automaticamente!", {
      description: "Confirme a visita 24h antes pelo WhatsApp!",
      duration: 4000,
    });
  }, [user]);

  /**
   * GATILHO 2: Visita realizada → registra atividade (NÃO cria negócio)
   * Negócio só é criado ao mover para etapa "Negócio Criado" no pipeline.
   */
  const onVisitaRealizada = useCallback(async (params: {
    pipelineLeadId: string;
    visitaId: string;
    nomeCliente: string;
    empreendimento?: string;
    corretorId: string;
    gerenteId: string;
    telefone?: string;
  }) => {
    if (!user) return;

    // Update pipeline_leads — move to "em_evolucao" stage, NOT negocios
    await supabase
      .from("pipeline_leads")
      .update({
        modulo_atual: "agenda",
        ultima_acao_at: new Date().toISOString(),
      } as any)
      .eq("id", params.pipelineLeadId);

    // Register progression
    await supabase.from("lead_progressao").insert({
      lead_id: params.pipelineLeadId,
      modulo_origem: "agenda",
      modulo_destino: "agenda",
      fase_destino: "pos_visita",
      triggered_by: "visita_realizada",
      corretor_id: params.corretorId,
      visita_id: params.visitaId,
    });

    toast("🎉 Visita realizada!", {
      description: "Lead avançou para Em Evolução. Crie o negócio quando estiver pronto!",
      duration: 5000,
    });
  }, [user]);

  /**
   * GATILHO 3: Visita reagendada
   */
  const onVisitaReagendada = useCallback(async (pipelineLeadId: string) => {
    if (!user) return;

    await supabase
      .from("pipeline_leads")
      .update({
        modulo_atual: "agenda",
        ultima_acao_at: new Date().toISOString(),
      } as any)
      .eq("id", pipelineLeadId);

    toast("🔄 Visita reagendada! Nova data na agenda.", { duration: 3000 });
  }, [user]);

  /**
   * GATILHO 4: No Show / Cancelada → return to pipeline
   */
  const onVisitaNoShow = useCallback(async (pipelineLeadId: string, tipo: "no_show" | "cancelada") => {
    if (!user) return;

    await supabase
      .from("pipeline_leads")
      .update({
        modulo_atual: "pipeline",
        ultima_acao_at: new Date().toISOString(),
      } as any)
      .eq("id", pipelineLeadId);

    await supabase.from("lead_progressao").insert({
      lead_id: pipelineLeadId,
      modulo_origem: "agenda",
      modulo_destino: "pipeline",
      fase_destino: "qualificacao",
      triggered_by: tipo,
      corretor_id: user.id,
    });

    if (tipo === "no_show") {
      toast("😤 No-show registrado.", {
        description: "💡 Aguarde 1 dia e envie: 'Tudo bem? Podemos remarcar?'",
        duration: 5000,
      });
    } else {
      toast("❌ Visita cancelada.", {
        description: "O lead voltou para o Pipeline de qualificação.",
        duration: 4000,
      });
    }
  }, [user]);

  /**
   * GATILHO 5: Negócio assinado → Pós-Vendas
   */
  const onNegocioAssinado = useCallback(async (params: {
    negocioId: string;
    pipelineLeadId?: string;
    nomeCliente: string;
    telefone?: string;
    email?: string;
    empreendimento?: string;
    corretorId: string;
    vgvFinal?: number;
    dataAssinatura?: string;
  }) => {
    if (!user) return;

    const dataAss = params.dataAssinatura || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // Create pos_vendas entry
    await supabase.from("pos_vendas").insert({
      negocio_id: params.negocioId,
      lead_id: params.pipelineLeadId || null,
      corretor_id: params.corretorId,
      nome_cliente: params.nomeCliente,
      empreendimento: params.empreendimento || null,
      data_assinatura: dataAss,
      vgv_final: params.vgvFinal || null,
    } as any);

    // Create pipeline_lead in pos_vendas Boas-vindas stage
    const BOAS_VINDAS_STAGE_ID = "6634d176-d596-461b-b854-ad43182f4696";
    await supabase.from("pipeline_leads").insert({
      nome: params.nomeCliente,
      telefone: params.telefone || null,
      email: params.email || null,
      empreendimento: params.empreendimento || null,
      stage_id: BOAS_VINDAS_STAGE_ID,
      corretor_id: params.corretorId,
      temperatura: "quente",
      aceite_status: "aceito",
      modulo_atual: "pos_vendas",
      negocio_id: params.negocioId,
      origem: "venda",
      observacoes: `Venda assinada — VGV: R$ ${(params.vgvFinal || 0).toLocaleString("pt-BR")}`,
      created_by: user!.id,
    } as any);

    // Update pipeline_leads if exists
    if (params.pipelineLeadId) {
      await supabase
        .from("pipeline_leads")
        .update({
          modulo_atual: "pos_vendas",
          ultima_acao_at: new Date().toISOString(),
        } as any)
        .eq("id", params.pipelineLeadId);

      await supabase.from("lead_progressao").insert({
        lead_id: params.pipelineLeadId,
        modulo_origem: "negocios",
        modulo_destino: "pos_vendas",
        triggered_by: "negocio_assinado",
        corretor_id: params.corretorId,
        negocio_id: params.negocioId,
      });
    }

    // Celebration!
    toast("🏆 VENDA FECHADA! Parabéns!", {
      description: `${params.nomeCliente} — ${params.empreendimento || "Negócio"} assinado!`,
      duration: 6000,
    });
  }, [user]);

  /**
   * Get HOMI suggestion based on progression event
   */
  const getSugestaoHomi = useCallback((evento: string): string => {
    const sugestoes: Record<string, string> = {
      visita_agendada: "📅 Confirme a visita 24h antes pelo WhatsApp!",
      visita_realizada: "🎯 Envie a proposta em até 24h — leads que recebem proposta rápida convertem 3x mais!",
      no_show: "💡 Aguarde 1 dia e envie: 'Tudo bem? Podemos remarcar?'",
      negocio_criado: "📋 Complete o VGV estimado no negócio para o gerente acompanhar!",
      proposta_enviada: "⏰ Faça follow-up em 48h se não houver resposta.",
    };
    return sugestoes[evento] || "";
  }, []);

  return {
    onVisitaAgendada,
    onVisitaRealizada,
    onVisitaReagendada,
    onVisitaNoShow,
    onNegocioAssinado,
    getSugestaoHomi,
  };
}
