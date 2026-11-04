import { registrarAtividadeComAviso } from "@/lib/registrarAtividade";
import { useState, useCallback, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProfileNames } from "@/hooks/useProfileNames";
import { useWhatsAppProduto } from "@/hooks/useWhatsAppProduto";
import { gerarMensagensWhatsApp, rotuloEtapaWhatsApp } from "@/lib/whatsappMensagens";
import { WhatsAppMessagePicker } from "./WhatsAppMessagePicker";
import { WhatsAppNextTask, WHATSAPP_TASK_TYPES } from "./WhatsAppNextTask";
import { getPresetsForStage, applyPresetToTarefa, PRESET_OUTRO_ID, type TaskPreset } from "@/lib/taskPresets";
import { registrarToque } from "@/lib/registrarToque";


interface WhatsAppFocusFlowProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    nome: string;
    telefone: string | null | undefined;
    empreendimento: string | null | undefined;
    stage_id: string;
  };
  stageTipo: string | undefined;
  onRefresh: () => void;
}

export default function WhatsAppFocusFlow({ isOpen, onClose, lead, stageTipo, onRefresh }: WhatsAppFocusFlowProps) {
  const { user } = useAuth();
  const profileNames = useProfileNames();
  const productQuery = useWhatsAppProduto(isOpen, lead.id, lead.empreendimento);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [obs, setObs] = useState("");
  const [taskType, setTaskType] = useState("whatsapp");
  const [taskDate, setTaskDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [taskTime, setTaskTime] = useState("10:00");
  // Presets Fase B — chips por etapa (Qualif/Aquec/Negoc)
  const stagePresets = useMemo(() => getPresetsForStage(stageTipo), [stageTipo]);
  const hasPresets = stagePresets.length > 0;
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const selectedPreset = useMemo<TaskPreset | null>(
    () => stagePresets.find((p) => p.id === selectedPresetId) ?? null,
    [stagePresets, selectedPresetId],
  );

  const handlePickPreset = (p: TaskPreset) => {
    setSelectedPresetId(p.id);
    if (p.id === PRESET_OUTRO_ID) return;
    const payload = applyPresetToTarefa(p);
    setTaskType(payload.tipo);
    setTaskDate(payload.vence_em);
    setTaskTime(payload.hora_vencimento || "10:00");
    if (payload.obs && !obs.trim()) setObs(payload.obs);
  };


  const flags = productQuery.data?.flagStatus;
  const statusVisita = flags && typeof flags === "object" && !Array.isArray(flags)
    && typeof flags.status_visita === "string" ? flags.status_visita : undefined;
  const metadataNome: unknown = user?.user_metadata?.nome;
  const corretorNome = (user ? profileNames[user.id] : undefined)
    || (typeof metadataNome === "string" ? metadataNome : undefined);
  const messages = useMemo(() => gerarMensagensWhatsApp({
    stageTipo, statusVisita, nome: lead.nome, corretorNome,
    empreendimento: lead.empreendimento, produto: productQuery.data?.produto,
  }), [stageTipo, statusVisita, lead.nome, corretorNome, lead.empreendimento, productQuery.data?.produto]);

  const phone = useMemo(() => {
    if (!lead.telefone) return "";
    const digits = lead.telefone.replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("55") ? digits : `55${digits}`;
  }, [lead.telefone]);

  const registerActivity = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      registrarAtividadeComAviso({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: "WhatsApp enviado",
        data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
      }),
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id),
    ]);
    // Toque humano do corretor (aditivo)
    await registrarToque(lead.id);
  }, [user, lead.id]);


  const sendMessage = async (msg: string, action: "copy" | "open") => {
    if (!msg.trim() || sendingRef.current || !user || (action === "open" && !phone)) return;
    sendingRef.current = true;
    setSending(true);
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(msg);
        toast.success("Mensagem copiada!");
      } else {
        // Abrir antes de aguardar o registro evita o bloqueio de pop-up.
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
      }
      await registerActivity();
      setPhase(2);
    } catch {
      toast.error(action === "copy" ? "Não foi possível copiar ou registrar o contato. Tente novamente." : "Não foi possível registrar o contato. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleSaveTask = async () => {
    if (!user) return;
    if (hasPresets && !selectedPresetId) {
      toast.error("Escolha um tipo de tarefa");
      return;
    }
    setSaving(true);
    try {
      const activePreset = selectedPreset && selectedPreset.id !== PRESET_OUTRO_ID ? selectedPreset : null;
      const titulo = activePreset
        ? activePreset.label
        : `${WHATSAPP_TASK_TYPES.find(t => t.value === taskType)?.label || taskType} — ${lead.nome}`;
      // Em Visita: presets manuais coexistem com automação da Agenda
      // (confirmar/reagendar/feedback continuam sendo criados automaticamente).
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: lead.id,
        titulo,
        descricao: obs || null,
        tipo: taskType,
        vence_em: taskDate,
        hora_vencimento: taskTime || null,
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
        responsavel_id: user.id,
      });


      // Sync flag_status quando preset carrega status da etapa.
      let flagPatch: Record<string, string> | null = null;
      if (activePreset?.syncFlagKey && activePreset?.syncFlagValue) {
        const { data: leadRow } = await supabase
          .from("pipeline_leads")
          .select("flag_status")
          .eq("id", lead.id)
          .maybeSingle();
        const rawFlags = leadRow?.flag_status;
        const currentFlags: Record<string, string> = {};
        if (rawFlags && typeof rawFlags === "object" && !Array.isArray(rawFlags)) {
          for (const [key, value] of Object.entries(rawFlags)) {
            if (typeof value === "string") currentFlags[key] = value;
          }
        }
        flagPatch = { ...currentFlags, [activePreset.syncFlagKey]: activePreset.syncFlagValue };
      }

      await supabase.from("pipeline_leads").update({
        proxima_acao: titulo,
        data_proxima_acao: taskDate,
        updated_at: new Date().toISOString(),
        ...(flagPatch ? { flag_status: flagPatch } : {}),
      }).eq("id", lead.id);
      toast.success("Tarefa criada ✅");
      onRefresh();
      handleClose();
    } catch (err: unknown) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Não foi possível salvar a tarefa"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPhase(1);
    setObs("");
    setTaskType("whatsapp");
    setTaskTime("10:00");
    setSelectedPresetId(null);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setTaskDate(d.toISOString().split("T")[0]);
    onClose();
  };


  if (!isOpen) return null;

  const initials = lead.nome?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !sending && !saving) handleClose(); }}>
      <DialogContent aria-describedby="whatsapp-lead-description"
        className="z-[70] flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 pt-4 sm:max-w-[480px] sm:p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-sm font-bold text-success">{initials}</div>
            <div className="min-w-0">
              <DialogTitle className="break-words text-base font-bold">{lead.nome}</DialogTitle>
              <DialogDescription id="whatsapp-lead-description" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {lead.telefone || "Sem telefone"}
                <span className="rounded bg-success/10 px-1.5 py-0.5 font-semibold text-success">{rotuloEtapaWhatsApp(stageTipo, statusVisita)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {phase === 1 ? (
            <>
              {productQuery.isFetching && <div role="status" className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Conferindo empreendimento…</div>}
              <WhatsAppMessagePicker key={lead.id} messages={messages} hasPhone={!!phone} busy={sending || !user}
                onCopy={msg => void sendMessage(msg, "copy")} onOpen={msg => void sendMessage(msg, "open")} />
            </>
          ) : (
            <WhatsAppNextTask stageTipo={stageTipo} obs={obs} onObs={setObs} presets={stagePresets}
              selectedPresetId={selectedPresetId} onPreset={handlePickPreset} taskType={taskType} onTaskType={setTaskType}
              taskDate={taskDate} onTaskDate={setTaskDate} taskTime={taskTime} onTaskTime={setTaskTime} />
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {phase === 1 ? <Button variant="outline" disabled={sending} onClick={handleClose}>Cancelar</Button> : <>
            <Button variant="outline" disabled={saving} onClick={handleClose}>Fechar sem tarefa</Button>
            <Button disabled={saving} onClick={handleSaveTask}>{saving ? "Salvando…" : "Salvar e fechar"}</Button>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
