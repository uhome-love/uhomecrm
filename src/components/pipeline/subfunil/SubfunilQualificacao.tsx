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
import { ArrowLeft, Building2, CalendarClock, Loader2, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CardMinimalProximaTarefa } from "../CardMinimal";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";
import { QUALIFICACAO_SUBSTATUS, normalizeStatusAtendimento } from "@/lib/leadHelpers";
import { getSaudeToque, type SaudeEstado } from "@/lib/leadSaude";
import { formatNextAction } from "@/lib/formatNextAction";
import TermometroBadge from "../TermometroBadge";

const SEM_STATUS = "__sem_status__";
const COLUMN_WIDTH = 272;

/** Dica de fluxo (para onde o lead vai depois) por substatus. */
const FLUXO_HINT: Record<string, string> = {
  contato_inicial: "→ Alinhando perfil",
  alinhamento_perfil: "→ Busca de imóveis",
  busca: "→ Follow up / Visita",
  follow_up: "→ Alinhando visita",
  alinhando_visita: "→ vira etapa Visita",
};

/** Quebra "📞 Contato inicial" em emoji + texto. */
function splitLabel(label: string): { emoji: string; text: string } {
  const parts = label.trim().split(/\s+/);
  if (parts.length > 1 && !/^[\wÀ-ÿ]/.test(parts[0])) {
    return { emoji: parts[0], text: parts.slice(1).join(" ") };
  }
  return { emoji: "•", text: label };
}

/** Saúde vira MOLDURA do card (borda tingida + glow suave). */
const SAUDE_FRAME: Record<SaudeEstado, string> = {
  neutro: "border-border shadow-sm",
  em_dia: "border-border shadow-sm",
  desatualizado: "border-amber-300/70 dark:border-amber-500/40 shadow-md shadow-amber-500/20",
  em_estagnacao: "border-red-300/80 dark:border-red-500/40 shadow-md shadow-red-500/25",
};

/** Dot do indicador de dias (sem fundo de pílula). */
const SAUDE_DOT: Record<SaudeEstado, string> = {
  neutro: "bg-muted-foreground/50",
  em_dia: "bg-emerald-500",
  desatualizado: "bg-amber-500",
  em_estagnacao: "bg-red-500",
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
  corretorAvatars,
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
  // leadId → nome CANÔNICO do empreendimento (não o nome do formulário/campanha).
  const [empreendimentoCanonico, setEmpreendimentoCanonico] = useState<Record<string, string>>({});

  const qualificacaoStage = useMemo(
    () => stages.find((s) => s.tipo === "qualificacao"),
    [stages]
  );

  const qualificacaoLeads = useMemo(
    () => (qualificacaoStage ? leads.filter((l) => l.stage_id === qualificacaoStage.id) : []),
    [leads, qualificacaoStage]
  );

  // Enriquecimento só-visual: resolve o empreendimento CANÔNICO (nome do produto),
  // e não `pipeline_leads.empreendimento` (que guarda o nome do formulário/campanha).
  useEffect(() => {
    let cancelled = false;
    const stageId = qualificacaoStage?.id;
    if (!stageId) {
      setEmpreendimentoCanonico({});
      return;
    }
    (async () => {
      const [canonRes, leadsRes] = await Promise.all([
        supabase.from("empreendimentos_canonicos").select("id, nome"),
        (async () => {
          const rows: Array<{ id: string; empreendimento_canonico_id: string | null }> = [];
          for (let from = 0; from < 5000; from += 1000) {
            const { data, error } = await supabase
              .from("pipeline_leads")
              .select("id, empreendimento_canonico_id")
              .eq("stage_id", stageId)
              .range(from, from + 999);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as typeof rows));
            if (data.length < 1000) break;
          }
          return rows;
        })(),
      ]);
      if (cancelled) return;
      const nomes: Record<string, string> = {};
      for (const c of (canonRes.data ?? []) as Array<{ id: string; nome: string }>) {
        nomes[c.id] = c.nome;
      }
      const map: Record<string, string> = {};
      for (const row of leadsRes) {
        const nome = row.empreendimento_canonico_id
          ? nomes[row.empreendimento_canonico_id]
          : undefined;
        if (nome) map[row.id] = nome;
      }
      setEmpreendimentoCanonico(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [qualificacaoStage?.id]);



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
      {/* Header slim */}
      <div className="shrink-0 flex items-center gap-3 pb-2.5 mb-3 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-2.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <Search className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-[15px] font-bold tracking-tight text-foreground whitespace-nowrap">
          Subfunil de Qualificação
        </h2>
        <span className="text-[12px] text-muted-foreground truncate hidden md:inline">
          Arraste o lead entre as colunas — grava só o substatus, não muda a etapa.
        </span>
        <span className="ml-auto shrink-0 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 tabular-nums">
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
              const { emoji, text } = splitLabel(col.label);
              return (
                <div
                  key={col.key}
                  className={`flex flex-col shrink-0 h-full rounded-2xl border p-2 transition-colors ${
                    isSemStatus
                      ? "border-amber-400/70 bg-amber-50/60 dark:bg-amber-500/5"
                      : isOver
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/40"
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
                      <span className="w-6 h-6 rounded-lg bg-card border border-border inline-flex items-center justify-center text-[12px] shrink-0">
                        {emoji}
                      </span>
                      <span
                        className={`text-[12.5px] font-bold truncate ${
                          isSemStatus ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                        }`}
                      >
                        {text}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 tabular-nums">
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
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 pt-1 px-1 -mx-1">

                    {colLeads.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border py-6 text-center text-[10.5px] text-muted-foreground">
                        {isSemStatus ? "Nenhum lead sem status" : "Arraste um lead para cá"}
                      </div>
                    )}
                    {colLeads.map((lead) => {
                      const saude = getSaudeToque(lead, "qualificacao", tarefasMap?.[lead.id] ?? null);
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
                          className={`group relative cursor-pointer rounded-xl border bg-card p-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${SAUDE_FRAME[saude.estado]}`}
                        >
                          {savingId === lead.id && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}

                          <div className="text-[14px] font-bold tracking-tight text-foreground truncate">
                            {lead.nome || "Sem nome"}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground min-w-0">
                            <Building2 className="h-3 w-3 opacity-60 shrink-0" />
                            <span className="truncate">{empreendimento || "Sem empreendimento"}</span>
                          </div>

                          {/* Fileira meta: termômetro + dias sem toque */}
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <TermometroBadge
                              temperatura={lead.temperatura}
                              score={lead.oportunidade_score}
                            />
                            <span
                              className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground"
                              title={`${saude.diasSemToque} ${saude.diasSemToque === 1 ? "dia" : "dias"} sem toque`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${SAUDE_DOT[saude.estado]}`} />
                              <span className="tabular-nums">{saudeTexto}</span>
                            </span>
                          </div>

                          {/* Próxima ação (só quando existe tarefa) */}
                          {tarefa && (
                            <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5 min-w-0">
                              <CalendarClock className="h-3 w-3 opacity-60 shrink-0" />
                              <span className="truncate">{formatNextAction(tarefa)}</span>
                            </div>
                          )}

                          {/* Rodapé */}
                          <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center gap-2">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={corretor ?? "Corretor"}
                                className="h-6 w-6 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-cyan-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {iniciais || "—"}
                              </span>
                            )}
                            <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">
                              {corretor ? corretor.split(" ")[0] : "Sem corretor"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO Build 3: RegistrarAtividadeDialog
                                onSelectLead(lead);
                              }}
                              className="ml-auto shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-7 px-3 text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
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
