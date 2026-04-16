import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/hooks/usePipeline";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  currentCorretorId: string | null;
  stages: PipelineStage[];
  onTransferred: (corretorId: string, corretorNome: string) => void;
}

const MOTIVOS = [
  "Fora do meu segmento",
  "Conflito de agenda",
  "Perfil melhor para outro corretor",
  "Outro",
];

interface TeamMember {
  user_id: string;
  nome: string;
  equipe: string | null;
}

export default function PipelineTransferDialog({ open, onOpenChange, leadId, leadNome, currentCorretorId, stages, onTransferred }: Props) {
  const { user } = useAuth();
  const [corretores, setCorretores] = useState<TeamMember[]>([]);
  const [selectedCorretor, setSelectedCorretor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, nome, equipe")
        .eq("status", "ativo")
        .order("nome");
      setCorretores((data || []).filter(m => m.user_id && m.user_id !== currentCorretorId));
    })();
  }, [open, currentCorretorId]);

  const handleTransfer = async () => {
    if (!selectedCorretor || !user) return;
    setSaving(true);
    try {
      const corretorNome = corretores.find(c => c.user_id === selectedCorretor)?.nome || "Corretor";

      // Find "Novo Lead" stage to reset
      const novoLeadStage = stages.find(s => s.tipo === "novo_lead");

      // Update the lead — repasse manual já dispensa fluxo de aceite
      const updates: Record<string, any> = {
        corretor_id: selectedCorretor,
        aceite_status: "aceito",
        aceito_em: new Date().toISOString(),
        aceite_expira_em: null,
        arquivado: false,
        updated_at: new Date().toISOString(),
      };
      if (novoLeadStage) {
        updates.stage_id = novoLeadStage.id;
        updates.stage_changed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("pipeline_leads")
        .update(updates)
        .eq("id", leadId);

      if (error) {
        toast.error("Erro ao repassar lead");
        return;
      }

      // Log in historico
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: leadId,
        stage_anterior_id: null,
        stage_novo_id: novoLeadStage?.id || stages[0]?.id,
        movido_por: user.id,
        observacao: `Lead repassado para ${corretorNome}${motivo ? ` — motivo: ${motivo}` : ""}`,
      });

      // Log in anotacoes
      await supabase.from("pipeline_anotacoes").insert({
        pipeline_lead_id: leadId,
        conteudo: `🔄 Lead repassado para ${corretorNome}${motivo ? ` — Motivo: ${motivo}` : ""}`,
        autor_id: user.id,
        autor_nome: "Sistema",
      });

      toast.success(`Lead repassado para ${corretorNome}`);
      onTransferred(selectedCorretor, corretorNome);
      onOpenChange(false);
      setSelectedCorretor("");
      setMotivo("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Repassar Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            Repassar <strong>{leadNome}</strong> para outro corretor
          </div>

          <div>
            <Label className="text-xs">Repassar para</Label>
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Buscar corretor..." />
              </SelectTrigger>
              <SelectContent>
                {corretores.map(c => (
                  <SelectItem key={c.user_id} value={c.user_id!}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{c.nome}</span>
                      {c.equipe && <span className="text-[10px] text-muted-foreground">{c.equipe}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Motivo (opcional)</Label>
            <RadioGroup value={motivo} onValueChange={setMotivo} className="mt-2 space-y-1.5">
              {MOTIVOS.map(m => (
                <div key={m} className="flex items-center space-x-2">
                  <RadioGroupItem value={m} id={`motivo-${m}`} />
                  <Label htmlFor={`motivo-${m}`} className="text-xs font-normal cursor-pointer">{m}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={!selectedCorretor || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Confirmar repasse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}