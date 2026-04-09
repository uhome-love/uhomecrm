import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Phone, ArrowLeft, Loader2, Users, Search, Zap, Sparkles, Trash2, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
    staleTime: 60_000,
    enabled: listaIds.length > 0 && !!user,
  });
}

/* ── Compact Row for a single lista ── */
function ListaRow({
  lista,
  stats,
  onClick,
  isCustom,
}: {
  lista: OALista;
  stats?: ListaStats;
  onClick?: () => void;
  isCustom?: boolean;
}) {
  const hasLeads = (stats?.naFila ?? 0) > 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 group"
      style={{
        background: "var(--arena-card-bg)",
        border: "1px solid var(--arena-card-border)",
      }}
      onMouseEnter={(e) => {
        if (hasLeads) e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--arena-card-border)";
      }}
    >
      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isCustom && <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />}
          <p className="text-sm font-semibold truncate group-hover:text-blue-400 transition-colors" style={{ color: "var(--arena-text)" }}>
            {lista.empreendimento}
          </p>
        </div>
        {lista.campanha && (
          <p className="text-[11px] truncate" style={{ color: "var(--arena-text-subtle)" }}>{lista.campanha}</p>
        )}
      </div>

      {/* Inline stats */}
      {stats ? (
        <div className="hidden sm:flex items-center gap-3 text-xs shrink-0">
          <span style={{ color: "#60A5FA", fontWeight: 700 }}>{stats.naFila}</span>
          <span style={{ color: "var(--arena-text-subtle)" }}>na fila</span>
          <span style={{ color: "var(--arena-text-subtle)", opacity: 0.5 }}>·</span>
          <span style={{ color: "#4ADE80", fontWeight: 700 }}>{stats.aproveitados}</span>
          <span style={{ color: "var(--arena-text-subtle)" }}>aprov.</span>
          <span style={{ color: "var(--arena-text-subtle)", opacity: 0.5 }}>·</span>
          <span style={{ color: "var(--arena-text-muted)", fontWeight: 600 }}>{stats.total}</span>
          <span style={{ color: "var(--arena-text-subtle)" }}>total</span>
        </div>
      ) : (
        <Skeleton className="h-4 w-32 rounded" style={{ background: "var(--arena-subtle-bg)" }} />
      )}

      {/* Mini progress bar */}
      <div className="hidden md:block w-20 shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stats?.pct ?? 0}%`,
              background: "linear-gradient(90deg, #3B82F6, #22C55E)",
            }}
          />
        </div>
        <p className="text-[10px] text-right mt-0.5" style={{ fontFamily: "monospace", color: "var(--arena-text-subtle)" }}>
          {stats?.pct ?? 0}%
        </p>
      </div>

      {/* Tentativas badge */}
      {(stats?.meusTentativas ?? 0) > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>
          ⚡{stats!.meusTentativas}
        </span>
      )}

      {/* Start button */}
      <button
        onClick={hasLeads ? onClick : undefined}
        disabled={!hasLeads}
        className={`h-8 px-3 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
          hasLeads
            ? "arena-btn-call"
            : "cursor-not-allowed"
        }`}
        style={!hasLeads ? { background: "var(--arena-subtle-bg)", color: "var(--arena-text-subtle)" } : {}}
      >
        <Phone className="h-3.5 w-3.5" />
        {hasLeads ? "Iniciar" : "Esgotada"}
      </button>
    </div>
  );
}

