import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  onAdd: (lead: Partial<PipelineLead>) => Promise<any>;
}

const ORIGENS = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "portal", label: "Portal" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "oferta_ativa", label: "Oferta Ativa" },
  { value: "outro", label: "Outro" },
];

export default function PipelineAddLeadDialog({ open, onOpenChange, stages, segmentos, onAdd }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    segmento_id: "",
    empreendimento: "",
    origem: "",
    origem_detalhe: "",
    observacoes: "",
    valor_estimado: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setLoading(true);
    try {
      const result = await onAdd({
        nome: form.nome.trim(),
        telefone: form.telefone || null,
        email: form.email || null,
        segmento_id: form.segmento_id || null,
        empreendimento: form.empreendimento || null,
        origem: form.origem || "Manual",
        origem_detalhe: form.origem_detalhe || null,
        observacoes: form.observacoes || null,
        valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      });
      if (result) {
        setForm({ nome: "", telefone: "", email: "", segmento_id: "", empreendimento: "", origem: "", origem_detalhe: "", observacoes: "", valor_estimado: "" });
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Erro ao adicionar lead:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar Lead ao Pipeline</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do cliente"
                required
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(51) 99999-9999"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Segmento</Label>
              <Select value={form.segmento_id} onValueChange={v => setForm(f => ({ ...f, segmento_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {segmentos.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.cor }} />
                        {s.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={v => setForm(f => ({ ...f, origem: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empreendimento</Label>
              <Input
                value={form.empreendimento}
                onChange={e => setForm(f => ({ ...f, empreendimento: e.target.value }))}
                placeholder="Nome do empreendimento"
              />
            </div>
            <div>
              <Label>Valor Estimado (R$)</Label>
              <Input
                type="number"
                value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Observações sobre o lead..."
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.nome.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
