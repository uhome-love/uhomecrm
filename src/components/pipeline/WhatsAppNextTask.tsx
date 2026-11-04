import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PRESET_OUTRO_ID, type TaskPreset } from "@/lib/taskPresets";

export const WHATSAPP_TASK_TYPES = [
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
];

interface Props {
  stageTipo?: string;
  obs: string;
  onObs: (value: string) => void;
  presets: TaskPreset[];
  selectedPresetId: string | null;
  onPreset: (preset: TaskPreset) => void;
  taskType: string;
  onTaskType: (value: string) => void;
  taskDate: string;
  onTaskDate: (value: string) => void;
  taskTime: string;
  onTaskTime: (value: string) => void;
}

/** Apresentação da segunda etapa; as regras de gravação permanecem no fluxo. */
export function WhatsAppNextTask(props: Props) {
  const hasPresets = props.presets.length > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm font-semibold text-success">
        <Check className="h-4 w-4" /> WhatsApp enviado ✓
      </div>
      <div className="space-y-2">
        <label htmlFor="whatsapp-observacao" className="text-xs font-semibold text-foreground">Observação (opcional)</label>
        <Textarea id="whatsapp-observacao" className="min-h-20 text-base sm:text-sm" placeholder="Observação do contato…" value={props.obs} onChange={e => props.onObs(e.target.value)} />
      </div>
      {props.stageTipo === "visita" ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-700 dark:text-warning">
          <p className="font-semibold">Etapa Visita — tarefas automáticas</p>
          <p>Confirmação, remarcação e feedback são geradas pelo sistema.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">📋 Próxima tarefa</p>
          {hasPresets && <div className="flex flex-wrap gap-1.5">{props.presets.map(p => {
            const Icon = p.Icon;
            return <Button key={p.id} size="sm" variant={props.selectedPresetId === p.id ? "default" : "outline"}
              className="text-xs" onClick={() => props.onPreset(p)}><Icon />{p.label}</Button>;
          })}</div>}
          {(!hasPresets || props.selectedPresetId === PRESET_OUTRO_ID) && (
            <div className="flex flex-wrap gap-1.5">{WHATSAPP_TASK_TYPES.map(t => (
              <Button key={t.value} size="sm" variant="outline" onClick={() => props.onTaskType(t.value)}
                className={cn("text-xs", props.taskType === t.value && "border-primary bg-primary text-primary-foreground")}>
                {t.emoji} {t.label}
              </Button>
            ))}</div>
          )}
          <div className="flex gap-2">
            <Input aria-label="Data da próxima tarefa" type="date" className="min-w-0 flex-1 text-base sm:text-sm" value={props.taskDate} onChange={e => props.onTaskDate(e.target.value)} />
            <Input aria-label="Hora da próxima tarefa" type="time" className="w-28 text-base sm:text-sm" value={props.taskTime} onChange={e => props.onTaskTime(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}