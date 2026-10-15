import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMinhasTarefas, separarAbas, type TarefaItem } from "@/hooks/useMinhasTarefas";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { acaoDaTarefa } from "@/lib/tarefaAcao";
import { Button } from "@/components/ui/button";

export default function MeuFocoHoje() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const responsaveis = useMemo(() => (user ? [user.id] : []), [user]);
  const { data, isLoading } = useMinhasTarefas(responsaveis);
  const abas = useMemo(() => separarAbas(data?.pendentes ?? [], data?.concluidas ?? []), [data]);
  const { data: perf } = useRoletaPerformanceStatus();
  const [concluindo, setConcluindo] = useState<TarefaItem | null>(null);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["minhas-tarefas-v2"] });
    qc.invalidateQueries({ queryKey: ["sem-proximo-passo"] });
  };
  const concluir = async (t: TarefaItem) => {
    if (t.lead) { setConcluindo(t); return; }
    const { error } = await supabase.from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: new Date().toISOString() } as never).eq("id", t.id);
    if (error) { toast.error("Não foi possível concluir."); return; }
    toast.success("Tarefa concluída ✅");
    recarregar();
  };

  if (!user) return null;
  const agoraHM = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  const proximas = abas.hoje.slice(0, 3);
  const aAtualizar = perf?.crm.a_atualizar ?? 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Meu foco de hoje</h2>
      {aAtualizar > 0 && (
        <button type="button" onClick={() => navigate("/pipeline-leads?filtro=atrasado")}
          className="mt-2 block text-left text-sm text-foreground hover:text-primary">
          🔄 Atualizar {aAtualizar} cliente{aAtualizar === 1 ? "" : "s"} parado{aAtualizar === 1 ? "" : "s"} para manter a saúde do CRM
        </button>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tarefas de hoje · {isLoading ? "–" : `${proximas.length} de ${abas.hoje.length}`}
        </p>
        {!isLoading && proximas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje.</p>
        )}
        <div className="space-y-1.5">
          {proximas.map((t) => {
            const hora = (t.hora_vencimento || "").slice(0, 5);
            const atrasada = !!hora && hora < agoraHM;
            return (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <b className={atrasada ? "text-destructive" : "text-foreground"}>{hora || "--:--"}</b>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-foreground">{t.lead ? t.lead.nome : (t.titulo || "Tarefa").split(" — ")[0]}</span>
                  {t.lead && <span className="text-muted-foreground"> — {acaoDaTarefa(t.tipo, t.titulo, t.lead.nome)}</span>}
                </span>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => concluir(t)}>Concluir</Button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs">
          {abas.vencidas.length > 0 && <span className="font-semibold text-warning">{abas.vencidas.length} vencida{abas.vencidas.length === 1 ? "" : "s"} · </span>}
          <button type="button" onClick={() => navigate("/tarefas")} className="font-semibold text-primary hover:underline">Ver todas as tarefas →</button>
        </p>
      </div>

      <RegistrarAtividadeModal
        lead={concluindo?.lead ? { id: concluindo.lead.id, nome: concluindo.lead.nome } : null}
        concluirTarefaId={concluindo?.id ?? null}
        subtitulo={concluindo ? `concluir: ${(concluindo.titulo || "").split(" — ")[0]} · vai para o histórico do lead` : undefined}
        onClose={() => setConcluindo(null)}
        onSaved={recarregar}
      />
    </section>
  );
}
