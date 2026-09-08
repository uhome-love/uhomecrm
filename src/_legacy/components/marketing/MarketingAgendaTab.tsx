import { useState } from "react";
import { useConteudosMarketing } from "@/hooks/useBackofficeData";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Plus, Camera, Video, Megaphone, Building2, PartyPopper, Newspaper, Loader2, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; icon: string }> = {
  planejado: { label: "Planejado", icon: "📝" },
  em_producao: { label: "Em Produção", icon: "🟡" },
  revisao: { label: "Revisão", icon: "🔵" },
  agendado: { label: "Agendado", icon: "🟢" },
  publicado: { label: "Publicado", icon: "✅" },
  atrasado: { label: "Atrasado", icon: "🔴" },
};

const TIPOS = [
  { value: "post_estatico", label: "📸 Post Estático" },
  { value: "reels", label: "🎬 Reels/TikTok" },
  { value: "anuncio", label: "📣 Anúncio Pago" },
  { value: "institucional", label: "🏢 Institucional" },
  { value: "endomarketing", label: "🎉 Endomarketing" },
  { value: "informativo", label: "📰 Informativo" },
];

const emptyForm = {
  tipo: "post_estatico",
  plataforma: ["instagram"],
  tema: "",
  descricao: "",
  data_publicacao: "",
  status: "planejado",
};

export default function MarketingAgendaTab() {
  const { user } = useAuth();
  const { conteudos, isLoading, createConteudo, updateConteudo, deleteConteudo } = useConteudosMarketing();
  const [newOpen, setNewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setNewOpen(true); };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      tipo: c.tipo || "post_estatico",
      plataforma: c.plataforma || ["instagram"],
      tema: c.tema || "",
      descricao: c.descricao || "",
      data_publicacao: c.data_publicacao ? new Date(c.data_publicacao).toISOString().slice(0, 16) : "",
      status: c.status || "planejado",
    });
    setNewOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.tema) return;
    try {
      const payload: any = {
        ...form,
        data_publicacao: form.data_publicacao ? new Date(form.data_publicacao).toISOString() : null,
      };
      if (editingId) {
        await updateConteudo.mutateAsync({ id: editingId, ...payload });
        toast.success("Conteúdo atualizado!");
      } else {
        await createConteudo.mutateAsync({ ...payload, criado_por: user.id });
        toast.success("Conteúdo criado!");
      }
      setNewOpen(false); setForm(emptyForm); setEditingId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este conteúdo?")) return;
    try { await deleteConteudo.mutateAsync(id); toast.success("Excluído!"); }
    catch (e: any) { toast.error(e.message); }
  };

  const getEffectiveStatus = (c: any) => {
    if (c.status === "publicado" || c.status === "agendado") return c.status;
    if (c.data_publicacao && new Date(c.data_publicacao) < new Date() && !["publicado", "agendado"].includes(c.status)) return "atrasado";
    return c.status;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Agenda editorial e conteúdos planejados</p>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Conteúdo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : conteudos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nenhum conteúdo planejado</p>
            <p className="text-sm text-muted-foreground mt-1">Crie conteúdos para preencher a agenda editorial.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conteudos.map((c: any) => {
            const effectiveStatus = getEffectiveStatus(c);
            const st = STATUS_MAP[effectiveStatus] || STATUS_MAP.planejado;
            const tipoInfo = TIPOS.find(t => t.value === c.tipo);
            return (
              <Card key={c.id} className={`hover:border-primary/30 transition-colors ${effectiveStatus === "atrasado" ? "border-red-500/30" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{tipoInfo?.label || c.tipo}</span>
                        <Badge variant="secondary" className="text-[10px]">{(c.plataforma || []).join(" + ")}</Badge>
                      </div>
                      <p className="font-semibold text-foreground">{c.tema}</p>
                      {c.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.descricao}</p>}
                      {c.data_publicacao && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📅 {format(new Date(c.data_publicacao), "EEEE, dd/MM · HH'h'", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={effectiveStatus === "atrasado" ? "destructive" : "secondary"}>
                        {st.icon} {st.label}
                      </Badge>
                      <Select value={c.status} onValueChange={v => updateConteudo.mutate({ id: c.id, status: v })}>
                        <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planejado">Planejado</SelectItem>
                          <SelectItem value="em_producao">Em Produção</SelectItem>
                          <SelectItem value="revisao">Revisão</SelectItem>
                          <SelectItem value="agendado">Agendado</SelectItem>
                          <SelectItem value="publicado">Publicado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={v => { if (!v) { setNewOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Conteúdo" : "Novo Conteúdo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tema / Título</Label>
              <Input value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} placeholder="Ex: Post Shift — condições março" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Data de publicação</Label>
              <Input type="datetime-local" value={form.data_publicacao} onChange={e => setForm(f => ({ ...f, data_publicacao: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.tema}>
              {editingId ? "Salvar Alterações" : "Criar Conteúdo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
