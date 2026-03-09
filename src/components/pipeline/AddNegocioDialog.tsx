import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TeamMemberOption {
  user_id: string;
  nome: string;
  gerente_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const FASES = [
  { value: "novo_negocio", label: "🆕 Novo Negócio" },
  { value: "proposta", label: "📋 Proposta" },
  { value: "negociacao", label: "🤝 Negociação" },
  { value: "documentacao", label: "📄 Documentação" },
];

export default function AddNegocioDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);
  const [form, setForm] = useState({
    nome_cliente: "",
    telefone: "",
    empreendimento: "",
    corretor_id: "",
    fase: "novo_negocio",
    vgv_estimado: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("team_members").select("user_id, nome, gerente_id").eq("status", "ativo"),
      supabase.from("pipeline_leads").select("empreendimento").not("empreendimento", "is", null).limit(500),
    ]).then(([teamRes, leadsRes]) => {
      setTeamMembers((teamRes.data || []).filter(m => m.user_id) as TeamMemberOption[]);
      const empSet = new Set<string>();
      (leadsRes.data || []).forEach((l: any) => { if (l.empreendimento) empSet.add(l.empreendimento); });
      setEmpreendimentos(Array.from(empSet).sort());
    });
  }, [open]);

  const handleSubmit = async () => {
    if (!form.nome_cliente.trim() || !user) return;
    setLoading(true);

    try {
      // Resolve corretor profile id
      let corretorProfileId: string | null = null;
      let gerenteId: string | null = null;

      if (form.corretor_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", form.corretor_id)
          .maybeSingle();
        corretorProfileId = profile?.id || null;

        const member = teamMembers.find(m => m.user_id === form.corretor_id);
        gerenteId = member?.gerente_id || null;
      }

      const { error } = await supabase.from("negocios").insert({
        nome_cliente: form.nome_cliente.trim(),
        telefone: form.telefone || null,
        empreendimento: form.empreendimento || null,
        corretor_id: corretorProfileId,
        gerente_id: gerenteId,
        fase: form.fase,
        vgv_estimado: form.vgv_estimado ? parseFloat(form.vgv_estimado.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        observacoes: form.observacoes || null,
        origem: "manual",
        status: "ativo",
      } as any);

      if (error) throw error;

      toast.success("✅ Negócio criado com sucesso!");
      setForm({ nome_cliente: "", telefone: "", empreendimento: "", corretor_id: "", fase: "novo_negocio", vgv_estimado: "", observacoes: "" });
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar negócio: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            Novo Negócio Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Cliente *</Label>
            <Input value={form.nome_cliente} onChange={e => set("nome_cliente", e.target.value)} placeholder="Nome do cliente" className="h-9 text-sm" />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Telefone</Label>
            <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(XX) XXXXX-XXXX" className="h-9 text-sm" />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Empreendimento</Label>
            {empreendimentos.length > 0 ? (
              <Select value={form.empreendimento} onValueChange={v => set("empreendimento", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empreendimentos.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.empreendimento} onChange={e => set("empreendimento", e.target.value)} placeholder="Nome do empreendimento" className="h-9 text-sm" />
            )}
          </div>

          {teamMembers.length > 0 && (
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

          <div>
            <Label className="text-xs font-semibold mb-1 block">Fase</Label>
            <Select value={form.fase} onValueChange={v => set("fase", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">VGV Estimado</Label>
            <Input value={form.vgv_estimado} onChange={e => set("vgv_estimado", e.target.value)} placeholder="R$ 500.000" className="h-9 text-sm" />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Notas sobre o negócio..." rows={2} className="text-sm" />
          </div>

          <Button
            className="w-full gap-2 h-10 text-sm font-semibold"
            disabled={!form.nome_cliente.trim() || loading}
            onClick={handleSubmit}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            🆕 Criar Negócio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
