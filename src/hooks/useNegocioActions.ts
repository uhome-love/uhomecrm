import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLeadProgression } from "@/hooks/useLeadProgression";
import { toast } from "sonner";
import { type Negocio, NEGOCIOS_FASES, NEGOCIO_FASE_PERDIDO } from "@/hooks/useNegocios";
import { type TransitionData } from "@/components/pipeline/FaseTransitionModal";
import { applyNegocioQueda, type QuedaDestino } from "@/lib/negocioQueda";

// Fases que abrem o popup de transição (coleta de dados) antes de mover
const PHASES_WITH_POPUP = ["proposta", "negociacao", "documentacao", "vendido", "perdido"];

export interface CelebrationData {
  nomeCliente: string;
  empreendimento?: string;
  vgv: number;
  corretorNome?: string;
}

export interface TransitionTarget {
  negocioId: string;
  fase: string;
}

/**
 * Encapsula a gestão de fases de UM negócio (fora do board de MeusNegocios):
 * mover fase, popup de transição, celebração de venda e atualização.
 * Usado no drawer do lead (aba Negócio) — regra "Tudo no Lead".
 *
 * @param reload callback opcional chamado após mudanças persistidas
 */
export function useNegocioActions(reload?: () => void | Promise<void>) {
  const { user } = useAuth();
  const { onNegocioAssinado } = useLeadProgression();

  const [transitionTarget, setTransitionTarget] = useState<TransitionTarget | null>(null);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  const moveFase = useCallback(
    async (negocio: Negocio, novaFase: string, dataAssinatura?: string) => {
      if (negocio.fase === novaFase) return;

      const updatePayload: Record<string, any> = {
        fase: novaFase,
        updated_at: new Date().toISOString(),
      };
      if (novaFase === "vendido") {
        updatePayload.data_assinatura =
          dataAssinatura ||
          new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      }
      if (novaFase === NEGOCIO_FASE_PERDIDO) {
        updatePayload.status = "perdido";
      }

      const { error } = await supabase
        .from("negocios")
        .update(updatePayload as any)
        .eq("id", negocio.id);

      if (error) {
        console.error("Error moving negocio:", error);
        toast.error("Erro ao mover negócio");
        return;
      }

      const faseInfo = NEGOCIOS_FASES.find((f) => f.key === novaFase);
      toast(`${faseInfo?.icon || "📍"} ${negocio.nome_cliente} → ${faseInfo?.label || novaFase}`, {
        duration: 3000,
      });

      if (novaFase === "vendido") {
        await onNegocioAssinado({
          negocioId: negocio.id,
          pipelineLeadId: negocio.pipeline_lead_id || negocio.lead_id || undefined,
          nomeCliente: negocio.nome_cliente,
          telefone: negocio.telefone || undefined,
          empreendimento: negocio.empreendimento || undefined,
          corretorId: negocio.corretor_id || user?.id || "",
          vgvFinal: negocio.vgv_final || negocio.vgv_estimado || undefined,
          dataAssinatura,
        });
        setCelebrationData({
          nomeCliente: negocio.nome_cliente,
          empreendimento: negocio.empreendimento || undefined,
          vgv: negocio.vgv_final || negocio.vgv_estimado || 0,
        });
      }

      await reload?.();
    },
    [onNegocioAssinado, user, reload]
  );

  // Ponto de entrada — abre popup quando a fase exige dados, senão move direto
  const requestMoveFase = useCallback((negocio: Negocio, novaFase: string) => {
    if (negocio.fase === novaFase) return;
    if (PHASES_WITH_POPUP.includes(novaFase)) {
      setTransitionTarget({ negocioId: negocio.id, fase: novaFase });
    } else {
      moveFase(negocio, novaFase);
    }
  }, [moveFase]);

  const handleTransitionConfirm = useCallback(
    async (negocio: Negocio, data: TransitionData) => {
      if (!user) return;

      // Log da atividade com todos os campos preenchidos
      const descParts: string[] = [];
      Object.entries(data.fields).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) descParts.push(`${k}: ${v}`);
      });
      await supabase.from("negocios_atividades").insert({
        negocio_id: negocio.id,
        tipo: `transicao_${data.fase}`,
        titulo: `Movido para ${data.fase}`,
        descricao: descParts.join(" | "),
        created_by: user.id,
      } as any);

      // Atualiza campos do negócio conforme a fase
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.fields.imovel) updates.empreendimento = data.fields.imovel;
      if (data.fields.empreendimento) updates.empreendimento = data.fields.empreendimento;
      if (data.fields.unidade) updates.unidade = data.fields.unidade;
      if (data.fase === "vendido") {
        // Ganho: VGV assinado alimenta vgv_final (fonte canônica de Vendas Realizadas / PDN)
        if (data.fields.vgv) updates.vgv_final = parseFloat(data.fields.vgv);
      } else {
        if (data.fields.vgv) updates.vgv_estimado = parseFloat(data.fields.vgv);
        if (data.fields.valor_proposta) updates.vgv_estimado = parseFloat(data.fields.valor_proposta);
      }
      if (data.fields.data_assinatura) updates.data_assinatura = data.fields.data_assinatura;
      if (Object.keys(updates).length > 1) {
        await supabase.from("negocios").update(updates as any).eq("id", negocio.id);
      }


      // Queda do negócio → tratar o lead conforme o destino escolhido
      if (data.fase === "perdido") {
        await applyNegocioQueda({
          negocioId: negocio.id,
          pipelineLeadId: negocio.pipeline_lead_id,
          motivo: data.fields.motivo || "",
          destino: (data.fields.destino as QuedaDestino) || "descarte",
          stageId: data.fields.stage_id,
        });
      }

      setTransitionTarget(null);
      await moveFase(negocio, data.fase, data.fields.data_assinatura || undefined);
    },
    [user, moveFase]
  );

  const updateNegocio = useCallback(
    async (id: string, updates: Partial<Negocio>) => {
      const { error } = await supabase
        .from("negocios")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar negócio");
        return;
      }
      await reload?.();
    },
    [reload]
  );

  return {
    transitionTarget,
    setTransitionTarget,
    celebrationData,
    setCelebrationData,
    requestMoveFase,
    handleTransitionConfirm,
    updateNegocio,
  };
}
