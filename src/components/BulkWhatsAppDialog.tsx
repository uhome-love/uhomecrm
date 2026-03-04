import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/lead";
import { Progress } from "@/components/ui/progress";

interface BulkWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}

export default function BulkWhatsAppDialog({ open, onOpenChange, leads }: BulkWhatsAppDialogProps) {
  const [mensagem, setMensagem] = useState(
    "Olá {nome}, tudo bem? Aqui é da UHome Imóveis. Gostaria de saber se ainda tem interesse em imóveis. Temos novidades incríveis! Posso te ajudar?"
  );
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null);

  const leadsComTelefone = leads.filter((l) => l.telefone);

  const handleBulkSend = async () => {
    setSending(true);
    setProgress(0);
    setResults(null);

    let sent = 0;
    let failed = 0;
    const total = leadsComTelefone.length;

    for (let i = 0; i < total; i++) {
      const lead = leadsComTelefone[i];
      const msgPersonalizada = mensagem.replace(/{nome}/g, lead.nome.split(" ")[0]);

      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-send", {
          body: { telefone: lead.telefone, mensagem: msgPersonalizada, nome: lead.nome },
        });
        if (error || !data?.success) {
          failed++;
        } else {
          sent++;
        }
      } catch {
        failed++;
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      // Small delay to avoid rate limiting
      if (i < total - 1) await new Promise((r) => setTimeout(r, 1500));
    }

    setResults({ sent, failed });
    setSending(false);
    toast.success(`Disparo concluído: ${sent} enviados, ${failed} falharam.`);
  };

  const handleClose = () => {
    if (!sending) {
      setResults(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Disparo em Massa — WhatsApp</DialogTitle>
          <DialogDescription>
            Enviar para <strong>{leadsComTelefone.length}</strong> leads com telefone cadastrado.
            Use <code>{"{nome}"}</code> para personalizar com o primeiro nome.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={5}
          disabled={sending}
          className="resize-none"
        />

        {sending && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">{progress}% concluído</p>
          </div>
        )}

        {results && (
          <div className="flex gap-4 justify-center text-sm">
            <span className="flex items-center gap-1 text-primary">
              <CheckCircle className="h-4 w-4" /> {results.sent} enviados
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-4 w-4" /> {results.failed} falharam
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            {results ? "Fechar" : "Cancelar"}
          </Button>
          {!results && (
            <Button onClick={handleBulkSend} disabled={sending || !mensagem.trim()} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : `Enviar para ${leadsComTelefone.length}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
