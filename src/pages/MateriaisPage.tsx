import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMateriais, type MaterialLink } from "@/hooks/useMateriais";
import { useUserRole } from "@/hooks/useUserRole";
import { MateriaisSidebar } from "@/components/materiais/MateriaisSidebar";
import { MateriaisEmpreendimentoPanel } from "@/components/materiais/MateriaisEmpreendimentoPanel";
import { MaterialListaCompact } from "@/components/materiais/MaterialListaCompact";
import { EmpreendimentoFormDialog } from "@/components/materiais/EmpreendimentoFormDialog";
import {
  FolderOpen, Plus, Search, Loader2, Sparkles, X, BarChart3,
  Clock, Menu, Building2, MoreVertical,
} from "lucide-react";
import { Link } from "react-router-dom";
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

  const selectedId = searchParams.get("emp");
  const selected = useMemo(
    () => empreendimentos.find((e) => e.id === selectedId) ?? null,
    [empreendimentos, selectedId],
  );

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
    <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 py-3 space-y-3">
      {/* Header compacto — título + ações + abas + busca em duas linhas */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
          <h1 className="text-xl font-semibold truncate">Materiais</h1>
        </div>

        {isGestor && (
          <div className="ml-auto flex items-center gap-2">
            {/* Desktop: botões separados */}
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/materiais/analytics">
                  <BarChart3 className="h-4 w-4 mr-1.5" /> Analytics
                </Link>
              </Button>
              <Button size="sm" onClick={() => setNewDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo empreendimento
              </Button>
            </div>
            {/* Mobile: dropdown */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/materiais/analytics">
                      <BarChart3 className="h-4 w-4 mr-2" /> Analytics
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Novo empreendimento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>

      {/* Barra unificada: abas + busca única */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <TabsList className="h-9 self-start">
            <TabsTrigger value="todos" className="h-7 px-3 text-xs">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Empreendimentos
            </TabsTrigger>
            <TabsTrigger value="recentes" className="h-7 px-3 text-xs">
              <Clock className="h-3.5 w-3.5 mr-1.5" /> Recentes
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar material ou empreendimento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSemantic(); }}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0 text-primary border-primary/40 hover:bg-primary/10"
              title="Buscar com IA"
              onClick={runSemantic}
              disabled={semanticLoading || search.trim().length < 3}
            >
              {semanticLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <TabsContent value="todos" className="space-y-3 mt-0">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                        className="p-3 rounded-xl border border-border/60 bg-card space-y-1.5 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground truncate">
                              {r.materiais_empreendimentos?.nome} • <Icon className="inline h-3 w-3" /> {info.label}
                            </p>
                            <h3 className="font-medium text-sm text-foreground line-clamp-2">{r.titulo}</h3>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        </div>
                        {r.snippet && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{r.snippet}...</p>
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
            <div className="flex gap-3" style={{ minHeight: "calc(100vh - 200px)" }}>
              {/* Sidebar desktop — mais estreita, sem borda dupla */}
              <aside className="hidden md:block w-[220px] flex-shrink-0 border border-border/60 rounded-lg overflow-hidden">
                <MateriaisSidebar
                  empreendimentos={empreendimentos}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  favIds={favEmpIds}
                  filterText={search}
                />
              </aside>

              {/* Painel principal — sem wrapper com borda extra */}
              <main className="flex-1 min-w-0">
                {/* Mobile trigger */}
                <div className="md:hidden mb-2">
                  <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Menu className="h-4 w-4 mr-2" />
                        <Building2 className="h-4 w-4 mr-2" />
                        <span className="truncate">{selected ? selected.nome : "Escolher empreendimento"}</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[280px]">
                      <SheetHeader className="px-4 py-3 border-b border-border/60">
                        <SheetTitle>Empreendimentos</SheetTitle>
                      </SheetHeader>
                      <div className="h-[calc(100%-56px)]">
                        <MateriaisSidebar
                          empreendimentos={empreendimentos}
                          selectedId={selectedId}
                          onSelect={handleSelect}
                          favIds={favEmpIds}
                          filterText={search}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {selected ? (
                  <MateriaisEmpreendimentoPanel empreendimento={selected} canEdit={isGestor} />
                ) : (
                  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                    Selecione um empreendimento.
                  </div>
                )}
              </main>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recentes" className="mt-0">
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
