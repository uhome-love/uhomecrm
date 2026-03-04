import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";

interface RecoveredLeadAlertProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RecoveredLeadAlert({ lead, open, onOpenChange }: RecoveredLeadAlertProps) {
  if (!lead) return null;

  const corretorMsg = `🔔 *Lead recuperado: ${lead.nome}*

📍 Interesse: ${lead.interesse || "Não definido"}
📞 Telefone: ${lead.telefone || "—"}
📧 Email: ${lead.email || "—"}

✅ Cliente voltou a responder.
➡️ Retomar contato no Jetimob.

${lead.observacoes ? `📝 Obs: ${lead.observacoes}` : ""}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(corretorMsg);
    toast.success("Mensagem copiada para enviar ao corretor!");
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(corretorMsg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            Lead Recuperado!
          </DialogTitle>
          <DialogDescription>
            Lead pronto para retornar ao fluxo do CRM Jetimob
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-success/20 bg-success/5 p-4">
          <pre className="text-sm whitespace-pre-wrap text-foreground font-sans leading-relaxed">
            {corretorMsg}
          </pre>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          <Button onClick={handleWhatsApp} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
            <MessageSquare className="h-4 w-4" /> Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
