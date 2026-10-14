import { supabase } from "@/integrations/supabase/client";
import type { Visita, VisitaStatus } from "@/hooks/useVisitas";
import { RESULTADO_LABELS, type ResultadoVisita } from "@/components/visitas/VisitaResultadoDialog";
import { routeLeadAfterVisita } from "@/lib/visitaResultadoRouting";

export interface FeedbackExtra {
  objecao?: string;
  temperatura?: string;
  proxima_acao?: string;
}

interface Deps {
  updateVisita: (id: string, updates: Partial<Visita>, silent?: boolean) => Promise<unknown>;
  updateStatus: (id: string, status: VisitaStatus, feedback?: string, userId?: string) => Promise<unknown>;
  userId?: string;
}

const TEMPERATURA_LABEL: Record<string, string> = {
  muito_quente: "🔥 Muito quente", quente: "⚡ Quente", morno: "🌡️ Morno", frio: "🧊 Frio",
};

/** Fluxo único de registro do resultado da visita (agenda + bloqueio de visita pendente). */
export async function registrarResultadoVisita(
  visita: Visita,
  resultado: ResultadoVisita,
  observacoes: string | undefined,
  feedback: FeedbackExtra | undefined,
  { updateVisita, updateStatus, userId }: Deps,
) {
  const updates: Partial<Visita> = { resultado_visita: resultado } as Partial<Visita>;
  if (observacoes) {
    updates.observacoes = [visita.observacoes, observacoes].filter(Boolean).join(" | ");
  }
  await updateVisita(visita.id, updates, true);

  const statusVisita: VisitaStatus =
    resultado === "nao_compareceu" ? "no_show" : resultado === "reagendar" ? "marcada" : "realizada";
  const feedbackHist = [
    `Resultado: ${RESULTADO_LABELS[resultado] || resultado}`,
    feedback?.temperatura ? `Temperatura: ${TEMPERATURA_LABEL[feedback.temperatura] || feedback.temperatura}` : null,
    feedback?.objecao ? `Objeção: ${feedback.objecao}` : null,
    observacoes || null,
  ].filter(Boolean).join(" · ");
  await updateStatus(visita.id, statusVisita, feedbackHist, userId);

  if (!visita.pipeline_lead_id) return;
  await routeLeadAfterVisita({
    pipelineLeadId: visita.pipeline_lead_id,
    resultado,
    userId: userId || visita.corretor_id,
    corretorId: visita.corretor_id,
    gerenteId: visita.gerente_id,
    nome: visita.nome_cliente,
    empreendimento: visita.empreendimento,
    telefone: visita.telefone,
    observacoes: feedback?.objecao || observacoes,
  });

  if (feedback) {
    const leadUpdates: Record<string, string> = {};
    if (feedback.temperatura) leadUpdates.temperatura = feedback.temperatura;
    if (feedback.proxima_acao) leadUpdates.proxima_acao = feedback.proxima_acao;
    if (feedback.objecao) {
      leadUpdates.observacoes = [visita.observacoes, `Objeção: ${feedback.objecao}`].filter(Boolean).join(" | ");
    }
    if (Object.keys(leadUpdates).length > 0) {
      await supabase.from("pipeline_leads").update({
        ...leadUpdates,
        ultima_acao_at: new Date().toISOString(),
      }).eq("id", visita.pipeline_lead_id);
    }
  }
}
