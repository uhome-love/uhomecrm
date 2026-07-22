import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMateriais, type MaterialLink, type MaterialEmpreendimento } from "@/hooks/useMateriais";
import { useUserRole } from "@/hooks/useUserRole";
import { MaterialCard } from "@/components/materiais/MaterialCard";
import { EmpreendimentoFormDialog } from "@/components/materiais/EmpreendimentoFormDialog";
import { FolderOpen, Plus, Search, Loader2, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCategoriaInfo } from "@/components/materiais/CategoriaIcon";

interface SemanticResult extends MaterialLink {
  similarity: number;
  snippet: string;
  materiais_empreendimentos?: { id: string; nome: string; logo_url: string | null };
}

export default function MateriaisPage() {
  const { data: empreendimentos = [], isLoading } = useMateriais();
  const { isGestor } = useUserRole();
  const [search, setSearch] = useState("");
  const [newDialog, setNewDialog] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const runSemantic = async () => {
    const q = search.trim();
    if (q.length < 3) {
      toast({ title: "Digite ao menos 3 caracteres." });
      return;
    }
    setSemanticLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("materiais-search", {
        body: { query: q, limit: 30 },
      });
      if (error) throw error;
      setSemanticResults(((data as any)?.results ?? []) as SemanticResult[]);
    } catch (e: any) {
      toast({ title: "Busca IA falhou", description: e.message, variant: "destructive" });
    } finally {
      setSemanticLoading(false);
    }
  };

  const clearSemantic = () => setSemanticResults(null);

  useEffect(() => { if (semanticResults) setSemanticResults(null); /* new keystroke resets IA view */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empreendimentos;
    return empreendimentos
      .map((e) => ({
        ...e,
        links: e.links.filter(
          (l) => l.titulo.toLowerCase().includes(q) || l.descricao?.toLowerCase().includes(q)
            || l.tags?.some((t) => t.toLowerCase().includes(q)),
        ),
      }))
      .filter((e) => e.nome.toLowerCase().includes(q) || e.links.length > 0);
  }, [empreendimentos, search]);

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <PageHeader
        title="Materiais"
        subtitle="Hub de drives, apresentações e scripts por empreendimento."
        icon={<FolderOpen className="h-5 w-5" />}
        actions={
          isGestor && (
            <Button onClick={() => setNewDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo empreendimento
            </Button>
          )
        }
      />

      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, tag ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSemantic(); }}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={runSemantic}
          disabled={semanticLoading || search.trim().length < 3}
        >
          {semanticLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Buscar com IA
        </Button>
      </div>

      {semanticResults !== null ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {semanticResults.length} resultado{semanticResults.length === 1 ? "" : "s"} por IA para "{search.trim()}"
            </h2>
            <Button variant="ghost" size="sm" onClick={clearSemantic}>
              <X className="h-3.5 w-3.5 mr-1" /> Fechar
            </Button>
          </div>
          {semanticResults.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-xl py-10 text-center text-sm text-muted-foreground">
              Nada relevante encontrado. Tente outras palavras.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {semanticResults.map((r) => {
                const info = getCategoriaInfo(r.categoria);
                const Icon = info.icon;
                return (
                  <div key={r.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {r.materiais_empreendimentos?.nome} • <Icon className="inline h-3 w-3" /> {info.label}
                        </p>
                        <h3 className="font-medium text-foreground truncate">{r.titulo}</h3>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                        {Math.round(r.similarity * 100)}%
                      </span>
                    </div>
                    {r.snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.snippet}...</p>
                    )}
                    {(r.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.tags!.slice(0, 5).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isLoading ? (
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
