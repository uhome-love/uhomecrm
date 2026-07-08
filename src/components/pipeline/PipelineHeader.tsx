// ─────────────────────────────────────────────────────────────────
// PipelineHeader — Header completo do Pipeline v2 (Fase 6)
//
// Extraído de PipelineKanban.tsx (lines 384-936) sem mudança visual ou
// comportamental. Renderiza 3 variantes por breakpoint:
//   • md:hidden        → mobile
//   • md:block lg:hidden → tablet
//   • lg:block         → desktop (com pílulas unificadas Dashboard↔Pipeline)
//
// Mantém todos os classNames, estados e callbacks idênticos ao original.
// ─────────────────────────────────────────────────────────────────
import React from "react";
import { LayoutGrid, Plus, RefreshCw, Search, X, Zap, CheckSquare, Square, Users, Building2, MoreHorizontal, ChevronDown, Inbox } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Select primitives no longer used here — corretor/gestor selects extraídos.
import PipelineAdvancedFilters, { type PipelineFilters } from "@/components/pipeline/PipelineAdvancedFilters";
import PipelineFiltroBadges, { type PipelineFiltroKey } from "@/components/pipeline/PipelineFiltroBadges";
import { PipelineSortDropdown } from "@/components/pipeline/PipelineSortDropdown";
import type { PipelineSortOrder } from "@/lib/pipelineSortOrder";
import type { LeadClientStatus } from "@/lib/taskQueryUtils";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCorretorSelect from "@/components/pipeline/header/PipelineCorretorSelect";
import PipelineGestorSelect from "@/components/pipeline/header/PipelineGestorSelect";
import PipelineScopeBadge from "@/components/pipeline/header/PipelineScopeBadge";

export type PipelineTabMode = "kanban" | "time" | "equipes";
export type ClientStatusFilter = "todos" | LeadClientStatus;

export interface CampaignTag {
  tag: string;
  label: string;
  color: string;
}


export interface PipelineHeaderProps {
  // Counts & data
  filteredLeadsCount: number;
  displayedClientStatusCounts: { em_dia: number; desatualizado: number; tarefa_atrasada: number };
  campaignTagCounts: Record<string, number>;
  campaignTags: CampaignTag[];
  pipelineStages: PipelineStage[];
  pipelineSegmentos: PipelineSegmento[];
  pipelineLeads: PipelineLead[];
  corretorNomes: Record<string, string>;
  corretorOptions: Array<[string, string]>;
  visitaLeadIds: Set<string> | undefined;
  focusLeadsCount: number;
  filaCeoCount: number;
  filaCeoNovosCount: number;
  

  // Role flags
  isAdmin: boolean;
  isDiretor?: boolean;
  isGestor: boolean;
  canAdd: boolean;

  // Filters state
  filters: PipelineFilters;
  setFilters: React.Dispatch<React.SetStateAction<PipelineFilters>>;
  corretorFilter: string;
  setCorretorFilter: (v: string) => void;
  campaignTagFilter: string;
  setCampaignTagFilter: (v: string) => void;
  clientStatusFilter: ClientStatusFilter;
  setClientStatusFilter: React.Dispatch<React.SetStateAction<ClientStatusFilter>>;
  negociosFilter: boolean;
  setNegociosFilter: React.Dispatch<React.SetStateAction<boolean>>;
  ganhosFilter: boolean;
  setGanhosFilter: React.Dispatch<React.SetStateAction<boolean>>;
  hasAnyFilter: boolean;
  clearAllFilters: () => void;

  // Tabs / views
  activeTab: string;
  setActiveTab: (v: string) => void;

  // Actions
  refreshing: boolean;
  handleRefresh: () => void;
  setAddOpen: (v: boolean) => void;
  setFocusModeOpen: (v: boolean) => void;
  filaCeoFilter: boolean;
  setFilaCeoFilter: React.Dispatch<React.SetStateAction<boolean>>;
  openDispatch: (mode: "novos") => void;
  selectionMode: boolean;
  setSelectionMode: (v: boolean) => void;
  clearSelection: () => void;

