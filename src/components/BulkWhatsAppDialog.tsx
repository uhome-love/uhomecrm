import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CheckCircle, XCircle, MessageSquare, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/lead";
import { Progress } from "@/components/ui/progress";

type Canal = "whatsapp" | "sms" | "email";

interface BulkWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}

const canalConfig: Record<Canal, { label: string; icon: typeof MessageSquare; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-success/10 text-success border-success/30" },
  sms: { label: "SMS", icon: Phone, color: "bg-info/10 text-info border-info/30" },
  email: { label: "E-mail", icon: Mail, color: "bg-primary/10 text-primary border-primary/30" },
};

const defaultMessages: Record<Canal, string> = {
  whatsapp: "Olá {nome}, tudo bem? Aqui é da UHome Imóveis. Gostaria de saber se ainda tem interesse em imóveis. Temos novidades incríveis! Posso te ajudar?",
  sms: "Olá {nome}! UHome Imóveis aqui. Temos novidades em imóveis para você. Responda SIM para saber mais!",
  email: "Olá {nome},\n\nEsperamos que esteja bem! Passando para compartilhar novidades da UHome Imóveis.\n\nTemos opções incríveis que podem ser perfeitas para você. Gostaria de saber mais?\n\nAbraço,\nEquipe UHome",
};

export default function BulkWhatsAppDialog({ open, onOpenChange, leads }: BulkWhatsAppDialogProps) {
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [mensagem, setMensagem] = useState(defaultMessages.whatsapp);
  const [assunto, setAssunto] = useState("Novidades UHome Imóveis para você, {nome}!");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null);

  const leadsComTelefone = leads.filter((l) => l.telefone);
  const leadsComEmail = leads.filter((l) => l.email);

  const targetLeads = canal === "email" ? leadsComEmail : leadsComTelefone;

  const handleCanalChange = (newCanal: Canal) => {
    setCanal(newCanal);
    setMensagem(defaultMessages[newCanal]);
    setResults(null);
  };

  const handleBulkSend = async () => {
    setSending(true);
    setProgress(0);
    setResults(null);

    let sent = 0;
    let failed = 0;
    const total = targetLeads.length;

    for (let i = 0; i < total; i++) {
      const lead = targetLeads[i];
      const msgPersonalizada = mensagem.replace(/{nome}/g, lead.nome.split(" ")[0]);
      const assuntoPersonalizado = assunto.replace(/{nome}/g, lead.nome.split(" ")[0]);

      try {
        if (canal === "whatsapp") {
          const { data, error } = await supabase.functions.invoke("whatsapp-send", {
            body: { telefone: lead.telefone, mensagem: msgPersonalizada, nome: lead.nome },
          });
          if (error || !data?.success) failed++;
          else sent++;
        } else if (canal === "sms") {
          // SMS: use wa.me link as fallback for now, log as SMS
          const phone = (lead.telefone || "").replace(/\D/g, "");
          const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
          // Open SMS link (browser-based)
          window.open(`sms:+${fullPhone}?body=${encodeURIComponent(msgPersonalizada)}`, "_blank");
          sent++;
        } else if (canal === "email") {
          // Email: open mailto as fallback
          const mailto = `mailto:${lead.email}?subject=${encodeURIComponent(assuntoPersonalizado)}&body=${encodeURIComponent(msgPersonalizada)}`;
          window.open(mailto, "_blank");
          sent++;
        }
      } catch {
        failed++;
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      if (canal === "whatsapp" && i < total - 1) await new Promise((r) => setTimeout(r, 1500));
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
          <DialogTitle>Disparo em Massa</DialogTitle>
          <DialogDescription>
            Escolha o canal e envie mensagens personalizadas para seus leads.
            Use <code>{"{nome}"}</code> para personalizar.
          </DialogDescription>
        </DialogHeader>

        {/* Canal selector */}
        <div className="flex gap-2">
          {(Object.keys(canalConfig) as Canal[]).map((c) => {
            const cfg = canalConfig[c];
            const Icon = cfg.icon;
            const count = c === "email" ? leadsComEmail.length : leadsComTelefone.length;
            return (
              <button
                key={c}
                onClick={() => handleCanalChange(c)}
                disabled={sending}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                  canal === c
                    ? `${cfg.color} border-current ring-1 ring-current/20`
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{cfg.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
          {canal === "email"
            ? `${leadsComEmail.length} leads com e-mail cadastrado`
            : `${leadsComTelefone.length} leads com telefone cadastrado`}
        </div>

        {canal === "email" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Assunto</label>
            <input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              disabled={sending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Assunto do e-mail"
            />
          </div>
        )}

        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={canal === "email" ? 7 : 5}
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
            <Button onClick={handleBulkSend} disabled={sending || !mensagem.trim() || targetLeads.length === 0} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : `Enviar ${canalConfig[canal].label} (${targetLeads.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
