/**
 * VisitaCompletionFlow — Fluxo fixo de conclusão de tarefa na etapa Visita.
 * Introduzido 2026-07-20.
 *
 * Ramifica por `subtipo` da tarefa `visita_auto`:
 *   - confirmar_visita:  só Observação + Concluir.
 *   - agendar_visita:    ✅ abre VisitaForm; ❌ regressão manual (Qualif/Aquec) + follow-up.
 *   - reagendar_visita:  idêntico ao agendar.
 *   - registrar_resultado: "Aconteceu" → status='realizada'; "Faltou" → status='no_show'.
 *   - pegar_feedback:    ✅ move p/ Em Negociação; ❌ regressão manual.
 *
 * Executa todas as escritas de banco e chama `onConfirm({ already_handled: true })`
 * pra o dialog fechar e o caller rodar a invalidação de queries normalmente.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Handshake,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, dateToBRT } from "@/lib/utils";
import { toast } from "sonner";
import VisitaForm from "@/components/visitas/VisitaForm";
import type { CompletionPayload } from "./types";

export type VisitaSubtipo =
  | "confirmar_visita"
  | "agendar_visita"
  | "reagendar_visita"
  | "registrar_resultado"
  | "pegar_feedback"
  | "atualizar_visita"
  | "decidir_descarte_visita";

export interface VisitaCompletionFlowProps {
  subtipo: VisitaSubtipo;
  tarefaId: string;
  leadId: string;
  leadNome?: string;
  corretorId?: string | null;
  saving: boolean;
  onSaving: (v: boolean) => void;
  onCancel: () => void;
  /** Chamado com already_handled=true depois que este flow completou o trabalho. */
  onConfirm: (payload: CompletionPayload) => Promise<void> | void;
}

const NEXT_TIPO_OPTIONS = [
  { value: "ligacao", label: "📞 Ligar" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "follow_up", label: "👥 Follow-up" },
  { value: "email", label: "📧 E-mail" },
] as const;

const SUBTIPO_HEADER: Record<VisitaSubtipo, { titulo: string; sub: string }> = {
  confirmar_visita: {
    titulo: "Confirmar visita",
    sub: "Registre se o cliente confirmou. A visita segue no fluxo.",
  },
  agendar_visita: {
    titulo: "Agendar visita",
    sub: "Você conseguiu marcar a visita com o cliente?",
  },
  reagendar_visita: {
    titulo: "Reagendar visita",
    sub: "Você conseguiu remarcar a visita?",
  },
  registrar_resultado: {
    titulo: "Registrar resultado da visita",
    sub: "O cliente compareceu?",
  },
  pegar_feedback: {
    titulo: "Pegar feedback",
    sub: "Qual foi o feedback do cliente sobre a visita?",
  },
  atualizar_visita: {
    titulo: "Atualizar visita",
    sub: "Esse lead está na etapa Visita sem visita marcada. Agende agora ou volte o lead.",
  },
  decidir_descarte_visita: {
    titulo: "Decidir descarte (2º no-show)",
    sub: "O cliente faltou 2 vezes seguidas. Reagendar mesmo assim ou descartar?",
  },
};

