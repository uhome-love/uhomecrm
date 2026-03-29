import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, ArrowRightCircle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT, dateToBRT } from "@/lib/utils";
import type { PipelineStage } from "@/hooks/usePipeline";
import { useAuth } from "@/hooks/useAuth";

type OptionType = "tarefa" | "avancar" | "descartar";

const TIPO_TAREFA_OPTIONS = [
  { value: "follow_up", label: "Follow-up", emoji: "🔄" },
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "enviar_proposta", label: "Enviar proposta", emoji: "📄" },
  { value: "marcar_visita", label: "Marcar visita", emoji: "📅" },
  { value: "enviar_material", label: "Enviar material", emoji: "✉️" },
];

const MOTIVOS_DESCARTE = [
  "Sem interesse",
  "Não atende / não responde",
  "Comprou com concorrente",
  "Sem condição financeira",
  "Perfil incompatível",
  "Lead duplicado",
  "Número inválido",
  "Outro",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  stages: PipelineStage[];
  currentStageId: string;
  onMove: (leadId: string, newStageId: string, observacao?: string) => Promise<void>;
  onReload: () => void;
}

export default function NextActionModal({ open, onOpenChange, leadId, leadNome, stages, currentStageId, onMove, onReload }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<OptionType>("tarefa");
  const [saving, setSaving] = useState(false);

  // Tarefa state
  const [tipoTarefa, setTipoTarefa] = useState("follow_up");
  const [tarefaData, setTarefaData] = useState("");
  const [tarefaHora, setTarefaHora] = useState("");

  // Avançar state
  const [nextStageId, setNextStageId] = useState("");

  // Descartar state
  const [motivoDescarte, setMotivoDescarte] = useState("");
  const [obsDescarte, setObsDescarte] = useState("");

  const availableStages = stages.filter(s => s.id !== currentStageId && s.tipo !== "descarte");
  const descarteStage = stages.find(s => s.tipo === "descarte");

  const resetForm = () => {
    setSelected("tarefa");
    setTipoTarefa("follow_up");
    setTarefaData("");
    setTarefaHora("");
    setNextStageId("");
    setMotivoDescarte("");
    setObsDescarte("");
  };

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (selected === "tarefa") {
        if (!tarefaData) { toast.error("Informe a data da tarefa"); setSaving(false); return; }
        await supabase.from("pipeline_tarefas").insert({
          pipeline_lead_id: leadId,
          titulo: TIPO_TAREFA_OPTIONS.find(t => t.value === tipoTarefa)?.label || tipoTarefa,
          tipo: tipoTarefa,
          prioridade: "media",
          status: "pendente",
          responsavel_id: user.id,
          vence_em: tarefaData,
          hora_vencimento: tarefaHora || null,
          created_by: user.id,
        } as any);
        await supabase.from("pipeline_leads").update({
          proxima_acao: TIPO_TAREFA_OPTIONS.find(t => t.value === tipoTarefa)?.label || tipoTarefa,
          data_proxima_acao: tarefaData,
          ultima_acao_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any).eq("id", leadId);
        toast.success("Tarefa agendada ✅");
      } else if (selected === "avancar") {
        if (!nextStageId) { toast.error("Selecione a etapa"); setSaving(false); return; }
        await onMove(leadId, nextStageId, "Avanço via próxima ação");
        toast.success("Lead avançado ✅");
      } else if (selected === "descartar") {
        if (!motivoDescarte) { toast.error("Selecione o motivo"); setSaving(false); return; }
        const motivoTexto = motivoDescarte === "Outro"
          ? `Descarte: ${obsDescarte.trim() || "Outro motivo"}`
          : `Descarte: ${motivoDescarte}`;
        await supabase.from("pipeline_leads").update({
          motivo_descarte: motivoTexto,
          updated_at: new Date().toISOString(),
        } as any).eq("id", leadId);
        if (descarteStage) {
          await onMove(leadId, descarteStage.id, motivoTexto);
        }
        toast.success("Lead descartado");
      }
      resetForm();
      onOpenChange(false);
      onReload();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const options: { key: OptionType; label: string; icon: any; color: string }[] = [
    { key: "tarefa", label: "Agendar nova tarefa", icon: CalendarPlus, color: "border-primary bg-primary/5 text-primary" },
    { key: "avancar", label: "Avançar etapa", icon: ArrowRightCircle, color: "border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" },
    { key: "descartar", label: "Descartar lead", icon: Trash2, color: "border-destructive bg-destructive/5 text-destructive" },
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button[data-radix-dialog-close]]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            ⚡ Ação registrada! Qual o próximo passo com este lead?
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Lead: <strong>{leadNome}</strong></p>
        </DialogHeader>

        {/* Option selector */}
        <div className="grid grid-cols-3 gap-2">
          {options.map(opt => {
            const Icon = opt.icon;
            const isActive = selected === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center",
                  isActive ? opt.color : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic form */}
        <div className="space-y-3 pt-1">
          {selected === "tarefa" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de tarefa</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIPO_TAREFA_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTipoTarefa(t.value)}
                      className={cn(
                        "text-xs py-1.5 px-2 rounded-md border transition-all",
                        tipoTarefa === t.value
                          ? "border-primary bg-primary/10 font-semibold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data *</label>
                  <Input type="date" value={tarefaData} onChange={(e) => setTarefaData(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Hora (opcional)</label>
                  <Input type="time" value={tarefaHora} onChange={(e) => setTarefaHora(e.target.value)} className="h-9" />
                </div>
              </div>
            </>
          )}

          {selected === "avancar" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mover para qual etapa?</label>
              <Select value={nextStageId} onValueChange={setNextStageId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selected === "descartar" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo do descarte *</label>
                <Select value={motivoDescarte} onValueChange={setMotivoDescarte}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DESCARTE.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observação</label>
                <Textarea
                  value={obsDescarte}
                  onChange={(e) => setObsDescarte(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={handleConfirm} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
