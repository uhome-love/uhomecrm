import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gestorId: string;
  mesKey: string;
  initial?: {
    meta_vgv_assinado?: number;
    meta_leads?: number;
    meta_visitas_realizadas?: number;
    meta_negocios?: number;
  };
  onSaved?: () => void;
}

export function EditarMetasModal({ open, onOpenChange, gestorId, mesKey, initial, onSaved }: Props) {
  const [vendas, setVendas] = useState("");
  const [leads, setLeads] = useState("");
  const [visitas, setVisitas] = useState("");
  const [negocios, setNegocios] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setVendas(String(initial?.meta_vgv_assinado ?? 0));
      setLeads(String(initial?.meta_leads ?? 400));
      setVisitas(String(initial?.meta_visitas_realizadas ?? 0));
      setNegocios(String(initial?.meta_negocios ?? 90));
    }
  }, [open, initial]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        gerente_id: gestorId,
        mes: mesKey,
        meta_vgv_assinado: Number(vendas) || 0,
        meta_leads: Number(leads) || 0,
        meta_visitas_realizadas: Number(visitas) || 0,
        meta_negocios: Number(negocios) || 0,
      };
      const { error } = await supabase
        .from("ceo_metas_mensais")
        .upsert(payload, { onConflict: "gerente_id,mes" });
      if (error) throw error;
      toast.success("Metas atualizadas");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar metas", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar metas — {mesKey}</DialogTitle>
          <DialogDescription>
            Defina as metas mensais do time. Valores zerados ocultam a barra de progresso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="meta-vendas">Vendas — VGV assinado (R$)</Label>
            <Input
              id="meta-vendas"
              type="number"
              min={0}
              value={vendas}
              onChange={(e) => setVendas(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-leads">Leads recebidos</Label>
            <Input
              id="meta-leads"
              type="number"
              min={0}
              value={leads}
              onChange={(e) => setLeads(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-visitas">Visitas realizadas</Label>
            <Input
              id="meta-visitas"
              type="number"
              min={0}
              value={visitas}
              onChange={(e) => setVisitas(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-negocios">Negócios ativos</Label>
            <Input
              id="meta-negocios"
              type="number"
              min={0}
              value={negocios}
              onChange={(e) => setNegocios(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
