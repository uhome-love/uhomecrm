import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Settings, Play, Pause, StopCircle, Loader2, Trash2, FolderOpen, Tag, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: <Settings className="h-3 w-3" /> },
  liberada: { label: "Liberada", color: "bg-emerald-500/15 text-emerald-600", icon: <Play className="h-3 w-3" /> },
  pausada: { label: "Pausada", color: "bg-amber-500/15 text-amber-600", icon: <Pause className="h-3 w-3" /> },
  encerrada: { label: "Encerrada", color: "bg-red-500/15 text-red-600", icon: <StopCircle className="h-3 w-3" /> },
};

function ListaStats({ listaId }: { listaId: string }) {
  const { data } = useQuery({
    queryKey: ["oa-lista-stats", listaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oferta_ativa_leads")
        .select("status")
        .eq("lista_id", listaId);
      if (error) return { na_fila: 0, aproveitado: 0, descartado: 0, total: 0 };
      const leads = data || [];
      return {
        total: leads.length,
        na_fila: leads.filter(l => l.status === "na_fila").length,
        aproveitado: leads.filter(l => l.status === "aproveitado" || l.status === "concluido").length,
        descartado: leads.filter(l => l.status === "descartado").length,
      };
    },
    staleTime: 30000,
  });

  if (!data) return null;
  return (
    <div className="flex gap-3 text-[11px]">
      <span>📋 {data.total} total</span>
      <span className="text-emerald-600">✅ {data.aproveitado} aprov.</span>
      <span>📞 {data.na_fila} na fila</span>
      <span className="text-muted-foreground">❌ {data.descartado} desc.</span>
    </div>
  );
}

