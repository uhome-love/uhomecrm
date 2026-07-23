import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMateriais, type MaterialLink } from "@/hooks/useMateriais";
import { useUserRole } from "@/hooks/useUserRole";
import { MateriaisSidebar } from "@/components/materiais/MateriaisSidebar";
import { MateriaisEmpreendimentoPanel } from "@/components/materiais/MateriaisEmpreendimentoPanel";
import { MaterialListaCompact } from "@/components/materiais/MaterialListaCompact";
import { EmpreendimentoFormDialog } from "@/components/materiais/EmpreendimentoFormDialog";
import {
  FolderOpen, Plus, Search, Loader2, Sparkles, X, BarChart3,
  Clock, Menu, Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCategoriaInfo } from "@/components/materiais/CategoriaIcon";
import {
  useEmpreendimentoFavoritoIds,
  useMaterialRecentes,
} from "@/hooks/useMateriaisFavoritos";

interface SemanticResult extends MaterialLink {
  similarity: number;
  snippet: string;
  materiais_empreendimentos?: { id: string; nome: string; logo_url: string | null };
}

export default function MateriaisPage() {
  const { data: empreendimentos = [], isLoading } = useMateriais();
  const { isGestor } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"todos" | "recentes">(
    (searchParams.get("tab") as any) === "recentes" ? "recentes" : "todos",
  );
  const [search, setSearch] = useState("");
  const [newDialog, setNewDialog] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: favEmpIds } = useEmpreendimentoFavoritoIds();
  const { data: recentes = [], isLoading: loadingRec } = useMaterialRecentes();

  // Empreendimento selecionado via URL (?emp=ID)
  const selectedId = searchParams.get("emp");
  const selected = useMemo(
    () => empreendimentos.find((e) => e.id === selectedId) ?? null,
    [empreendimentos, selectedId],
  );

  // Auto-selecionar o primeiro se nada selecionado
  useEffect(() => {
    if (tab !== "todos") return;
    if (!empreendimentos.length) return;
    if (!selectedId || !empreendimentos.some((e) => e.id === selectedId)) {
      const next = new URLSearchParams(searchParams);
      next.set("emp", empreendimentos[0].id);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentos, tab]);

  const handleSelect = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("emp", id);
    setSearchParams(next, { replace: true });
    setMobileNavOpen(false);
  };

  const handleTabChange = (v: string) => {
    setTab(v as any);
    const next = new URLSearchParams(searchParams);
    if (v === "todos") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

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

  useEffect(() => {
    if (semanticResults) setSemanticResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="container max-w-[1400px] mx-auto py-6 space-y-4">
      <PageHeader
        title="Materiais"
        subtitle="Hub de drives, apresentações e scripts por empreendimento."
        icon={<FolderOpen className="h-5 w-5" />}
        actions={
          isGestor && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/materiais/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" /> Analytics
                </Link>
              </Button>
              <Button onClick={() => setNewDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Novo empreendimento
              </Button>
            </div>
          )
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Empreendimentos
          </TabsTrigger>
          <TabsTrigger value="recentes">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Recentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          {/* Busca global */}
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar material por título, tag ou descrição..."
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
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          if (r.materiais_empreendimentos?.id) {
                            handleSelect(r.materiais_empreendimentos.id);
                            clearSemantic();
                          }
                        }}
                        className="p-4 rounded-xl border border-border/60 bg-card space-y-2 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">
                              {r.materiais_empreendimentos?.nome} • <Icon className="inline h-3 w-3" /> {info.label}
                            </p>
                            <h3 className="font-medium text-foreground">{r.titulo}</h3>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        </div>
                        {r.snippet && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.snippet}...</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : empreendimentos.length === 0 ? (
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
            <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
              <div className="flex" style={{ minHeight: "calc(100vh - 340px)" }}>
                {/* Sidebar desktop */}
                <aside className="hidden md:block w-[280px] flex-shrink-0">
                  <MateriaisSidebar
                    empreendimentos={empreendimentos}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    favIds={favEmpIds}
                  />
                </aside>

                {/* Painel principal */}
                <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-auto">
                  {/* Mobile trigger */}
                  <div className="md:hidden mb-4">
                    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Menu className="h-4 w-4 mr-2" />
                          <Building2 className="h-4 w-4 mr-2" />
                          {selected ? selected.nome : "Escolher empreendimento"}
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0 w-[300px]">
                        <SheetHeader className="px-4 py-3 border-b border-border/60">
                          <SheetTitle>Empreendimentos</SheetTitle>
                        </SheetHeader>
                        <div className="h-[calc(100%-56px)]">
                          <MateriaisSidebar
                            empreendimentos={empreendimentos}
                            selectedId={selectedId}
                            onSelect={handleSelect}
                            favIds={favEmpIds}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>

                  {selected ? (
                    <MateriaisEmpreendimentoPanel empreendimento={selected} canEdit={isGestor} />
                  ) : (
                    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                      Selecione um empreendimento na lista ao lado.
                    </div>
                  )}
                </main>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recentes">
          <MaterialListaCompact
            items={recentes}
            loading={loadingRec}
            emptyLabel="Seus últimos materiais abertos aparecerão aqui."
          />
        </TabsContent>
      </Tabs>

      <EmpreendimentoFormDialog open={newDialog} onOpenChange={setNewDialog} />
    </div>
  );
}
