import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Phone, Send } from "lucide-react";
import { toast } from "sonner";

type Destino = "manha" | "tarde" | "noturna" | "qualquer" | "oferta_ativa";

const DESTINO_OPTIONS: { id: Destino; label: string; emoji: string; group: "roleta" | "oferta" }[] = [
  { id: "manha", label: "Roleta da Manhã", emoji: "🌅", group: "roleta" },
  { id: "tarde", label: "Roleta da Tarde", emoji: "☀️", group: "roleta" },
  { id: "noturna", label: "Roleta Noturna", emoji: "🌙", group: "roleta" },
  { id: "qualquer", label: "Distribuir agora para qualquer corretor ativo", emoji: "📋", group: "roleta" },
  { id: "oferta_ativa", label: "Enviar para Oferta Ativa", emoji: "📞", group: "oferta" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onComplete?: () => void;
}

export default function BulkActionModal({ open, onOpenChange, selectedLeadIds, onComplete }: Props) {
  const [dispatching, setDispatching] = useState(false);
  const [selectedDestino, setSelectedDestino] = useState<Destino>("manha");

  const isOfertaAtiva = selectedDestino === "oferta_ativa";
  const count = selectedLeadIds.length;

  const handleDispatch = async () => {
    if (count === 0) return;
    setDispatching(true);
    let dispatched = 0;
    let failed = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        setDispatching(false);
        return;
      }

      if (isOfertaAtiva) {
        // Send leads to Oferta Ativa by setting etapa to "Oferta Ativa"
        for (const leadId of selectedLeadIds) {
          try {
            const { error } = await supabase
              .from("pipeline_leads")
              .update({ etapa: "Oferta Ativa", updated_at: new Date().toISOString() })
              .eq("id", leadId);
            if (error) { failed++; continue; }
            dispatched++;
          } catch {
            failed++;
          }
        }

        // Log the dispatch
        await supabase.from("audit_log").insert({
          user_id: session.user.id,
          modulo: "pipeline",
          acao: "bulk_send_oferta_ativa",
          descricao: `Enviou ${dispatched} leads selecionados para Oferta Ativa`,
          depois: { dispatched, failed, destino: "oferta_ativa" },
        });

        toast.success(`✅ ${dispatched} leads enviados para Oferta Ativa!${failed > 0 ? ` ${failed} falharam.` : ""}`);
      } else {
        // Send to roleta via edge function
        for (const leadId of selectedLeadIds) {
          try {
            const { error } = await supabase.functions.invoke("distribute-lead", {
              body: {
                action: "dispatch_fila_ceo",
                lead_id: leadId,
                segmento_id: null,
                janela: selectedDestino,
              },
            });
            if (error) { failed++; continue; }
            dispatched++;
          } catch {
            failed++;
          }
        }

        // Log the dispatch
        await supabase.from("audit_log").insert({
          user_id: session.user.id,
          modulo: "pipeline",
          acao: "bulk_send_roleta",
          descricao: `Disparou ${dispatched} leads selecionados para roleta (janela: ${selectedDestino})`,
          depois: { dispatched, failed, janela: selectedDestino },
        });

        toast.success(`✅ ${dispatched} leads disparados para a roleta!${failed > 0 ? ` ${failed} falharam.` : ""}`);
      }

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao disparar leads.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-purple-600" />
            Ação em Massa
          </DialogTitle>
          <DialogDescription>
            {count} lead{count !== 1 ? "s" : ""} selecionado{count !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destino selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enviar para onde?</p>

            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1 mb-1">Roleta de Leads</p>
            <div className="grid grid-cols-1 gap-1.5">
              {DESTINO_OPTIONS.filter(d => d.group === "roleta").map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedDestino(j.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                    selectedDestino === j.id
                      ? "border-purple-500 bg-purple-500/10 text-purple-700 font-medium"
                      : "border-border hover:border-purple-300 text-foreground"
                  }`}
                >
                  <span>{j.emoji}</span>
                  <span>{j.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-3 mb-1">Oferta Ativa</p>
            <div className="grid grid-cols-1 gap-1.5">
              {DESTINO_OPTIONS.filter(d => d.group === "oferta").map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedDestino(j.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                    selectedDestino === j.id
                      ? "border-orange-500 bg-orange-500/10 text-orange-700 font-medium"
                      : "border-border hover:border-orange-300 text-foreground"
                  }`}
                >
                  <span>{j.emoji}</span>
                  <span>{j.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispatching}>
              Cancelar
            </Button>
            <Button
              onClick={handleDispatch}
              disabled={dispatching || count === 0}
              className={`gap-2 text-white ${isOfertaAtiva ? "bg-orange-600 hover:bg-orange-700" : "bg-purple-600 hover:bg-purple-700"}`}
            >
              {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : isOfertaAtiva ? <Phone className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
              {isOfertaAtiva ? "Enviar para Oferta Ativa" : "Disparar para Roleta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
