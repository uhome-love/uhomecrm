import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarPlus, Search } from "lucide-react";
import { ORIGEM_LABELS, type Visita } from "@/hooks/useVisitas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import EmpreendimentoCombobox from "@/components/ui/empreendimento-combobox";

interface PipelineLeadOption {
  id: string;
  nome: string;
  empreendimento: string | null;
  telefone: string | null;
}

interface TeamMemberOption {
  user_id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Visita>) => Promise<any>;
  initialData?: Partial<Visita> & { pipeline_lead_id?: string };
  mode?: "create" | "edit";
}

const QUICK_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

function getDefaultForm(initialData?: Props["initialData"]) {
  return {
    nome_cliente: initialData?.nome_cliente || "",
    telefone: initialData?.telefone || "",
    empreendimento: initialData?.empreendimento || "",
    corretor_id: initialData?.corretor_id || "",
    origem: initialData?.origem || "manual",
    data_visita: initialData?.data_visita || new Date().toISOString().split("T")[0],
    hora_visita: initialData?.hora_visita || "",
    observacoes: initialData?.observacoes || "",
    pipeline_lead_id: (initialData as any)?.pipeline_lead_id || "",
  };
}

export default function VisitaForm({ open, onClose, onSubmit, initialData, mode = "create" }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => getDefaultForm(initialData));
  const [submitting, setSubmitting] = useState(false);
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLeadOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [searchPipeline, setSearchPipeline] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setForm(getDefaultForm(initialData));
      setSearchPipeline("");
      setSubmitting(false);
    }
  }, [open, initialData]);

  // Load pipeline leads + team members + empreendimentos
  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      setLoadingLeads(true);
      const [leadsRes, teamRes, campanhasRes] = await Promise.all([
        supabase.from("pipeline_leads").select("id, nome, empreendimento, telefone").order("updated_at", { ascending: false }).limit(200),
        supabase.from("team_members").select("user_id, nome").eq("status", "ativo"),
        supabase.from("roleta_campanhas").select("empreendimento").eq("ativo", true),
      ]);
      const leads = (leadsRes.data || []) as PipelineLeadOption[];
      setPipelineLeads(leads);
      setTeamMembers((teamRes.data || []).filter(m => m.user_id) as TeamMemberOption[]);

      // Merge empreendimentos from campanhas (official) + pipeline_leads
      const empSet = new Set<string>();
      (campanhasRes.data || []).forEach((c: any) => { if (c.empreendimento) empSet.add(c.empreendimento); });
      leads.forEach(l => { if (l.empreendimento) empSet.add(l.empreendimento); });
      setEmpreendimentos(Array.from(empSet).sort());
      setLoadingLeads(false);
    };
    load();
  }, [user, open]);

  const filteredLeads = useMemo(() => {
    if (!searchPipeline.trim()) return pipelineLeads.slice(0, 20);
    const term = searchPipeline.toLowerCase();
    return pipelineLeads.filter(l =>
      l.nome.toLowerCase().includes(term) ||
      l.empreendimento?.toLowerCase().includes(term) ||
      l.telefone?.includes(term)
    ).slice(0, 20);
  }, [pipelineLeads, searchPipeline]);

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
      setSearchPipeline("");
    }
  };

  const handleSubmit = async () => {
    if (!form.nome_cliente.trim()) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({
        ...form,
        corretor_id: form.corretor_id || undefined,
        telefone: form.telefone || null,
        empreendimento: form.empreendimento || null,
        hora_visita: form.hora_visita || null,
        observacoes: form.observacoes || null,
        // Explicitly use pipeline_lead_id (NOT lead_id) for pipeline leads
        pipeline_lead_id: form.pipeline_lead_id || null,
        lead_id: null, // force null — only set for oferta_ativa leads
      } as any);
      // Only close if creation succeeded (not null)
      if (result !== null && result !== undefined) {
        onClose();
      }
    } catch (err) {
      console.error("Erro ao salvar visita:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarPlus className="h-5 w-5 text-blue-600" />
            {mode === "create" ? "Nova Visita" : "Editar Visita"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Autocomplete: Search leads */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Cliente *</Label>
            {selectedLead ? (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 border">
                <div>
                  <p className="text-sm font-semibold">{selectedLead.nome}</p>
                  {selectedLead.empreendimento && (
                    <p className="text-[10px] text-muted-foreground">{selectedLead.empreendimento} {selectedLead.telefone && `· ${selectedLead.telefone}`}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => set("pipeline_lead_id", "")}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchPipeline || form.nome_cliente}
                    onChange={e => {
                      setSearchPipeline(e.target.value);
                      set("nome_cliente", e.target.value);
                    }}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                {searchPipeline.trim().length > 1 && filteredLeads.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border bg-card shadow-md">
                    {filteredLeads.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        onClick={() => handleSelectPipelineLead(l.id)}
                      >
                        <p className="text-xs font-semibold">{l.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[l.empreendimento, l.telefone].filter(Boolean).join(" · ") || "Sem detalhes"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Empreendimento */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Empreendimento</Label>
            <EmpreendimentoCombobox
              value={form.empreendimento}
              onChange={(v) => set("empreendimento", v)}
              extraOptions={empreendimentos}
              placeholder="Selecione ou digite o empreendimento"
            />
          </div>

          {/* Corretor — only show for gestores/admins who manage a team (not for corretores) */}
          {teamMembers.length > 1 && teamMembers.some(m => m.user_id !== user?.id) && (
            <div>
              <Label className="text-xs font-semibold mb-1 block">Corretor</Label>
              <Select value={form.corretor_id} onValueChange={v => set("corretor_id", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Data *</Label>
              <Input type="date" value={form.data_visita} onChange={e => set("data_visita", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Horário</Label>
              <Input type="time" value={form.hora_visita} onChange={e => set("hora_visita", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Quick time buttons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set("hora_visita", t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  form.hora_visita === t
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Telefone */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Telefone</Label>
            <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(XX) XXXXX-XXXX" className="h-9 text-sm" />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Notas sobre a visita..." rows={2} className="text-sm" />
          </div>

          {/* Submit */}
          <Button
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white h-10 text-sm font-semibold"
            disabled={!form.nome_cliente.trim() || !form.data_visita || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "📅 Agendar Visita" : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}