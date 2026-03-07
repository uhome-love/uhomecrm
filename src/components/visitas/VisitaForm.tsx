import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarPlus, Link2, Search } from "lucide-react";
import { ORIGEM_LABELS, type Visita } from "@/hooks/useVisitas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PipelineLeadOption {
  id: string;
  nome: string;
  empreendimento: string | null;
  telefone: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Visita>) => Promise<any>;
  initialData?: Partial<Visita> & { pipeline_lead_id?: string };
  mode?: "create" | "edit";
}

export default function VisitaForm({ open, onClose, onSubmit, initialData, mode = "create" }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nome_cliente: initialData?.nome_cliente || "",
    telefone: initialData?.telefone || "",
    empreendimento: initialData?.empreendimento || "",
    origem: initialData?.origem || "manual",
    data_visita: initialData?.data_visita || new Date().toISOString().split("T")[0],
    hora_visita: initialData?.hora_visita || "",
    local_visita: initialData?.local_visita || "",
    observacoes: initialData?.observacoes || "",
    pipeline_lead_id: (initialData as any)?.pipeline_lead_id || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLeadOption[]>([]);
  const [searchPipeline, setSearchPipeline] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Load pipeline leads for linking
  useEffect(() => {
    if (!user) return;
    const loadLeads = async () => {
      setLoadingLeads(true);
      const { data } = await supabase
        .from("pipeline_leads")
        .select("id, nome, empreendimento, telefone")
        .order("updated_at", { ascending: false })
        .limit(200);
      setPipelineLeads((data || []) as PipelineLeadOption[]);
      setLoadingLeads(false);
    };
    loadLeads();
  }, [user]);

  const filteredLeads = pipelineLeads.filter(l => {
    if (!searchPipeline.trim()) return true;
    const term = searchPipeline.toLowerCase();
    return l.nome.toLowerCase().includes(term) ||
      l.empreendimento?.toLowerCase().includes(term) ||
      l.telefone?.includes(term);
  });

  const selectedLead = pipelineLeads.find(l => l.id === form.pipeline_lead_id);

  const handleSelectPipelineLead = (leadId: string) => {
    const lead = pipelineLeads.find(l => l.id === leadId);
    if (lead) {
      setForm(f => ({
        ...f,
        pipeline_lead_id: leadId,
        nome_cliente: f.nome_cliente || lead.nome,
        telefone: f.telefone || lead.telefone || "",
        empreendimento: f.empreendimento || lead.empreendimento || "",
      }));
    }
  };

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
        pipeline_lead_id: form.pipeline_lead_id || null,
      } as any);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nova Visita" : "Editar Visita"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pipeline Lead Link */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              Vincular ao Pipeline (opcional)
            </Label>
            {selectedLead ? (
              <div className="flex items-center justify-between bg-background rounded-md px-3 py-2 border">
                <div>
                  <p className="text-xs font-medium">{selectedLead.nome}</p>
                  {selectedLead.empreendimento && (
                    <p className="text-[10px] text-muted-foreground">{selectedLead.empreendimento}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-destructive"
                  onClick={() => set("pipeline_lead_id", "")}
                >
                  Desvincular
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar oportunidade..."
                    value={searchPipeline}
                    onChange={e => setSearchPipeline(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {loadingLeads ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Carregando...</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-0.5 rounded border bg-background">
                    {filteredLeads.slice(0, 20).map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectPipelineLead(l.id)}
                      >
                        <p className="text-xs font-medium truncate">{l.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[l.empreendimento, l.telefone].filter(Boolean).join(" · ") || "Sem detalhes"}
                        </p>
                      </button>
                    ))}
                    {filteredLeads.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma oportunidade encontrada</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

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
