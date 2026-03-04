import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Trash2, Edit, Phone, MessageCircle, Mail, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OATemplate } from "@/hooks/useOfertaAtiva";

const CANAIS = [
  { value: "ligacao", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "E-mail", icon: Mail },
];

const TIPOS = [
  { value: "primeiro_contato", label: "Primeiro Contato" },
  { value: "follow_up", label: "Follow Up" },
  { value: "reativacao", label: "Reativação" },
];

export default function TemplateManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OATemplate | null>(null);
  const [form, setForm] = useState({ titulo: "", conteudo: "", canal: "ligacao", tipo: "primeiro_contato", empreendimento: "" });
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["oa-all-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oferta_ativa_templates").select("*").order("empreendimento").order("canal");
      if (error) throw error;
      return data as OATemplate[];
    },
  });

  // Get unique empreendimentos from listas
  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["oa-empreendimentos-list"],
    queryFn: async () => {
      const { data } = await supabase.from("oferta_ativa_listas").select("empreendimento");
      return [...new Set((data || []).map(d => d.empreendimento))].filter(Boolean);
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ titulo: "", conteudo: "", canal: "ligacao", tipo: "primeiro_contato", empreendimento: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: OATemplate) => {
    setEditing(t);
    setForm({ titulo: t.titulo, conteudo: t.conteudo, canal: t.canal, tipo: t.tipo, empreendimento: t.empreendimento || "" });
    setDialogOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.titulo || !form.conteudo || !user) { toast.error("Preencha título e conteúdo"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("oferta_ativa_templates").update({
          titulo: form.titulo, conteudo: form.conteudo, canal: form.canal,
          tipo: form.tipo, empreendimento: form.empreendimento || null,
        } as any).eq("id", editing.id);
        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase.from("oferta_ativa_templates").insert({
          titulo: form.titulo, conteudo: form.conteudo, canal: form.canal,
          tipo: form.tipo, empreendimento: form.empreendimento || null,
          criado_por: user.id,
        } as any);
        if (error) throw error;
        toast.success("Template criado!");
      }
      queryClient.invalidateQueries({ queryKey: ["oa-all-templates"] });
      queryClient.invalidateQueries({ queryKey: ["oa-templates"] });
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar template");
    }
    setSaving(false);
  }, [form, editing, user, queryClient]);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("oferta_ativa_templates").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    queryClient.invalidateQueries({ queryKey: ["oa-all-templates"] });
    queryClient.invalidateQueries({ queryKey: ["oa-templates"] });
    toast.success("Template excluído");
  }, [queryClient]);

  const canalIcon = (canal: string) => {
    const c = CANAIS.find(c => c.value === canal);
    return c ? <c.icon className="h-3.5 w-3.5" /> : null;
  };

  // Group by empreendimento
  const grouped: Record<string, OATemplate[]> = {};
  templates.forEach(t => {
    const key = t.empreendimento || "🌐 Global (todos)";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Templates de Mensagem
        </h3>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Novo Template
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Use <code className="bg-muted px-1 rounded">{"{nome}"}</code> e <code className="bg-muted px-1 rounded">{"{empreendimento}"}</code> como variáveis dinâmicas nos templates.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum template criado. Crie scripts para ligação, WhatsApp e e-mail.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([emp, tmpls]) => (
          <Card key={emp}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">{emp}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tmpls.map(t => (
                <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {canalIcon(t.canal)}
                      <span className="text-xs font-semibold text-foreground">{t.titulo}</span>
                      <Badge variant="outline" className="text-[9px]">{TIPOS.find(tp => tp.value === t.tipo)?.label || t.tipo}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{t.conteudo}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Script primeiro contato Open Bosque" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Canal</Label>
                <Select value={form.canal} onValueChange={v => setForm(f => ({ ...f, canal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Empreendimento <span className="text-muted-foreground">(vazio = global)</span></Label>
              <Select value={form.empreendimento} onValueChange={v => setForm(f => ({ ...f, empreendimento: v === "__global__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Global (todos)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">🌐 Global (todos)</SelectItem>
                  {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Conteúdo</Label>
              <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Olá {nome}! Vi que você se interessou pelo {empreendimento}..." rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.titulo || !form.conteudo}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}