  // Mobile search
  mobileSearchOpen: boolean;
  setMobileSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSearchRef: React.RefObject<HTMLInputElement>;

  // Sort
  sortOrder: PipelineSortOrder;
  setSortOrder: (v: PipelineSortOrder) => void;

  // Fase 1 — Filtro de gestor exclusivo do CEO
  gestorFilter?: string;
  setGestorFilter?: (v: string) => void;

  // Bug-fix Pílulas: contagens calculadas client-side em PipelineKanban
  // a partir dos leads em escopo (corretor/gestor/CEO com ou sem filtro).
  pillCounts?: { em_dia: number; sem_tarefa: number; atrasado: number; negocios: number };

  // Toggle Equipe / Minha carteira — integrado na linha de pílulas no mobile.
  canToggleCarteira?: boolean;
  minhaCarteira?: boolean;
  setMinhaCarteira?: (v: boolean) => void;
}

export default function PipelineHeader(props: PipelineHeaderProps) {
  const {
    filteredLeadsCount, displayedClientStatusCounts, campaignTagCounts, campaignTags,
    pipelineStages, pipelineSegmentos, pipelineLeads, corretorNomes, corretorOptions,
    visitaLeadIds, focusLeadsCount, filaCeoCount, filaCeoNovosCount,
    isAdmin, isDiretor = false, isGestor, canAdd,
    filters, setFilters, corretorFilter, setCorretorFilter,
    campaignTagFilter, setCampaignTagFilter,
    clientStatusFilter, setClientStatusFilter,
    negociosFilter, setNegociosFilter,
    ganhosFilter, setGanhosFilter,
    hasAnyFilter, clearAllFilters,
    activeTab, setActiveTab,
    refreshing, handleRefresh, setAddOpen, setFocusModeOpen,
    filaCeoFilter, setFilaCeoFilter, openDispatch,
    selectionMode, setSelectionMode, clearSelection,
    mobileSearchOpen, setMobileSearchOpen, mobileSearchRef,
    sortOrder, setSortOrder,
    gestorFilter = "todos", setGestorFilter,
    pillCounts,
    canToggleCarteira = false, minhaCarteira = false, setMinhaCarteira,
  } = props;

  // Tabs por role (Fase 1):
  //  • Corretor: Kanban
  //  • Gestor:   Modo Time | Kanban
  //  • CEO:      Equipes   | Kanban
  const roleTabs: Array<{ key: string; icon: React.ReactNode; label: string }> = isAdmin
    ? [
        { key: "equipes", icon: <Building2 size={12} strokeWidth={1.5} />, label: "Equipes" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
      ]
    : isGestor
    ? [
        { key: "time", icon: <Users size={12} strokeWidth={1.5} />, label: "Modo Time" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
      ]
    : [
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
      ];


  return (
    <div className="shrink-0 bg-[#f7f7fb] dark:bg-[#141e30] border-b border-[#e8e8f0] dark:border-white/[0.07] sticky top-0 z-40">
      {/* ── MOBILE HEADER (< md) ── */}
      <div className="md:hidden">
        {/* Line 1: Title + filters + novo */}
        <div className="flex items-center gap-2 h-[46px] px-3">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <LayoutGrid className="h-3 w-3 text-white" />
          </div>
          <span className="text-[15px] font-bold text-foreground shrink-0">Pipeline</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">{filteredLeadsCount}</span>
          <div className="flex-1 min-w-0" />

          <PipelineAdvancedFilters
            filters={filters}
            onChange={setFilters}
            stages={pipelineStages}
            segmentos={pipelineSegmentos}
            leads={pipelineLeads}
            corretorNomes={corretorNomes}
            isManager={isGestor || isAdmin}
            visitaLeadIds={visitaLeadIds}
          />

          {activeTab !== "kanban" && (
            <button
              onClick={() => {
                setMobileSearchOpen(v => !v);
                setTimeout(() => mobileSearchRef.current?.focus(), 100);
              }}
              aria-label="Buscar leads"
              aria-expanded={mobileSearchOpen}
              className="relative w-8 h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              {filters.search && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          )}


          {canAdd && activeTab === "kanban" && (
            <button
              onClick={() => setAddOpen(true)}
              className="bg-primary hover:bg-primary-600 text-white rounded-[7px] px-2.5 py-[5px] font-bold text-xs border-none cursor-pointer whitespace-nowrap shrink-0"
            >
              + Novo
            </button>
          )}
        </div>

        {/* Mobile selects row — corretor/gestor em linha própria para não cortar */}
        {(isAdmin || isGestor) && (
          <div className="flex items-center gap-2 px-3 pb-1 overflow-x-auto scrollbar-none">
            <PipelineCorretorSelect
              value={corretorFilter}
              onChange={setCorretorFilter}
              options={corretorOptions}
              isAdmin={isAdmin}
              variant="mobile"
            />
            {isAdmin && setGestorFilter && (
              <PipelineGestorSelect value={gestorFilter} onChange={setGestorFilter} variant="compact" />
            )}
          </div>
        )}


        {/* Tab switcher mobile — paridade com desktop (Kanban / Modo Time / Equipes) */}
        {roleTabs.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto scrollbar-none">
            {roleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 shrink-0 transition-colors h-8 px-3 rounded-full text-[11px] font-semibold border-none cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "bg-slate-100 dark:bg-gray-800 text-[#71717a] dark:text-[#a1a1aa]"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {(activeTab === "kanban" || mobileSearchOpen || filters.search) && (
          <div className="flex items-center gap-2 px-3 py-1.5 animate-fade-in">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              ref={mobileSearchRef}
              type="text"
              aria-label="Buscar lead por nome, telefone ou empreendimento"
              placeholder="Buscar lead por nome, telefone..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="flex-1 bg-transparent text-xs text-foreground outline-none h-8"
            />
            {filters.search && (
              <button
                onClick={() => {
                  setFilters(f => ({ ...f, search: "" }));
                  if (activeTab !== "kanban") setMobileSearchOpen(false);
                }}
                aria-label="Limpar busca"
                className="bg-transparent border-none cursor-pointer flex items-center justify-center w-8 h-8 shrink-0"
              >
                <X className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </button>
            )}
          </div>
        )}


        {/* Line 2 mobile: toggle carteira + pílulas unificadas (somente Kanban) */}
        {activeTab === "kanban" && (
        <div className="flex items-center gap-2 px-3 pb-2 border-b border-slate-200 dark:border-gray-700">
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 w-max">
              {canToggleCarteira && setMinhaCarteira && (
                <div className="inline-flex shrink-0 rounded-full border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setMinhaCarteira(false)}
                    className={`px-2.5 h-7 text-[11px] font-semibold rounded-full transition-colors ${!minhaCarteira ? "bg-primary text-white" : "text-muted-foreground"}`}
                  >
                    Equipe
                  </button>
                  <button
                    type="button"
                    onClick={() => setMinhaCarteira(true)}
                    className={`px-2.5 h-7 text-[11px] font-semibold rounded-full transition-colors ${minhaCarteira ? "bg-primary text-white" : "text-muted-foreground"}`}
                  >
                    Minha
                  </button>
                </div>
              )}
              <PipelineFiltroBadges
                counts={pillCounts}
                active={
                  negociosFilter ? "negocios"
                  : clientStatusFilter === "em_dia" ? "em_dia"
                  : clientStatusFilter === "desatualizado" ? "sem_tarefa"
                  : clientStatusFilter === "tarefa_atrasada" ? "atrasado"
                  : null
                }
                onChange={(key) => {
                  // Evita conflito silencioso com o filtro de status do Sheet avançado.
                  setFilters(f => (f.statusLead ? { ...f, statusLead: "" } : f));
                  if (key === "negocios") {
                    setNegociosFilter(true);
                    setClientStatusFilter("todos");
                    return;
                  }
                  setNegociosFilter(false);
                  const map: Record<Exclude<PipelineFiltroKey, "negocios">, ClientStatusFilter> = {
                    em_dia: "em_dia",
                    sem_tarefa: "desatualizado",
                    atrasado: "tarefa_atrasada",
                  };
                  setClientStatusFilter(key ? map[key as Exclude<PipelineFiltroKey, "negocios">] : "todos");
                }}
              />
            </div>
          </div>
          {hasAnyFilter && (
            <button onClick={clearAllFilters} className="text-[10px] font-semibold text-red-600 bg-transparent border-none cursor-pointer shrink-0">
              <X className="h-[10px] w-[10px] inline" /> Limpar
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Atualizar pipeline"
            className="w-8 h-8 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        )}

      </div>

      {/* ── TABLET HEADER (md to lg) ── */}
      <div className="hidden md:block lg:hidden">
        <div className="flex items-center gap-2 h-12 px-4 border-b border-slate-200 dark:border-gray-700">
          <span className="text-sm font-bold text-foreground">Pipeline</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{filteredLeadsCount}</span>

          <div className="flex-1" />

          <div className="flex items-center bg-slate-100 dark:bg-gray-800 rounded-[7px] p-0.5">
            {roleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border-none cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 shadow-sm text-slate-800 dark:text-slate-100"
                    : "bg-transparent text-slate-500 dark:text-slate-400"
                }`}
              >
                {tab.icon}
                <span className="hidden xl:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {(isAdmin || isGestor) && (
            <PipelineCorretorSelect
              value={corretorFilter}
              onChange={setCorretorFilter}
              options={corretorOptions}
              isAdmin={isAdmin}
              variant="tablet"
            />
          )}
          {isAdmin && setGestorFilter && (
            <PipelineGestorSelect value={gestorFilter} onChange={setGestorFilter} variant="compact" />
          )}

          <PipelineAdvancedFilters
            filters={filters}
            onChange={setFilters}
            stages={pipelineStages}
            segmentos={pipelineSegmentos}
            leads={pipelineLeads}
            corretorNomes={corretorNomes}
            isManager={isGestor || isAdmin}
            visitaLeadIds={visitaLeadIds}
          />

          <div className="relative w-[120px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-500" />
            <input
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full outline-none h-[30px] rounded-[7px] bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 pl-[26px] pr-2 text-[11px] font-medium text-slate-800 dark:text-slate-100"
            />
          </div>

          <button onClick={handleRefresh} disabled={refreshing} className="w-7 h-7 rounded-[7px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer">
            <RefreshCw className={`h-3 w-3 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {canAdd && activeTab === "kanban" && (
            <button
              onClick={() => setAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 font-bold text-[11px] border-none cursor-pointer whitespace-nowrap"
            >
              + Novo Lead
            </button>
          )}
        </div>

        {/* Tablet line 2: pílulas unificadas + fila ceo */}
        <div className="flex items-center gap-2 overflow-x-auto h-9 px-4">
          <PipelineFiltroBadges
            counts={pillCounts}
            active={
              negociosFilter ? "negocios"
              : clientStatusFilter === "em_dia" ? "em_dia"
              : clientStatusFilter === "desatualizado" ? "sem_tarefa"
              : clientStatusFilter === "tarefa_atrasada" ? "atrasado"
              : null
            }
            onChange={(key) => {
              if (key === "negocios") {
                setNegociosFilter(true);
                setClientStatusFilter("todos");
                return;
              }
              setNegociosFilter(false);
              const map: Record<Exclude<PipelineFiltroKey, "negocios">, ClientStatusFilter> = {
                em_dia: "em_dia",
                sem_tarefa: "desatualizado",
                atrasado: "tarefa_atrasada",
              };
              setClientStatusFilter(key ? map[key as Exclude<PipelineFiltroKey, "negocios">] : "todos");
            }}
          />

          {isAdmin && filaCeoCount > 0 && (
            <>
              <button
                onClick={() => setFilaCeoFilter(f => !f)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer whitespace-nowrap border shrink-0 ${
                  filaCeoFilter
                    ? "bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-800"
                    : "bg-white dark:bg-gray-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-gray-700"
                }`}
              >
                📥 CEO {filaCeoCount}
              </button>
              {filaCeoNovosCount > 0 && (
                <button
                  onClick={() => openDispatch("novos")}
                  className="flex items-center gap-1 h-5 px-1.5 rounded-md text-[9px] font-bold bg-emerald-600 text-white border-none cursor-pointer shrink-0"
                  title="Leads novos aguardando distribuição"
                >
                  🆕 Novos {filaCeoNovosCount}
                </button>
              )}
            </>
          )}

          {isAdmin && activeTab === "kanban" && (
            <button
              onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
              className={`h-[22px] rounded-md px-2 text-[10px] font-semibold cursor-pointer flex items-center gap-1 border shrink-0 ${
                selectionMode
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                  : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {selectionMode ? <CheckSquare className="h-[10px] w-[10px]" /> : <Square className="h-[10px] w-[10px]" />}
              {selectionMode ? "Selec..." : "Selec."}
            </button>
          )}

          <div className="flex-1" />

          {hasAnyFilter && (
            <button onClick={clearAllFilters} className="text-[9px] font-semibold text-red-600 bg-transparent border-none cursor-pointer flex items-center gap-0.5 shrink-0">
              <X className="h-[9px] w-[9px]" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── DESKTOP HEADER (lg+) — Command Bar unificada ── */}
      <div className="hidden lg:block">
        {/* Linha 1 — Identidade · Navegação · Status · Ações primárias */}
        <div className="flex items-center flex-wrap gap-y-1.5 min-h-12 py-1.5 px-6 border-b border-[#e8e8f0] dark:border-white/[0.07] gap-3">
          {/* Identidade */}
          <div className="flex items-center flex-shrink-0 gap-2 min-w-0">
            <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center shrink-0">
              <LayoutGrid size={13} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-[15px] font-bold text-foreground tracking-tight whitespace-nowrap">
              Pipeline
            </span>
            <span className="text-[12px] text-[#a1a1aa] dark:text-[#52525b] font-medium shrink-0">{filteredLeadsCount} leads</span>
            <PipelineScopeBadge
              isAdmin={isAdmin}
              isDiretor={isDiretor}
              isGestor={isGestor}
              filteredCount={filteredLeadsCount}
              gestorFilter={gestorFilter}
            />
          </div>

          {/* Divisor identidade ↔ navegação */}
          <div className="w-px h-5 bg-[#e8e8f0] dark:bg-white/[0.07] shrink-0" />

          {/* Navegação (abas) — segmented control */}
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] p-1">
              {roleTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 shrink-0 transition-colors h-7 px-3 rounded-md text-xs border-none cursor-pointer ${
                    activeTab === tab.key
                      ? "bg-card text-foreground font-semibold shadow-sm"
                      : "bg-transparent text-[#71717a] dark:text-[#a1a1aa] font-medium hover:text-foreground"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Toggle Equipe / Minha carteira (gestor/admin, só Kanban) */}
            {canToggleCarteira && setMinhaCarteira && activeTab === "kanban" && (
              <div className="inline-flex shrink-0 rounded-[7px] border border-[#e8e8f0] dark:border-white/[0.07] bg-card p-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => setMinhaCarteira(false)}
                  className={`px-2.5 h-7 text-[11px] font-semibold rounded-md transition-colors ${!minhaCarteira ? "bg-primary text-white" : "text-[#71717a] dark:text-[#a1a1aa] hover:text-foreground"}`}
                >
                  Equipe
                </button>
                <button
                  type="button"
                  onClick={() => setMinhaCarteira(true)}
                  className={`px-2.5 h-7 text-[11px] font-semibold rounded-md transition-colors ${minhaCarteira ? "bg-primary text-white" : "text-[#71717a] dark:text-[#a1a1aa] hover:text-foreground"}`}
                >
                  Minha carteira
                </button>
              </div>
            )}


          </div>

          <div className="flex-1" />

          {/* Pílulas de status — Em dia / Sem tarefa / Atrasado / Negócios */}
          <div className="shrink-0">
            <PipelineFiltroBadges
              compact

              counts={pillCounts}
              active={
                negociosFilter ? "negocios"
                : clientStatusFilter === "em_dia" ? "em_dia"
                : clientStatusFilter === "desatualizado" ? "sem_tarefa"
                : clientStatusFilter === "tarefa_atrasada" ? "atrasado"
                : null
              }
              onChange={(key) => {
                setFilters(f => (f.statusLead ? { ...f, statusLead: "" } : f));
                if (key === "negocios") {
                  setNegociosFilter(true);
                  setClientStatusFilter("todos");
                  return;
                }
                setNegociosFilter(false);
                const map: Record<Exclude<PipelineFiltroKey, "negocios">, ClientStatusFilter> = {
                  em_dia: "em_dia",
                  sem_tarefa: "desatualizado",
                  atrasado: "tarefa_atrasada",
                };
                setClientStatusFilter(key ? map[key as Exclude<PipelineFiltroKey, "negocios">] : "todos");
              }}
            />
          </div>

          {/* Ações primárias */}
          <div className="flex items-center gap-1.5 shrink-0">
            {activeTab === "kanban" && (
              <button
                onClick={() => setFocusModeOpen(true)}
                className="whitespace-nowrap flex items-center gap-1.5 transition-colors h-9 px-3 rounded-lg font-semibold text-xs border-none cursor-pointer text-white"
                style={{ background: "linear-gradient(135deg, #4969FF, #7C3AED)" }}
              >
                <Zap size={13} strokeWidth={2} /> Modo Foco
                {focusLeadsCount > 0 && (
                  <span className="bg-white/20 rounded-md px-1.5 py-px text-[10px] font-bold">
                    {focusLeadsCount}
                  </span>
                )}
              </button>
            )}

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                className="whitespace-nowrap flex items-center gap-1.5 transition-colors h-9 px-3.5 bg-primary hover:bg-primary-600 text-white rounded-lg font-semibold text-xs border-none cursor-pointer"
              >
                <Plus size={13} strokeWidth={2} /> Novo Lead
              </button>
            )}
          </div>
        </div>

        {/* Linha 2 — Busca · Filtros · Ordenação · Ações globais */}
        <div className="flex items-center flex-wrap gap-y-1.5 gap-x-2 min-h-11 py-1.5 px-6">
          {/* Busca */}
          <div className="relative w-[180px] xl:w-[220px]">
            <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] dark:text-[#52525b]" />
            <input
              aria-label="Buscar lead, telefone ou empreendimento"
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full outline-none h-9 rounded-lg bg-[#f7f7fb] dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.07] pl-7 pr-2 text-xs font-medium text-[#0a0a0a] dark:text-white transition-all duration-200 focus:border-primary dark:focus:border-primary"
            />
            {filters.search && (
              <button aria-label="Limpar busca" onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-[#a1a1aa] dark:text-[#52525b]" />
              </button>
            )}
          </div>

          {/* Divisor busca ↔ filtros */}
          <div className="w-px h-5 bg-[#e8e8f0] dark:bg-white/[0.07] shrink-0 mx-0.5" />

          {/* Grupo de filtros */}
          <div className="flex items-center gap-2">
            {(isAdmin || isGestor) && (
              <PipelineCorretorSelect
                value={corretorFilter}
                onChange={setCorretorFilter}
                options={corretorOptions}
                isAdmin={isAdmin}
                variant="desktop"
              />
            )}
            {isAdmin && setGestorFilter && (
              <PipelineGestorSelect value={gestorFilter} onChange={setGestorFilter} variant="desktop" />
            )}

            <PipelineAdvancedFilters
              filters={filters}
              onChange={setFilters}
              stages={pipelineStages}
              segmentos={pipelineSegmentos}
              leads={pipelineLeads}
              corretorNomes={corretorNomes}
              isManager={isGestor || isAdmin}
              visitaLeadIds={visitaLeadIds}
            />
          </div>

          <div className="flex-1" />

          {/* Ordenação */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#a1a1aa] dark:text-[#52525b] hidden xl:inline">Ordenar por</span>
            <PipelineSortDropdown value={sortOrder} onChange={setSortOrder} />
          </div>

          {/* Divisor ordenação ↔ ações globais */}
          <div className="w-px h-5 bg-[#e8e8f0] dark:bg-white/[0.07] shrink-0 mx-0.5" />

          {/* Grupo de ações globais — Fila CEO · menu ⋯ */}
          <div className="flex items-center gap-1.5 shrink-0">
          {/* Fila CEO — colapsada num único botão com popover */}
          {isAdmin && filaCeoCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`shrink-0 flex items-center gap-1.5 transition-colors h-9 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    filaCeoFilter
                      ? "bg-primary/10 text-primary border-primary"
                      : "bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa] border-[#e8e8f0] dark:border-white/[0.07] hover:text-foreground"
                  }`}
                  title="Fila CEO"
                >
                  <Inbox size={13} strokeWidth={1.5} />
                  Fila CEO
                  {filaCeoNovosCount > 0 && (
                    <span className="bg-emerald-600 text-white rounded-md px-1.5 py-px text-[10px] font-bold">
                      {filaCeoNovosCount}
                    </span>
                  )}
                  <ChevronDown size={12} strokeWidth={1.5} className="opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60 p-2 space-y-1.5">
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  className={`w-full flex items-center justify-between transition-colors h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border ${
                    filaCeoFilter
                      ? "bg-primary/10 text-primary border-primary"
                      : "bg-transparent text-[#52525b] dark:text-[#a1a1aa] border-[#e8e8f0] dark:border-white/[0.07] hover:text-foreground"
                  }`}
                >
                  {filaCeoFilter ? "Filtrando Fila CEO" : "Filtrar Fila CEO"}
                  <span className="text-[10px] font-bold opacity-70">{filaCeoCount}</span>
                </button>
                {filaCeoNovosCount > 0 && (
                  <button
                    onClick={() => openDispatch("novos")}
                    className="w-full flex items-center justify-between transition-colors h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold border-none cursor-pointer"
                    title="Distribuir leads novos (Meta, site, ImovelWeb...)"
                  >
                    🆕 Distribuir novos <span className="font-bold">{filaCeoNovosCount}</span>
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Menu de ações secundárias — Atualizar / Selecionar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Mais ações"
                className="shrink-0 flex items-center justify-center transition-colors w-9 h-9 rounded-lg text-[#a1a1aa] dark:text-[#52525b] bg-[#f7f7fb] dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.07] cursor-pointer hover:text-foreground"
              >
                <MoreHorizontal size={15} strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleRefresh} disabled={refreshing} className="text-xs gap-2">
                <RefreshCw size={13} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
                Atualizar pipeline
              </DropdownMenuItem>
              {isAdmin && activeTab === "kanban" && (
                <DropdownMenuItem
                  onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
                  className="text-xs gap-2"
                >
                  {selectionMode ? <CheckSquare size={13} strokeWidth={1.5} /> : <Square size={13} strokeWidth={1.5} />}
                  {selectionMode ? "Sair da seleção" : "Selecionar leads"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>



      </div>


      {/* Vestigial reference for compat — unused state surfaced to keep prop interface stable */}
      {/* displayedClientStatusCounts mantido na interface para futura instrumentação. */}
      {false && <span>{displayedClientStatusCounts.em_dia}</span>}
    </div>
  );
}
