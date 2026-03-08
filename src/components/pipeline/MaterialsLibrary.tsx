import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Plus, Loader2, FolderOpen, ClipboardCopy, Sparkles, MessageSquare, Phone, Eye, Pencil, X
} from "lucide-react";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";

interface Template {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: string;
  canal: string;
  empreendimento: string | null;
  campanha: string | null;
  uso_count: number | null;
  ativo: boolean | null;
  created_at: string | null;
}

const TIPO_COLORS: Record<string, string> = {
  contato_inicial: "#3B82F6",
  follow_up_ligacao: "#F59E0B",
  follow_up_visita: "#22C55E",
  proposta: "#8B5CF6",
  campanha: "#EC4899",
  reengajamento: "#F97316",
  pos_venda: "#06B6D4",
};

const TIPO_LABELS: Record<string, string> = {
  contato_inicial: "Contato Inicial",
  follow_up_ligacao: "Follow-up Ligação",
  follow_up_visita: "Follow-up Visita",
  proposta: "Proposta",
  campanha: "Campanha",
  reengajamento: "Reengajamento",
  pos_venda: "Pós-venda",
};

const CANAL_ICONS: Record<string, { icon: typeof MessageSquare; label: string }> = {
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  ligacao: { icon: Phone, label: "Ligação" },
  email: { icon: MessageSquare, label: "E-mail" },
  sms: { icon: MessageSquare, label: "SMS" },
};

/** Render template content with highlighted variables */
function renderTemplateContent(text: string) {
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (/^{{[^}]+}}$/.test(part)) {
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-[#dbeafe] text-[#1e40af] mx-0.5"
        >
          {part}
        </span>
      );
    }
    // Respect line breaks
    const lines = part.split("\n");
    return lines.map((line, j) => (
      <Fragment key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </Fragment>
    ));
  });
}

