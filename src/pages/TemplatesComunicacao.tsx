import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare, Plus, Search, Pencil, Trash2, Phone, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAllComunicacaoTemplates,
  TIPO_CONFIG,
  type ComunicacaoTemplate,
} from "@/hooks/useComunicacao";

const TIPOS = [
  { value: "contato_inicial", label: "Contato Inicial" },
  { value: "follow_up_ligacao", label: "Follow Up Ligação" },
  { value: "follow_up_visita", label: "Follow Up Visita" },
  { value: "proposta", label: "Proposta" },
  { value: "campanha", label: "Campanha" },
  { value: "reengajamento", label: "Reengajamento" },
  { value: "pos_venda", label: "Pós-Venda" },
];

export default function TemplatesComunicacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useAllComunicacaoTemplates();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterCanal, setFilterCanal] = useState("todos");
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<Partial<ComunicacaoTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let list = templates;
    if (filterTipo !== "todos") list = list.filter(t => t.tipo === filterTipo);
    if (filterCanal !== "todos") list = list.filter(t => t.canal === filterCanal);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.titulo.toLowerCase().includes(q) ||
        t.conteudo.toLowerCase().includes(q) ||
        (t.campanha?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [templates, filterTipo, filterCanal, search]);

  const handleNew = () => {
    setEditData({ titulo: "", tipo: "contato_inicial", canal: "whatsapp", conteudo: "", campanha: "", empreendimento: "" });
    setEditModal(true);
  };

  const handleEdit = (tmpl: ComunicacaoTemplate) => {
    setEditData({ ...tmpl });
    setEditModal(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("comunicacao_templates").update({ ativo: false } as any).eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Template removido");
    queryClient.invalidateQueries({ queryKey: ["comunicacao-templates"] });
  };

  const handleSave = async () => {
    if (!editData?.titulo || !editData?.conteudo) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    setSaving(true);
    try {
      if (editData.id) {
        const { error } = await supabase
          .from("comunicacao_templates")
          .update({
            titulo: editData.titulo,
            tipo: editData.tipo,
            canal: editData.canal,
            conteudo: editData.conteudo,
            campanha: editData.campanha || null,
            empreendimento: editData.empreendimento || null,
          } as any)
          .eq("id", editData.id);
        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase
          .from("comunicacao_templates")
          .insert({
            titulo: editData.titulo,
            tipo: editData.tipo,
            canal: editData.canal,
            conteudo: editData.conteudo,
            campanha: editData.campanha || null,
            empreendimento: editData.empreendimento || null,
            criado_por: user?.id,
          } as any);
        if (error) throw error;
        toast.success("Template criado!");
      }
      setEditModal(false);
      setEditData(null);
      queryClient.invalidateQueries({ queryKey: ["comunicacao-templates"] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 28, color: "#1F2937" }}>
            <MessageSquare className="h-7 w-7" style={{ color: "#3B82F6" }} />
            💬 Templates de Comunicação
          </h1>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
            Gerencie os templates de mensagens para a equipe
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2 font-semibold" style={{ background: "#2563EB", borderRadius: 10 }}>
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9CA3AF" }} />
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            style={{ border: "1px solid #E5E7EB", borderRadius: 8 }}
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px]" style={{ border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCanal} onValueChange={setFilterCanal}>
          <SelectTrigger className="w-[150px]" style={{ border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="ligacao">Ligação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tmpl) => {
          const cfg = TIPO_CONFIG[tmpl.tipo] || { label: tmpl.tipo, color: "#6B7280", emoji: "📝" };
          return (
            <Card
              key={tmpl.id}
              className="overflow-hidden transition-all duration-150 hover:shadow-md"
              style={{ borderLeft: `3px solid ${cfg.color}`, borderRadius: 12 }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm" style={{ color: "#1F2937" }}>{tmpl.titulo}</h3>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(tmpl)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" style={{ color: "#6B7280" }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(tmpl.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" style={{ color: "#EF4444" }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                    {tmpl.canal === "whatsapp" ? "📱" : "📞"} {tmpl.canal}
                  </span>
                  {tmpl.campanha && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(236,72,153,0.1)", color: "#EC4899" }}>
                      🎉 {tmpl.campanha}
                    </span>
                  )}
                </div>

                <p className="text-xs line-clamp-3" style={{ color: "#9CA3AF" }}>{tmpl.conteudo}</p>

                <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <span className="text-[10px]" style={{ color: "#D1D5DB" }}>
                    {tmpl.uso_count > 0 ? `Usado ${tmpl.uso_count}x` : "Nunca usado"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "#FAFAFA", border: "1px dashed #D1D5DB" }}>
          <span className="text-5xl">💬</span>
          <p className="font-bold text-xl mt-3" style={{ color: "#374151" }}>Nenhum template encontrado</p>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Crie o primeiro template para sua equipe!</p>
          <Button onClick={handleNew} className="mt-4 gap-2 font-semibold" style={{ background: "#2563EB", borderRadius: 10 }}>
            <Plus className="h-4 w-4" /> Criar template
          </Button>
        </div>
      )}

      {/* Edit/Create Modal */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editData?.id ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-3">
              <Input
                placeholder="Título do template"
                value={editData.titulo || ""}
                onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={editData.tipo || "contato_inicial"} onValueChange={(v) => setEditData({ ...editData, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={editData.canal || "whatsapp"} onValueChange={(v) => setEditData({ ...editData, canal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Empreendimento (opcional)"
                  value={editData.empreendimento || ""}
                  onChange={(e) => setEditData({ ...editData, empreendimento: e.target.value })}
                />
                <Input
                  placeholder="Campanha (opcional)"
                  value={editData.campanha || ""}
                  onChange={(e) => setEditData({ ...editData, campanha: e.target.value })}
                />
              </div>
              <Textarea
                placeholder="Conteúdo da mensagem... Use {{nome}}, {{corretor}}, {{empreendimento}}"
                value={editData.conteudo || ""}
                onChange={(e) => setEditData({ ...editData, conteudo: e.target.value })}
                className="min-h-[200px]"
              />
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                Variáveis disponíveis: {"{{nome}}"}, {"{{corretor}}"}, {"{{empreendimento}}"}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} style={{ background: "#2563EB" }}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
