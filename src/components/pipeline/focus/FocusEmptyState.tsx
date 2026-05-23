/**
 * FocusEmptyState — tela rica "Você zerou a fila" do Modo Foco (R4).
 *
 * Aparece em 2 casos:
 *   1. Filtro retornou 0 leads (configurou e iniciou, fila vazia)
 *   2. Corretor concluiu o último lead da sessão (workedCount > 0)
 *
 * Variação serena: quando os 3 buckets de sugestão também estão zerados,
 * substitui o bloco de sugestões pela mensagem celebratória + botão fechar.
 *
 * Telemetria: focus_empty_state_shown no mount, focus_suggestion_clicked no click.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Filter, Flame, Clock, AlertTriangle } from "lucide-react";
import { useFocusSuggestions } from "@/hooks/useFocusSuggestions";
import FocusSuggestionCard from "./FocusSuggestionCard";
import { logFocus } from "@/lib/focusTelemetry";

interface FocusEmptyStateProps {
  corretorAuthId: string | null;
  sessionId: string | null;
  workedCount: number;
  onOpenSuggestion: (
    category: "visita_sem_followup" | "vence_2d" | "sem_tarefa",
    leadIds: string[]
  ) => void;
  onBackToConfig: () => void;
  onClose: () => void;
}

export default function FocusEmptyState({
  corretorAuthId,
  sessionId,
  workedCount,
  onOpenSuggestion,
  onBackToConfig,
  onClose,
}: FocusEmptyStateProps) {
  const { buckets, loading } = useFocusSuggestions(corretorAuthId, true);

  const allEmpty =
    !loading &&
    buckets.visitaSemFollowup.length === 0 &&
    buckets.vence2d.length === 0 &&
    buckets.semTarefa.length === 0;

  useEffect(() => {
    if (loading) return;
    logFocus("focus_empty_state_shown", {
      session_id: sessionId,
      worked_count: workedCount,
      all_empty: allEmpty,
      visita_sem_followup_count: buckets.visitaSemFollowup.length,
      vence_2d_count: buckets.vence2d.length,
      sem_tarefa_count: buckets.semTarefa.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleClick = (
    category: "visita_sem_followup" | "vence_2d" | "sem_tarefa",
    leadIds: string[]
  ) => {
    if (leadIds.length === 0) return;
    logFocus("focus_suggestion_clicked", {
      session_id: sessionId,
      category,
      lead_count: leadIds.length,
    });
    onOpenSuggestion(category, leadIds);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-hidden">
      <div className="w-full max-w-xl flex flex-col gap-6">
        {/* Header celebratório */}
        <div className="text-center">
          <div className="text-5xl mb-2">🎯</div>
          <h2
            className="text-white text-3xl sm:text-4xl font-semibold tracking-tight"
            style={{ fontFamily: "'Fraunces', 'Plus Jakarta Sans', serif" }}
          >
            Você zerou a fila.
          </h2>
          {workedCount > 0 && (
            <p className="text-gray-400 text-sm mt-2">
              {workedCount} {workedCount === 1 ? "lead trabalhado" : "leads trabalhados"} nesta sessão.
            </p>
          )}
        </div>

        {/* Sugestões ou variação serena */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] rounded-2xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))}
          </div>
        ) : allEmpty ? (
          <div className="text-center py-6">
            <p
              className="text-white text-lg font-medium"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Você zerou tudo. Hora de respirar.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Sua carteira está em dia. Aproveite o momento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <FocusSuggestionCard
              icon={Flame}
              iconColor="#EC4899"
              iconBg="rgba(236,72,153,0.12)"
              title="Visita ou pós-visita sem follow-up"
              description="Esses leads estão esfriando. Retome agora."
              count={buckets.visitaSemFollowup.length}
              onClick={() => handleClick("visita_sem_followup", buckets.visitaSemFollowup)}
            />
            <FocusSuggestionCard
              icon={Clock}
              iconColor="#818CF8"
              iconBg="rgba(129,140,248,0.12)"
              title="Próximos 1-2 dias"
              description="Adiante o que vence amanhã ou depois."
              count={buckets.vence2d.length}
              onClick={() => handleClick("vence_2d", buckets.vence2d)}
            />
            <FocusSuggestionCard
              icon={AlertTriangle}
              iconColor="#F59E0B"
              iconBg="rgba(245,158,11,0.12)"
              title="Leads sem tarefa"
              description="Organize sua carteira. Defina o próximo passo desses leads."
              count={buckets.semTarefa.length}
              onClick={() => handleClick("sem_tarefa", buckets.semTarefa)}
            />
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onBackToConfig}
            className="text-gray-300 hover:text-white hover:bg-white/5 gap-2"
          >
            <Filter className="w-4 h-4" /> Voltar para configuração
          </Button>
          <Button
            onClick={onClose}
            style={{ background: allEmpty ? "#4969FF" : "rgba(255,255,255,0.08)", color: "#fff" }}
            className="hover:opacity-90"
          >
            Sair do Modo Foco
          </Button>
        </div>
      </div>
    </div>
  );
}
