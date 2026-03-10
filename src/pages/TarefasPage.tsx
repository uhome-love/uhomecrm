import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, isToday, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, GripVertical, Calendar, Clock, User, Edit2, Trash2,
  ChevronRight, AlertTriangle, Filter, LayoutGrid, CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

type TarefaStatus = "a_fazer" | "em_andamento" | "revisao" | "concluida";
type TarefaPrioridade = "baixa" | "media" | "alta" | "urgente";
type TarefaCategoria = "marketing" | "financeiro" | "operacional" | "administrativo" | "outro";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  criado_por: string | null;
  responsavel_id: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  categoria: TarefaCategoria | null;
  prazo: string | null;
  prazo_hora: string | null;
  anexo_url: string | null;
  observacoes: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS: { key: TarefaStatus; label: string; emoji: string; color: string; bg: string; cardBg: string; borderAccent: string; headerBg: string }[] = [
  { key: "a_fazer", label: "A Fazer", emoji: "📋", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.3)", cardBg: "hsl(var(--muted) / 0.15)", borderAccent: "hsl(var(--muted-foreground) / 0.2)", headerBg: "hsl(var(--muted) / 0.5)" },
  { key: "em_andamento", label: "Em Andamento", emoji: "⚡", color: "hsl(220 90% 56%)", bg: "hsl(220 90% 56% / 0.06)", cardBg: "hsl(220 90% 56% / 0.04)", borderAccent: "hsl(220 90% 56% / 0.25)", headerBg: "hsl(220 90% 56% / 0.1)" },
  { key: "revisao", label: "Revisão", emoji: "👀", color: "hsl(38 92% 50%)", bg: "hsl(38 92% 50% / 0.06)", cardBg: "hsl(38 92% 50% / 0.04)", borderAccent: "hsl(38 92% 50% / 0.25)", headerBg: "hsl(38 92% 50% / 0.1)" },
  { key: "concluida", label: "Concluída", emoji: "✅", color: "hsl(142 71% 45%)", bg: "hsl(142 71% 45% / 0.06)", cardBg: "hsl(142 71% 45% / 0.04)", borderAccent: "hsl(142 71% 45% / 0.25)", headerBg: "hsl(142 71% 45% / 0.1)" },
];

