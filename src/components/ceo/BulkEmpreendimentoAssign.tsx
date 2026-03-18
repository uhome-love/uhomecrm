import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, Search, AlertTriangle, Wand2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const EMPREENDIMENTOS_PADRAO = [
  "Open Bosque", "Casa Tua", "Las Casas", "Orygem", "Me Day", "Alto Lindóia",
  "Terrace", "Alfa", "Duetto", "Salzburg", "Lake Eyre", "Seen Menino Deus",
  "Boa Vista Country Club", "Shift", "Casa Bastian", "Melnick Day",
  "Melnick Day Compactos",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}

interface LeadRow {
  id: string;
  nome: string;
  telefone: string | null;
  origem: string | null;
  plataforma: string | null;
  campanha: string | null;
  conjunto_anuncio: string | null;
  anuncio: string | null;
  formulario: string | null;
  created_at: string;
}

export default function BulkEmpreendimentoAssign({ open, onOpenChange, onComplete }: Props) {
  const [selectedEmp, setSelectedEmp] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("__all__");
  const [filterCampanha, setFilterCampanha] = useState("__all__");
  const [filterFormulario, setFilterFormulario] = useState("__all__");
  const [filterPlataforma, setFilterPlataforma] = useState("__all__");
  const [autoResolving, setAutoResolving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads-sem-empreendimento"],
    queryFn: async () => {
      const all: LeadRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, origem, plataforma, campanha, conjunto_anuncio, anuncio, formulario, created_at")
          .is("empreendimento", null)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    enabled: open,
    staleTime: 10_000,
  });

  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.origem) set.add(l.origem); });
    return Array.from(set).sort();
  }, [leads]);

  const campanhas = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.campanha) set.add(l.campanha); });
    return Array.from(set).sort();
  }, [leads]);

  const formularios = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.formulario) set.add(l.formulario); });
    return Array.from(set).sort();
  }, [leads]);

  const plataformas = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.plataforma) set.add(l.plataforma); });
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads;
    if (filterOrigem !== "__all__") list = list.filter(l => l.origem === filterOrigem);
    if (filterCampanha !== "__all__") list = list.filter(l => l.campanha === filterCampanha);
    if (filterFormulario !== "__all__") list = list.filter(l => l.formulario === filterFormulario);
    if (filterPlataforma !== "__all__") list = list.filter(l => l.plataforma === filterPlataforma);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q) || l.campanha?.toLowerCase().includes(q));
    }
    return list;
  }, [leads, filterOrigem, filterCampanha, filterFormulario, filterPlataforma, search]);

  // Grouped view: group by campanha+formulario
  const grouped = useMemo(() => {
    if (viewMode !== "grouped") return [];
    const map = new Map<string, { campanha: string; formulario: string; plataforma: string; leads: LeadRow[] }>();
    for (const l of filtered) {
      const key = `${l.campanha || "—"}|||${l.formulario || "—"}`;
      if (!map.has(key)) {
        map.set(key, { campanha: l.campanha || "—", formulario: l.formulario || "—", plataforma: l.plataforma || "—", leads: [] });
      }
      map.get(key)!.leads.push(l);
    }
    return Array.from(map.values()).sort((a, b) => b.leads.length - a.leads.length);
  }, [filtered, viewMode]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const toggleGroup = (groupLeads: LeadRow[]) => {
    const next = new Set(selectedIds);
    const allSelected = groupLeads.every(l => next.has(l.id));
    if (allSelected) {
      groupLeads.forEach(l => next.delete(l.id));
    } else {
      groupLeads.forEach(l => next.add(l.id));
    }
    setSelectedIds(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (!selectedEmp || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const batchSize = 200;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase
          .from("pipeline_leads")
          .update({ empreendimento: selectedEmp })
          .in("id", batch);
        if (error) throw error;
      }
      toast.success(`${ids.length} leads atualizados para "${selectedEmp}"`);
      setSelectedIds(new Set());
      refetch();
      onComplete?.();
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoResolve = async () => {
    setAutoResolving(true);
    try {
      const { data: session } = await (supabase.auth as any).getSession();
      const { data, error } = await supabase.functions.invoke("jetimob-sync", {
        body: { backfill_campaign: true },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error) throw error;
      toast.success(data?.message || `${data?.fixed || 0} leads corrigidos automaticamente!`);
      refetch();
      onComplete?.();
    } catch (e: any) {
      toast.error("Erro no auto-resolve: " + (e.message || "erro desconhecido"));
    } finally {
      setAutoResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Atribuir Empreendimento
          </DialogTitle>
          <DialogDescription>
            {leads.length} leads sem empreendimento. Filtre por campanha/formulário para atribuir em lote.
          </DialogDescription>
        </DialogHeader>

        {/* Actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoResolve}
            disabled={autoResolving}
            className="gap-1.5"
          >
            {autoResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Auto-resolver via Campanha
          </Button>
          <div className="flex-1" />
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="text-xs h-7 px-2.5"
          >
            Lista
          </Button>
          <Button
            variant={viewMode === "grouped" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grouped")}
            className="text-xs h-7 px-2.5"
          >
            Agrupado
          </Button>
        </div>

        {/* Empreendimento selector */}
        <div className="space-y-2">
          <Select value={selectedEmp} onValueChange={setSelectedEmp}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o empreendimento para atribuir..." />
            </SelectTrigger>
            <SelectContent>
              {EMPREENDIMENTOS_PADRAO.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, tel ou campanha..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas origens</SelectItem>
                {origens.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Extra filters row */}
          <div className="flex gap-2 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={filterPlataforma} onValueChange={setFilterPlataforma}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas plataformas</SelectItem>
                {plataformas.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCampanha} onValueChange={setFilterCampanha}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas campanhas</SelectItem>
                {campanhas.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterFormulario} onValueChange={setFilterFormulario}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Formulário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos formulários</SelectItem>
                {formularios.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select all / count */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <button onClick={toggleAll} className="hover:text-foreground transition-colors">
              {selectedIds.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : `Selecionar todos (${filtered.length})`}
            </button>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="text-[10px]">{selectedIds.size} selecionados</Badge>
            )}
          </div>
        </div>

        {/* Lead list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : viewMode === "grouped" ? (
          <ScrollArea className="flex-1 min-h-0 max-h-[360px] border rounded-lg">
            <div className="divide-y divide-border">
              {grouped.map((g, i) => {
                const allSelected = g.leads.every(l => selectedIds.has(l.id));
                return (
                  <div key={i} className="border-b last:border-0">
                    <label
                      className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors"
                      onClick={(e) => { e.preventDefault(); toggleGroup(g.leads); }}
                    >
                      <Checkbox checked={allSelected} onCheckedChange={() => toggleGroup(g.leads)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold">{g.campanha}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{g.plataforma}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Form: {g.formulario}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{g.leads.length} leads</Badge>
                    </label>
                  </div>
                );
              })}
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              )}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1 min-h-0 max-h-[360px] border rounded-lg">
            <div className="divide-y divide-border">
              {filtered.slice(0, 300).map(l => (
                <label
                  key={l.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(l.id)}
                    onCheckedChange={() => toggle(l.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{l.nome}</p>
                      {l.plataforma && (
                        <Badge variant="outline" className="text-[9px] h-4 shrink-0">{l.plataforma}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {l.origem || "—"} · {l.telefone || "sem tel"}
                    </p>
                    {(l.campanha || l.formulario || l.anuncio) && (
                      <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                        {l.campanha && <span>📢 {l.campanha}</span>}
                        {l.formulario && <span> · 📝 {l.formulario}</span>}
                        {l.anuncio && <span> · 🎯 {l.anuncio}</span>}
                      </p>
                    )}
                  </div>
                </label>
              ))}
              {filtered.length > 300 && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground text-center flex items-center gap-1 justify-center">
                  <AlertTriangle className="h-3 w-3" />
                  Mostrando 300 de {filtered.length}. Use os filtros para refinar.
                </div>
              )}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedEmp || selectedIds.size === 0}
            size="sm"
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Atribuir a {selectedIds.size} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