export default function MaterialsLibrary() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCanal, setFilterCanal] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homiLeadId, setHomiLeadId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [form, setForm] = useState({
    titulo: "", conteudo: "", tipo: "contato_inicial", canal: "whatsapp", empreendimento: "",
  });

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("comunicacao_templates")
      .select("*")
      .eq("ativo", true)
      .order("uso_count", { ascending: false, nullsFirst: false });
    setTemplates((data || []) as Template[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = templates.filter(t => {
    if (filterTipo !== "all" && t.tipo !== filterTipo) return false;
    if (filterCanal !== "all" && t.canal !== filterCanal) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.titulo.toLowerCase().includes(q) && !t.conteudo.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleCopy = (conteudo: string) => {
    navigator.clipboard.writeText(conteudo);
    toast.success("📋 Template copiado!");
  };

  const handleCreate = async () => {
    if (!user || !form.titulo.trim() || !form.conteudo.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("comunicacao_templates").insert({
        titulo: form.titulo,
        conteudo: form.conteudo,
        tipo: form.tipo,
        canal: form.canal,
        empreendimento: form.empreendimento || null,
        criado_por: user.id,
        ativo: true,
      });
      if (error) throw error;
      toast.success("Template criado!");
      setAddOpen(false);
      setForm({ titulo: "", conteudo: "", tipo: "contato_inicial", canal: "whatsapp", empreendimento: "" });
      loadTemplates();
    } catch {
      toast.error("Erro ao criar template");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("comunicacao_templates").update({
        titulo: form.titulo,
        conteudo: form.conteudo,
        tipo: form.tipo,
        canal: form.canal,
        empreendimento: form.empreendimento || null,
      }).eq("id", editingTemplate.id);
      if (error) throw error;
      toast.success("Template atualizado!");
      setEditingTemplate(null);
      setPreviewTemplate(null);
      loadTemplates();
    } catch {
      toast.error("Erro ao atualizar template");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t: Template) => {
    setForm({
      titulo: t.titulo,
      conteudo: t.conteudo,
      tipo: t.tipo,
      canal: t.canal,
      empreendimento: t.empreendimento || "",
    });
    setEditingTemplate(t);
    setPreviewTemplate(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[150px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar template..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCanal} onValueChange={setFilterCanal}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="ligacao">Ligação</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 h-9">
            <Plus className="h-4 w-4" /> Novo Material
          </Button>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum template encontrado</p>
            <p className="text-xs mt-1">Crie templates na Central de Comunicação ou clique em "+ Novo Material"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(t => {
              const borderColor = TIPO_COLORS[t.tipo] || "#6B7280";
              const canalInfo = CANAL_ICONS[t.canal] || CANAL_ICONS.whatsapp;
              const CanalIcon = canalInfo.icon;
              return (
                <div
                  key={t.id}
                  className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow group cursor-pointer relative"
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                  onClick={() => setPreviewTemplate(t)}
                >
                  {/* Eye hint */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Ver completo</TooltipContent>
                  </Tooltip>

                  <h4 className="text-sm font-semibold text-foreground truncate pr-6">{t.titulo}</h4>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: `${borderColor}18`, color: borderColor, border: `1px solid ${borderColor}44` }}>
                      {TIPO_LABELS[t.tipo] || t.tipo}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                      <CanalIcon className="h-2.5 w-2.5" /> {canalInfo.label}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                    {t.conteudo}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-muted-foreground/60">
                      Usado {t.uso_count || 0} vezes
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={(e) => { e.stopPropagation(); handleCopy(t.conteudo); }}
                      >
                        <ClipboardCopy className="h-3 w-3" /> 📋 Usar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={(e) => { e.stopPropagation(); setHomiLeadId(t.id); }}
                      >
                        <Sparkles className="h-3 w-3" /> ✨ HOMI
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Preview Modal ─── */}
        <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
          {previewTemplate && (() => {
            const t = previewTemplate;
            const borderColor = TIPO_COLORS[t.tipo] || "#6B7280";
            const canalInfo = CANAL_ICONS[t.canal] || CANAL_ICONS.whatsapp;
            const CanalIcon = canalInfo.icon;
            return (
              <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-foreground leading-snug">{t.titulo}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className="text-[10px] px-2 py-0.5" style={{ backgroundColor: `${borderColor}18`, color: borderColor, border: `1px solid ${borderColor}44` }}>
                      {TIPO_LABELS[t.tipo] || t.tipo}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1">
                      <CanalIcon className="h-2.5 w-2.5" /> {canalInfo.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">
                      Usado {t.uso_count || 0} vezes
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {renderTemplateContent(t.conteudo)}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> ✏️ Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => { setPreviewTemplate(null); setHomiLeadId(t.id); }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" /> ✨ HOMI
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs ml-auto bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                    onClick={() => { handleCopy(t.conteudo); setPreviewTemplate(null); }}
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" /> 📋 Usar template
                  </Button>
                </div>
              </DialogContent>
            );
          })()}
        </Dialog>

        {/* ─── Edit Template Dialog ─── */}
        <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Template
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={form.canal} onValueChange={v => setForm(p => ({ ...p, canal: v }))}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Empreendimento (opcional)</Label>
                <Input value={form.empreendimento} onChange={e => setForm(p => ({ ...p, empreendimento: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  value={form.conteudo}
                  onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
                  className="mt-1 min-h-[120px] text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
              <Button onClick={handleEditSave} disabled={saving || !form.titulo.trim() || !form.conteudo.trim()} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Template Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Novo Template
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Nome do template" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={form.canal} onValueChange={v => setForm(p => ({ ...p, canal: v }))}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Empreendimento (opcional)</Label>
                <Input value={form.empreendimento} onChange={e => setForm(p => ({ ...p, empreendimento: e.target.value }))} placeholder="Ex: Casa Tua" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  value={form.conteudo}
                  onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
                  placeholder="Escreva o conteúdo do template... Use {{nome}}, {{empreendimento}} para variáveis."
                  className="mt-1 min-h-[120px] text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !form.titulo.trim() || !form.conteudo.trim()} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Salvando..." : "Criar Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* HOMI Communication Central */}
        {homiLeadId && (
          <CentralComunicacao
            open={!!homiLeadId}
            onOpenChange={(open) => { if (!open) setHomiLeadId(null); }}
            leadId={homiLeadId}
            leadNome="Lead"
          />
        )}
      </div>
    </TooltipProvider>
  );
}