/* ── Campaign compact row ── */
function CampaignRow({
  campanha,
  listas,
  statsMap,
  onStart,
}: {
  campanha: string;
  listas: OALista[];
  statsMap: Record<string, ListaStats> | undefined;
  onStart: () => void;
}) {
  const totalNaFila = listas.reduce((s, l) => s + (statsMap?.[l.id]?.naFila ?? 0), 0);
  const totalAproveitados = listas.reduce((s, l) => s + (statsMap?.[l.id]?.aproveitados ?? 0), 0);
  const totalLeads = listas.reduce((s, l) => s + (statsMap?.[l.id]?.total ?? 0), 0);
  const pct = totalLeads > 0 ? Math.round(((totalLeads - totalNaFila) / totalLeads) * 100) : 0;
  const hasLeads = totalNaFila > 0;
  const empreendimentos = [...new Set(listas.map(l => l.empreendimento))];

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 group"
      style={{
        background: "var(--arena-card-bg)",
        border: "1px solid var(--arena-card-border)",
      }}
      onMouseEnter={(e) => {
        if (hasLeads) e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--arena-card-border)";
      }}
    >
      <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate group-hover:text-blue-400 transition-colors" style={{ color: "var(--arena-text)" }}>
          {campanha}
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--arena-text-subtle)" }}>
          {listas.length} lista{listas.length > 1 ? "s" : ""} · {empreendimentos.join(", ")}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-xs shrink-0">
        <span style={{ color: "#60A5FA", fontWeight: 700 }}>{totalNaFila}</span>
        <span style={{ color: "var(--arena-text-subtle)" }}>na fila</span>
        <span style={{ color: "var(--arena-text-subtle)", opacity: 0.5 }}>·</span>
        <span style={{ color: "#4ADE80", fontWeight: 700 }}>{totalAproveitados}</span>
        <span style={{ color: "var(--arena-text-subtle)" }}>aprov.</span>
        <span style={{ color: "var(--arena-text-subtle)", opacity: 0.5 }}>·</span>
        <span style={{ color: "var(--arena-text-muted)", fontWeight: 600 }}>{totalLeads}</span>
        <span style={{ color: "var(--arena-text-subtle)" }}>total</span>
      </div>

      <div className="hidden md:block w-20 shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--arena-progress-track)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #3B82F6, #22C55E)",
            }}
          />
        </div>
        <p className="text-[10px] text-right mt-0.5" style={{ fontFamily: "monospace", color: "var(--arena-text-subtle)" }}>{pct}%</p>
      </div>

      <button
        onClick={hasLeads ? onStart : undefined}
        disabled={!hasLeads}
        className={`h-8 px-3 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
          hasLeads ? "arena-btn-call" : "cursor-not-allowed"
        }`}
        style={!hasLeads ? { background: "var(--arena-subtle-bg)", color: "var(--arena-text-subtle)" } : {}}
      >
        <Phone className="h-3.5 w-3.5" />
        {hasLeads ? "Iniciar" : "Esgotada"}
      </button>
    </div>
  );
}

function SavedListRow({ list, onStart, onDelete }: { list: CustomList; onStart: () => void; onDelete: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150"
      style={{
        background: "var(--arena-card-bg)",
        border: "1px solid var(--arena-card-border)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--arena-card-border)"; }}
    >
      <Sparkles className="h-3.5 w-3.5 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--arena-text)" }}>{list.nome}</p>
        <p className="text-[10px]" style={{ color: "var(--arena-text-subtle)" }}>
          {list.ultima_usada_at
            ? `Usada ${formatDistanceToNow(new Date(list.ultima_usada_at), { addSuffix: true, locale: ptBR })}`
            : "Nunca usada"
          }
          {list.vezes_usada > 0 && ` · ${list.vezes_usada}x`}
        </p>
      </div>
      <button
        onClick={onStart}
        className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors arena-btn-call shrink-0"
      >
        <Phone className="h-3.5 w-3.5" /> Iniciar
      </button>
      <button
        onClick={onDelete}
        title="Excluir"
        className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type ViewMode = "campanhas" | "listas" | "personalizadas";

