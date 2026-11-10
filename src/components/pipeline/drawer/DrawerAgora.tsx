// ─────────────────────────────────────────────────────────────────
// DrawerAgora — o que precisa de ação: visita marcada, próxima tarefa
// e UM botão principal (Registrar atividade).
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDateBRTSafe } from "@/lib/utils";
import { parseNextActionType } from "./DrawerProximaAcao";

interface Tarefa { id?: string; titulo?: string | null; descricao?: string | null; tipo?: string | null; vence_em?: string | null; hora_vencimento?: string | null }
interface Visita { data_visita: string; hora_visita: string | null; empreendimento: string | null; status: string }

interface Props {
  leadId: string;
  nextTask: Tarefa | null;
  proximaAcaoTexto?: string | null;
  pendingCount: number;
  onComplete: (taskId: string) => void;
  onSeeAll: () => void;
  onCreateTask: () => void;
  onRegistrar: () => void;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function formatVisita(data: string, hora: string | null): string {
  const [y, m, d] = data.slice(0, 10).split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d, 12));
  const base = `${DIAS[dia.getUTCDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  if (!hora) return base;
  const [hh, mm] = hora.split(":");
  return `${base} · ${Number(hh)}h${mm && mm !== "00" ? mm : ""}`;
}

function hojeBRT(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function DrawerAgora({ leadId, nextTask, proximaAcaoTexto, pendingCount, onComplete, onSeeAll, onCreateTask, onRegistrar }: Props) {
  const [visita, setVisita] = useState<Visita | null>(null);

  useEffect(() => {
    let cancel = false;
    void supabase.from("visitas")
      .select("data_visita, hora_visita, empreendimento, status")
      .eq("pipeline_lead_id", leadId)
      .in("status", ["marcada", "confirmada", "reagendada"])
      .gte("data_visita", hojeBRT())
      .order("data_visita", { ascending: true })
      .limit(1)
      .then(({ data }) => { if (!cancel) setVisita(((data ?? [])[0] as Visita) ?? null); });
    return () => { cancel = true; };
  }, [leadId]);

  let tarefaQuando: string | null = null;
  let atrasada = false;
  if (nextTask?.vence_em) {
    const dia = String(nextTask.vence_em).slice(0, 10);
    const hora = nextTask.hora_vencimento && /^\d{2}:\d{2}/.test(nextTask.hora_vencimento) ? nextTask.hora_vencimento.slice(0, 5) : "23:59";
    const due = new Date(`${dia}T${hora}:00-03:00`);
    const valido = !Number.isNaN(due.getTime()) ? due : parseDateBRTSafe(nextTask.vence_em);
    if (valido) {
      atrasada = valido.getTime() < Date.now();
      const abs = valido.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", ...(nextTask.hora_vencimento ? { hour: "2-digit", minute: "2-digit" } : {}) });
      tarefaQuando = `${abs} · ${atrasada ? "atrasada há" : "em"} ${formatDistance(valido, new Date(), { locale: ptBR })}`;
    }
  }
  const tipo = parseNextActionType(nextTask, proximaAcaoTexto);
  const tituloTarefa = nextTask?.titulo || nextTask?.descricao || (tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "Próxima tarefa");

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Agora</p>

      {visita && (
        <div className="mt-2 flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground leading-tight">Visita {formatVisita(visita.data_visita, visita.hora_visita)}</p>
            <p className="text-[12px] text-muted-foreground truncate">
              {visita.empreendimento || "Imóvel não informado"}{visita.status === "confirmada" ? " · confirmada" : ""}
            </p>
          </div>
        </div>
      )}

      {visita && <div className="my-3 h-px bg-border/70" />}

      {nextTask ? (
        <div className={visita ? "" : "mt-2"}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-foreground leading-snug">{tituloTarefa}</p>
              {tarefaQuando && <p className={`text-[12px] ${atrasada ? "text-destructive font-medium" : "text-muted-foreground"}`}>{tarefaQuando}</p>}
            </div>
            {nextTask.id && (
              <button onClick={() => onComplete(nextTask.id!)} className="shrink-0 text-[12px] font-semibold text-primary hover:underline">
                Concluir
              </button>
            )}
          </div>
          {pendingCount > 1 && (
            <button onClick={onSeeAll} className="mt-1 text-[11.5px] text-muted-foreground hover:text-foreground">
              + {pendingCount - 1} tarefa{pendingCount - 1 > 1 ? "s" : ""} pendente{pendingCount - 1 > 1 ? "s" : ""}
            </button>
          )}
        </div>
      ) : (
        <div className={`${visita ? "" : "mt-2"} flex items-center justify-between gap-2`}>
          <p className="text-[13px] text-muted-foreground">Sem próxima tarefa</p>
          <button onClick={onCreateTask} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Criar tarefa
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onRegistrar}
        className="hidden md:flex mt-4 w-full items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-[13.5px] font-bold transition-colors hover:bg-primary/90"
      >
        <Zap className="h-4 w-4" strokeWidth={2.4} /> Registrar atividade
      </button>
    </section>
  );
}
