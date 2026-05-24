/**
 * DiscardLeadDialog — Dialog único e estilizado para Descartar/Inativar lead.
 *
 * Substitui `window.prompt("Motivo do descarte:")` legado de PipelineCard.tsx e centraliza
 * o uso do helper `buildMotivoDescarte` (4º fluxo coberto: PipelineLeadDetail, FocusModeModal,
 * LeadTarefasTab, NextActionModal já usam — este é o do card do Kanban).
 *
 * Comportamento:
 *  - reengajavel → move lead para stage Descarte (nutrição/oferta ativa podem reengajar)
 *  - definitivo  → arquiva o lead (some da carteira ativa)
 *
 * Update é atômico: um único UPDATE seta motivo + (stage_id OU arquivado=true).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildMotivoDescarte } from "@/lib/leadOutcome";
import { toast } from "sonner";
import type { PipelineStage } from "@/hooks/usePipeline";

interface DiscardLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  stages: PipelineStage[];
  /** Chamado após sucesso para refresh do Kanban (opcional) */
  onDone?: () => void;
}

export default function DiscardLeadDialog({
  open, onOpenChange, leadId, leadNome, stages, onDone,
}: DiscardLeadDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [tipo, setTipo] = useState<"reengajavel" | "definitivo">("reengajavel");
  const [saving, setSaving] = useState(false);

  const reset = () => { setMotivo(""); setObs(""); setTipo("reengajavel"); };

  const handleConfirm = async () => {
    if (!motivo) { toast.error("Selecione um motivo"); return; }
    setSaving(true);
    try {
      const labelRaw = motivo === "outro" ? (obs.trim() || "Outro motivo") : motivo;
      const motivoTexto = buildMotivoDescarte(tipo, labelRaw);
      const nowIso = new Date().toISOString();

      if (tipo === "definitivo") {
        const { error } = await supabase
          .from("pipeline_leads")
          .update({
            motivo_descarte: motivoTexto,
            tipo_descarte: "definitivo",
            arquivado: true,
            ultima_acao_at: nowIso,
          })
          .eq("id", leadId);
        if (error) throw error;
        toast.success("Lead inativado definitivamente");
      } else {
        const descarteStage = stages.find(s => s.tipo === "descarte")
          || stages.find(s => s.nome.toLowerCase().includes("descart"));
        if (!descarteStage) {
          toast.error("Etapa de Descarte não encontrada. Contate o suporte.");
          return;
        }
        const { error } = await supabase
          .from("pipeline_leads")
          .update({
            motivo_descarte: motivoTexto,
            tipo_descarte: "reengajavel",
            stage_id: descarteStage.id,
            stage_changed_at: nowIso,
            ultima_acao_at: nowIso,
          })
          .eq("id", leadId);
        if (error) throw error;
        toast.info("Lead movido para Descarte");
      }

      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      console.error("DiscardLeadDialog error:", e);
      toast.error(e?.message || "Erro ao descartar lead");
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || !motivo || (motivo === "outro" && !obs.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" /> Descartar / Inativar lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Selecione o motivo e o destino do lead <strong>{leadNome}</strong>.
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Contato errado">📵 Contato errado</SelectItem>
                <SelectItem value="Não quer mais contato">🚫 Não quer mais contato</SelectItem>
                <SelectItem value="Solicitou retirada do nome">🗑️ Solicitou retirada do nome</SelectItem>
                <SelectItem value="Sem perfil">🎯 Sem perfil para o produto</SelectItem>
                <SelectItem value="Sem retorno">📞 Sem retorno após tentativas</SelectItem>
                <SelectItem value="outro">✏️ Outro motivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {motivo === "outro" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descreva o motivo</Label>
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Descreva..."
                className="resize-none"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">O que fazer com o lead? *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "reengajavel" | "definitivo")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reengajavel">🔄 Descartar (nutrição/oferta ativa)</SelectItem>
                <SelectItem value="definitivo">⛔ Inativar definitivo (arquivar)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tipo === "definitivo"
                ? "O lead será arquivado. Não receberá comunicação nem entrará em listas."
                : "O lead será movido para Descarte e poderá ser reengajado por nutrição ou oferta ativa."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={disabled} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