function ListaCard({ lista, isAdmin, isSelected, onToggle, onUpdate, onDelete, onClean }: {
  lista: OALista;
  isAdmin: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onClean: (id: string) => void;
}) {
  const st = STATUS_CONFIG[lista.status] || STATUS_CONFIG.pendente;
  return (
    <Card className={`overflow-hidden transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {isAdmin && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              className="mt-1 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground truncate">{lista.nome}</h4>
              <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${st.color}`}>
                {st.icon} {st.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Empreendimento: {lista.empreendimento}</p>
            {lista.campanha && <p className="text-xs text-muted-foreground">Campanha: {lista.campanha}</p>}
            <div className="mt-2">
              <ListaStats listaId={lista.id} />
            </div>
            <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>Max tentativas: {lista.max_tentativas}</span>
              <span>·</span>
              <span>Cooldown: {lista.cooldown_dias}d</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {lista.status !== "liberada" && (
                <Button size="sm" className="gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => onUpdate(lista.id, { status: "liberada" })}>
                  <Play className="h-3 w-3" /> START
                </Button>
              )}
              {lista.status === "liberada" && (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-amber-600" onClick={() => onUpdate(lista.id, { status: "pausada" })}>
                  <Pause className="h-3 w-3" /> Pausar
                </Button>
              )}
              {lista.status !== "encerrada" && (
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive" onClick={() => onUpdate(lista.id, { status: "encerrada" })}>
                  <StopCircle className="h-3 w-3" /> Encerrar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-7 text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => {
                  if (confirm(`Limpar leads já contatados (descartados/aproveitados) da lista "${lista.nome}"?`)) {
                    onClean(lista.id);
                  }
                }}
              >
                <Sparkles className="h-3 w-3" /> Limpar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  if (confirm(`Excluir a lista "${lista.nome}" e todos os seus leads? Esta ação não pode ser desfeita.`)) {
                    onDelete(lista.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampaignManager() {
  const { listas, isLoading, updateLista, deleteLista } = useOAListas();
  const { isAdmin } = useUserRole();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [showCampanhaDialog, setShowCampanhaDialog] = useState(false);
  const [campanhaName, setCampanhaName] = useState("");
  const [assigningCampanha, setAssigningCampanha] = useState(false);
  const [collapsedCampanhas, setCollapsedCampanhas] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const handleCleanLista = useCallback(async (listaId: string) => {
    const { data: removed, error } = await supabase
      .from("oferta_ativa_leads")
      .delete()
      .eq("lista_id", listaId)
      .in("status", ["descartado", "aproveitado", "concluido"])
      .select("id");
    if (error) { toast.error("Erro ao limpar lista"); console.error(error); return; }
    const count = removed?.length || 0;
    if (count > 0) {
      // Update total_leads count
      const { data: currentLista } = await supabase
        .from("oferta_ativa_listas")
        .select("total_leads")
        .eq("id", listaId)
        .single();
      const newTotal = Math.max(0, (currentLista?.total_leads || 0) - count);
      await supabase.from("oferta_ativa_listas").update({ total_leads: newTotal } as any).eq("id", listaId);
      queryClient.invalidateQueries({ queryKey: ["oa-listas"] });
      queryClient.invalidateQueries({ queryKey: ["oa-lista-stats"] });
      queryClient.invalidateQueries({ queryKey: ["oa-leads"] });
    }
    toast.success(`${count} lead(s) removidos da lista!`);
  }, [queryClient]);

  const handleBulkClean = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Limpar leads já contatados de ${selected.size} lista(s)? Leads descartados e aproveitados serão removidos.`)) return;
    setBulkActioning(true);
    try {
      for (const id of selected) await handleCleanLista(id);
      toast.success(`${selected.size} lista(s) limpas!`);
    } catch {
      toast.error("Erro ao limpar listas.");
    } finally {
      setBulkActioning(false);
    }
  }, [selected, handleCleanLista]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === listas.length) setSelected(new Set());
    else setSelected(new Set(listas.map(l => l.id)));
  };

  const toggleCampanha = (key: string) => {
    setCollapsedCampanhas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Group listas by campanha
  const grouped = useMemo(() => {
    const groups: Record<string, OALista[]> = {};
    const ungrouped: OALista[] = [];
    for (const l of listas) {
      if (l.campanha) {
        if (!groups[l.campanha]) groups[l.campanha] = [];
        groups[l.campanha].push(l);
      } else {
        ungrouped.push(l);
      }
    }
    return { groups, ungrouped };
  }, [listas]);

  const existingCampanhas = useMemo(() => 
    Object.keys(grouped.groups).sort(), [grouped.groups]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} lista(s) e todos os leads vinculados?`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selected) await deleteLista(id);
      setSelected(new Set());
      toast.success(`${selected.size} lista(s) excluída(s)!`);
    } catch {
      toast.error("Erro ao excluir listas.");
    } finally {
      setBulkDeleting(false);
    }
  }, [selected, deleteLista]);

  const handleBulkStatus = useCallback(async (newStatus: string) => {
    if (selected.size === 0) return;
    const label = newStatus === "liberada" ? "liberar" : newStatus === "pausada" ? "pausar" : "encerrar";
    if (!confirm(`Deseja ${label} ${selected.size} lista(s)?`)) return;
    setBulkActioning(true);
    try {
      for (const id of selected) await updateLista(id, { status: newStatus } as any);
      toast.success(`${selected.size} lista(s) atualizadas!`);
    } catch {
      toast.error("Erro ao atualizar listas.");
    } finally {
      setBulkActioning(false);
    }
  }, [selected, updateLista]);

  const handleAssignCampanha = useCallback(async () => {
    if (!campanhaName.trim() || selected.size === 0) return;
    setAssigningCampanha(true);
    try {
      for (const id of selected) {
        await updateLista(id, { campanha: campanhaName.trim() } as any);
      }
      toast.success(`${selected.size} lista(s) agrupadas na campanha "${campanhaName.trim()}"!`);
      setShowCampanhaDialog(false);
      setCampanhaName("");
      setSelected(new Set());
    } catch {
      toast.error("Erro ao agrupar listas.");
    } finally {
      setAssigningCampanha(false);
    }
  }, [selected, campanhaName, updateLista]);

  const handleRemoveCampanha = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remover ${selected.size} lista(s) da campanha atual?`)) return;
    setBulkActioning(true);
    try {
      for (const id of selected) await updateLista(id, { campanha: null } as any);
      toast.success("Listas removidas da campanha.");
      setSelected(new Set());
    } catch {
      toast.error("Erro ao remover da campanha.");
    } finally {
      setBulkActioning(false);
    }
  }, [selected, updateLista]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (listas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma campanha criada</p>
          <p className="text-sm mt-1">Importe uma lista na aba "Importar" para começar.</p>
        </CardContent>
      </Card>
    );
  }

  const allSelected = selected.size === listas.length && listas.length > 0;
  const someHaveCampanha = [...selected].some(id => listas.find(l => l.id === id)?.campanha);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Campanhas / Listas ({listas.length})</h3>
      </div>

      {/* Bulk actions bar */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border flex-wrap">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all-listas" />
          <label htmlFor="select-all-listas" className="text-sm font-medium cursor-pointer">
            {allSelected ? "Desmarcar" : "Selecionar todas"}
          </label>
          <Badge variant="outline" className="text-xs">{selected.size}/{listas.length}</Badge>

          {selected.size > 0 && (
            <>
              <div className="h-4 w-px bg-border mx-1" />
              <Button
                size="sm"
                className="gap-1.5 text-xs h-7 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setCampanhaName("");
                  setShowCampanhaDialog(true);
                }}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Agrupar em Campanha
              </Button>
              {someHaveCampanha && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  onClick={handleRemoveCampanha}
                  disabled={bulkActioning}
                >
                  <Tag className="h-3.5 w-3.5" /> Desagrupar
                </Button>
              )}
              <div className="h-4 w-px bg-border mx-1" />
              <Button
                size="sm"
                className="gap-1.5 text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleBulkStatus("liberada")}
                disabled={bulkActioning}
              >
                {bulkActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Liberar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7 text-amber-600"
                onClick={() => handleBulkStatus("pausada")}
                disabled={bulkActioning}
              >
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7 text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                onClick={handleBulkClean}
                disabled={bulkActioning}
              >
                {bulkActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Limpar Contatados
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5 text-xs h-7 ml-auto"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir
              </Button>
            </>
          )}
        </div>
      )}

      {/* Grouped campanhas */}
      {Object.entries(grouped.groups).map(([campanha, listasGroup]) => {
        const isCollapsed = collapsedCampanhas.has(campanha);
        const totalLeads = listasGroup.reduce((s, l) => s + (l.total_leads || 0), 0);
        const allInGroup = listasGroup.every(l => selected.has(l.id));
        const someInGroup = listasGroup.some(l => selected.has(l.id));

        return (
          <div key={campanha} className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-500/10 transition-colors"
              onClick={() => toggleCampanha(campanha)}
            >
              {isAdmin && (
                <Checkbox
                  checked={allInGroup}
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => {
                    setSelected(prev => {
                      const next = new Set(prev);
                      if (allInGroup) {
                        listasGroup.forEach(l => next.delete(l.id));
                      } else {
                        listasGroup.forEach(l => next.add(l.id));
                      }
                      return next;
                    });
                  }}
                />
              )}
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
              <FolderOpen className="h-4 w-4 text-blue-400" />
              <span className="font-semibold text-sm text-foreground">{campanha}</span>
              <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-400 border-blue-500/30">
                {listasGroup.length} lista{listasGroup.length > 1 ? "s" : ""} · {totalLeads} leads
              </Badge>
            </div>
            {!isCollapsed && (
              <div className="px-3 pb-3 space-y-2">
                {listasGroup.map(lista => (
                  <ListaCard
                    key={lista.id}
                    lista={lista}
                    isAdmin={isAdmin}
                    isSelected={selected.has(lista.id)}
                    onToggle={() => toggleSelect(lista.id)}
                    onUpdate={(id, data) => updateLista(id, data)}
                    onDelete={(id) => { deleteLista(id); setSelected(prev => { const n = new Set(prev); n.delete(id); return n; }); }}
                    onClean={handleCleanLista}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Ungrouped listas */}
      {grouped.ungrouped.length > 0 && Object.keys(grouped.groups).length > 0 && (
        <p className="text-xs text-muted-foreground font-medium pt-2">Sem campanha</p>
      )}
      {grouped.ungrouped.map(lista => (
        <ListaCard
          key={lista.id}
          lista={lista}
          isAdmin={isAdmin}
          isSelected={selected.has(lista.id)}
          onToggle={() => toggleSelect(lista.id)}
          onUpdate={(id, data) => updateLista(id, data)}
          onDelete={(id) => { deleteLista(id); setSelected(prev => { const n = new Set(prev); n.delete(id); return n; }); }}
          onClean={handleCleanLista}
        />
      ))}

      {/* Assign campanha dialog */}
      <Dialog open={showCampanhaDialog} onOpenChange={setShowCampanhaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-500" />
              Agrupar {selected.size} lista(s) em campanha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da campanha</label>
              <Input
                placeholder="Ex: Mega da Cyrela"
                value={campanhaName}
                onChange={(e) => setCampanhaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAssignCampanha()}
              />
            </div>
            {existingCampanhas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Ou selecione uma campanha existente:</p>
                <div className="flex flex-wrap gap-2">
                  {existingCampanhas.map(c => (
                    <Button
                      key={c}
                      size="sm"
                      variant={campanhaName === c ? "default" : "outline"}
                      className="text-xs h-7"
                      onClick={() => setCampanhaName(c)}
                    >
                      <FolderOpen className="h-3 w-3 mr-1" /> {c}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampanhaDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleAssignCampanha}
              disabled={!campanhaName.trim() || assigningCampanha}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assigningCampanha ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderOpen className="h-4 w-4 mr-2" />}
              Agrupar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
