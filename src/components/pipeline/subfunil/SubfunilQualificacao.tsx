// ─────────────────────────────────────────────────────────────────
// SubfunilQualificacao — Onda 1 / Build 1 (mecânica) + revisão visual
//
// REGRA DE OURO (inalterada): arrastar entre colunas grava APENAS
//   flag_status = { ...flag_status_atual, status_atendimento: <novo> }
// Nunca altera stage_id / stage_changed_at / negocio_id, não cria tarefa,
// não dispara transição de etapa. Risco zero para PDN/CAPI/roleta/relatórios.
//
// Camada visual: card compacto próprio (não usa CardMinimal), termômetro,
// linha de saúde por toque e barra de urgência — tudo só-cor.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, CalendarClock, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CardMinimalProximaTarefa } from "../CardMinimal";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { QUALIFICACAO_SUBSTATUS, normalizeStatusAtendimento } from "@/lib/leadHelpers";
import { getSaudeToque, type SaudeEstado } from "@/lib/leadSaude";
import { formatNextAction } from "@/lib/formatNextAction";
import TermometroBadge from "../TermometroBadge";

const SEM_STATUS = "__sem_status__";
const COLUMN_WIDTH = 236;

/** Dica de fluxo (para onde o lead vai depois) por substatus. */
const FLUXO_HINT: Record<string, string> = {
  contato_inicial: "→ Alinhando perfil",
  alinhamento_perfil: "→ Busca de imóveis",
  busca: "→ Follow up / Visita",
  follow_up: "→ Alinhando visita",
  alinhando_visita: "→ vira etapa Visita",
};

