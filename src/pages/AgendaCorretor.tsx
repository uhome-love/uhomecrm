import { useState } from "react";
import { useFilaDoDia, type LeadFila, type MotivoFila, type CompromissoHoje } from "@/hooks/useFilaDoDia";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Target, CalendarClock, Zap, Phone, MessageCircle, Home, Bell, Flame, Snowflake,
  Sparkles, AlertTriangle, ClockAlert, History, Layers, type LucideIcon,
} from "lucide-react";

const MOTIVO_META: Record<MotivoFila, { label: string; icon: LucideIcon; chip: string }> = {
  retorno_hoje:     { label: "Retorno de hoje",     icon: ClockAlert,   chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  no_show:          { label: "No-show",             icon: AlertTriangle, chip: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  pos_visita:       { label: "Pós-visita parada",   icon: Home,         chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  novo_lead:        { label: "Novo lead",           icon: Sparkles,     chip: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  quente_esfriando: { label: "Quente esfriando",    icon: Flame,        chip: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  esfriando:        { label: "Precisa de atenção",  icon: Snowflake,    chip: "bg-muted text-muted-foreground" },
};

const SAUDE_BORDER: Record<string, string> = {
  verde: "before:bg-emerald-500",
  ambar: "before:bg-amber-500",
  vermelho: "before:bg-red-500",
  estagnado: "before:bg-violet-500",
  terminal: "before:bg-zinc-300",
};

const COMP_ICON: Record<CompromissoHoje["icon"], LucideIcon> = {
  phone: Phone, whatsapp: MessageCircle, home: Home, bell: Bell,
};

function diasLabel(d: number | null, temAtividade: boolean): string {
  if (!temAtividade) return "sem atividade ainda";
  if (d === null || d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d}d`;
}

function CardPrioridade({ lead, onRegistrar }: { lead: LeadFila; onRegistrar: () => void }) {
  const m = MOTIVO_META[lead.motivo];
  const Icon = m.icon;
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card p-3 pl-4 overflow-hidden",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
        SAUDE_BORDER[lead.saude] ?? "before:bg-amber-500"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.chip)}>
            <Icon className="h-3 w-3" strokeWidth={2} /> {m.label}
          </span>
          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-semibold text-foreground truncate">{lead.nome}</span>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">{lead.stage_nome}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <History className="h-3 w-3 shrink-0" />
            última atividade · {diasLabel(lead.dias_sem_atividade, lead.tem_atividade)}
          </div>
          {lead.ultimo_registro && (
            <div className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[12px] italic leading-snug text-foreground/80">
              “{lead.ultimo_registro}”
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={onRegistrar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Zap className="h-3.5 w-3.5" strokeWidth={2.4} /> Registrar
          </button>
          {lead.telefone && (
            <a
              href={`tel:${lead.telefone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5" /> Ligar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaCorretor() {
  const { data, isLoading } = useFilaDoDia();
  const [registrar, setRegistrar] = useState<{ id: string; nome: string } | null>(null);

  const hojeLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "short", timeZone: "America/Sao_Paulo",
  });

  const prioridades = data?.prioridades ?? [];
  const agenda = data?.agenda ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-24">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Agenda do corretor</h1>
          <p className="text-[13px] capitalize text-muted-foreground">{hojeLabel}</p>
        </div>
      </div>

      {/* Prioridades */}
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <span className="text-[13.5px] font-semibold text-foreground">Sua fila de hoje</span>
        <span className="text-[11.5px] text-muted-foreground">· priorizada por progresso, não por tarefa</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : prioridades.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4">
          <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-[13px] text-foreground">
            <b className="font-semibold">Fila zerada — mandou bem!</b>
            <p className="mt-0.5 text-muted-foreground">
              Sem leads pedindo atenção agora. Aproveite pra aquecer os mornos na Oferta Ativa.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {prioridades.map((l) => (
            <CardPrioridade key={l.id} lead={l} onRegistrar={() => setRegistrar({ id: l.id, nome: l.nome })} />
          ))}
        </div>
      )}

      {/* Agenda de hoje */}
      <div className="mb-2 mt-7 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="text-[13.5px] font-semibold text-foreground">Agenda de hoje</span>
        <span className="text-[11.5px] text-muted-foreground">· o que você combinou</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : agenda.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-5 text-center text-[13px] text-muted-foreground">
          Nenhum compromisso marcado pra hoje.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-3 divide-y divide-border/60">
          {agenda.map((c) => {
            const Icon = COMP_ICON[c.icon];
            return (
              <div key={`${c.tipo}-${c.id}`} className="flex items-center gap-3 py-2.5">
                <span className={cn("w-11 shrink-0 text-[12.5px] font-semibold", c.atrasado ? "text-red-600" : "text-foreground/70")}>
                  {c.hora ?? "—"}
                </span>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {c.titulo} · <b className="font-medium">{c.lead_nome}</b>
                  {c.atrasado && <span className="ml-1 text-[11px] font-semibold text-red-600">atrasado</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {registrar && (
        <RegistrarAtividadeModal lead={registrar} onClose={() => setRegistrar(null)} />
      )}
    </div>
  );
}
