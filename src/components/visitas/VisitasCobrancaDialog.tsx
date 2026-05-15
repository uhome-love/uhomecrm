import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Visita } from "@/hooks/useVisitas";

interface PendingCorretor {
  nome: string;
  count: number;
}

interface VisitasCobrancaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingVisitas: Visita[];
  pendingByCorretor: PendingCorretor[];
}

export default function VisitasCobrancaDialog({
  open, onOpenChange, pendingVisitas, pendingByCorretor,
}: VisitasCobrancaDialogProps) {
  const [msg, setMsg] = useState(
    `Oi [nome]! 👋 Você tem [X] visita(s) sem status atualizado no UhomeSales. Por favor, acesse o sistema e atualize: Realizada, No Show ou Reagendada. Obrigado! 🏠`
  );
  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    setSending(true);
    try {
      const corretorIds = [...new Set(pendingVisitas.map(v => v.corretor_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone")
        .in("user_id", corretorIds);

      let sent = 0;
      for (const p of profiles || []) {
        if (!p.telefone) continue;
        const count = pendingVisitas.filter(v => v.corretor_id === p.user_id).length;
        const personalizedMsg = msg
          .replace("[nome]", p.nome?.split(" ")[0] || "")
          .replace("[X]", String(count));

        await supabase.functions.invoke("whatsapp-notificacao", {
          body: { telefone: p.telefone, mensagem: personalizedMsg, tipo: "cobranca_visita" },
        });
        sent++;
      }
      toast.success(`✅ Cobrança enviada para ${sent} corretor${sent !== 1 ? "es" : ""}`);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao enviar cobranças");
    } finally {
      setSending(false);
    }
  }, [pendingVisitas, msg, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-destructive" /> Cobrar atualização de visitas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Enviar cobrança para <strong>{pendingByCorretor.length}</strong> corretor{pendingByCorretor.length !== 1 ? "es" : ""}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pendingByCorretor.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c.nome} ({c.count})
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mensagem (editável)</label>
            <Textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5} className="mt-1 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Use [nome] para nome do corretor e [X] para qtd de visitas
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending} className="gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {sending ? "Enviando..." : `📲 Enviar para ${pendingByCorretor.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
