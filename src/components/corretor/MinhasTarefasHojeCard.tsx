import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMinhasTarefas, useSemProximoPasso, separarAbas, type TarefaItem } from "@/hooks/useMinhasTarefas";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Faixa compacta de Tarefas dentro do quadro "Sua fila de hoje" (Minha rotina). */
export default function MinhasTarefasHojeCard() {
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
    toast.success("Anotação concluída ✅");
    recarregar();
  };

  if (!user) return null;
  const agoraHM = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  const proxima = abas.hoje[0];
  const hora = (proxima?.hora_vencimento || "").slice(0, 5);
  const atrasada = !!hora && hora < agoraHM;
  const ir = () => navigate("/tarefas");
  const tags = [
    { n: abas.vencidas.length, l: "vencidas", c: "bg-destructive/10 text-destructive" },
    { n: abas.hoje.length, l: "hoje", c: "bg-primary/10 text-primary" },
    { n: semPasso.data?.length ?? 0, l: "sem passo", c: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center">
        <span className="flex-1 text-[12.5px] font-bold text-foreground">Tarefas</span>
        <button type="button" onClick={ir} className="text-[11px] font-semibold text-primary hover:underline">Ver todas →</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((x) => (
          <button key={x.l} type="button" onClick={ir} className={cn("rounded-md px-2 py-1 text-[11px]", x.c)}>
            <b>{isLoading ? "–" : x.n}</b> {x.l}
          </button>
        ))}
      </div>
      {proxima && (
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <b className={atrasada ? "text-destructive" : "text-foreground"}>{hora || "--"}</b>
          <span className="min-w-0 flex-1 truncate text-foreground">{(proxima.titulo || "Tarefa").split(" — ")[0]}</span>
          <button type="button" onClick={() => concluir(proxima)} className="text-[11px] font-semibold text-primary hover:underline">Concluir</button>
        </div>
      )}
      <RegistrarAtividadeModal
        lead={concluindo?.lead ? { id: concluindo.lead.id, nome: concluindo.lead.nome } : null}
        concluirTarefaId={concluindo?.id ?? null}
        subtitulo={concluindo ? `concluir: ${(concluindo.titulo || "").split(" — ")[0]} · vai para o histórico do lead` : undefined}
        onClose={() => setConcluindo(null)}
        onSaved={recarregar}
      />
    </div>
  );
}
