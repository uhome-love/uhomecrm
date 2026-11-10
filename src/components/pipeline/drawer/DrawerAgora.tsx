// ─────────────────────────────────────────────────────────────────
// DrawerAgora — card "Próximo passo" da ficha do lead.
// Mostra, nesta ordem: o único alerta de saúde (parado há N dias + barra
// contra o prazo da etapa), a visita marcada, a próxima tarefa (explicando
// quando ela sobrou da etapa anterior) e a sugestão do Homi, recolhida.
// Mantém as props antigas: quem ainda passa só `saudeLinha` continua funcionando.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Plus, Repeat, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDateBRTSafe, cn } from "@/lib/utils";
import { parseNextActionType } from "./DrawerProximaAcao";

interface Tarefa { id?: string; titulo?: string | null; descricao?: string | null; tipo?: string | null; vence_em?: string | null; hora_vencimento?: string | null }
interface Visita { data_visita: string; hora_visita: string | null; empreendimento: string | null; status: string }

interface Props {
  leadId: string;
  leadNome?: string;
  nextTask: Tarefa | null;
  proximaAcaoTexto?: string | null;
  pendingCount: number;
  onComplete: (taskId: string) => void;
  onSeeAll: () => void;
  onCreateTask: () => void;
  onRegistrar: () => void;
  /** Formato antigo (uma linha de texto). Usado só se `saude` não vier. */
  saudeLinha?: { texto: string; critico: boolean } | null;
  /** Novo: alimenta o selo "Parado há N dias" e a barra contra o prazo da etapa. */
  saude?: { dias: number | null; prazo: number; critico: boolean } | null;
  /** Novo: a tarefa foi criada antes da última troca de etapa. */
  tarefaDeEtapaAnterior?: { etapaAtual: string; trocadaEm: string; etapaAnterior?: string | null } | null;
  /** Novo: bloco do Homi (HomiSugestaoRecolhida). */
  homi?: ReactNode;
  /** Novo: esconde o botão grande "Registrar atividade" (o registro fica no topo do histórico). */
  esconderRegistrar?: boolean;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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

function diaMesBRT(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "numeric" }).formatToParts(d);
  const dia = partes.find((x) => x.type === "day")?.value ?? "";
  const mes = Number(partes.find((x) => x.type === "month")?.value ?? "1");
  return `${dia} ${MESES[mes - 1]}`;
}

export default function DrawerAgora({
  leadId, leadNome, nextTask, proximaAcaoTexto, pendingCount, onComplete, onSeeAll, onCreateTask, onRegistrar,
  saudeLinha, saude, tarefaDeEtapaAnterior, homi, esconderRegistrar = false,
}: Props) {
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
      const dist = formatDistance(valido, new Date(), { locale: ptBR });
      tarefaQuando = atrasada ? `Venceu há ${dist} · ${abs}` : `Vence em ${dist} · ${abs}`;
    }
  }
  const tipo = parseNextActionType(nextTask, proximaAcaoTexto);
  const tituloBruto = nextTask?.titulo || nextTask?.descricao || (tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "Próxima tarefa");
  const tituloTarefa = leadNome ? tituloBruto.replace(new RegExp(`\\s*[—-]\\s*${leadNome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "") : tituloBruto;

  // Um alerta só: selo + barra. Verde não aparece (nada a fazer).
  const temSaude = !!saude && saude.dias != null && saude.dias > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Próximo passo</p>
        {temSaude && (
          <span title={`Prazo da etapa: ${saude!.prazo} ${saude!.prazo === 1 ? "dia" : "dias"}`} className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold",
            saude!.critico ? "bg-danger-500/10 text-danger-700 dark:text-danger-500" : "bg-warning-500/15 text-warning-700 dark:text-warning-500",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", saude!.critico ? "bg-danger-500" : "bg-warning-500")} />
            {saude!.critico ? "Parado" : "Atenção"} há {saude!.dias} {saude!.dias === 1 ? "dia" : "dias"}
          </span>
        )}
      </div>

      {!saude && saudeLinha && (
        <p className={cn("flex items-center gap-1.5 text-[12px]", saudeLinha.critico ? "text-destructive" : "text-muted-foreground")}>
          <Clock className="h-3.5 w-3.5 shrink-0" /> {saudeLinha.texto}
        </p>
      )}

      {visita && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-tight text-foreground">Visita {formatVisita(visita.data_visita, visita.hora_visita)}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {visita.empreendimento || "Imóvel não informado"}{visita.status === "confirmada" ? " · confirmada" : ""}
            </p>
          </div>
        </div>
      )}

      {nextTask ? (
        <div className="rounded-lg bg-muted/60 p-3.5">
          <div className="flex items-start gap-2">
            <Clock className={cn("mt-0.5 h-4 w-4 shrink-0", atrasada ? "text-danger-500" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-snug text-foreground">{tituloTarefa}</p>
              {tarefaQuando && (
                <p className={cn("text-[12px]", atrasada ? "font-semibold text-danger-700 dark:text-danger-500" : "text-muted-foreground")}>{tarefaQuando}</p>
              )}
              {tarefaDeEtapaAnterior && (
                <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">
                  {tarefaDeEtapaAnterior.etapaAnterior
                    ? `É da etapa anterior (${tarefaDeEtapaAnterior.etapaAnterior}).`
                    : `É da etapa anterior (antes de ${diaMesBRT(tarefaDeEtapaAnterior.trocadaEm)}).`}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {nextTask.id && (
                  <button type="button" onClick={() => onComplete(nextTask.id!)} className="text-[12.5px] font-semibold text-primary hover:underline">
                    Concluir
                  </button>
                )}
                {(atrasada || tarefaDeEtapaAnterior) && (
                  <button type="button" onClick={onCreateTask} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">
                    <Repeat className="h-3.5 w-3.5" /> Trocar tarefa
                  </button>
                )}
                {pendingCount > 1 && (
                  <button type="button" onClick={onSeeAll} className="text-[12px] text-muted-foreground hover:text-foreground">
                    + {pendingCount - 1} tarefa{pendingCount - 1 > 1 ? "s" : ""} pendente{pendingCount - 1 > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-warning-500/10 px-3.5 py-3">
          <p className="text-[14px] font-semibold text-warning-700 dark:text-warning-500">Sem próximo passo</p>
          <button type="button" onClick={onCreateTask} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Criar tarefa
          </button>
        </div>
      )}

      {homi}

      {!esconderRegistrar && (
        <button
          type="button"
          onClick={onRegistrar}
          className="hidden md:flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-[13.5px] font-bold transition-colors hover:bg-primary/90"
        >
          <Zap className="h-4 w-4" strokeWidth={2.4} /> Registrar atividade
        </button>
      )}
    </section>
  );
}
