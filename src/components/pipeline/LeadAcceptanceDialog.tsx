import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, X, Phone, MessageCircle, Clock, AlertTriangle, Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingLead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  observacoes: string | null;
  aceite_expira_em: string | null;
  distribuido_em: string | null;
  prioridade_lead: string;
}

interface Props {
  lead: PendingLead | null;
  open: boolean;
  onClose: () => void;
  onResult: () => void;
}

const REJECTION_REASONS = [
  { value: "ocupado", label: "Estou ocupado" },
  { value: "cliente_repetido", label: "Cliente repetido" },
  { value: "fora_regiao", label: "Fora da minha região" },
  { value: "produto_nao_trabalha", label: "Não trabalho este produto" },
  { value: "outro", label: "Outro motivo" },
];

const STATUS_OPTIONS = [
  { value: "ligando_agora", label: "Ligando agora", icon: Phone },
  { value: "whatsapp", label: "Chamando WhatsApp", icon: MessageCircle },
  { value: "nao_atendeu", label: "Não atendeu", icon: X },
  { value: "contato_realizado", label: "Contato realizado", icon: Check },
];

export default function LeadAcceptanceDialog({ lead, open, onClose, onResult }: Props) {
  const [mode, setMode] = useState<"initial" | "rejecting">("initial");
  const [selectedReason, setSelectedReason] = useState("ocupado");
  const [selectedStatus, setSelectedStatus] = useState("ligando_agora");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!lead?.aceite_expira_em || !open) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(lead.aceite_expira_em!).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [lead?.aceite_expira_em, open]);

  // Auto-close when timer expires
  useEffect(() => {
    if (remaining === 0 && open && lead) {
      toast.warning("Tempo expirado! Lead será redistribuído.");
      onClose();
      onResult();
    }
  }, [remaining, open, lead]);

  const handleAccept = useCallback(async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribute-lead", {
        body: { pipeline_lead_id: lead.id, action: "aceitar", status_inicial: selectedStatus },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.reason === "sla_expired" ? "SLA expirado. Lead redistribuído." : "Erro ao aceitar lead.");
      } else {
        toast.success("Lead aceito! Bom atendimento! 🚀");
      }
    } catch (err) {
      toast.error("Erro ao aceitar lead");
    }
    setLoading(false);
    onClose();
    onResult();
  }, [lead, selectedStatus, onClose, onResult]);

  const handleReject = useCallback(async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribute-lead", {
        body: { pipeline_lead_id: lead.id, action: "rejeitar", motivo: selectedReason },
      });
      if (error) throw error;
      toast.info("Lead devolvido à roleta.");
    } catch (err) {
      toast.error("Erro ao rejeitar lead");
    }
    setLoading(false);
    setMode("initial");
    onClose();
    onResult();
  }, [lead, selectedReason, onClose, onResult]);

  if (!lead) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 60;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isUrgent ? "text-destructive animate-pulse" : "text-amber-500"}`} />
            Novo Lead Recebido
          </DialogTitle>
          <DialogDescription>Aceite ou rejeite este lead</DialogDescription>
        </DialogHeader>

        {/* Timer */}
        <div className={`text-center py-2 rounded-lg font-mono text-lg font-bold ${
          isUrgent ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
        }`}>
          <Clock className="inline h-4 w-4 mr-1 -mt-0.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>

        {/* Lead info */}
        <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{lead.nome}</span>
            <Badge variant={lead.prioridade_lead === "alta" ? "destructive" : "secondary"} className="text-[10px]">
              {lead.prioridade_lead === "alta" ? "PRIORIDADE ALTA" : "NORMAL"}
            </Badge>
          </div>
          {lead.telefone && (
            <p className="text-sm text-muted-foreground">📞 {lead.telefone}</p>
          )}
          {lead.email && (
            <p className="text-sm text-muted-foreground">✉️ {lead.email}</p>
          )}
          {lead.empreendimento && (
            <div className="flex items-center gap-1 text-sm">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">{lead.empreendimento}</span>
            </div>
          )}
          {lead.origem && (
            <p className="text-xs text-muted-foreground">Origem: {lead.origem}</p>
          )}
          {lead.observacoes && (
            <p className="text-xs text-muted-foreground italic border-t pt-1 mt-1">"{lead.observacoes}"</p>
          )}
        </div>

        {mode === "initial" ? (
          <>
            {/* Status selection */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Ao aceitar, qual será sua ação?</p>
              <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus} className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <Label
                      key={opt.value}
                      htmlFor={`status-${opt.value}`}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                        selectedStatus === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                      }`}
                    >
                      <RadioGroupItem value={opt.value} id={`status-${opt.value}`} className="sr-only" />
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleAccept} disabled={loading} className="flex-1 gap-2" size="lg">
                <Check className="h-4 w-4" />
                Aceitar Lead
              </Button>
              <Button onClick={() => setMode("rejecting")} disabled={loading} variant="outline" size="lg" className="gap-2">
                <X className="h-4 w-4" />
                Rejeitar
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Rejection reasons */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Motivo da rejeição:</p>
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="space-y-1.5">
                {REJECTION_REASONS.map((r) => (
                  <Label
                    key={r.value}
                    htmlFor={`reason-${r.value}`}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      selectedReason === r.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                    }`}
                  >
                    <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                    {r.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleReject} disabled={loading} variant="destructive" className="flex-1 gap-2">
                <X className="h-4 w-4" />
                Confirmar Rejeição
              </Button>
              <Button onClick={() => setMode("initial")} variant="ghost">
                Voltar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
