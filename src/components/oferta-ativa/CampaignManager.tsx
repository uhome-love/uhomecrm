import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Play, Pause, StopCircle, Loader2, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function CampaignManager() {
  const { listas, isLoading, updateLista, deleteLista } = useOAListas();
  const { isAdmin } = useUserRole();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} lista(s) e todos os leads vinculados? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selected) {
        await deleteLista(id);
      }
      setSelected(new Set());
      toast.success(`${selected.size} lista(s) excluída(s)!`);
    } catch {
      toast.error("Erro ao excluir listas.");
    } finally {
      setBulkDeleting(false);
    }
  }, [selected, deleteLista]);

  const [bulkActioning, setBulkActioning] = useState(false);

  const handleBulkStatus = useCallback(async (newStatus: string) => {
    if (selected.size === 0) return;
    const label = newStatus === "liberada" ? "liberar" : newStatus === "pausada" ? "pausar" : "encerrar";
    if (!confirm(`Deseja ${label} ${selected.size} lista(s)?`)) return;
    setBulkActioning(true);
    try {
      for (const id of selected) {
        await updateLista(id, { status: newStatus } as any);
      }
      toast.success(`${selected.size} lista(s) ${newStatus === "liberada" ? "liberada(s)" : newStatus === "pausada" ? "pausada(s)" : "encerrada(s)"}!`);
    } catch {
      toast.error("Erro ao atualizar listas.");
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Campanhas / Listas ({listas.length})</h3>
      </div>

      {/* Bulk actions bar */}
      {isAdmin && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            id="select-all-listas"
          />
          <label htmlFor="select-all-listas" className="text-sm font-medium cursor-pointer">
            {allSelected ? "Desmarcar todas" : "Selecionar todas"}
          </label>
          <Badge variant="outline" className="text-xs">
            {selected.size}/{listas.length}
          </Badge>
          {selected.size > 0 && (
            <>
              <Button
                size="sm"
                className="gap-1.5 text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleBulkStatus("liberada")}
                disabled={bulkActioning}
              >
                {bulkActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Liberar {selected.size}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7 text-amber-600"
                onClick={() => handleBulkStatus("pausada")}
                disabled={bulkActioning}
              >
                <Pause className="h-3.5 w-3.5" /> Pausar {selected.size}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="ml-auto gap-1.5 text-xs h-7"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir {selected.size}
              </Button>
            </>
          )}
        </div>
      )}

      {listas.map(lista => {
        const st = STATUS_CONFIG[lista.status] || STATUS_CONFIG.pendente;
        const isSelected = selected.has(lista.id);
        return (
          <Card key={lista.id} className={`overflow-hidden transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {isAdmin && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(lista.id)}
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
                      <Button size="sm" className="gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateLista(lista.id, { status: "liberada" } as any)}>
                        <Play className="h-3 w-3" /> START
                      </Button>
                    )}
                    {lista.status === "liberada" && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-amber-600" onClick={() => updateLista(lista.id, { status: "pausada" } as any)}>
                        <Pause className="h-3 w-3" /> Pausar
                      </Button>
                    )}
                    {lista.status !== "encerrada" && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive" onClick={() => updateLista(lista.id, { status: "encerrada" } as any)}>
                        <StopCircle className="h-3 w-3" /> Encerrar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Excluir a lista "${lista.nome}" e todos os seus leads? Esta ação não pode ser desfeita.`)) {
                          deleteLista(lista.id);
                          setSelected(prev => { const n = new Set(prev); n.delete(lista.id); return n; });
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
      })}
    </div>
  );
}
