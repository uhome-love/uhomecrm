import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarPlus } from "lucide-react";
import { ORIGEM_LABELS, type Visita } from "@/hooks/useVisitas";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Visita>) => Promise<any>;
  initialData?: Partial<Visita>;
  mode?: "create" | "edit";
}

export default function VisitaForm({ open, onClose, onSubmit, initialData, mode = "create" }: Props) {
  const [form, setForm] = useState({
    nome_cliente: initialData?.nome_cliente || "",
    telefone: initialData?.telefone || "",
    empreendimento: initialData?.empreendimento || "",
    origem: initialData?.origem || "manual",
    data_visita: initialData?.data_visita || new Date().toISOString().split("T")[0],
    hora_visita: initialData?.hora_visita || "",
    local_visita: initialData?.local_visita || "",
    observacoes: initialData?.observacoes || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.nome_cliente.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        telefone: form.telefone || null,
        empreendimento: form.empreendimento || null,
        hora_visita: form.hora_visita || null,
        local_visita: form.local_visita || null,
        observacoes: form.observacoes || null,
      } as any);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nova Visita" : "Editar Visita"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome do Cliente *</Label>
              <Input value={form.nome_cliente} onChange={e => set("nome_cliente", e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(XX) XXXXX-XXXX" />
            </div>
            <div>
              <Label className="text-xs">Empreendimento</Label>
              <Input value={form.empreendimento} onChange={e => set("empreendimento", e.target.value)} placeholder="Nome do empreendimento" />
            </div>
            <div>
              <Label className="text-xs">Data da Visita *</Label>
              <Input type="date" value={form.data_visita} onChange={e => set("data_visita", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={form.hora_visita} onChange={e => set("hora_visita", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Local</Label>
              <Input value={form.local_visita} onChange={e => set("local_visita", e.target.value)} placeholder="Local da visita" />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={form.origem} onValueChange={v => set("origem", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGEM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Notas sobre a visita..." rows={2} />
          </div>

          <Button className="w-full gap-2" disabled={!form.nome_cliente.trim() || !form.data_visita || submitting} onClick={handleSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Criar Visita" : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
