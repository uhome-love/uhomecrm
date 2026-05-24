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
import { Brain, BarChart3, Radar, LayoutGrid, Plus, RefreshCw, Search, X, Zap, CheckSquare, Square, Users, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PipelineAdvancedFilters, { type PipelineFilters } from "@/components/pipeline/PipelineAdvancedFilters";
import PipelineFiltroBadges, { type PipelineFiltroKey } from "@/components/pipeline/PipelineFiltroBadges";
import { PipelineSortDropdown } from "@/components/pipeline/PipelineSortDropdown";
import type { PipelineSortOrder } from "@/lib/pipelineSortOrder";
import type { LeadClientStatus } from "@/components/pipeline/CardStatusLine";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCorretorSelect from "@/components/pipeline/header/PipelineCorretorSelect";
import PipelineGestorSelect from "@/components/pipeline/header/PipelineGestorSelect";
import PipelineScopeBadge from "@/components/pipeline/header/PipelineScopeBadge";

export type PipelineTabMode = "kanban" | "inteligencia" | "time" | "equipes";
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
  filaCeoRedistCount: number;

  // Role flags
  isAdmin: boolean;
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
  hasAnyFilter: boolean;
  clearAllFilters: () => void;

  // Tabs / views
  activeTab: string;
  setActiveTab: (v: string) => void;
  intelView: "funil" | "radar";
  setIntelView: (v: "funil" | "radar") => void;

  // Actions
  refreshing: boolean;
  handleRefresh: () => void;
  setAddOpen: (v: boolean) => void;
  setFocusModeOpen: (v: boolean) => void;
  filaCeoFilter: boolean;
  setFilaCeoFilter: React.Dispatch<React.SetStateAction<boolean>>;
  openDispatch: (mode: "novos" | "redistribuicao") => void;
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
}

