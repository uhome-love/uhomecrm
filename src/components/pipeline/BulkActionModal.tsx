import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Phone, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Destino = "manha" | "tarde" | "noturna" | "qualquer" | "oferta_ativa" | "descarte";

const DESTINO_OPTIONS: { id: Destino; label: string; emoji: string; group: "roleta" | "oferta" | "descarte" }[] = [
  { id: "descarte", label: "Mover para Descarte", emoji: "🗑️", group: "descarte" },
  { id: "oferta_ativa", label: "Enviar para Oferta Ativa", emoji: "📞", group: "oferta" },
  { id: "manha", label: "Roleta da Manhã", emoji: "🌅", group: "roleta" },
  { id: "tarde", label: "Roleta da Tarde", emoji: "☀️", group: "roleta" },
  { id: "noturna", label: "Roleta Noturna", emoji: "🌙", group: "roleta" },
  { id: "qualquer", label: "Distribuir agora para qualquer corretor ativo", emoji: "📋", group: "roleta" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  onComplete?: () => void;
}

export default function BulkActionModal({ open, onOpenChange, selectedLeadIds, onComplete }: Props) {
  const [dispatching, setDispatching] = useState(false);
  const [selectedDestino, setSelectedDestino] = useState<Destino>("descarte");

  const isOfertaAtiva = selectedDestino === "oferta_ativa";
  const isDescarte = selectedDestino === "descarte";
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

      if (isDescarte) {
        const { data: descarteStages } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("tipo", "descarte")
          .eq("ativo", true)
          .limit(1);
        
        const descarteStageId = descarteStages?.[0]?.id;
        if (!descarteStageId) {
          toast.error("Estágio de Descarte não encontrado.");
          setDispatching(false);
          return;
        }

        for (const leadId of selectedLeadIds) {
          try {
            const { error } = await supabase
              .from("pipeline_leads")
              .update({
                stage_id: descarteStageId,
                stage_changed_at: new Date().toISOString(),
                motivo_descarte: "Descarte em massa (CEO)",
                updated_at: new Date().toISOString(),
              })
              .eq("id", leadId);
            if (error) { failed++; continue; }

            await supabase.from("pipeline_historico").insert({
              pipeline_lead_id: leadId,
              stage_novo_id: descarteStageId,
              movido_por: session.user.id,
              observacao: "Descarte em massa (CEO)",
            });

            dispatched++;
          } catch {
            failed++;
          }
        }

        await supabase.from("audit_log").insert({
          user_id: session.user.id,
          modulo: "pipeline",
          acao: "bulk_descarte",
          descricao: `Descartou ${dispatched} leads em massa`,
          depois: { dispatched, failed },
        });

        toast.success(`🗑️ ${dispatched} leads movidos para Descarte!${failed > 0 ? ` ${failed} falharam.` : ""}`);
      } else if (isOfertaAtiva) {
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

        await supabase.from("audit_log").insert({
          user_id: session.user.id,
          modulo: "pipeline",
          acao: "bulk_send_oferta_ativa",
          descricao: `Enviou ${dispatched} leads selecionados para Oferta Ativa`,
          depois: { dispatched, failed, destino: "oferta_ativa" },
        });

        toast.success(`✅ ${dispatched} leads enviados para Oferta Ativa!${failed > 0 ? ` ${failed} falharam.` : ""}`);
      } else {
        for (const leadId of selectedLeadIds) {
          try {
            const { error } = await supabase.functions.invoke("distribute-lead", {
              body: {
                action: "distribute_single",
                pipeline_lead_id: leadId,
                janela: selectedDestino,
              },
            });
            if (error) { failed++; continue; }
            dispatched++;
          } catch {
            failed++;
          }
        }

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

  const getButtonColor = () => {
    if (isDescarte) return "bg-destructive hover:bg-destructive/90";
    if (isOfertaAtiva) return "bg-orange-600 hover:bg-orange-700";
    return "bg-purple-600 hover:bg-purple-700";
  };

  const getButtonLabel = () => {
    if (isDescarte) return "Mover para Descarte";
    if (isOfertaAtiva) return "Enviar para Oferta Ativa";
    return "Disparar para Roleta";
  };

  const getButtonIcon = () => {
    if (dispatching) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isDescarte) return <Trash2 className="h-4 w-4" />;
    if (isOfertaAtiva) return <Phone className="h-4 w-4" />;
    return <Rocket className="h-4 w-4" />;
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">O que fazer com os leads?</p>

            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1 mb-1">Descarte</p>
            <div className="grid grid-cols-1 gap-1.5">
              {DESTINO_OPTIONS.filter(d => d.group === "descarte").map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedDestino(j.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                    selectedDestino === j.id
                      ? "border-destructive bg-destructive/10 text-destructive font-medium"
                      : "border-border hover:border-destructive/50 text-foreground"
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

            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-3 mb-1">Roleta de Leads</p>
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispatching}>
              Cancelar
            </Button>
            <Button
              onClick={handleDispatch}
              disabled={dispatching || count === 0}
              className={`gap-2 text-white ${getButtonColor()}`}
            >
              {getButtonIcon()}
              {getButtonLabel()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
