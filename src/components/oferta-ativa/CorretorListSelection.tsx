import { useState, useMemo, useEffect, useRef } from "react";
import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ArrowLeft, Loader2, Users, Search, Zap, Sparkles, Trash2, RotateCcw } from "lucide-react";
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
    <div
      className={`arena-card rounded-xl p-5 space-y-3 cursor-pointer group ${
        hasLeads ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
            {lista.empreendimento}
          </h3>
          {lista.campanha && <p className="text-xs text-neutral-500">{lista.campanha}</p>}
        </div>
        {isCustom ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
            background: "rgba(168,85,247,0.15)",
            color: "#c084fc",
            border: "1px solid rgba(168,85,247,0.3)",
          }}>
            ✨ Personalizada
          </span>
        ) : (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
            background: "rgba(34,197,94,0.15)",
            color: "#4ade80",
            border: "1px solid rgba(34,197,94,0.3)",
          }}>
            Liberada
          </span>
        )}
      </div>

      {stats ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-400">{stats.naFila}</p>
              <p className="text-[10px] text-neutral-500">na fila</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.aproveitados}</p>
              <p className="text-[10px] text-neutral-500">aproveitados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-300">{stats.total}</p>
              <p className="text-[10px] text-neutral-500">total</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
              <span>Progresso da lista</span>
              <span className="font-semibold text-neutral-400">{stats.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>

          {stats.meusTentativas > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <Zap className="h-3 w-3 text-blue-400" />
              <span>Você fez <strong className="text-neutral-300">{stats.meusTentativas}</strong> tentativas hoje nesta lista</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
        </div>
      )}

      <button
        className={`w-full h-9 rounded-lg text-sm font-semibold transition-colors ${
          hasLeads
            ? "arena-btn-call"
            : "text-neutral-500 cursor-not-allowed"
        }`}
        style={hasLeads ? undefined : { background: "rgba(255,255,255,0.05)" }}
        disabled={!hasLeads}
      >
        <span className="flex items-center justify-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> {hasLeads ? "Iniciar o Call" : "Lista Esgotada"}
        </span>
      </button>
    </div>
  );
}

function SavedListCard({ list, onReuse, onDelete }: { list: CustomList; onReuse: () => void; onDelete: () => void }) {
  return (
    <div
      className="rounded-xl p-4 flex items-center justify-between gap-3 transition-all duration-150"
      style={{
        background: "#161B22",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <p className="text-sm font-semibold text-white truncate">{list.nome}</p>
        </div>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          {list.ultima_usada_at
            ? `Usada ${formatDistanceToNow(new Date(list.ultima_usada_at), { addSuffix: true, locale: ptBR })}`
            : "Nunca usada"
          }
          {list.vezes_usada > 0 && ` · ${list.vezes_usada}x`}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onReuse}
          title="Reusar"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Excluir"
          className="h-7 w-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CorretorListSelection() {
  const { listas, isLoading } = useOAListas();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const { lists: savedLists, isLoading: savedLoading, markUsed, deleteList } = useCustomLists();
  const { setOpen, open } = useSidebar();
  const prevOpenRef = useRef(open);

  // Toggle fullscreen arena-mode only when dialing a specific list
  useEffect(() => {
    if (selectedLista) {
      prevOpenRef.current = open;
      document.body.classList.add("arena-mode");
      setOpen(false);
    } else {
      document.body.classList.remove("arena-mode");
      setOpen(prevOpenRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLista]);

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
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-neutral-400 hover:text-white hover:bg-white/10" onClick={() => setSelectedLista(null)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar às listas
        </Button>
        <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Create custom list CTA */}
      <button
        onClick={() => setWizardOpen(true)}
        className="w-full p-4 rounded-xl text-left flex items-center gap-3 group transition-all duration-150"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))",
          border: "1px dashed rgba(99,102,241,0.5)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
        }}
      >
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
          <Sparkles className="h-5 w-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Criar lista personalizada</p>
          <p className="text-xs text-neutral-400">Filtre seus leads e trabalhe do seu jeito</p>
        </div>
        <ArrowLeft className="h-4 w-4 text-blue-400 rotate-180 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Saved custom lists */}
      {savedLists.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Minhas listas salvas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedLists.map(list => (
              <SavedListCard
                key={list.id}
                list={list}
                onReuse={() => {
                  markUsed.mutate(list.id);
                }}
                onDelete={() => deleteList.mutate(list.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Released lists */}
      {liberadas.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ background: "#161B22", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Phone className="h-10 w-10 mx-auto mb-3 text-neutral-600" />
          <p className="font-medium text-neutral-300">Nenhuma lista liberada</p>
          <p className="text-sm mt-1 text-neutral-500">Aguarde o Admin liberar uma campanha para começar.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-500" /> Listas liberadas ({liberadas.length})
            </h3>
          </div>
          {liberadas.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por empreendimento ou campanha..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl text-sm text-white placeholder-neutral-500 outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>
          )}
          {filtered.length === 0 && search && (
            <p className="text-sm text-neutral-500 text-center py-4">Nenhuma lista encontrada para "{search}"</p>
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
        }}
      />
    </div>
  );
}