/** Pílula soft de saúde por estado (dot + texto). */
const SAUDE_PILL: Record<Exclude<SaudeEstado, "neutro">, { pill: string; dot: string }> = {
  em_dia: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  desatualizado: {
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  em_estagnacao: {
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    dot: "bg-red-500",
  },
};


interface Props {
  stages: PipelineStage[];
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
  corretorAvatars?: Record<string, string>;
  parcerias?: Record<string, string>;
  tarefasMap?: Record<string, CardMinimalProximaTarefa>;
  onSelectLead: (lead: PipelineLead) => void;
  onClose: () => void;
  /** Recarrega os leads após gravar o substatus. */
  onChanged?: () => void;
}

export default function SubfunilQualificacao({
  stages,
  leads,
  corretorNomes,
  tarefasMap,
  onSelectLead,
  onClose,
  onChanged,
}: Props) {
  const dragLeadId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Override otimista local: leadId → status_atendimento gravado agora.
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const qualificacaoStage = useMemo(
    () => stages.find((s) => s.tipo === "qualificacao"),
    [stages]
  );

  const qualificacaoLeads = useMemo(
    () => (qualificacaoStage ? leads.filter((l) => l.stage_id === qualificacaoStage.id) : []),
    [leads, qualificacaoStage]
  );

  // "Sem status" vem PRIMEIRO (é o que precisa de classificação).
  const columns = useMemo(
    () => [
      { key: SEM_STATUS, label: "⚠ Sem status" },
      ...QUALIFICACAO_SUBSTATUS.map((o) => ({ key: o.value, label: o.label })),
    ],
    []
  );

  const leadsByColumn = useMemo(() => {
    const map = new Map<string, PipelineLead[]>();
    for (const c of columns) map.set(c.key, []);
    for (const lead of qualificacaoLeads) {
      const raw =
        localStatus[lead.id] ??
        ((lead.flag_status as Record<string, string> | null | undefined)?.status_atendimento ?? null);
      const canonical = normalizeStatusAtendimento(raw);
      const key = canonical && map.has(canonical) ? canonical : SEM_STATUS;
      map.get(key)!.push(lead);
    }
    return map;
  }, [qualificacaoLeads, columns, localStatus]);

  const handleDrop = async (colKey: string) => {
    setDragOverCol(null);
    const leadId = dragLeadId.current;
    dragLeadId.current = null;
    if (!leadId || colKey === SEM_STATUS) return;

    const lead = qualificacaoLeads.find((l) => l.id === leadId);
    if (!lead) return;

    const current =
      localStatus[lead.id] ??
      ((lead.flag_status as Record<string, string> | null | undefined)?.status_atendimento ?? null);
    if (normalizeStatusAtendimento(current) === colKey) return;

    // Merge: preserva tipologia, prazo, status_visita e demais chaves.
    const nextFlag: Record<string, unknown> = {
      ...((lead.flag_status as Record<string, unknown> | null | undefined) ?? {}),
      status_atendimento: colKey,
    };

    setSavingId(leadId);
    setLocalStatus((prev) => ({ ...prev, [leadId]: colKey }));
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ flag_status: nextFlag } as never)
      .eq("id", leadId);
    setSavingId(null);

    if (error) {
      setLocalStatus((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
      console.error("[SubfunilQualificacao] erro ao gravar status_atendimento:", error);
      toast.error("Não foi possível salvar o substatus.");
      return;
    }

    const label = columns.find((c) => c.key === colKey)?.label ?? colKey;
    toast.success(`${lead.nome} → ${label}`);
    onChanged?.();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header — padrão PageHeader canônico */}
      <div className="shrink-0 flex items-start gap-3 border-b border-border pb-4 mb-3">
        <div className="w-10 h-10 rounded-[11px] bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
          🔎
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Subfunil de Qualificação
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Arraste o lead entre as colunas para dizer onde o cliente está — grava só o substatus,
            não muda a etapa.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 tabular-nums">
            {qualificacaoLeads.length} leads
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Kanban
          </button>
        </div>
      </div>


      {!qualificacaoStage ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Etapa de Qualificação não encontrada no pipeline.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full pb-3">
            {columns.map((col) => {
              const colLeads = leadsByColumn.get(col.key) ?? [];
              const isOver = dragOverCol === col.key;
              const isSemStatus = col.key === SEM_STATUS;
              return (
                <div
                  key={col.key}
                  className={`flex flex-col shrink-0 h-full rounded-2xl border p-2 transition-colors ${
                    isSemStatus
                      ? "border-amber-400/70 bg-amber-50/60 dark:bg-amber-500/5"
                      : isOver
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-muted/30"
                  }`}
                  style={{ width: COLUMN_WIDTH }}
                  onDragOver={(e) => {
                    if (isSemStatus) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== col.key) setDragOverCol(col.key);
                  }}
                  onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleDrop(col.key);
                  }}
                >
                  {/* Cabeçalho da coluna */}
                  <div className="shrink-0 px-1.5 pt-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[12px] font-semibold truncate ${
                          isSemStatus ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                        }`}
                      >
                        {col.label}
                      </span>
                      <span className="ml-auto text-[12px] font-bold text-primary tabular-nums">
                        {colLeads.length}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground truncate">
                      {isSemStatus
                        ? "Classifique — o cliente está em algum ponto abaixo"
                        : (FLUXO_HINT[col.key] ?? "")}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                    {colLeads.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border py-6 text-center text-[10.5px] text-muted-foreground">
                        {isSemStatus ? "Nenhum lead sem status" : "Arraste um lead para cá"}
                      </div>
                    )}
                    {colLeads.map((lead) => {
                      const saude = getSaudeToque(lead, "qualificacao", tarefasMap?.[lead.id] ?? null);
                      const saudePill =
                        saude.estado === "neutro" ? null : SAUDE_PILL[saude.estado];
                      const saudeTexto =
                        saude.estado === "em_estagnacao"
                          ? "em estagnação"
                          : saude.diasSemToque === 0
                            ? "hoje"
                            : `há ${saude.diasSemToque}d`;
                      const corretor = lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined;
                      const avatar = lead.corretor_id ? corretorAvatars?.[lead.corretor_id] : undefined;
                      const iniciais = (corretor ?? "")
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0] ?? "")
                        .join("")
                        .toUpperCase();
                      const tarefa = tarefasMap?.[lead.id];
                      const empreendimento = empreendimentoCanonico[lead.id];
                      return (
                        <div
                          key={lead.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            dragLeadId.current = lead.id;
                          }}
                          onClick={() => onSelectLead(lead)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelectLead(lead);
                            }
                          }}
                          aria-label={`Abrir lead ${lead.nome || "sem nome"}`}
                          className="group relative cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {savingId === lead.id && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}

                          <div className="text-[15px] font-bold tracking-tight text-foreground truncate">
                            {lead.nome || "Sem nome"}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground min-w-0">
                            <Building2 className="h-3 w-3 opacity-60 shrink-0" />
                            <span className="truncate">{empreendimento || "Sem empreendimento"}</span>
                          </div>

                          {/* Fileira meta: termômetro + saúde */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <TermometroBadge
                              temperatura={lead.temperatura}
                              score={lead.oportunidade_score}
                            />
                            {saudePill && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${saudePill.pill}`}
                                title={`${saude.diasSemToque} ${saude.diasSemToque === 1 ? "dia" : "dias"} sem toque`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${saudePill.dot}`} />
                                <span className="tabular-nums">{saudeTexto}</span>
                              </span>
                            )}
                          </div>

                          {/* Próxima ação (só quando existe tarefa) */}
                          {tarefa && (
                            <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-w-0">
                              <CalendarClock className="h-3 w-3 opacity-60 shrink-0" />
                              <span className="truncate">{formatNextAction(tarefa)}</span>
                            </div>
                          )}

                          {/* Rodapé */}
                          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={corretor ?? "Corretor"}
                                className="h-[26px] w-[26px] rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="h-[26px] w-[26px] rounded-full bg-gradient-to-br from-primary to-cyan-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {iniciais || "—"}
                              </span>
                            )}
                            <span className="text-[12px] font-semibold text-muted-foreground truncate">
                              {corretor ? corretor.split(" ")[0] : "Sem corretor"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO Build 3: RegistrarAtividadeDialog
                                onSelectLead(lead);
                              }}
                              className="ml-auto shrink-0 bg-foreground text-background rounded-full h-7 px-3 text-[11.5px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                            >
                              <Zap className="h-3 w-3" />
                              Registrar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
