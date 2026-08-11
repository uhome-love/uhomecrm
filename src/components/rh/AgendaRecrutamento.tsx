import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, CalendarDays, Video } from "lucide-react";
import { MEET_LINK } from "@/config/recrutamento";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isPast, parseISO, addDays, startOfDay, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * AgendaRecrutamento — agenda por DATA das entrevistas do funil de recrutamento.
 * Reaproveita rh_entrevistas + os candidatos já carregados pelo kanban.
 */

interface CandidatoLite {
  id: string;
  nome: string;
  etapa: string;
}

interface Entrevista {
  id: string;
  candidato_id: string;
  data_entrevista: string;
  local: string | null;
  observacoes: string | null;
  status: string;
}

type StatusFiltro = "todas" | "agendada" | "realizada" | "nao_compareceu";
type PeriodoFiltro = "7d" | "mes" | "todas";

const STATUS_OPTS: { key: StatusFiltro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "agendada", label: "Agendadas" },
  { key: "realizada", label: "Realizadas" },
  { key: "nao_compareceu", label: "Não compareceu" },
];

const PERIODO_OPTS: { key: PeriodoFiltro; label: string }[] = [
  { key: "7d", label: "Próximos 7 dias" },
  { key: "mes", label: "Este mês" },
  { key: "todas", label: "Todas" },
];

function statusBadge(status: string) {
  switch (status) {
    case "agendada":
      return (
        <Badge className="bg-primary/12 text-primary border-primary/25 text-[10px] rounded-full">
          <Clock className="h-3 w-3 mr-1" />Agendada
        </Badge>
      );
    case "realizada":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-[10px] rounded-full">
          <Check className="h-3 w-3 mr-1" />Realizada
        </Badge>
      );
    case "nao_compareceu":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-200 text-[10px] rounded-full">
          <X className="h-3 w-3 mr-1" />Não compareceu
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px] rounded-full">{status}</Badge>;
  }
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "EEE, dd/MM", { locale: ptBR });
}

interface Props {
  candidatos: CandidatoLite[];
  onKanbanUpdate: () => void;
  readOnly?: boolean;
}

export default function AgendaRecrutamento({ candidatos, onKanbanUpdate, readOnly = false }: Props) {
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("7d");

  const nomeById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of candidatos) m[c.id] = c.nome;
    return m;
  }, [candidatos]);

  const fetchEntrevistas = useCallback(async () => {
    const { data, error } = await supabase
      .from("rh_entrevistas" as any)
      .select("id, candidato_id, data_entrevista, local, observacoes, status")
      .order("data_entrevista", { ascending: true });
    if (!error) setEntrevistas(((data || []) as unknown as Entrevista[]));
  }, []);

  useEffect(() => { fetchEntrevistas(); }, [fetchEntrevistas]);

  const marcar = async (e: Entrevista, novo: "realizada" | "nao_compareceu") => {
    const { error } = await supabase
      .from("rh_entrevistas" as any)
      .update({ status: novo, updated_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) { toast.error("Erro ao atualizar entrevista"); return; }

    await supabase
      .from("rh_candidatos" as any)
      .update({
        etapa: novo === "realizada" ? "entrevista_realizada" : "sem_interesse",
        updated_at: new Date().toISOString(),
      })
      .eq("id", e.candidato_id);

    toast.success(novo === "realizada" ? "Entrevista marcada como realizada!" : "Candidato marcado como não compareceu");
    fetchEntrevistas();
    onKanbanUpdate();
  };

  const grupos = useMemo(() => {
    const hoje = startOfDay(new Date());
    const limite =
      periodo === "7d" ? addDays(hoje, 7) : periodo === "mes" ? endOfMonth(hoje) : null;

    const filtradas = entrevistas.filter((e) => {
      if (status !== "todas" && e.status !== status) return false;
      if (limite) {
        const d = parseISO(e.data_entrevista);
        if (d < hoje || d > limite) return false;
      }
      return true;
    });

    const map = new Map<string, { date: Date; items: Entrevista[] }>();
    for (const e of filtradas) {
      const d = parseISO(e.data_entrevista);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: startOfDay(d), items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ key, ...v }));
  }, [entrevistas, status, periodo]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm">
          {STATUS_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setStatus(o.key)}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors",
                status === o.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm">
          {PERIODO_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setPeriodo(o.key)}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors",
                periodo === o.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 py-12">
          <CalendarDays size={20} strokeWidth={1.5} className="text-muted-foreground/60" />
          <p className="text-xs font-medium text-muted-foreground">Nenhuma entrevista neste filtro</p>
        </div>
      )}

      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{dayLabel(g.date)}</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {g.items.length}
              </span>
              <span className="flex-1 h-px bg-border/60" />
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 dark:bg-white/[0.03] divide-y divide-border/50 overflow-hidden">
              {g.items.map((e) => {
                const d = parseISO(e.data_entrevista);
                const atrasada = e.status === "agendada" && isPast(d);
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      atrasada && "bg-destructive/[0.04]"
                    )}
                  >
                    <span className="text-[13px] font-bold text-primary tabular-nums w-12 shrink-0">
                      {format(d, "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {nomeById[e.candidato_id] || "Candidato removido"}
                      </p>
                      {e.local && <p className="text-[11px] text-muted-foreground truncate">{e.local}</p>}
                    </div>
                    {statusBadge(e.status)}
                    {!readOnly && e.status === "agendada" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-[11px] gap-1 rounded-full border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => marcar(e, "realizada")}
                        >
                          <Check className="h-3 w-3" /> Realizada
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 w-7 p-0 rounded-full border-red-300 text-red-600 hover:bg-red-50"
                          title="Não compareceu"
                          onClick={() => marcar(e, "nao_compareceu")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
