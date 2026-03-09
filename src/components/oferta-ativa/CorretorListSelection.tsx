import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ArrowLeft, Loader2, Users, Search, Zap, Sparkles, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DialingModeWithScript from "./DialingModeWithScript";
import CustomListWizard from "./CustomListWizard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomLists, resolveCustomListLeads, type CustomList } from "@/hooks/useCustomLists";
import { useNavigate } from "react-router-dom";
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

      const { data, error } = await supabase.rpc("get_batch_lista_stats", {
        p_lista_ids: listaIds,
        p_corretor_id: user.id,
      });

      if (error) {
        console.error("get_batch_lista_stats error:", error);
        return {} as Record<string, ListaStats>;
      }

      const raw = (data || {}) as Record<string, any>;
      const statsMap: Record<string, ListaStats> = {};
      for (const [lid, val] of Object.entries(raw)) {
        statsMap[lid] = {
          naFila: val.naFila ?? 0,
          aproveitados: val.aproveitados ?? 0,
          total: val.total ?? 0,
          pct: val.pct ?? 0,
          meusTentativas: val.meusTentativas ?? 0,
        };
      }
      return statsMap;
    },
    staleTime: 60_000, // Cache 60s
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
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "white" }} className="group-hover:text-blue-400 transition-colors">
            {lista.empreendimento}
          </h3>
          {lista.campanha && <p className="text-xs text-neutral-500 mt-0.5">{lista.campanha}</p>}
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
              <p style={{ fontSize: 32, fontWeight: 900, color: "#60A5FA" }}>{stats.naFila}</p>
              <p style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>na fila</p>
            </div>
            <div>
              <p style={{ fontSize: 32, fontWeight: 900, color: "#4ADE80" }}>{stats.aproveitados}</p>
              <p style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>aproveitados</p>
            </div>
            <div>
              <p style={{ fontSize: 32, fontWeight: 900, color: "white" }}>{stats.total}</p>
              <p style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>total</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1" style={{ fontSize: 12, color: "#6B7280" }}>
              <span>Progresso da lista</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#4ADE80" }}>{stats.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.pct}%`,
                  background: "linear-gradient(90deg, #3B82F6, #22C55E)",
                  boxShadow: "0 0 6px rgba(34,197,94,0.4)",
                }}
              />
            </div>
          </div>

          {stats.meusTentativas > 0 && (
            <div className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#FBBF24" }}>
              <span>⚡</span>
              <span>Você fez <strong>{stats.meusTentativas}</strong> tentativas hoje nesta lista</span>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="text-center space-y-1.5">
                <Skeleton className="h-8 w-16 mx-auto rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
                <Skeleton className="h-3 w-12 mx-auto rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
            ))}
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      )}

      <button
        className={`w-full h-10 rounded-lg font-bold transition-colors ${
          hasLeads
            ? "arena-btn-call"
            : "text-neutral-500 cursor-not-allowed"
        }`}
        style={hasLeads ? { fontSize: 16 } : { background: "rgba(255,255,255,0.05)", fontSize: 16 }}
        disabled={!hasLeads}
      >
        <span className="flex items-center justify-center gap-1.5">
          <Phone className="h-4 w-4" /> {hasLeads ? "Iniciar o Call" : "Lista Esgotada"}
        </span>
      </button>
    </div>
  );
}

function SavedListCard({ list, onStart, onDelete }: { list: CustomList; onStart: () => void; onDelete: () => void }) {
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
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={onStart}
          className="h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #16A34A, #15803D)" }}
        >
          <Phone className="h-3.5 w-3.5" /> Iniciar
        </button>
        <button
          onClick={onDelete}
          title="Excluir"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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

  // Pagination: show 20 initially, load more on scroll
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return liberadas;
    const q = search.toLowerCase();
    return liberadas.filter(l =>
      l.empreendimento.toLowerCase().includes(q) ||
      (l.campanha?.toLowerCase().includes(q)) ||
      l.nome.toLowerCase().includes(q)
    );
  }, [liberadas, search]);

  const paginatedFiltered = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // Reset pagination when search changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => v + PAGE_SIZE); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, paginatedFiltered.length]);

  if (selectedLista) {
    return (
      <div>
        <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3" style={{ background: "#0A0F1E" }}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="arena-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-2/3 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
              <Skeleton className="h-3 w-1/3 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => (
                  <div key={j} className="text-center space-y-1.5">
                    <Skeleton className="h-8 w-16 mx-auto rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <Skeleton className="h-3 w-12 mx-auto rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
                  </div>
                ))}
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              <Skeleton className="h-10 w-full rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ background: "#0A0F1E" }}>
      {/* Create custom list CTA */}
      <button
        onClick={() => setWizardOpen(true)}
        className="w-full p-4 rounded-xl text-left flex items-center gap-3 group transition-all duration-150"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))",
          border: "1px solid rgba(99,102,241,0.35)",
          boxShadow: "0 0 20px rgba(99,102,241,0.1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.8)";
          e.currentTarget.style.boxShadow = "0 0 30px rgba(99,102,241,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(99,102,241,0.1)";
        }}
      >
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
          <Sparkles className="h-5 w-5 text-indigo-400 arena-sparkle-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 17 }} className="font-semibold text-white">Criar lista personalizada</p>
          <p style={{ fontSize: 13 }} className="text-neutral-400">Filtre seus leads e trabalhe do seu jeito</p>
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
            <h3 style={{ fontSize: 14, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em" }} className="flex items-center gap-2 font-semibold">
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
            {paginatedFiltered.map(lista => {
              const stats = statsMap?.[lista.id];
              const hasLeads = (stats?.naFila ?? 0) > 0;
              return (
                <div key={lista.id} onClick={hasLeads ? () => setSelectedLista(lista) : undefined}>
                  <ListaCard lista={lista} stats={stats} />
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            </div>
          )}
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
