import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Calendar, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/customClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useCalendarIntegration, sendVisitaInvite } from "@/hooks/useCalendarIntegration";
import { useQueryClient } from "@tanstack/react-query";
import type { PipelineLead, PipelineStage } from "@/hooks/usePipeline";

function cleanName(name: string) {
  if (!name) return "";
  const half = Math.floor(name.length / 2);
  const firstHalf = name.substring(0, half).trim();
  const secondHalf = name.substring(half).trim();
  if (firstHalf === secondHalf) return firstHalf;
  return name;
}

interface CardScheduleVisitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: PipelineLead;
  stages: PipelineStage[];
  onMoveLead?: (leadId: string, stageId: string) => void;
}

export default function CardScheduleVisitDialog({ open, onOpenChange, lead, stages, onMoveLead }: CardScheduleVisitDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { integration, isLoading: integLoading } = useCalendarIntegration();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("10:00");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!integration?.connected) setSendInvite(false);
    else setSendInvite(true);
  }, [integration?.connected]);

  const handleSubmit = useCallback(async () => {
    if (!date || !user) return;
    setSubmitting(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const { data: inserted, error } = await supabase
        .from("visitas")
        .insert({
          nome_cliente: lead.nome,
          data_visita: dateStr,
          hora_visita: time,
          empreendimento: lead.empreendimento || "",
          corretor_id: lead.corretor_id || user.id,
          origem: "pipeline",
          status: "marcada",
          gerente_id: user.id,
          created_by: user.id,
          pipeline_lead_id: lead.id,
          local_visita: local || null,
          observacoes: obs || null,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Update lead's last action timestamp
      await supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", lead.id);

      // Invalidate caches so Agenda + widgets refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["visitas"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-visitas"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-widget-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
      ]);

      if (onMoveLead) {
        const visitaStage = stages.find(s => s.nome.toLowerCase().includes("visita marcada") || s.tipo === "visita");
        if (visitaStage) onMoveLead(lead.id, visitaStage.id);
      }

      // Enviar invite Google se conectado e marcado
      if (sendInvite && integration?.connected && inserted?.id) {
        try {
          const result = await sendVisitaInvite(inserted.id);
          toast.success(
            result?.cliente_recebeu_email
              ? "📅 Visita agendada e convite enviado ao cliente"
              : "📅 Visita agendada e adicionada ao seu Google Calendar (cliente sem e-mail)",
          );
        } catch (e: any) {
          toast.warning(`Visita criada, mas falhou ao enviar convite: ${e.message}`);
        }
      } else {
        toast.success("📅 Visita agendada e lead movido");
      }

      onOpenChange(false);
      setDate(undefined);
      setLocal("");
      setObs("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao agendar visita");
    } finally {
      setSubmitting(false);
    }
  }, [date, time, local, obs, user, lead, stages, onMoveLead, onOpenChange, sendInvite, integration?.connected, queryClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] p-5 gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-0 mb-1">
          <DialogTitle className="text-base font-semibold">📅 Agendar Visita</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{cleanName(lead.nome)}</p>
        </DialogHeader>
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={setDate}
          className={cn("p-0 mx-auto pointer-events-auto border rounded-md")}
          locale={ptBR}
          disabled={(d) => d < startOfDay(new Date())}
        />
        <div className="space-y-3 mt-1">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Horário</label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm w-full" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Empreendimento</label>
            <div className="text-sm font-medium text-foreground">
              {lead.empreendimento || <span className="text-amber-500">Sem empreendimento definido</span>}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Local da visita (opcional)</label>
            <Input placeholder="Ex: Stand do empreendimento, sala 3..." value={local} onChange={(e) => setLocal(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Observações (opcional)</label>
            <Input placeholder="Ex: Cliente prefere período da tarde..." value={obs} onChange={(e) => setObs(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* Bloco Confirmação Google Calendar */}
          <div className="rounded-md border p-2.5 text-xs space-y-2">
            {integLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando Google Agenda...
              </div>
            ) : integration?.connected ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Google Agenda conectada</span>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    Enviar convite Google ao cliente (e-mail oficial com botões Sim/Talvez/Não)
                  </span>
                </label>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Conecte sua Google Agenda para enviar convite ao cliente.</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/integracoes");
                  }}
                >
                  Conectar agora
                </Button>
              </div>
            )}
          </div>

          <Button
            className="w-full h-9 text-sm font-semibold mt-1"
            disabled={!date || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-1.5" />
            )}
            {sendInvite && integration?.connected ? "Marcar Visita + Enviar Convite" : "Marcar Visita"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