export default function PipelineHeader(props: PipelineHeaderProps) {
  const {
    filteredLeadsCount, displayedClientStatusCounts, campaignTagCounts, campaignTags,
    pipelineStages, pipelineSegmentos, pipelineLeads, corretorNomes, corretorOptions,
    visitaLeadIds, focusLeadsCount, filaCeoCount, filaCeoNovosCount, filaCeoRedistCount,
    isAdmin, isGestor, canAdd,
    filters, setFilters, corretorFilter, setCorretorFilter,
    campaignTagFilter, setCampaignTagFilter,
    clientStatusFilter, setClientStatusFilter,
    negociosFilter, setNegociosFilter,
    hasAnyFilter, clearAllFilters,
    activeTab, setActiveTab, intelView, setIntelView,
    refreshing, handleRefresh, setAddOpen, setFocusModeOpen,
    filaCeoFilter, setFilaCeoFilter, openDispatch,
    selectionMode, setSelectionMode, clearSelection,
    mobileSearchOpen, setMobileSearchOpen, mobileSearchRef,
    sortOrder, setSortOrder,
    gestorFilter = "todos", setGestorFilter,
  } = props;

  // Tabs por role (Fase 1):
  //  • Corretor: Kanban | Inteligência
  //  • Gestor:   Modo Time | Kanban | Inteligência
  //  • CEO:      Equipes   | Kanban | Inteligência
  const roleTabs: Array<{ key: string; icon: React.ReactNode; label: string }> = isAdmin
    ? [
        { key: "equipes", icon: <Building2 size={12} strokeWidth={1.5} />, label: "Equipes" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
        { key: "inteligencia", icon: <Brain size={12} strokeWidth={1.5} />, label: "Inteligência" },
      ]
    : isGestor
    ? [
        { key: "time", icon: <Users size={12} strokeWidth={1.5} />, label: "Modo Time" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
        { key: "inteligencia", icon: <Brain size={12} strokeWidth={1.5} />, label: "Inteligência" },
      ]
    : [
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
        { key: "inteligencia", icon: <Brain size={12} strokeWidth={1.5} />, label: "Inteligência" },
      ];


  return (
    <div className="shrink-0 bg-[#f7f7fb] dark:bg-[#141e30] border-b border-[#e8e8f0] dark:border-white/[0.07] sticky top-0 z-40">
      {/* ── MOBILE HEADER (< md) ── */}
      <div className="md:hidden">
        {/* Line 1: Title + filters + novo */}
        <div className="flex items-center gap-2 h-[46px] px-3">
          <div className="h-6 w-6 rounded-md bg-[#4969FF] flex items-center justify-center shrink-0">
            <LayoutGrid className="h-3 w-3 text-white" />
          </div>
          <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Pipeline</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{filteredLeadsCount}</span>
          <div className="flex-1" />

          {(isAdmin || isGestor) && (
            <PipelineCorretorSelect
              value={corretorFilter}
              onChange={setCorretorFilter}
              options={corretorOptions}
              isAdmin={isAdmin}
              variant="mobile"
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

          <button
            onClick={() => {
              setMobileSearchOpen(v => !v);
              setTimeout(() => mobileSearchRef.current?.focus(), 100);
            }}
            className="relative w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer"
          >
            <Search className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            {filters.search && (
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </button>

          {canAdd && activeTab === "kanban" && (
            <button
              onClick={() => setAddOpen(true)}
              className="bg-[#4969FF] hover:bg-[#3350E6] text-white rounded-[7px] px-2.5 py-[5px] font-bold text-xs border-none cursor-pointer whitespace-nowrap"
            >
              + Novo
            </button>
          )}
        </div>

        {(mobileSearchOpen || filters.search) && (
          <div className="flex items-center gap-2 px-3 py-1.5 animate-fade-in border-b border-slate-200 dark:border-gray-700">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              ref={mobileSearchRef}
              type="text"
              placeholder="Buscar lead por nome, telefone..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 outline-none h-7"
            />
            <button
              onClick={() => {
                setFilters(f => ({ ...f, search: "" }));
                setMobileSearchOpen(false);
              }}
              className="bg-transparent border-none cursor-pointer p-0.5"
            >
              <X className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        )}

        {/* Line 2 mobile: pílulas unificadas Dashboard↔Pipeline */}
        <div className="flex items-center gap-2 px-3 pb-2 border-b border-slate-200 dark:border-gray-700 overflow-x-auto">
          <PipelineFiltroBadges
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
          <div className="flex-1" />
          {hasAnyFilter && (
            <button onClick={clearAllFilters} className="text-[10px] font-semibold text-red-600 bg-transparent border-none cursor-pointer shrink-0">
              <X className="h-[10px] w-[10px] inline" /> Limpar
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3 w-3 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── TABLET HEADER (md to lg) ── */}
      <div className="hidden md:block lg:hidden">
        <div className="flex items-center gap-2 h-12 px-4 border-b border-slate-200 dark:border-gray-700">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Pipeline</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{filteredLeadsCount}</span>

          <div className="flex-1" />

          <div className="flex items-center bg-slate-100 dark:bg-gray-800 rounded-[7px] p-0.5">
            {[
              { key: "kanban", icon: <LayoutGrid className="h-3 w-3" />, label: "Kanban" },
              { key: "inteligencia", icon: <Brain className="h-3 w-3" />, label: "Intel" },
            ].map(tab => (
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
              {filaCeoRedistCount > 0 && (
                <button
                  onClick={() => openDispatch("redistribuicao")}
                  className="flex items-center gap-1 h-5 px-1.5 rounded-md text-[9px] font-bold bg-amber-600 text-white border-none cursor-pointer shrink-0"
                  title="Leads aguardando confirmação de redistribuição"
                >
                  🔄 Redistrib. {filaCeoRedistCount}
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

      {/* ── DESKTOP HEADER (lg+) ── */}
      <div className="hidden lg:block">
        {/* Line 1 — Title + Pílulas + Actions (compacto) */}
        <div className="flex items-center flex-wrap h-12 px-6 border-b border-[#e8e8f0] dark:border-white/[0.07] gap-2">
          <div className="flex items-center flex-shrink-0 gap-2 min-w-0">
            <div className="w-7 h-7 rounded-[7px] bg-[#4969FF] flex items-center justify-center shrink-0">
              <LayoutGrid size={13} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-[15px] font-bold text-[#0a0a0a] dark:text-white tracking-tight whitespace-nowrap">
              Pipeline
            </span>
            <span className="text-[12px] text-[#a1a1aa] dark:text-[#52525b] font-medium shrink-0">{filteredLeadsCount} leads</span>
          </div>

          {/* Pílulas movidas para linha 2 (ver abaixo) */}


          <div className="flex-1" />

          <div className="flex items-center gap-1.5 min-w-0">
            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className={`h-[32px] text-[12px] max-w-[170px] min-w-[120px] shrink rounded-lg font-medium truncate ${
                    corretorFilter !== "all"
                      ? "border-[#4969FF] bg-[#4969FF]/5 dark:bg-[#4969FF]/10 text-[#4969FF]"
                      : "border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa]"
                  }`}
                >
                  <SelectValue placeholder="Todos os corretores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os corretores</SelectItem>
                  {isAdmin && <SelectItem value="sem_corretor">Sem corretor</SelectItem>}
                  {corretorOptions.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Dropdown "Todas as campanhas" removido — filtro disponível em Filtros Avançados */}


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

            <div className="relative w-[280px]">
              <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] dark:text-[#52525b]" />
              <input
                placeholder="Buscar lead, telefone, empreendimento..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full outline-none h-9 rounded-lg bg-[#f7f7fb] dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.07] pl-7 pr-2 text-xs font-medium text-[#0a0a0a] dark:text-white transition-all duration-200 focus:border-[#4969FF] dark:focus:border-[#4969FF]"
              />
              {filters.search && (
                <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-[#a1a1aa] dark:text-[#52525b]" />
                </button>
              )}
            </div>

            <PipelineSortDropdown value={sortOrder} onChange={setSortOrder} />

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
                className="whitespace-nowrap flex items-center gap-1.5 transition-colors h-9 px-3.5 bg-[#4969FF] hover:bg-[#3350E6] text-white rounded-lg font-semibold text-xs border-none cursor-pointer"
              >
                <Plus size={13} strokeWidth={2} /> Novo Lead
              </button>
            )}
          </div>
        </div>

        {/* Line 2 — Tabs + Intel toggle + ações admin */}
        <div className="flex items-center overflow-x-auto h-9 px-6 gap-1">
          {[
            { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
            { key: "inteligencia", icon: <Brain size={12} strokeWidth={1.5} />, label: "Inteligência" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 shrink-0 transition-colors h-7 px-2.5 rounded-[7px] text-xs border-none cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#4969FF] text-white font-semibold"
                  : "bg-transparent text-[#71717a] dark:text-[#a1a1aa] font-medium"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}

          {activeTab === "inteligencia" && (
            <div className="flex items-center bg-[#f0f0f5] dark:bg-gray-800 rounded-[7px] p-0.5 ml-0.5">
              {[
                { key: "funil", icon: <BarChart3 className="h-3 w-3 inline mr-1" />, label: "Funil" },
                { key: "radar", icon: <Radar className="h-3 w-3 inline mr-1" />, label: "Radar" },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setIntelView(v.key as "funil" | "radar")}
                  className={`px-2 py-[3px] rounded-md text-[11px] font-semibold border-none cursor-pointer ${
                    intelView === v.key
                      ? "bg-white dark:bg-gray-700 text-[#0a0a0a] dark:text-white"
                      : "bg-transparent text-[#71717a] dark:text-[#a1a1aa]"
                  }`}
                >
                  {v.icon}{v.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 flex items-center justify-center transition-colors w-7 h-7 rounded-[7px] text-[#a1a1aa] dark:text-[#52525b] bg-transparent border-none cursor-pointer"
          >
            <RefreshCw size={12} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
          </button>

          {isAdmin && activeTab === "kanban" && (
            <button
              onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
              className={`flex items-center gap-1.5 shrink-0 transition-colors h-7 px-2.5 rounded-[7px] text-xs font-medium border-none cursor-pointer ${
                selectionMode
                  ? "bg-[#4969FF] text-white"
                  : "bg-transparent text-[#71717a] dark:text-[#a1a1aa]"
              }`}
            >
              {selectionMode ? <CheckSquare size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
              {selectionMode ? "Selecionando..." : "Selecionar"}
            </button>
          )}

          {isAdmin && filaCeoCount > 0 && (
            <>
              <div className="w-px h-4 bg-[#e8e8f0] dark:bg-white/[0.07] mx-1 shrink-0" />
              <span className="text-[11px] text-[#a1a1aa] dark:text-[#52525b]">Fila CEO</span>
              <button
                onClick={() => setFilaCeoFilter(f => !f)}
                className={`shrink-0 flex items-center gap-1 transition-colors h-[22px] px-1.5 rounded-md text-[10px] font-bold cursor-pointer border ${
                  filaCeoFilter
                    ? "bg-[#4969FF]/10 text-[#4969FF] border-[#4969FF]"
                    : "bg-transparent text-[#a1a1aa] dark:text-[#52525b] border-[#e8e8f0] dark:border-white/[0.07]"
                }`}
              >
                {filaCeoFilter ? "Filtrando" : "Filtrar"}
              </button>
              {filaCeoNovosCount > 0 && (
                <button
                  onClick={() => openDispatch("novos")}
                  className="shrink-0 flex items-center gap-1.5 transition-colors h-7 px-2.5 rounded-[7px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold border-none cursor-pointer"
                  title="Distribuir leads novos (Meta, site, ImovelWeb...)"
                >
                  🆕 Novos <span className="font-bold">{filaCeoNovosCount}</span>
                </button>
              )}
              {filaCeoRedistCount > 0 && (
                <button
                  onClick={() => openDispatch("redistribuicao")}
                  className="shrink-0 flex items-center gap-1.5 transition-colors h-7 px-2.5 rounded-[7px] bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold border-none cursor-pointer"
                  title="Confirmar redistribuição (leads reciclados após 72h)"
                >
                  🔄 Redistrib. <span className="font-bold">{filaCeoRedistCount}</span>
                </button>
              )}
            </>
          )}

          <div className="flex-1" />

          {/* Pílulas Em dia/Sem tarefa/Atrasado/Negócios — alinhadas à direita da linha de tabs */}
          <div className="shrink-0">
            <PipelineFiltroBadges
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
          </div>
        </div>


        {/* Line 3 — Filtros ativos (condicional) */}
        {hasAnyFilter && (
          <div className="flex items-center h-7 px-6 gap-2 border-t border-[#e8e8f0]/60 dark:border-white/[0.05]">
            <span className="text-[10px] uppercase tracking-wide text-[#a1a1aa] dark:text-[#52525b] font-semibold">
              Filtros ativos
            </span>
            <button
              onClick={clearAllFilters}
              className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-[#ef4444] bg-transparent border-none cursor-pointer"
            >
              <X size={10} strokeWidth={1.5} /> Limpar todos
            </button>
          </div>
        )}
      </div>

      {/* Vestigial reference for compat — unused state surfaced to keep prop interface stable */}
      {/* displayedClientStatusCounts mantido na interface para futura instrumentação. */}
      {false && <span>{displayedClientStatusCounts.em_dia}</span>}
    </div>
  );
}
