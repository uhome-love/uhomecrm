import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, Search, AlertTriangle } from "lucide-react";
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
  created_at: string;
}

export default function BulkEmpreendimentoAssign({ open, onOpenChange, onComplete }: Props) {
  const [selectedEmp, setSelectedEmp] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("__all__");

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads-sem-empreendimento"],
    queryFn: async () => {
      const all: LeadRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("pipeline_leads")
          .select("id, nome, telefone, origem, created_at")
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

  const filtered = useMemo(() => {
    let list = leads;
    if (filterOrigem !== "__all__") list = list.filter(l => l.origem === filterOrigem);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.nome?.toLowerCase().includes(q) || l.telefone?.includes(q));
    }
    return list;
  }, [leads, filterOrigem, search]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Atribuir Empreendimento
          </DialogTitle>
          <DialogDescription>
            {leads.length} leads sem empreendimento definido. Selecione e atribua.
          </DialogDescription>
        </DialogHeader>

        {/* Empreendimento selector */}
        <div className="space-y-3">
          <Select value={selectedEmp} onValueChange={setSelectedEmp}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o empreendimento..." />
            </SelectTrigger>
            <SelectContent>
              {EMPREENDIMENTOS_PADRAO.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger className="w-40 h-9 text-xs">
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

          {/* Select all */}
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
        ) : (
          <ScrollArea className="flex-1 min-h-0 max-h-[340px] border rounded-lg">
            <div className="divide-y divide-border">
              {filtered.slice(0, 200).map(l => (
                <label
                  key={l.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(l.id)}
                    onCheckedChange={() => toggle(l.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{l.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {l.origem || "—"} · {l.telefone || "sem tel"}
                    </p>
                  </div>
                </label>
              ))}
              {filtered.length > 200 && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground text-center flex items-center gap-1 justify-center">
                  <AlertTriangle className="h-3 w-3" />
                  Mostrando 200 de {filtered.length}. Use os filtros para refinar.
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
