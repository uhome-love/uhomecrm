import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayBRT, dateToBRT } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { TIPO_LABELS } from "./CardStatusLine";

const CARD_QUICK_TASK_TYPES = [
  { value: "ligar", label: "Ligar", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "follow_up", label: "Follow-up", emoji: "📋" },
  { value: "marcar_visita", label: "Visita", emoji: "🏠" },
  { value: "enviar_proposta", label: "Proposta", emoji: "📄" },
];

interface CardQuickTaskPopoverProps {
  leadId: string;
  leadNome: string;
}

export default function CardQuickTaskPopover({ leadId, leadNome }: CardQuickTaskPopoverProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("follow_up");
  const [obs, setObs] = useState("");
  const [obsError, setObsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customDate, setCustomDate] = useState<Date>();
  const [time, setTime] = useState("10:00");
  const [dateMode, setDateMode] = useState<"hoje" | "amanha" | "custom">("hoje");

  const handleCreate = useCallback(async () => {
    if (!user) { toast.error("Faça login primeiro"); return; }
    if (!obs.trim()) { setObsError(true); toast.error("Preencha a observação da tarefa"); return; }
    setSaving(true);
    try {
      let venceEm: string;
      if (dateMode === "hoje") {
        venceEm = todayBRT();
      } else if (dateMode === "amanha") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        venceEm = dateToBRT(tomorrow);
      } else if (customDate) {
        venceEm = dateToBRT(customDate);
      } else {
        toast.error("Selecione uma data");
        setSaving(false);
        return;
      }
      const titulo = `${TIPO_LABELS[type] || type}: ${leadNome || "Lead"}`;
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: leadId,
        titulo,
        descricao: obs,
        tipo: type,
        vence_em: venceEm,
        hora_vencimento: time || null,
        prioridade: "media",
        status: "pendente",
        created_by: user.id,
        responsavel_id: user.id,
      } as any);
      await supabase.from("pipeline_leads").update({
        proxima_acao: TIPO_LABELS[type] || titulo,
        data_proxima_acao: venceEm,
        updated_at: new Date().toISOString(),
      } as any).eq("id", leadId);
      const dateLabel = dateMode === "hoje" ? "hoje" : dateMode === "amanha" ? "amanhã" : format(customDate!, "dd/MM");
      toast.success(`Tarefa "${TIPO_LABELS[type]}" criada para ${dateLabel} às ${time} ✅`);
      setOpen(false);
      setObs("");
      setObsError(false);
      setType("follow_up");
      setDateMode("hoje");
      setCustomDate(undefined);
      setTime("10:00");
    } catch (err: any) {
      toast.error("Erro ao criar tarefa: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }, [user, obs, dateMode, customDate, time, type, leadId, leadNome]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px] text-[11px] px-3 gap-1.5 font-semibold text-foreground/80 hover:bg-accent hover:text-foreground rounded-lg"
          title="Criar tarefa rápida"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Tarefa</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-bold text-foreground">➕ Tarefa rápida para {leadNome?.split(" ")[0]}</p>
        <div className="flex flex-wrap gap-1">
          {CARD_QUICK_TASK_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-md border transition-colors",
                type === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <Input
          className={cn("h-7 text-[11px]", obsError && !obs.trim() && "border-destructive")}
          placeholder="Obs (obrigatório): ex. Retornar sobre financiamento"
          value={obs}
          onChange={e => { setObs(e.target.value); setObsError(false); }}
          onKeyDown={e => { if (e.key === "Enter" && obs.trim()) handleCreate(); }}
        />
        {obsError && !obs.trim() && (
          <p className="text-[9px] text-destructive">⚠️ Observação obrigatória</p>
        )}
        <div className="flex gap-1">
          {([
            { value: "hoje" as const, label: "Hoje" },
            { value: "amanha" as const, label: "Amanhã" },
            { value: "custom" as const, label: "📅 Data" },
          ]).map(d => (
            <button
              key={d.value}
              onClick={() => setDateMode(d.value)}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-md border transition-colors flex-1",
                dateMode === d.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        {dateMode === "custom" && (
          <div className="border border-border rounded-md overflow-hidden">
            <CalendarPicker
              mode="single"
              selected={customDate}
              onSelect={(d) => setCustomDate(d as Date | undefined)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-1 pointer-events-auto text-[10px] [&_.rdp-day]:h-7 [&_.rdp-day]:w-7 [&_.rdp-head_cell]:text-[9px]")}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground font-medium shrink-0">⏰ Horário:</label>
          <Input type="time" className="h-7 text-[11px] flex-1" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <Button
          size="sm"
          className="h-7 text-[11px] w-full gap-1"
          disabled={saving || (dateMode === "custom" && !customDate)}
          onClick={() => handleCreate()}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "✅ Criar Tarefa"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
