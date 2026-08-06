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
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CardMinimalProximaTarefa } from "../CardMinimal";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { QUALIFICACAO_SUBSTATUS, normalizeStatusAtendimento } from "@/lib/leadHelpers";
import { getSaudeToque, SAUDE_UI, type SaudeEstado } from "@/lib/leadSaude";
import TermometroBadge from "../TermometroBadge";

const SEM_STATUS = "__sem_status__";
const COLUMN_WIDTH = 220;

/** Dica de fluxo (para onde o lead vai depois) por substatus. */
const FLUXO_HINT: Record<string, string> = {
  contato_inicial: "→ Alinhando perfil",
  alinhamento_perfil: "→ Busca de imóveis",
  busca: "→ Follow up / Visita",
  follow_up: "→ Alinhando visita",
  alinhando_visita: "→ vira etapa Visita",
};

/** Cor da barra de urgência (3px) por estado de saúde. */
const BARRA_BY_SAUDE: Record<SaudeEstado, string> = {
  em_dia: "bg-emerald-500/70",
  desatualizado: "bg-amber-500",
  em_estagnacao: "bg-red-500",
  neutro: "bg-border",
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
      {/* Header — breadcrumb + explicação do que o arrasto faz */}
      <div className="shrink-0 flex items-center gap-3 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-medium border border-border bg-muted/40 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao Kanban
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
            <span className="text-muted-foreground">Pipeline</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span>🔎 Qualificação</span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            Arraste o lead entre as colunas para dizer onde o cliente está. Isso grava só o
            substatus — não muda a etapa, nem mexe em relatório, roleta ou PDN.
          </p>
        </div>
        <span className="ml-auto text-xs font-semibold text-primary">
          {qualificacaoLeads.length} leads
        </span>
      </div>

      {!qualificacaoStage ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Etapa de Qualificação não encontrada no pipeline.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-2.5 h-full pb-3">
            {columns.map((col) => {
              const colLeads = leadsByColumn.get(col.key) ?? [];
              const isOver = dragOverCol === col.key;
              const isSemStatus = col.key === SEM_STATUS;
              return (
                <div
                  key={col.key}
                  className={`flex flex-col shrink-0 h-full rounded-xl border p-1.5 transition-colors ${
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
                  <div className="shrink-0 px-1.5 pt-1 pb-2">
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
                    <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                      {isSemStatus
                        ? "Classifique — o cliente está em algum ponto abaixo"
                        : (FLUXO_HINT[col.key] ?? "")}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                    {colLeads.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-[10.5px] text-muted-foreground">
                        {isSemStatus ? "Nenhum lead sem status" : "Arraste um lead para cá"}
                      </div>
                    )}
                    {colLeads.map((lead) => {
                      const saude = getSaudeToque(lead, "qualificacao", tarefasMap?.[lead.id] ?? null);
                      const saudeUi = saude.estado === "neutro" ? null : SAUDE_UI[saude.estado];
                      const corretor = lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined;
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
                          className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card px-2.5 py-2 pl-3 shadow-sm hover:border-border hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {/* Barra de urgência (3px) */}
                          <span
                            aria-hidden
                            className={`absolute left-0 top-0 bottom-0 w-[3px] ${BARRA_BY_SAUDE[saude.estado]}`}
                          />
                          {savingId === lead.id && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-bold text-foreground leading-tight truncate">
                                {lead.nome || "Sem nome"}
                              </div>
                              <div className="text-[10.5px] text-muted-foreground truncate">
                                {lead.empreendimento || "Sem empreendimento"}
                              </div>
                            </div>
                            <TermometroBadge
                              temperatura={lead.temperatura}
                              score={lead.oportunidade_score}
                            />
                          </div>

                          {/* Linha de saúde por toque */}
                          <div className="mt-1 flex items-center gap-1.5 min-w-0">
                            {saudeUi && (
                              <span
                                className="text-[10.5px] font-medium text-muted-foreground truncate"
                                title={`${saudeUi.label} — ${saude.diasSemToque} ${saude.diasSemToque === 1 ? "dia" : "dias"} sem toque`}
                              >
                                {saudeUi.emoji}{" "}
                                {saude.estado === "em_estagnacao"
                                  ? "em estagnação"
                                  : saude.estado === "em_dia"
                                    ? `há ${saude.diasSemToque}d`
                                    : `${saude.diasSemToque}d`}
                              </span>
                            )}
                            {corretor && (
                              <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[90px]">
                                {corretor.split(" ")[0]}
                              </span>
                            )}
                          </div>

                          {/* Rodapé: ação rápida */}
                          <div className="mt-1.5 flex">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO Build 3: abrir RegistrarAtividadeDialog
                                onSelectLead(lead);
                              }}
                              className="h-6 px-2 rounded-md border border-border/70 bg-muted/40 text-[10px] font-semibold text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                            >
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
