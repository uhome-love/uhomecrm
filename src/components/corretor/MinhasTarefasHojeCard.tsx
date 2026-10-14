import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMinhasTarefas, useSemProximoPasso, separarAbas, type TarefaItem } from "@/hooks/useMinhasTarefas";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import CriarTarefaModal from "@/components/pipeline/CriarTarefaModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Resumo das tarefas do corretor na Minha rotina: números + próximas 3 de hoje. */
export default function MinhasTarefasHojeCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const responsaveis = useMemo(() => (user ? [user.id] : []), [user]);
  const { data, isLoading } = useMinhasTarefas(responsaveis);
  const abas = useMemo(() => separarAbas(data?.pendentes ?? [], data?.concluidas ?? []), [data]);
  const semPasso = useSemProximoPasso(user?.id ?? null, data?.pendentes);
  const [concluindo, setConcluindo] = useState<TarefaItem | null>(null);
  const [criar, setCriar] = useState(false);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["minhas-tarefas-v2"] });
    qc.invalidateQueries({ queryKey: ["sem-proximo-passo"] });
  };
  const concluir = async (t: TarefaItem) => {
    if (t.lead) { setConcluindo(t); return; }
    const { error } = await supabase.from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: new Date().toISOString() } as never).eq("id", t.id);
    if (error) { toast.error("Não foi possível concluir."); return; }
    toast.success("Anotação concluída ✅");
    recarregar();
  };

  if (!user) return null;
  const agoraHM = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  const proximas = abas.hoje.slice(0, 3);
  const nums = [
    { n: abas.vencidas.length, l: "Vencidas", c: "bg-destructive/10 text-destructive" },
    { n: abas.hoje.length, l: "Hoje", c: "bg-primary/10 text-primary" },
    { n: semPasso.data?.length ?? 0, l: "Sem próximo passo", c: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="flex-1 text-sm font-semibold text-foreground">Minhas tarefas de hoje</h3>
        <button type="button" onClick={() => navigate("/tarefas")} className="text-[12px] font-semibold text-primary hover:underline">Ver todas →</button>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {nums.map((x) => (
          <button key={x.l} type="button" onClick={() => navigate("/tarefas")} className={cn("rounded-lg p-2 text-center", x.c)}>
            <div className="text-xl font-bold">{isLoading ? "–" : x.n}</div>
            <div className="text-[11px] leading-tight">{x.l}</div>
          </button>
        ))}
      </div>
      {!isLoading && proximas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-center text-[12px] text-muted-foreground">
          Nenhuma tarefa para hoje. Que tal criar o próximo passo de um cliente?
        </div>
      ) : (
        <div className="divide-y divide-border">
          {proximas.map((t) => {
            const hora = (t.hora_vencimento || "").slice(0, 5);
            const atrasada = !!hora && hora < agoraHM;
            return (
              <div key={t.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span className={cn("w-11 font-bold", atrasada ? "text-destructive" : "text-foreground")}>{hora || "--"}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {(t.titulo || "Tarefa").split(" — ")[0]}
                  {atrasada && <span className="ml-1.5 text-[10px] font-bold uppercase text-destructive">atrasada</span>}
                </span>
                <button type="button" onClick={() => concluir(t)} className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90">Concluir</button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" onClick={() => setCriar(true)} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12px] font-semibold text-foreground hover:bg-muted">
        <Plus className="h-3.5 w-3.5" /> Nova tarefa
      </button>

      <RegistrarAtividadeModal
        lead={concluindo?.lead ? { id: concluindo.lead.id, nome: concluindo.lead.nome } : null}
        concluirTarefaId={concluindo?.id ?? null}
        subtitulo={concluindo ? `concluir: ${(concluindo.titulo || "").split(" — ")[0]} · vai para o histórico do lead` : undefined}
        onClose={() => setConcluindo(null)}
        onSaved={recarregar}
      />
      <CriarTarefaModal open={criar} lead={null} permitirNota onClose={() => setCriar(false)} onSaved={recarregar} />
    </div>
  );
}