const PRIORIDADE_CONFIG: Record<TarefaPrioridade, { label: string; color: string; border: string; badge: string }> = {
  urgente: { label: "🔴 Urgente", color: "#EF4444", border: "4px solid #EF4444", badge: "bg-red-100 text-red-700 border-red-200" },
  alta: { label: "🟠 Alta", color: "#F59E0B", border: "4px solid #F59E0B", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  media: { label: "🔵 Média", color: "#3B82F6", border: "4px solid #3B82F6", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  baixa: { label: "⚪ Baixa", color: "#9CA3AF", border: "4px solid #9CA3AF", badge: "bg-gray-100 text-gray-600 border-gray-200" },
};

const CATEGORIA_CONFIG: Record<TarefaCategoria, { label: string; emoji: string; badge: string }> = {
  marketing: { label: "Marketing", emoji: "📣", badge: "bg-purple-100 text-purple-700 border-purple-200" },
  financeiro: { label: "Financeiro", emoji: "💰", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  operacional: { label: "Operacional", emoji: "⚙️", badge: "bg-sky-100 text-sky-700 border-sky-200" },
  administrativo: { label: "Administrativo", emoji: "📁", badge: "bg-gray-100 text-gray-600 border-gray-200" },
  outro: { label: "Outro", emoji: "📌", badge: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

const emptyForm = {
  titulo: "",
  descricao: "",
  categoria: "marketing" as TarefaCategoria,
  prioridade: "media" as TarefaPrioridade,
  prazo: "",
  prazo_hora: "",
  observacoes: "",
};

export default function TarefasPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [viewMode, setViewMode] = useState<"kanban" | "semana">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Get profile id
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProfileId(data.id); });
  }, [user]);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tarefa[];
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<Tarefa> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("tarefas").update({
          ...payload, updated_at: new Date().toISOString()
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tarefas").insert({
          ...payload,
          criado_por: profileId,
          responsavel_id: profileId,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success(editingId ? "Tarefa atualizada!" : "Tarefa criada!");
      closeModal();
    },
    onError: () => toast.error("Erro ao salvar tarefa"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa excluída");
    },
  });

  const moveTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TarefaStatus }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "concluida") updates.concluida_em = new Date().toISOString();
      else updates.concluida_em = null;
      const { error } = await supabase.from("tarefas").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openEdit(t: Tarefa) {
    setEditingId(t.id);
    setForm({
      titulo: t.titulo,
      descricao: t.descricao || "",
      categoria: (t.categoria || "outro") as TarefaCategoria,
      prioridade: t.prioridade as TarefaPrioridade,
      prazo: t.prazo || "",
      prazo_hora: t.prazo_hora || "",
      observacoes: t.observacoes || "",
    });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.titulo.trim()) { toast.error("Título obrigatório"); return; }
    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      categoria: form.categoria,
      prioridade: form.prioridade,
      prazo: form.prazo || null,
      prazo_hora: form.prazo_hora || null,
      observacoes: form.observacoes || null,
    };
    if (editingId) payload.id = editingId;
    upsertMutation.mutate(payload);
  }

  const filtered = useMemo(() => {
    if (filterCat === "todas") return tarefas;
    if (filterCat === "urgentes") return tarefas.filter(t => t.prioridade === "urgente");
    return tarefas.filter(t => t.categoria === filterCat);
  }, [tarefas, filterCat]);

  // Week info
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekNum = Math.ceil((now.getDate()) / 7);
  const weekLabel = `Semana ${weekNum} · ${format(weekStart, "d", { locale: ptBR })}–${format(weekEnd, "d 'de' MMMM", { locale: ptBR })}`;

  const [dragOverCol, setDragOverCol] = useState<TarefaStatus | null>(null);

  // Drag handlers
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  function onDragEnter(status: TarefaStatus) { setDragOverCol(status); }
  function onDragLeave(e: React.DragEvent, colEl: HTMLDivElement | null) {
    if (colEl && !colEl.contains(e.relatedTarget as Node)) setDragOverCol(null);
  }
  function onDrop(e: React.DragEvent, status: TarefaStatus) {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedId) {
      moveTask.mutate({ id: draggedId, status });
      setDraggedId(null);
    }
  }

  function getPrazoStyle(prazo: string | null) {
    if (!prazo) return { text: "", className: "" };
    const d = new Date(prazo + "T23:59:59");
    if (isBefore(d, startOfDay(now))) return { text: "Vencida", className: "text-red-600 font-semibold" };
    if (isToday(d)) return { text: "Hoje", className: "text-amber-600 font-semibold" };
    return { text: format(d, "EEE dd/MM", { locale: ptBR }), className: "text-muted-foreground" };
  }

  // Weekly view
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📋 Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filters */}
          <div className="flex gap-1 flex-wrap">
            {["todas", "marketing", "financeiro", "operacional", "urgentes"].map(f => (
              <button
                key={f}
                onClick={() => setFilterCat(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterCat === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "todas" ? "Todas" : f === "urgentes" ? "🔴 Urgentes" : CATEGORIA_CONFIG[f as TarefaCategoria]?.label || f}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-2 transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("semana")}
              className={`p-2 transition-colors ${viewMode === "semana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Overdue / today banners */}
      {(() => {
        const vencidas = tarefas.filter(t => t.status !== "concluida" && t.prazo && isBefore(new Date(t.prazo + "T23:59:59"), startOfDay(now)));
        const hoje = tarefas.filter(t => t.status !== "concluida" && t.prazo && isToday(new Date(t.prazo + "T23:59:59")));
        return (
          <>
            {vencidas.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                🔴 Você tem {vencidas.length} tarefa(s) vencida(s)!
              </div>
            )}
            {hoje.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                <Clock className="h-4 w-4" />
                ⚠️ {hoje.length} tarefa(s) vencem hoje!
              </div>
            )}
          </>
        );
      })()}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                className="rounded-xl border border-border bg-card min-h-[300px] flex flex-col"
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, col.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span>{col.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
                  <AnimatePresence>
                    {colTasks.map(t => {
                      const prio = PRIORIDADE_CONFIG[t.prioridade as TarefaPrioridade];
                      const cat = t.categoria ? CATEGORIA_CONFIG[t.categoria as TarefaCategoria] : null;
                      const prazoInfo = getPrazoStyle(t.prazo);
                      return (
                        <motion.div
                          key={t.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          draggable
                          onDragStart={e => onDragStart(e as unknown as React.DragEvent, t.id)}
                          className="rounded-lg border border-border bg-background p-3 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md transition-all group"
                          style={{ borderLeft: prio.border }}
                        >
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <Badge variant="outline" className={`text-[10px] ${prio.badge}`}>
                              {prio.label}
                            </Badge>
                            {cat && (
                              <Badge variant="outline" className={`text-[10px] ${cat.badge}`}>
                                {cat.emoji} {cat.label}
                              </Badge>
                            )}
                          </div>

                          {/* Title & desc */}
                          <p className="font-semibold text-sm text-foreground leading-tight">{t.titulo}</p>
                          {t.descricao && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>
                          )}

                          {/* Prazo */}
                          {t.prazo && (
                            <div className={`flex items-center gap-1 mt-2 text-xs ${prazoInfo.className}`}>
                              <Calendar className="h-3 w-3" />
                              Prazo: {prazoInfo.text || format(new Date(t.prazo + "T12:00:00"), "EEE dd/MM", { locale: ptBR })}
                              {t.prazo_hora && ` ${t.prazo_hora.slice(0, 5)}`}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => openEdit(t)}>
                              <Edit2 className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            {col.key !== "concluida" && (
                              <Button
                                size="sm" variant="ghost" className="h-7 text-xs px-2"
                                onClick={() => {
                                  const nextMap: Record<string, TarefaStatus> = {
                                    a_fazer: "em_andamento", em_andamento: "revisao", revisao: "concluida"
                                  };
                                  moveTask.mutate({ id: t.id, status: nextMap[col.key] });
                                }}
                              >
                                Mover <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            )}
                            {(isAdmin || col.key === "concluida") && (
                              <Button
                                size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
                                onClick={() => deleteMutation.mutate(t.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly View */}
      {viewMode === "semana" && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {weekDays.map(day => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayTasks = filtered.filter(t => t.prazo === dayStr && t.status !== "concluida");
            return (
              <div key={dayStr} className="rounded-xl border border-border bg-card min-h-[200px]">
                <div className={`px-3 py-2 border-b border-border text-center ${isToday(day) ? "bg-primary/10" : ""}`}>
                  <p className="text-xs font-semibold text-foreground">{format(day, "EEE", { locale: ptBR }).toUpperCase()}</p>
                  <p className={`text-lg font-bold ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</p>
                </div>
                <div className="p-2 space-y-1.5">
                  {dayTasks.map(t => {
                    const cat = t.categoria ? CATEGORIA_CONFIG[t.categoria as TarefaCategoria] : null;
                    return (
                      <div
                        key={t.id}
                        className="rounded-md p-2 text-xs border border-border bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                        style={{ borderLeft: PRIORIDADE_CONFIG[t.prioridade as TarefaPrioridade].border }}
                        onClick={() => openEdit(t)}
                      >
                        <p className="font-medium text-foreground line-clamp-2">{t.titulo}</p>
                        {cat && <span className="text-[10px] text-muted-foreground">{cat.emoji} {cat.label}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Sem data */}
          <div className="rounded-xl border border-border bg-card min-h-[200px]">
            <div className="px-3 py-2 border-b border-border text-center">
              <p className="text-xs font-semibold text-muted-foreground">SEM DATA</p>
              <p className="text-lg font-bold text-muted-foreground">—</p>
            </div>
            <div className="p-2 space-y-1.5">
              {filtered.filter(t => !t.prazo && t.status !== "concluida").map(t => (
                <div
                  key={t.id}
                  className="rounded-md p-2 text-xs border border-border bg-background cursor-pointer hover:bg-muted/50"
                  style={{ borderLeft: PRIORIDADE_CONFIG[t.prioridade as TarefaPrioridade].border }}
                  onClick={() => openEdit(t)}
                >
                  <p className="font-medium text-foreground line-clamp-2">{t.titulo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            <DialogDescription>Preencha os campos abaixo para {editingId ? "atualizar" : "criar"} a tarefa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Título *</label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Publicar posts da semana" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Detalhes da tarefa..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Categoria *</label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as TarefaCategoria }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Prioridade *</label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v as TarefaPrioridade }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Prazo *</label>
                <Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Hora limite</label>
                <Input type="time" value={form.prazo_hora} onChange={e => setForm(f => ({ ...f, prazo_hora: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Observações</label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando..." : "Salvar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
