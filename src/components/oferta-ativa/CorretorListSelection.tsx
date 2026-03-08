import { useState, useMemo } from "react";
import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Phone, ArrowLeft, Loader2, Users, Search, Zap, Sparkles, Trash2, RotateCcw, Pencil } from "lucide-react";
import DialingModeWithScript from "./DialingModeWithScript";
import CustomListWizard from "./CustomListWizard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomLists, type CustomList } from "@/hooks/useCustomLists";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ListaStats {
  naFila: number;
  aproveitados: number;
  total: number;
  pct: number;
  meusTentativas: number;
}

function useBatchListaStats(listaIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["oa-listas-batch-stats", listaIds.join(","), user?.id],
    queryFn: async () => {
      if (!listaIds.length || !user) return {} as Record<string, ListaStats>;

      const allLeads: Array<{ id: string; lista_id: string; status: string; proxima_tentativa_apos: string | null }> = [];
      const PAGE_SIZE = 1000;
      let page = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("oferta_ativa_leads")
          .select("id, lista_id, status, proxima_tentativa_apos")
          .in("lista_id", listaIds)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (!batch || batch.length === 0) break;
        allLeads.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: attempts } = await supabase
        .from("oferta_ativa_tentativas")
        .select("id, lista_id")
        .eq("corretor_id", user.id)
        .in("lista_id", listaIds)
        .gte("created_at", today.toISOString());

      const now = new Date().toISOString();
      const statsMap: Record<string, ListaStats> = {};

      for (const lid of listaIds) {
        const listaLeads = allLeads.filter(l => l.lista_id === lid);
        const total = listaLeads.length;
        const naFila = listaLeads.filter(l =>
          (l.status === "na_fila" || l.status === "em_cooldown") &&
          (l.proxima_tentativa_apos == null || l.proxima_tentativa_apos < now)
        ).length;
        const aproveitados = listaLeads.filter(l => l.status === "aproveitado").length;
        const worked = total - naFila;
        const pct = total > 0 ? Math.round((worked / total) * 100) : 0;
        const meusTentativas = (attempts || []).filter(a => a.lista_id === lid).length;

        statsMap[lid] = { naFila, aproveitados, total, pct, meusTentativas };
      }

      return statsMap;
    },
    staleTime: 15000,
    enabled: listaIds.length > 0 && !!user,
  });
}

function ListaCard({ lista, stats, isCustom }: { lista: OALista; stats?: ListaStats; isCustom?: boolean }) {
  const hasLeads = (stats?.naFila ?? 0) > 0;

  return (
    <Card
      className={`cursor-pointer transition-all group ${hasLeads ? "hover:border-primary/40 hover:shadow-md" : "opacity-60"}`}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">
              {lista.empreendimento}
            </h3>
            {lista.campanha && <p className="text-xs text-muted-foreground">{lista.campanha}</p>}
          </div>
          {isCustom ? (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px]">
              ✨ Personalizada
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
              Liberada
            </Badge>
          )}
        </div>

        {stats ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{stats.naFila}</p>
                <p className="text-[10px] text-muted-foreground">na fila</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.aproveitados}</p>
                <p className="text-[10px] text-muted-foreground">aproveitados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">total</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progresso da lista</span>
                <span className="font-semibold">{stats.pct}%</span>
              </div>
              <Progress value={stats.pct} className="h-1.5" />
            </div>

            {stats.meusTentativas > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                <span>Você fez <strong className="text-foreground">{stats.meusTentativas}</strong> tentativas hoje nesta lista</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <Button size="sm" className="w-full gap-1.5" disabled={!hasLeads}>
          <Phone className="h-3.5 w-3.5" /> {hasLeads ? "Iniciar o Call" : "Lista Esgotada"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SavedListCard({ list, onReuse, onDelete }: { list: CustomList; onReuse: () => void; onDelete: () => void }) {
  return (
    <Card className="hover:border-purple-400/40 hover:shadow-sm transition-all">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{list.nome}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {list.ultima_usada_at
              ? `Usada ${formatDistanceToNow(new Date(list.ultima_usada_at), { addSuffix: true, locale: ptBR })}`
              : "Nunca usada"
            }
            {list.vezes_usada > 0 && ` · ${list.vezes_usada}x`}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReuse} title="Reusar">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CorretorListSelection() {
  const { listas, isLoading } = useOAListas();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const { lists: savedLists, isLoading: savedLoading, markUsed, deleteList } = useCustomLists();

  const liberadas = listas.filter(l => l.status === "liberada");
  const listaIds = useMemo(() => liberadas.map(l => l.id), [liberadas]);

  const { data: statsMap } = useBatchListaStats(listaIds);

  const filtered = useMemo(() => {
    if (!search.trim()) return liberadas;
    const q = search.toLowerCase();
    return liberadas.filter(l =>
      l.empreendimento.toLowerCase().includes(q) ||
      (l.campanha?.toLowerCase().includes(q)) ||
      l.nome.toLowerCase().includes(q)
    );
  }, [liberadas, search]);

  if (selectedLista) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setSelectedLista(null)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar às listas
        </Button>
        <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Create custom list CTA */}
      <button
        onClick={() => setWizardOpen(true)}
        className="w-full p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition-all text-left flex items-center gap-3 group"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Criar lista personalizada</p>
          <p className="text-xs text-muted-foreground">Filtre seus leads e trabalhe do seu jeito</p>
        </div>
        <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Saved custom lists */}
      {savedLists.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minhas listas salvas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedLists.map(list => (
              <SavedListCard
                key={list.id}
                list={list}
                onReuse={() => {
                  markUsed.mutate(list.id);
                  // TODO: navigate to battle mode with custom list
                }}
                onDelete={() => deleteList.mutate(list.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Released lists */}
      {liberadas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma lista liberada</p>
            <p className="text-sm mt-1">Aguarde o Admin liberar uma campanha para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Listas liberadas ({liberadas.length})
            </h3>
          </div>
          {liberadas.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empreendimento ou campanha..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filtered.length === 0 && search && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista encontrada para "{search}"</p>
          )}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(lista => {
              const stats = statsMap?.[lista.id];
              const hasLeads = (stats?.naFila ?? 0) > 0;
              return (
                <div key={lista.id} onClick={hasLeads ? () => setSelectedLista(lista) : undefined}>
                  <ListaCard lista={lista} stats={stats} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Wizard modal */}
      <CustomListWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(listId) => {
          setWizardOpen(false);
          // The list is saved, user can now see it in saved lists
        }}
      />
    </div>
  );
}