export default function CorretorListSelection() {
  const { listas, isLoading } = useOAListas();
  const { user } = useAuth();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("campanhas");
  const [showExhausted, setShowExhausted] = useState(false);
  const { lists: savedLists, isLoading: savedLoading, markUsed, deleteList } = useCustomLists();
  const { setOpen, open } = useSidebar();
  const prevOpenRef = useRef(open);

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

  // Filter helpers
  const isExhausted = useCallback((listaId: string) => {
    if (!statsMap) return false;
    const s = statsMap[listaId];
    return s ? s.naFila === 0 : false;
  }, [statsMap]);

  const filterListas = useCallback((items: OALista[]) => {
    let result = items;
    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(l =>
        l.empreendimento.toLowerCase().includes(q) ||
        (l.campanha?.toLowerCase().includes(q)) ||
        l.nome.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search]);

  // Count exhausted for toggle label
  const exhaustedCount = useMemo(() => {
    if (!statsMap) return 0;
    return liberadas.filter(l => isExhausted(l.id)).length;
  }, [liberadas, statsMap, isExhausted]);

  // Campaign groups (filtered, excluding exhausted campaigns)
  const { campaignGroups, ungroupedListas, exhaustedCampaigns } = useMemo(() => {
    const matched = filterListas(liberadas);
    const groups: Record<string, OALista[]> = {};
    const ungrouped: OALista[] = [];
    
    for (const l of matched) {
      if (l.campanha) {
        if (!groups[l.campanha]) groups[l.campanha] = [];
        groups[l.campanha].push(l);
      } else {
        ungrouped.push(l);
      }
    }

    // Separate exhausted campaigns
    const active: Record<string, OALista[]> = {};
    const exhausted: Record<string, OALista[]> = {};
    for (const [camp, items] of Object.entries(groups)) {
      const totalNaFila = items.reduce((s, l) => s + (statsMap?.[l.id]?.naFila ?? 0), 0);
      if (totalNaFila === 0) {
        exhausted[camp] = items;
      } else {
        active[camp] = items;
      }
    }

    // Filter ungrouped
    const activeUngrouped = showExhausted ? ungrouped : ungrouped.filter(l => !isExhausted(l.id));
    const finalGroups = showExhausted ? { ...active, ...exhausted } : active;

    return { campaignGroups: finalGroups, ungroupedListas: activeUngrouped, exhaustedCampaigns: exhausted };
  }, [liberadas, filterListas, statsMap, showExhausted, isExhausted]);

  // All listas flat (for "listas" view mode)
  const allListasFlat = useMemo(() => {
    const matched = filterListas(liberadas);
    return showExhausted ? matched : matched.filter(l => !isExhausted(l.id));
  }, [liberadas, filterListas, showExhausted, isExhausted]);

  const startCampaign = useCallback((campanha: string, listas: OALista[]) => {
    const listaIds = listas.map(l => l.id);
    sessionStorage.setItem("campaign_lista_ids", JSON.stringify(listaIds));
    sessionStorage.setItem("campaign_name", campanha);
    
    const empMap: Record<string, string[]> = {};
    for (const l of listas) {
      const emp = l.empreendimento || "Outros";
      if (!empMap[emp]) empMap[emp] = [];
      empMap[emp].push(l.id);
    }
    sessionStorage.setItem("campaign_emp_map", JSON.stringify(empMap));
    
    const virtualLista: OALista = {
      id: `campaign_${campanha}`,
      nome: campanha,
      empreendimento: campanha,
      campanha: campanha,
      origem: "campaign",
      status: "liberada",
      max_tentativas: listas[0]?.max_tentativas || 4,
      cooldown_dias: listas[0]?.cooldown_dias || 1,
      total_leads: listas.reduce((s, l) => s + (l.total_leads || 0), 0),
      criado_por: user?.id || "",
      created_at: listas[0]?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSelectedLista(virtualLista);
  }, [user]);

  if (selectedLista) {
    return (
      <div>
        <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "var(--arena-card-bg)" }}>
            <Skeleton className="h-4 w-32 rounded" style={{ background: "var(--arena-subtle-bg)" }} />
            <div className="flex-1" />
            <Skeleton className="h-4 w-40 rounded" style={{ background: "var(--arena-subtle-bg)" }} />
            <Skeleton className="h-8 w-20 rounded-lg" style={{ background: "var(--arena-subtle-bg)" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View mode toggle + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "campanhas" as ViewMode, icon: "📂", label: "Campanhas" },
          { key: "listas" as ViewMode, icon: "📋", label: "Listas" },
          { key: "personalizadas" as ViewMode, icon: "✨", label: "Personalizadas" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: viewMode === tab.key ? "rgba(59,130,246,0.2)" : "var(--arena-subtle-bg)",
              color: viewMode === tab.key ? "#60A5FA" : "var(--arena-text-muted)",
              border: viewMode === tab.key ? "1px solid rgba(59,130,246,0.4)" : "1px solid var(--arena-card-border)",
            }}
          >
            {tab.icon} {tab.label}
            {tab.key === "personalizadas" && savedLists.length > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({savedLists.length})</span>
            )}
          </button>
        ))}

        {/* Search inline */}
        {viewMode !== "personalizadas" && liberadas.length > 3 && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--arena-text-subtle)" }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg text-xs placeholder-opacity-50 outline-none transition-colors"
              style={{
                background: "var(--arena-subtle-bg)",
                border: "1px solid var(--arena-card-border)",
                color: "var(--arena-text)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--arena-card-border)"; }}
            />
          </div>
        )}
      </div>

      {/* ── CAMPANHAS VIEW ── */}
      {viewMode === "campanhas" && (
        <>
          {liberadas.length === 0 ? (
            <div className="rounded-xl py-12 text-center" style={{ background: "var(--arena-card-bg)", border: "1px solid var(--arena-card-border)" }}>
              <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--arena-text-subtle)" }} />
              <p className="font-medium" style={{ color: "var(--arena-text-muted)" }}>Nenhuma lista liberada</p>
              <p className="text-sm mt-1" style={{ color: "var(--arena-text-subtle)" }}>Aguarde o Admin liberar uma campanha para começar.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(campaignGroups).map(([campanha, campanhaListas]) => (
                <CampaignRow
                  key={campanha}
                  campanha={campanha}
                  listas={campanhaListas}
                  statsMap={statsMap}
                  onStart={() => startCampaign(campanha, campanhaListas)}
                />
              ))}

              {ungroupedListas.length > 0 && (
                <>
                  {Object.keys(campaignGroups).length > 0 && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider pt-2 pb-0.5 px-1" style={{ color: "var(--arena-text-subtle)" }}>Listas individuais</p>
                  )}
                  {ungroupedListas.map(lista => {
                    const stats = statsMap?.[lista.id];
                    return (
                      <ListaRow
                        key={lista.id}
                        lista={lista}
                        stats={stats}
                        onClick={() => setSelectedLista(lista)}
                      />
                    );
                  })}
                </>
              )}

              {/* Empty search state */}
              {Object.keys(campaignGroups).length === 0 && ungroupedListas.length === 0 && search && (
                <p className="text-sm text-center py-4" style={{ color: "var(--arena-text-subtle)" }}>Nenhuma lista encontrada para "{search}"</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LISTAS VIEW (flat) ── */}
      {viewMode === "listas" && (
        <>
          {allListasFlat.length === 0 && !search ? (
            <div className="rounded-xl py-12 text-center" style={{ background: "var(--arena-card-bg)", border: "1px solid var(--arena-card-border)" }}>
              <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--arena-text-subtle)" }} />
              <p className="font-medium" style={{ color: "var(--arena-text-muted)" }}>Nenhuma lista liberada</p>
            </div>
          ) : allListasFlat.length === 0 && search ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--arena-text-subtle)" }}>Nenhuma lista encontrada para "{search}"</p>
          ) : (
            <div className="space-y-1.5">
              {allListasFlat.map(lista => {
                const stats = statsMap?.[lista.id];
                return (
                  <ListaRow
                    key={lista.id}
                    lista={lista}
                    stats={stats}
                    onClick={() => setSelectedLista(lista)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── PERSONALIZADAS VIEW ── */}
      {viewMode === "personalizadas" && (
        <div className="space-y-3">
          <button
            onClick={() => setWizardOpen(true)}
            className="w-full p-3 rounded-xl text-left flex items-center gap-3 group transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))",
              border: "1px solid rgba(99,102,241,0.35)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.8)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}
          >
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
              <Sparkles className="h-4 w-4 text-indigo-400 arena-sparkle-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--arena-text)" }}>Criar lista personalizada</p>
              <p className="text-xs" style={{ color: "var(--arena-text-muted)" }}>Filtre seus leads e trabalhe do seu jeito</p>
            </div>
            <ArrowLeft className="h-4 w-4 text-blue-400 rotate-180 group-hover:translate-x-1 transition-transform" />
          </button>

          {savedLists.length > 0 ? (
            <div className="space-y-1.5">
              {savedLists.map(list => (
                <SavedListRow
                  key={list.id}
                  list={list}
                  onStart={async () => {
                    if (!user) return;
                    markUsed.mutate(list.id);
                    toast.loading("Carregando leads da lista...");
                    const result = await resolveCustomListLeads(user.id, list.filtros);
                    toast.dismiss();
                    if (result.count === 0) {
                      toast.error("Nenhum lead encontrado com esses filtros.");
                      return;
                    }
                    const virtualLista: OALista = {
                      id: `custom_${list.id}`,
                      nome: list.nome,
                      empreendimento: list.nome,
                      campanha: (list.filtros as any)?.campanha || null,
                      origem: "custom_list",
                      status: "liberada",
                      max_tentativas: 4,
                      cooldown_dias: 1,
                      total_leads: result.count,
                      criado_por: user.id,
                      created_at: list.criada_at,
                      updated_at: list.criada_at,
                    };
                    sessionStorage.setItem("custom_list_lead_ids", JSON.stringify(result.ids));
                    sessionStorage.setItem("custom_list_name", list.nome);
                    setSelectedLista(virtualLista);
                    toast.success(`📋 ${result.count} leads carregados! Arena pronta.`);
                  }}
                  onDelete={() => deleteList.mutate(list.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl py-8 text-center" style={{ background: "var(--arena-card-bg)", border: "1px solid var(--arena-card-border)" }}>
              <Sparkles className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--arena-text-subtle)" }} />
              <p className="text-sm" style={{ color: "var(--arena-text-muted)" }}>Nenhuma lista salva ainda</p>
              <p className="text-xs mt-1" style={{ color: "var(--arena-text-subtle)" }}>Crie uma lista personalizada para começar</p>
            </div>
          )}
        </div>
      )}

      {/* Toggle exhausted lists */}
      {viewMode !== "personalizadas" && exhaustedCount > 0 && (
        <button
          onClick={() => setShowExhausted(v => !v)}
          className="flex items-center gap-1.5 text-[11px] hover:opacity-80 transition-colors mx-auto"
          style={{ color: "var(--arena-text-subtle)" }}
        >
          {showExhausted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showExhausted ? "Ocultar" : "Mostrar"} {exhaustedCount} lista{exhaustedCount > 1 ? "s" : ""} esgotada{exhaustedCount > 1 ? "s" : ""}
        </button>
      )}

      {/* Wizard modal */}
      <CustomListWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={async (listId) => {
          setWizardOpen(false);
          if (!user) return;
          const { data: newList } = await supabase
            .from("custom_lists")
            .select("*")
            .eq("id", listId)
            .maybeSingle();
          if (!newList) return;
          const filtros = (newList.filtros || {}) as any;
          toast.loading("Carregando leads da lista...");
          const result = await resolveCustomListLeads(user.id, filtros);
          toast.dismiss();
          if (result.count === 0) {
            toast.error("Nenhum lead encontrado.");
            return;
          }
          const virtualLista: OALista = {
            id: `custom_${listId}`,
            nome: newList.nome || "Lista personalizada",
            empreendimento: newList.nome || "Lista personalizada",
            campanha: filtros.campanha || null,
            origem: "custom_list",
            status: "liberada",
            max_tentativas: 4,
            cooldown_dias: 1,
            total_leads: result.count,
            criado_por: user.id,
            created_at: newList.criada_at,
            updated_at: newList.criada_at,
          };
          sessionStorage.setItem("custom_list_lead_ids", JSON.stringify(result.ids));
          sessionStorage.setItem("custom_list_name", newList.nome);
          setSelectedLista(virtualLista);
          toast.success(`📋 ${result.count} leads carregados! Arena pronta.`);
        }}
      />
    </div>
  );
}
