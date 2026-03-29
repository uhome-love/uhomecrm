// =============================================================================
// Componente: StatusElegibilidadeRoleta
// Exibe o card de status de elegibilidade do corretor para as roletas do dia.
// Agora usa o hook unificado useElegibilidadeRoleta (single source of truth).
// =============================================================================

import { useState } from "react";
import { useElegibilidadeRoleta } from "@/hooks/useElegibilidadeRoleta";
import { CheckCircle, XCircle, Moon, Clock, ChevronDown, ChevronUp, ListTodo, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getProximaRoleta(): { nome: string; horario: string; tipo: "manha" | "tarde" | "noturna" } {
  const agora = new Date();
  const hora = agora.getHours() * 60 + agora.getMinutes();

  if (hora < 9 * 60 + 30) return { nome: "Roleta Manhã", horario: "09:30", tipo: "manha" };
  if (hora < 13 * 60 + 30) return { nome: "Roleta Tarde", horario: "13:30", tipo: "tarde" };
  return { nome: "Roleta Noturna", horario: "18:30", tipo: "noturna" };
}

function getBarraProgresso(desatualizados: number, limite: number): number {
  return Math.min(100, (desatualizados / limite) * 100);
}

function getCorBarra(desatualizados: number, limite: number): string {
  const pct = desatualizados / limite;
  if (pct < 0.5) return "bg-green-500";
  if (pct < 0.8) return "bg-yellow-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function StatusElegibilidadeRoleta() {
  const { elegibilidade, carregando } = useElegibilidadeRoleta();
  const [expandido, setExpandido] = useState(false);
  const proximaRoleta = getProximaRoleta();

  if (carregando) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-2" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (!elegibilidade) return null;

  const elegívelProxima =
    proximaRoleta.tipo === "noturna"
      ? elegibilidade.pode_roleta_noturna
      : elegibilidade.pode_roleta_manha;

  const pctBarra = getBarraProgresso(elegibilidade.leads_desatualizados, elegibilidade.limite_bloqueio);
  const corBarra = getCorBarra(elegibilidade.leads_desatualizados, elegibilidade.limite_bloqueio);

  return (
    <div
      className={`rounded-xl border-2 bg-card shadow-sm transition-all ${
        elegívelProxima ? "border-green-500/30" : "border-destructive/30"
      }`}
    >
      {/* Cabeçalho */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {elegívelProxima ? (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                {proximaRoleta.tipo === "noturna" && (
                  <Moon className="w-4 h-4 text-primary" />
                )}
                <span className="font-semibold text-foreground text-sm">
                  {proximaRoleta.nome}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  até {proximaRoleta.horario}
                </span>
              </div>

              {elegívelProxima ? (
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                  ✅ Você está elegível para se credenciar
                </p>
              ) : (
                <p className="text-sm text-destructive mt-0.5">
                  🔒 Você está bloqueado — veja o que fazer abaixo
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setExpandido(!expandido)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-1"
          >
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-muted-foreground">Leads desatualizados</span>
            <span
              className={`text-xs font-semibold ${
                elegibilidade.leads_desatualizados > 10 ? "text-destructive" : "text-foreground"
              }`}
            >
              {elegibilidade.leads_desatualizados} / {elegibilidade.limite_bloqueio}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${corBarra}`}
              style={{ width: `${pctBarra}%` }}
            />
          </div>
          {!elegívelProxima && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-destructive">
                Você precisa atualizar pelo menos{" "}
                <strong>{elegibilidade.leads_desatualizados - 10} lead(s)</strong> para se desbloquear.
              </p>
              <button
                onClick={() => (window.location.href = "/pipeline?filtro=sem_tarefa")}
                className="w-full text-xs font-medium py-2 px-3 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <ListTodo className="w-3.5 h-3.5" />
                Ver leads sem tarefa
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {elegívelProxima && elegibilidade.faltam_para_bloquear <= 3 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              ⚠️ Atenção: faltam apenas {elegibilidade.faltam_para_bloquear} lead(s) para você ser bloqueado.
            </p>
          )}
        </div>

        {/* Regra noturna */}
        {proximaRoleta.tipo === "noturna" && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
              elegibilidade.tem_visita_hoje
                ? "bg-primary/10 text-primary"
                : "bg-orange-500/10 text-orange-700 dark:text-orange-400"
            }`}
          >
            <Moon className="w-3.5 h-3.5 flex-shrink-0" />
            {elegibilidade.tem_visita_hoje ? (
              <span>Visita registrada hoje — acesso à roleta noturna liberado</span>
            ) : (
              <span>
                Roleta noturna exige visita agendada ou realizada hoje. Registre uma visita no pipeline para participar.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandido: lista de leads */}
      {expandido && elegibilidade.leads_para_atualizar.length > 0 && (
        <div className="border-t border-border px-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">
            Leads que precisam de atenção
          </p>
          <div className="space-y-2">
            {elegibilidade.leads_para_atualizar.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground">{lead.stage}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      lead.dias_sem_tarefa > 14
                        ? "bg-destructive/10 text-destructive"
                        : lead.dias_sem_tarefa > 7
                        ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lead.dias_sem_tarefa}d sem tarefa
                  </span>
                </div>
              </div>
            ))}
          </div>

          {elegibilidade.leads_desatualizados > 10 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Mostrando 10 de {elegibilidade.leads_desatualizados} leads desatualizados
            </p>
          )}

          <button
            onClick={() => (window.location.href = "/pipeline?filtro=sem_tarefa")}
            className="mt-3 w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 transition-colors"
          >
            Ir para o pipeline e atualizar leads →
          </button>
        </div>
      )}

      {expandido && elegibilidade.leads_para_atualizar.length === 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-sm text-green-600 dark:text-green-400 text-center">
            🎉 Todos os seus leads estão com tarefas em dia!
          </p>
        </div>
      )}
    </div>
  );
}
