import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useMinhasTarefas, useSemProximoPasso, useCorretoresEquipe, separarAbas,
  type AbaTarefa, type TarefaItem,
} from "@/hooks/useMinhasTarefas";
import { usePipelineMeta, useEstagnadoLeadDrawer } from "@/hooks/useEstagnadoLeadDrawer";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import CriarTarefaModal from "@/components/pipeline/CriarTarefaModal";
import TarefaRow from "@/components/tarefas/TarefaRow";
import SemProximoPasso from "@/components/tarefas/SemProximoPasso";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ABAS: { key: AbaTarefa; label: string; tom: string }[] = [
  { key: "vencidas", label: "Vencidas", tom: "text-destructive" },
  { key: "hoje", label: "Hoje", tom: "" },
  { key: "proximas", label: "Próximas", tom: "" },
  { key: "novas", label: "Novas", tom: "" },
  { key: "concluidas", label: "Concluídas", tom: "" },
];

export default function TarefasCorretor() {
  const { user } = useAuth();
  const { isGestor, isAdmin, isDiretor } = useUserRole();
  const isGestao = isGestor || isAdmin || isDiretor;
  const qc = useQueryClient();

  // Gestão pode olhar a equipe (só leitura). "me" = as próprias tarefas.
  const [visao, setVisao] = useState<string>("me");
  const equipe = useCorretoresEquipe(user?.id ?? null, isGestao, isAdmin || isDiretor);
  const nomes = useMemo(() => Object.fromEntries((equipe.data ?? []).map((c) => [c.id, c.nome])), [equipe.data]);
  const responsaveis = useMemo(() => {
    if (!user) return [];
    if (visao === "me") return [user.id];
    if (visao === "time") return (equipe.data ?? []).map((c) => c.id);
    return [visao];
  }, [visao, user, equipe.data]);
  const somenteLeitura = visao !== "me";

  const { data, isLoading } = useMinhasTarefas(responsaveis);
  const abas = useMemo(() => separarAbas(data?.pendentes ?? [], data?.concluidas ?? []), [data]);
  const semPasso = useSemProximoPasso(visao === "me" ? user?.id ?? null : null, data?.pendentes);

  const [aba, setAba] = useState<AbaTarefa>(() => "hoje");
  const [semPassoAba, setSemPassoAba] = useState(false);
  useEffect(() => { if (visao !== "me") setSemPassoAba(false); }, [visao]);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = abas[aba];
    return q ? base.filter((t) => `${t.lead?.nome ?? ""} ${t.titulo}`.toLowerCase().includes(q)) : base;
  }, [abas, aba, busca]);

  const meta = usePipelineMeta();
  const drawer = useEstagnadoLeadDrawer();
  const [concluindo, setConcluindo] = useState<TarefaItem | null>(null);
  const [criar, setCriar] = useState<{ open: boolean; lead: { id: string; nome: string } | null }>({ open: false, lead: null });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["minhas-tarefas-v2"] });
    qc.invalidateQueries({ queryKey: ["sem-proximo-passo"] });
  };

  const concluir = async (t: TarefaItem) => {
    if (t.lead) { setConcluindo(t); return; }
    // Anotação pessoal (sem cliente): só marca como feita.
    const { error } = await supabase.from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: new Date().toISOString() } as never).eq("id", t.id);
    if (error) { toast.error("Não foi possível concluir."); return; }
    toast.success("Anotação concluída ✅");
    recarregar();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Tarefas</h1>
          <p className="text-[13px] text-muted-foreground">Organize seus próximos passos com cada cliente</p>
        </div>
        {isGestao && (
          <select value={visao} onChange={(e) => setVisao(e.target.value)} className="rounded-lg border border-border bg-card px-2.5 py-2 text-[13px]">
            <option value="me">Minhas tarefas</option>
            <option value="time">Todo o time (só ver)</option>
            {(equipe.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {!somenteLeitura && (
          <button type="button" onClick={() => setCriar({ open: true, lead: null })} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Nova tarefa
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => {
          const n = abas[a.key].length;
          const on = !semPassoAba && aba === a.key;
          const btn = (
            <button key={a.key} type="button" onClick={() => { setSemPassoAba(false); setAba(a.key); }} className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
              on ? "bg-primary text-primary-foreground" : cn("bg-muted hover:bg-muted/70", n > 0 && a.tom),
            )}>
              {a.label} {a.key !== "concluidas" || n > 0 ? n : ""}
            </button>
          );
          if (a.key !== "concluidas" || visao !== "me") return btn;
          const nSem = semPasso.data?.length ?? 0;
          return [
            <button key="sem_passo" type="button" onClick={() => setSemPassoAba(true)} className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
              semPassoAba ? "bg-primary text-primary-foreground" : cn("bg-muted hover:bg-muted/70", nSem > 0 && "text-warning"),
            )}>
              Sem próximo passo {nSem}
            </button>,
            btn,
          ];
        })}
      </div>

      {!semPassoAba && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou tarefa..." className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-[13px]" />
        </div>
      )}

      {semPassoAba && visao === "me" ? (
        semPasso.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <SemProximoPasso leads={semPasso.data ?? []} onAbrir={drawer.openLead} onCriar={(lead) => setCriar({ open: true, lead })} />
        )
      ) : isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
          {aba === "concluidas" ? "Nenhuma tarefa concluída nos últimos 7 dias." : "Nenhuma tarefa aqui."}
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((t) => (
            <TarefaRow key={t.id} t={t} somenteLeitura={somenteLeitura}
              corretorNome={visao === "time" && t.responsavel_id ? nomes[t.responsavel_id] : undefined}
              onAbrir={drawer.openLead} onConcluir={concluir} />
          ))}
        </div>
      )}

      <RegistrarAtividadeModal
        lead={concluindo?.lead ? { id: concluindo.lead.id, nome: concluindo.lead.nome } : null}
        concluirTarefaId={concluindo?.id ?? null}
        subtitulo={concluindo ? `concluir: ${(concluindo.titulo || "").split(" — ")[0]} · vai para o histórico do lead` : undefined}
        onClose={() => setConcluindo(null)}
        onSaved={recarregar}
      />

      <CriarTarefaModal open={criar.open} lead={criar.lead} permitirNota={!criar.lead}
        onClose={() => setCriar({ open: false, lead: null })} onSaved={recarregar} />

      {drawer.loadingLead && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      {drawer.lead && (
        <PipelineLeadDetail lead={drawer.lead} stages={meta.stages} segmentos={meta.segmentos} open={drawer.open}
          onOpenChange={(o) => { if (!o) { drawer.close(); recarregar(); } }}
          onUpdate={drawer.onUpdate} onMove={drawer.onMove} onDelete={drawer.onDelete} />
      )}
    </div>
  );
}
