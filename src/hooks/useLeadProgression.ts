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
      fase_destino: "visita_marcada",
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
   * GATILHO 2: Visita realizada → create negócio
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

    // Create negócio
    const { data: negocio, error } = await supabase
      .from("negocios")
      .insert({
        lead_id: params.pipelineLeadId,
        visita_id: params.visitaId,
        corretor_id: params.corretorId,
        gerente_id: params.gerenteId,
        nome_cliente: params.nomeCliente,
        empreendimento: params.empreendimento || null,
        telefone: params.telefone || null,
        fase: "proposta",
        origem: "visita_realizada",
        pipeline_lead_id: params.pipelineLeadId,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error creating negocio:", error);
      toast.error("Erro ao criar negócio");
      return;
    }

    // Update pipeline_leads
    await supabase
      .from("pipeline_leads")
      .update({
        modulo_atual: "negocios",
        negocio_id: negocio.id,
        ultima_acao_at: new Date().toISOString(),
      } as any)
      .eq("id", params.pipelineLeadId);

    // Register progression
    await supabase.from("lead_progressao").insert({
      lead_id: params.pipelineLeadId,
      modulo_origem: "agenda",
      modulo_destino: "negocios",
      fase_destino: "proposta",
      triggered_by: "visita_realizada",
      corretor_id: params.corretorId,
      visita_id: params.visitaId,
      negocio_id: negocio.id,
    });

    toast("🎉 Visita realizada! Negócio criado!", {
      description: "🎯 Envie a proposta em até 24h — leads que recebem proposta rápida convertem 3x mais!",
      duration: 5000,
    });

    return negocio;
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
    empreendimento?: string;
    corretorId: string;
    vgvFinal?: number;
  }) => {
    if (!user) return;

    // Create pos_vendas entry
    await supabase.from("pos_vendas").insert({
      negocio_id: params.negocioId,
      lead_id: params.pipelineLeadId || null,
      corretor_id: params.corretorId,
      nome_cliente: params.nomeCliente,
      empreendimento: params.empreendimento || null,
      data_assinatura: new Date().toISOString().split("T")[0],
      vgv_final: params.vgvFinal || null,
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
