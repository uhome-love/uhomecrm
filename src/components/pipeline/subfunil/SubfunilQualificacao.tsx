// ─────────────────────────────────────────────────────────────────
// SubfunilQualificacao — Onda 1 / Build 1
//
// Tela cheia com os substatus da etapa Qualificação como colunas.
// REGRA DE OURO: arrastar entre colunas grava APENAS
//   flag_status = { ...flag_status_atual, status_atendimento: <novo> }
// Nunca altera stage_id / stage_changed_at / negocio_id, não cria tarefa,
// não dispara transição de etapa. Risco zero para PDN/CAPI/roleta/relatórios.
// ─────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CardMinimal, { type CardMinimalProximaTarefa } from "./CardMinimal";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { QUALIFICACAO_SUBSTATUS, normalizeStatusAtendimento } from "@/lib/leadHelpers";

const SEM_STATUS = "__sem_status__";

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

const COLUMN_WIDTH = 268;

export default function SubfunilQualificacao({
  stages,
  leads,
  corretorNomes,
  corretorAvatars,
  parcerias,
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

  const columns = useMemo(
    () => [
      ...QUALIFICACAO_SUBSTATUS.map((o) => ({ key: o.value, label: o.label })),
      { key: SEM_STATUS, label: "⚠ Sem status" },
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
      {/* Header */}
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
          <h2 className="text-sm font-semibold text-foreground truncate">
            🔎 Subfunil de Qualificação
          </h2>
          <p className="text-[11px] text-muted-foreground truncate">
            Arrastar aqui muda apenas o substatus — o lead continua na etapa Qualificação.
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
          <div className="flex gap-3 h-full pb-3">
            {columns.map((col) => {
              const colLeads = leadsByColumn.get(col.key) ?? [];
              const isOver = dragOverCol === col.key;
              const isSemStatus = col.key === SEM_STATUS;
              return (
                <div
                  key={col.key}
                  className="flex flex-col shrink-0 h-full"
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
                  <div
                    className={`shrink-0 rounded-xl border px-3 py-2 mb-2 transition-colors ${
                      isOver ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[12px] font-semibold truncate ${
                          isSemStatus ? "text-amber-600" : "text-foreground"
                        }`}
                      >
                        {col.label}
                      </span>
                      <span className="ml-auto text-[12px] font-bold text-primary">
                        {colLeads.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                    {colLeads.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">
                        {isSemStatus ? "Nenhum lead sem status" : "Arraste um lead para cá"}
                      </div>
                    )}
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="relative"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          dragLeadId.current = lead.id;
                        }}
                      >
                        {savingId === lead.id && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        )}
                        <CardMinimal
                          lead={lead}
                          stage={qualificacaoStage}
                          corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                          corretorAvatarUrl={lead.corretor_id ? corretorAvatars?.[lead.corretor_id] : undefined}
                          parceiroNome={parcerias?.[lead.id]}
                          proximaTarefa={tarefasMap?.[lead.id] ?? null}
                          onClick={() => onSelectLead(lead)}
                          onDragStart={() => {
                            dragLeadId.current = lead.id;
                          }}
                        />
                      </div>
                    ))}
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
