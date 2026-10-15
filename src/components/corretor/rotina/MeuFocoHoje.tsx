import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMinhasTarefas, useSemProximoPasso, separarAbas, type TarefaItem } from "@/hooks/useMinhasTarefas";
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
  const semPasso = useSemProximoPasso(user?.id ?? null, data?.pendentes);
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

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Meu foco de hoje</h2>
      <div className="mt-3">
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { n: abas.vencidas.length, l: "vencidas", c: "bg-destructive/10 text-destructive" },
            { n: abas.hoje.length, l: "hoje", c: "bg-primary/10 text-primary" },
            { n: semPasso.data?.length ?? 0, l: "sem passo", c: "bg-warning/10 text-warning" },
          ].map((x) => (
            <button key={x.l} type="button" onClick={() => navigate("/tarefas")} className={`rounded-md px-2 py-1 ${x.c}`}>
              <b>{isLoading ? "–" : x.n}</b> {x.l}
            </button>
          ))}
          <button type="button" onClick={() => navigate("/tarefas")} className="ml-auto font-semibold text-primary hover:underline">Ver todas →</button>
        </div>
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