export default function VisitaCompletionFlow(props: VisitaCompletionFlowProps) {
  const {
    subtipo,
    tarefaId,
    leadId,
    leadNome,
    corretorId,
    saving,
    onSaving,
    onCancel,
    onConfirm,
  } = props;

  const [obs, setObs] = useState("");
  const [visitaFormOpen, setVisitaFormOpen] = useState(false);
  const [regressOpen, setRegressOpen] = useState(false);
  const [regressStageTipo, setRegressStageTipo] = useState<"qualificacao" | "aquecimento" | "">("");
  const [nextTipo, setNextTipo] = useState<string>("ligacao");
  const [nextDate, setNextDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return dateToBRT(d);
  });

  const [stages, setStages] = useState<Record<string, string>>({});
  const [visitaAlvo, setVisitaAlvo] = useState<{
    id: string;
    status: string;
    data_visita: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, tipo")
        .eq("pipeline_tipo", "leads");
      if (cancelled) return;
      const map: Record<string, string> = {};
      (data ?? []).forEach((s: any) => {
        map[s.tipo] = s.id;
      });
      setStages(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (subtipo !== "registrar_resultado" && subtipo !== "pegar_feedback") return;
    let cancelled = false;
    (async () => {
      // Última visita marcada/reagendada/confirmada (para registrar_resultado)
      // ou realizada (para pegar_feedback — não precisamos alterar, só referência)
      const { data } = await supabase
        .from("visitas")
        .select("id, status, data_visita")
        .eq("pipeline_lead_id", leadId)
        .order("data_visita", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setVisitaAlvo(((data ?? [])[0] as any) || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, subtipo]);

  const obsValida = obs.trim().length >= 3;
  const header = SUBTIPO_HEADER[subtipo];

  /** Helpers */
  async function markTaskDone(extraDesc?: string) {
    const now = new Date().toISOString();
    await supabase
      .from("pipeline_tarefas")
      .update({ status: "concluida", concluida_em: now } as never)
      .eq("id", tarefaId);
    await supabase
      .from("pipeline_leads")
      .update({ ultima_acao_at: now, updated_at: now } as never)
      .eq("id", leadId);

    const userId = (await supabase.auth.getUser()).data?.user?.id || "";
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: leadId,
      tipo: "visita",
      tipo_contato: "visita",
      resultado: "respondeu",
      titulo: `Fluxo Visita — ${header.titulo}`,
      descricao: (extraDesc || obs).trim() || null,
      data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      hora: new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
      prioridade: "media",
      status: "concluida",
      created_by: userId,
    } as never);
  }

  async function finish(msg: string) {
    await onConfirm({
      tipo_contato: "visita",
      resultado: "respondeu",
      descricao: obs.trim() || undefined,
      outcome: "concluir",
      already_handled: true,
    } as CompletionPayload);
    toast.success(msg);
  }

  /* ─────────── Ações ─────────── */

  async function handleConfirmarVisita() {
    if (!obsValida) return;
    onSaving(true);
    try {
      await markTaskDone();
      await finish("Confirmação registrada ✅");
    } catch (err) {
      console.error("[VisitaFlow.confirmar]", err);
      toast.error("Erro ao concluir tarefa");
    } finally {
      onSaving(false);
    }
  }

  async function handleAgendouOk() {
    // A visita será salva pelo VisitaForm — o trigger visita_auto_tarefas cria
    // a próxima "Confirmar visita" e cancela pendentes. Aqui só marcamos ESTA
    // tarefa como concluída (evita depender do UPDATE pendentes→cancelada do trigger).
    if (!obsValida) {
      toast.error("Escreva uma observação antes de agendar.");
      return;
    }
    setVisitaFormOpen(true);
  }

  async function handleVisitaFormSaved() {
    onSaving(true);
    try {
      await markTaskDone("Visita agendada via fluxo automático. " + obs.trim());
      await finish("Visita agendada ✅");
    } catch (err) {
      console.error("[VisitaFlow.agendou]", err);
      toast.error("Erro ao finalizar");
    } finally {
      onSaving(false);
    }
  }

  async function handleRegistrarResultado(status: "realizada" | "no_show") {
    if (!obsValida) return;
    if (!visitaAlvo?.id) {
      toast.error("Nenhuma visita marcada encontrada para atualizar.");
      return;
    }
    onSaving(true);
    try {
      const { error } = await supabase
        .from("visitas")
        .update({ status } as never)
        .eq("id", visitaAlvo.id);
      if (error) throw error;
      await markTaskDone(`Resultado: ${status}. ${obs.trim()}`);
      await finish(
        status === "realizada"
          ? "Resultado registrado — feedback agendado ✅"
          : "No-show registrado — reagendar agendado ✅",
      );
    } catch (err) {
      console.error("[VisitaFlow.resultado]", err);
      toast.error("Erro ao registrar resultado");
    } finally {
      onSaving(false);
    }
  }

  async function handleFeedbackPositivo() {
    if (!obsValida) return;
    const negociacaoId = stages["proposta"];
    if (!negociacaoId) {
      toast.error("Etapa Em Negociação não encontrada.");
      return;
    }
    onSaving(true);
    try {
      const now = new Date().toISOString();
      const userId = (await supabase.auth.getUser()).data?.user?.id || "";
      await markTaskDone("Feedback positivo. " + obs.trim());
      const { error } = await supabase
        .from("pipeline_leads")
        .update({
          stage_id: negociacaoId,
          stage_changed_at: now,
          updated_at: now,
        } as never)
        .eq("id", leadId);
      if (error) throw error;
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: leadId,
        stage_novo_id: negociacaoId,
        movido_por: userId,
        observacao: "Movido via fluxo Visita (feedback positivo)",
      } as never);
      await finish("Lead avançou para Em Negociação — preencha valor/status no card 🤝");
    } catch (err) {
      console.error("[VisitaFlow.feedback+]", err);
      toast.error("Erro ao avançar lead");
    } finally {
      onSaving(false);
    }
  }

  async function handleRegressao() {
    if (!obsValida) return;
    if (!regressStageTipo) {
      toast.error("Escolha a etapa de destino.");
      return;
    }
    const stageId = stages[regressStageTipo];
    if (!stageId) {
      toast.error("Etapa de destino não encontrada.");
      return;
    }
    onSaving(true);
    try {
      const now = new Date().toISOString();
      const userId = (await supabase.auth.getUser()).data?.user?.id || "";
      await markTaskDone(`Regressão para ${regressStageTipo}. ${obs.trim()}`);

      // Move stage
      const { error: stErr } = await supabase
        .from("pipeline_leads")
        .update({
          stage_id: stageId,
          stage_changed_at: now,
          updated_at: now,
        } as never)
        .eq("id", leadId);
      if (stErr) throw stErr;
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: leadId,
        stage_novo_id: stageId,
        movido_por: userId,
        observacao: `Movido via fluxo Visita (${subtipo} — não avançou)`,
      } as never);

      // Cria follow-up manual na etapa destino
      const tipoLabel: Record<string, string> = {
        ligacao: "Ligar",
        whatsapp: "WhatsApp",
        follow_up: "Follow-up",
        email: "E-mail",
      };
      const [y, m, d] = nextDate.split("-");
      const dateSuffix = y && m && d ? ` · ${d}/${m}` : "";
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: leadId,
        tipo: nextTipo,
        titulo: `${tipoLabel[nextTipo] || nextTipo}: ${leadNome || "Lead"}${dateSuffix}`,
        descricao: obs.trim() || null,
        prioridade: "media",
        status: "pendente",
        responsavel_id: corretorId || userId,
        vence_em: nextDate,
        hora_vencimento: "10:00",
        created_by: userId,
      } as never);

      await finish(
        `Lead voltou para ${regressStageTipo === "qualificacao" ? "Qualificação" : "Aquecimento"} ✅`,
      );
    } catch (err) {
      console.error("[VisitaFlow.regressao]", err);
      toast.error("Erro ao regredir lead");
    } finally {
      onSaving(false);
    }
  }

  /* ─────────── UI ─────────── */

  const observacaoBox = (
    <div>
      <label className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1 flex items-center gap-1">
        Observação <span className="text-destructive">*</span>
      </label>
      <Textarea
        placeholder="O que aconteceu? (mínimo 3 caracteres)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        rows={2}
        className="resize-none text-xs bg-background border-border text-foreground min-h-[48px]"
      />
    </div>
  );

  const regressBlock = (
    <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 space-y-2.5">
      <div className="text-[11px] font-semibold text-warning-700 dark:text-warning-500 flex items-center gap-1.5">
        <ArrowRight className="w-3 h-3 rotate-180" />
        Voltar lead para etapa anterior
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 block">
          Etapa de destino <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setRegressStageTipo("qualificacao")}
            className={cn(
              "px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
              regressStageTipo === "qualificacao"
                ? "bg-primary/15 border-primary text-foreground ring-2 ring-primary/30"
                : "bg-background border-border text-muted-foreground hover:bg-muted",
            )}
          >
            🔎 Qualificação
          </button>
          <button
            type="button"
            onClick={() => setRegressStageTipo("aquecimento")}
            className={cn(
              "px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
              regressStageTipo === "aquecimento"
                ? "bg-primary/15 border-primary text-foreground ring-2 ring-primary/30"
                : "bg-background border-border text-muted-foreground hover:bg-muted",
            )}
          >
            🔥 Aquecimento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 block">
            Próxima tarefa
          </label>
          <Select value={nextTipo} onValueChange={setNextTipo}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEXT_TIPO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 block">
            Data
          </label>
          <Input
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            className="h-8 text-xs w-[140px]"
          />
        </div>
      </div>

      <Button
        onClick={handleRegressao}
        disabled={!obsValida || !regressStageTipo || saving}
        size="sm"
        className="w-full gap-1.5"
        variant="default"
      >
        <ArrowRight className="w-3 h-3 rotate-180" />
        {saving ? "Salvando..." : "Voltar lead e criar tarefa"}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col max-h-[90vh] max-[420px]:max-h-[92vh]">
      <div className="px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
          🏠 Fluxo Visita
        </div>
        <div className="text-sm font-semibold text-foreground mt-0.5">
          {header.titulo}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {header.sub}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {observacaoBox}

        {/* Ramificação por subtipo */}
        {subtipo === "confirmar_visita" && (
          <Button
            onClick={handleConfirmarVisita}
            disabled={!obsValida || saving}
            className="w-full gap-1.5"
            size="sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {saving ? "Salvando..." : "Concluir confirmação"}
          </Button>
        )}

        {(subtipo === "agendar_visita" || subtipo === "reagendar_visita") && !regressOpen && (
          <div className="space-y-2">
            <Button
              onClick={handleAgendouOk}
              disabled={!obsValida || saving}
              className="w-full gap-1.5 bg-success-500 hover:bg-success-600 text-white"
              size="sm"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              ✅ {subtipo === "agendar_visita" ? "Consegui agendar" : "Consegui remarcar"}
            </Button>
            <Button
              onClick={() => setRegressOpen(true)}
              disabled={saving}
              variant="outline"
              className="w-full gap-1.5"
              size="sm"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              ❌ Não consegui — voltar lead
            </Button>
          </div>
        )}

        {(subtipo === "agendar_visita" || subtipo === "reagendar_visita") && regressOpen && (
          <>
            {regressBlock}
            <button
              type="button"
              onClick={() => setRegressOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              ← voltar
            </button>
          </>
        )}

        {subtipo === "registrar_resultado" && (
          <div className="space-y-2">
            {!visitaAlvo && (
              <div className="text-[11px] text-warning-700 dark:text-warning-500 bg-warning-500/10 border border-warning-500/30 rounded-md p-2">
                ⚠ Nenhuma visita marcada encontrada. Confirme se o agendamento existe.
              </div>
            )}
            <Button
              onClick={() => handleRegistrarResultado("realizada")}
              disabled={!obsValida || saving || !visitaAlvo}
              className="w-full gap-1.5 bg-success-500 hover:bg-success-600 text-white"
              size="sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              ✅ Aconteceu (marcar como realizada)
            </Button>
            <Button
              onClick={() => handleRegistrarResultado("no_show")}
              disabled={!obsValida || saving || !visitaAlvo}
              variant="outline"
              className="w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
              size="sm"
            >
              <X className="w-3.5 h-3.5" />
              ❌ Faltou (no-show)
            </Button>
          </div>
        )}

        {subtipo === "pegar_feedback" && !regressOpen && (
          <div className="space-y-2">
            <Button
              onClick={handleFeedbackPositivo}
              disabled={!obsValida || saving}
              className="w-full gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              size="sm"
            >
              <Handshake className="w-3.5 h-3.5" />
              ✅ Positivo — avançar p/ Em Negociação
            </Button>
            <Button
              onClick={() => setRegressOpen(true)}
              disabled={saving}
              variant="outline"
              className="w-full gap-1.5"
              size="sm"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              ❌ Negativo — voltar lead
            </Button>
          </div>
        )}

        {subtipo === "pegar_feedback" && regressOpen && (
          <>
            {regressBlock}
            <button
              type="button"
              onClick={() => setRegressOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              ← voltar
            </button>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/60 bg-card shrink-0 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>

      {/* Agendador da Agenda de Visitas (componente real reutilizado) */}
      {visitaFormOpen && (
        <VisitaForm
          open={visitaFormOpen}
          onClose={() => {
            setVisitaFormOpen(false);
          }}
          onSubmit={async (data) => {
            const { data: inserted, error } = await supabase
              .from("visitas")
              .insert({
                ...(data as any),
                pipeline_lead_id: leadId,
                nome_cliente: (data as any).nome_cliente || leadNome || "Lead",
                status: "marcada",
                corretor_id: (data as any).corretor_id || corretorId || undefined,
                created_by: (await supabase.auth.getUser()).data?.user?.id,
              } as never)
              .select()
              .single();
            if (error) {
              toast.error("Erro ao agendar visita: " + error.message);
              return null;
            }
            setVisitaFormOpen(false);
            await handleVisitaFormSaved();
            return inserted;
          }}
          initialData={
            {
              nome_cliente: leadNome,
              corretor_id: corretorId || undefined,
              pipeline_lead_id: leadId,
            } as any
          }
        />
      )}
    </div>
  );
}
