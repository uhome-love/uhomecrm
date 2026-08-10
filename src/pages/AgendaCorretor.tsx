import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useFilaDoDia, type LeadFila, type MotivoFila, type Compromisso, type LembretesAgrupados } from "@/hooks/useFilaDoDia";
import RegistrarAtividadeModal from "@/components/pipeline/RegistrarAtividadeModal";
import CardOverflowMenu from "@/components/pipeline/CardOverflowMenu";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Target, Zap, Phone, MessageCircle, Home, Bell, Flame, Home as HomeIcon,
  Sparkles, AlertTriangle, ClockAlert, History, Layers, MoreVertical, type LucideIcon,
} from "lucide-react";

const MOTIVO_META: Record<MotivoFila, { label: string; icon: LucideIcon; chip: string }> = {
  novo_lead:        { label: "Novo lead",         icon: Sparkles,     chip: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  retorno_hoje:     { label: "Retorno de hoje",   icon: ClockAlert,   chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  no_show:          { label: "No-show",           icon: AlertTriangle, chip: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  pos_visita:       { label: "Pós-visita parada", icon: HomeIcon,     chip: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  quente_esfriando: { label: "Quente esfriando",  icon: Flame,        chip: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

const SAUDE_BORDER: Record<string, string> = {
  verde: "before:bg-emerald-500", ambar: "before:bg-amber-500",
  vermelho: "before:bg-red-500", estagnado: "before:bg-violet-500", terminal: "before:bg-zinc-300",
};

const COMP_ICON: Record<Compromisso["icon"], LucideIcon> = {
  phone: Phone, whatsapp: MessageCircle, home: Home, bell: Bell,
};

function diasLabel(d: number | null, temAtividade: boolean): string {
  if (!temAtividade) return "sem atividade ainda";
  if (d === null || d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d}d`;
}

function CardPrioridade({
  lead, stages, onRegistrar, onOpen, onMove,
}: {
  lead: LeadFila; stages: PipelineStage[];
  onRegistrar: () => void; onOpen: () => void;
  onMove: (leadId: string, stageId: string) => void;
}) {
  const m = MOTIVO_META[lead.motivo];
  const Icon = m.icon;
  const leadObj = {
    id: lead.id, nome: lead.nome, stage_id: lead.stage_id, corretor_id: lead.corretor_id,
    telefone: lead.telefone, empreendimento: lead.empreendimento,
  } as unknown as PipelineLead;
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border bg-card p-3 pl-4 overflow-hidden transition-colors hover:border-border/80 hover:bg-muted/20",
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
        <div className="flex shrink-0 items-start gap-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-end gap-1.5">
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
          <CardOverflowMenu
            lead={leadObj}
            stages={stages}
            onMoveLead={onMove}
            onOpenDetail={onOpen}
            onRegistrarAtividade={onRegistrar}
            trigger={
              <button
                type="button"
                aria-label="Ações do lead"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}

const GRUPOS: { key: keyof LembretesAgrupados; label: string; tone: string }[] = [
  { key: "atrasados", label: "Atrasados", tone: "text-red-600" },
  { key: "hoje",      label: "Hoje",      tone: "text-amber-700 dark:text-amber-500" },
  { key: "amanha",    label: "Amanhã",    tone: "text-foreground" },
  { key: "semana",    label: "Esta semana", tone: "text-muted-foreground" },
  { key: "proximos",  label: "Próximos",  tone: "text-muted-foreground" },
];

function ListaLembretes({ lembretes }: { lembretes: LembretesAgrupados }) {
  const algum = GRUPOS.some((g) => lembretes[g.key].length > 0);
  if (!algum) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
        Nenhum lembrete agendado. Registre uma atividade e agende o próximo passo.
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {GRUPOS.map((g) => {
        const itens = lembretes[g.key];
        if (itens.length === 0) return null;
        return (
          <div key={g.key}>
            <div className={cn("mb-1.5 text-[12px] font-semibold uppercase tracking-wide", g.tone)}>
              {g.label} <span className="text-muted-foreground">· {itens.length}</span>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 divide-y divide-border/60">
              {itens.map((c) => {
                const Icon = COMP_ICON[c.icon];
                return (
                  <div key={`${c.tipo}-${c.id}`} className="flex items-center gap-3 py-2.5">
                    <span className="w-11 shrink-0 text-[12.5px] font-semibold text-foreground/70">{c.hora ?? "—"}</span>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {c.titulo} · <b className="font-medium">{c.lead_nome}</b>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgendaCorretor() {
  const { data, isLoading } = useFilaDoDia();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"prioridades" | "lembretes">("prioridades");
  const [registrar, setRegistrar] = useState<{ id: string; nome: string } | null>(null);

  const hojeLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "short", timeZone: "America/Sao_Paulo",
  });

  const prioridades = data?.prioridades ?? [];
  const stages = data?.stages ?? [];
  const lembretes = data?.lembretes ?? { atrasados: [], hoje: [], amanha: [], semana: [], proximos: [] };

  const abrirLead = (id: string) => navigate(`/pipeline-leads?lead=${id}`);

  const moverEtapa = async (leadId: string, stageId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ stage_id: stageId, stage_changed_at: now, updated_at: now } as never)
      .eq("id", leadId);
    if (error) { toast.error("Não foi possível mover o lead."); return; }
    toast.success("Lead movido ✅");
    queryClient.invalidateQueries({ queryKey: ["fila-do-dia"] });
  };

  const TabBtn = ({ id, label, badge }: { id: typeof tab; label: string; badge?: number }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className={cn("rounded-full px-1.5 text-[11px] font-bold",
          tab === id ? "bg-white/20" : "bg-muted-foreground/15")}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-24">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Agenda do corretor</h1>
        <p className="text-[13px] capitalize text-muted-foreground">{hojeLabel}</p>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-border bg-card p-1">
        <TabBtn id="prioridades" label="Prioridades" badge={prioridades.length} />
        <TabBtn id="lembretes" label="Lembretes" badge={data?.totalLembretes} />
      </div>

      {tab === "prioridades" ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">Sua fila de hoje</span>
            <span className="text-[11.5px] text-muted-foreground">· só o que dá pra agir agora</span>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : prioridades.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4">
              <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-[13px] text-foreground">
                <b className="font-semibold">Fila zerada — mandou bem!</b>
                <p className="mt-0.5 text-muted-foreground">Sem leads pedindo ação agora. Aproveite pra aquecer os mornos na Oferta Ativa.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {prioridades.map((l) => (
                <CardPrioridade
                  key={l.id} lead={l} stages={stages}
                  onRegistrar={() => setRegistrar({ id: l.id, nome: l.nome })}
                  onOpen={() => abrirLead(l.id)}
                  onMove={moverEtapa}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">Seus lembretes</span>
            <span className="text-[11.5px] text-muted-foreground">· para se organizar</span>
          </div>
          {isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : <ListaLembretes lembretes={lembretes} />}
        </>
      )}

      {registrar && (
        <RegistrarAtividadeModal
          lead={registrar}
          onClose={() => setRegistrar(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["fila-do-dia"] })}
        />
      )}
    </div>
  );
}
