import { useState } from "react";
import { Plus, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { TarefaItem, AbaTarefa } from "@/hooks/useMinhasTarefas";
import TarefaCardMobile from "./TarefaCardMobile";

interface Props {
  abas: Record<AbaTarefa, TarefaItem[]>;
  isLoading: boolean;
  busca: string;
  setBusca: (v: string) => void;
  modo: "minhas" | "concluidas" | "sem_passo";
  setModo: (m: "minhas" | "concluidas" | "sem_passo") => void;
  nSemPasso: number;
  mostrarSemPasso: boolean;
  semPassoNode: React.ReactNode;
  seletorGestao?: React.ReactNode;
  somenteLeitura: boolean;
  nomes: Record<string, string>;
  mostrarCorretor: boolean;
  onNova: () => void;
  onAbrir: (leadId: string) => void;
  onConcluir: (t: TarefaItem) => void;
  onAdiar: (t: TarefaItem) => void;
}

function filtrar(lista: TarefaItem[], q: string) {
  const s = q.trim().toLowerCase();
  return s ? lista.filter((t) => `${t.lead?.nome ?? ""} ${t.titulo}`.toLowerCase().includes(s)) : lista;
}

export default function TarefasMobileView(p: Props) {
  const [abrirProximas, setAbrirProximas] = useState(false);
  const atrasadas = filtrar(p.abas.vencidas, p.busca);
  const hoje = filtrar(p.abas.hoje, p.busca);
  const proximas = filtrar(p.abas.proximas, p.busca);
  const concluidas = filtrar(p.abas.concluidas, p.busca);
  const buscando = p.busca.trim().length > 0;

  const card = (t: TarefaItem, tom: "atrasada" | "hoje" | "normal") => (
    <TarefaCardMobile key={t.id} t={t} tom={tom} somenteLeitura={p.somenteLeitura}
      corretorNome={p.mostrarCorretor && t.responsavel_id ? p.nomes[t.responsavel_id] : undefined}
      onAbrir={p.onAbrir} onConcluir={p.onConcluir} onAdiar={p.onAdiar} />
  );
  const grupo = (titulo: string, n: number, cor: string, extra?: React.ReactNode) => (
    <div className={cn("flex items-center justify-between px-1 pb-1.5 pt-4 text-[13px] font-bold uppercase tracking-wide", cor)}>
      <span>{titulo}</span>{extra ?? <span>{n}</span>}
    </div>
  );

  return (
    <div className="min-h-full bg-background px-4 pb-8 pt-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground">{p.abas.vencidas.length} atrasadas · {p.abas.hoje.length} para hoje</p>
        </div>
        {!p.somenteLeitura && (
          <button type="button" aria-label="Nova tarefa" onClick={p.onNova}
            className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95">
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
      {p.seletorGestao && <div className="mt-3">{p.seletorGestao}</div>}

      <div className="mt-3 flex rounded-xl bg-muted p-[3px]">
        {(["minhas", "concluidas"] as const).map((m) => (
          <button key={m} type="button" onClick={() => p.setModo(m)} className={cn(
            "h-9 flex-1 rounded-[9px] text-sm font-semibold",
            p.modo === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}>{m === "minhas" ? (p.somenteLeitura ? "Pendentes" : "Minhas") : "Concluídas"}</button>
        ))}
      </div>
      {p.mostrarSemPasso && p.nSemPasso > 0 && (
        <button type="button" onClick={() => p.setModo(p.modo === "sem_passo" ? "minhas" : "sem_passo")} className={cn(
          "mt-2 rounded-full px-3 py-1.5 text-[13px] font-semibold",
          p.modo === "sem_passo" ? "bg-primary text-primary-foreground" : "bg-warning/15 text-warning",
        )}>Sem próximo passo · {p.nSemPasso}</button>
      )}

      {p.modo === "sem_passo" ? <div className="mt-3">{p.semPassoNode}</div> : (
        <>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={p.busca} onChange={(e) => p.setBusca(e.target.value)} placeholder="Buscar cliente"
              className="h-11 w-full rounded-xl bg-muted pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {p.isLoading ? (
            <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : p.modo === "concluidas" ? (
            concluidas.length === 0
              ? <p className="mt-8 text-center text-sm text-muted-foreground">Nenhuma tarefa concluída nos últimos 7 dias.</p>
              : <div className="mt-3 space-y-2">{concluidas.map((t) => card(t, "normal"))}</div>
          ) : atrasadas.length + hoje.length + proximas.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">{buscando ? "Nada encontrado." : "Tudo em dia por aqui. 🎉"}</p>
          ) : (
            <>
              {atrasadas.length > 0 && <>{grupo("Atrasadas", atrasadas.length, "text-destructive")}<div className="space-y-2">{atrasadas.map((t) => card(t, "atrasada"))}</div></>}
              {hoje.length > 0 && <>{grupo("Hoje", hoje.length, "text-primary")}<div className="space-y-2">{hoje.map((t) => card(t, "hoje"))}</div></>}
              {proximas.length > 0 && (
                <>
                  <button type="button" className="w-full" onClick={() => setAbrirProximas((v) => !v)}>
                    {grupo("Próximas", proximas.length, "text-muted-foreground",
                      <span className="flex items-center gap-0.5">{proximas.length}<ChevronRight className={cn("h-4 w-4 transition-transform", (abrirProximas || buscando) && "rotate-90")} /></span>)}
                  </button>
                  {(abrirProximas || buscando) && <div className="space-y-2">{proximas.map((t) => card(t, "normal"))}</div>}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
