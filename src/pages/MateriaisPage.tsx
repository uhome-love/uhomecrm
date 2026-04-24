import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMateriais } from "@/hooks/useMateriais";
import { useUserRole } from "@/hooks/useUserRole";
import { MaterialCard } from "@/components/materiais/MaterialCard";
import { EmpreendimentoFormDialog } from "@/components/materiais/EmpreendimentoFormDialog";
import { FolderOpen, Plus, Search, Loader2 } from "lucide-react";

export default function MateriaisPage() {
  const { data: empreendimentos = [], isLoading } = useMateriais();
  const { isGestor } = useUserRole();
  const [search, setSearch] = useState("");
  const [newDialog, setNewDialog] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empreendimentos;
    return empreendimentos
      .map((e) => ({
        ...e,
        links: e.links.filter(
          (l) => l.titulo.toLowerCase().includes(q) || l.descricao?.toLowerCase().includes(q),
        ),
      }))
      .filter((e) => e.nome.toLowerCase().includes(q) || e.links.length > 0);
  }, [empreendimentos, search]);

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
            <p className="text-sm text-muted-foreground">
              Hub de drives, apresentações e scripts por empreendimento.
            </p>
          </div>
        </div>
        {isGestor && (
          <Button onClick={() => setNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo empreendimento
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empreendimento ou material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-xl py-16 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-foreground">Nenhum material cadastrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isGestor
              ? "Comece adicionando o primeiro empreendimento."
              : "Os materiais aparecerão aqui assim que forem cadastrados pelo gestor."}
          </p>
          {isGestor && (
            <Button className="mt-4" onClick={() => setNewDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo empreendimento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <MaterialCard key={emp.id} empreendimento={emp} canEdit={isGestor} />
          ))}
        </div>
      )}

      <EmpreendimentoFormDialog open={newDialog} onOpenChange={setNewDialog} />
    </div>
  );
}
