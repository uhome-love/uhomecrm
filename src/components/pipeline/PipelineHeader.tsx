// ─────────────────────────────────────────────────────────────────
// PipelineHeader — Header padrão do Pipeline (mockup aprovado 12/08/2026).
//
// UMA estrutura responsiva única (mobile→tablet→desktop), sem variantes que
// divergem. 3 zonas com respiro (divisória fina):
//   Zona 1 — Identidade + contexto (segue a aba) + ação primária
//   Zona 2 — Navegação (abas) + lente + Sinal (segue a aba) + toggle da 3ª linha
//   Zona 3 — Ferramentas (busca + filtros + ordenação + ações) · colapsável
// Contexto e sinal seguem a aba (Leads/Negócios/Equipes). Pílulas de saúde do
// Leads filtram (fonte única) e viram chips de filtro ativo (removíveis).
// A 3ª linha colapsa (lembrada por usuário). Chips = fonte única aqui (a faixa
// legada do PipelineKanban foi removida).
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, RefreshCw, Search, X, Zap, CheckSquare, Square, Users, Building2, MoreHorizontal, ChevronDown, Inbox, Briefcase, SlidersHorizontal, Trophy, HelpCircle } from "lucide-react";
import { useNegociosBoard } from "@/hooks/useNegociosBoard";
import { GERENTES_REAIS } from "@/components/pipeline/header/gerentesReais";
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
import HomiPageButton from "@/components/homi/HomiPageButton";

export type PipelineTabMode = "kanban" | "time" | "equipes";
export type ClientStatusFilter = "todos" | LeadClientStatus | "estagnado";

export interface CampaignTag {
  tag: string;
  label: string;
  color: string;
}

// R$ curto pro chip de contexto/sinal (mesmo formato do board de Negócios).
function moneyShort(reais: number): string {
  if (!reais) return "R$ 0";
  if (reais >= 1_000_000) return "R$ " + (reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (reais >= 1000) return "R$ " + Math.round(reais / 1000) + " mil";
  return "R$ " + reais;
}

// Pílula de passo (sinal da aba Negócios) — só leitura, mesmo visual das pílulas de saúde.
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
  // Filtro de SAÚDE do negócio (aba Negócios): "ambar" | "vermelho" | "estagnado" | null.
  negocioSaudeFilter?: "verde" | "ambar" | "vermelho" | null;
  setNegocioSaudeFilter?: (v: "verde" | "ambar" | "vermelho" | null) => void;
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
  pillCounts?: { em_dia: number; sem_tarefa: number; atrasado: number; estagnado?: number; negocios: number };

  /** Chip "Estagnado" só para gerente/CEO. */
  showEstagnado?: boolean;

  // Toggle Equipe / Minha carteira — integrado na linha de pílulas no mobile.
  canToggleCarteira?: boolean;
  minhaCarteira?: boolean;
  setMinhaCarteira?: (v: boolean) => void;

  // Filtro "em risco de estagnação" (estado local do PipelineKanban) — pro chip de filtro ativo.
  riscoFilter?: boolean;
  clearRisco?: () => void;
}

/** Regras de ociosidade do NEGÓCIO (saúde por toque nas etapas comerciais) — igual ao
 *  "?" do pipeline de leads, mas com as regras do negócio. */
function InfoOciosidadeNegocio() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Como funciona a cor do negócio"
          title="Como funciona a cor do negócio"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-[12.5px] leading-relaxed">
        <div className="mb-1 text-[13px] font-semibold text-foreground">A cor do negócio = sua atividade real</div>
        <p className="mb-2.5 text-muted-foreground">
          Mostra há quanto tempo você não registra uma atividade nesse negócio — não é sobre ter tarefa aberta.
        </p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span><b className="font-semibold text-foreground">Em dia</b> — dentro do prazo da etapa.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            <span><b className="font-semibold text-foreground">Atenção</b> — passou do prazo (até o dobro dele).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            <span><b className="font-semibold text-foreground">Desatualizado</b> — passou do dobro do prazo, prioridade.</span>
          </li>
        </ul>
        <div className="mt-2.5 rounded-md bg-muted/50 p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prazo por etapa (dias sem atividade)</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
            <span>Pós-Visita <b className="font-semibold text-foreground">7</b></span>
            <span>Documentação <b className="font-semibold text-foreground">7</b></span>
            <span>Proposta <b className="font-semibold text-foreground">7</b></span>
            <span>Contrato <b className="font-semibold text-foreground">7</b></span>
          </div>
        </div>
        <p className="mt-2.5 text-muted-foreground">
          No negócio não existe "estagnado": negócio parado vira <b className="font-semibold text-red-600 dark:text-red-400">desatualizado</b> e
          é prioridade (diferente do lead, que estagna e sai pra gestão).
        </p>
        <p className="mt-2 text-muted-foreground">
          Registre uma atividade <b className="font-semibold text-primary">⚡</b> e o negócio volta a ficar verde.
        </p>
      </PopoverContent>
    </Popover>
  );
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
    negocioSaudeFilter = null, setNegocioSaudeFilter,
    hasAnyFilter, clearAllFilters,
    activeTab, setActiveTab,
    refreshing, handleRefresh, setAddOpen, setFocusModeOpen,
    filaCeoFilter, setFilaCeoFilter, openDispatch,
    selectionMode, setSelectionMode, clearSelection,
    mobileSearchOpen, setMobileSearchOpen, mobileSearchRef,
    sortOrder, setSortOrder,
    gestorFilter = "todos", setGestorFilter,
    pillCounts,
    showEstagnado = false,
    canToggleCarteira = false, minhaCarteira = false, setMinhaCarteira,
    riscoFilter = false, clearRisco,
  } = props;

  // Tabs por role (Fase 1):
  //  • Corretor: Kanban
  //  • Gestor:   Modo Time | Kanban
  //  • CEO:      Equipes   | Kanban
  const NEGOCIOS_TAB = { key: "negocios", icon: <Briefcase size={12} strokeWidth={1.5} />, label: "Negócios" };
  const roleTabs: Array<{ key: string; icon: React.ReactNode; label: string }> = isAdmin
    ? [
        { key: "equipes", icon: <Building2 size={12} strokeWidth={1.5} />, label: "Equipes" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Leads" },
        NEGOCIOS_TAB,
      ]
    : isGestor
    ? [
        { key: "time", icon: <Users size={12} strokeWidth={1.5} />, label: "Modo Time" },
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Leads" },
        NEGOCIOS_TAB,
      ]
    : [
        { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Leads" },
        NEGOCIOS_TAB,
      ];

  // ── Resumo de Negócios (só busca quando na aba Negócios; cache compartilhado com o board) ──
  const negBoard = useNegociosBoard({ enabled: activeTab === "negocios" });
  const negResumo = useMemo(() => {
    const d = negBoard.data;
    if (!d) return null;
    const p = { documentacao: { n: 0, vgv: 0 }, proposta: { n: 0, vgv: 0 }, contrato: { n: 0, vgv: 0 }, ganho: { n: 0, vgv: 0 } };
    for (const c of d.negocios) {
      const k = c.passo as keyof typeof p;
      if (p[k]) { p[k].n++; p[k].vgv += c.vgv || 0; }
    }
    const posVisita = d.prontos.length;
    const total = posVisita + p.documentacao.n + p.proposta.n + p.contrato.n + p.ganho.n;
    const vgvTotal = p.documentacao.vgv + p.proposta.vgv + p.contrato.vgv + p.ganho.vgv;
    // Saúde do NEGÓCIO em andamento (Ganho é terminal, não conta): mesma vocabulária do lead.
    // Estagnado NÃO se aplica a negócio (só nas etapas de lead); por isso: em dia / atenção / desatualizado.
    let verde = 0, ambar = 0, vermelho = 0;
    const bump = (s: string) => { if (s === "verde") verde++; else if (s === "ambar") ambar++; else if (s === "vermelho") vermelho++; };
    d.prontos.forEach((x) => bump(x.saude));
    d.negocios.forEach((c) => { if (c.passo !== "ganho") bump(c.saude); });
    return { posVisita, ...p, total, vgvTotal, saude: { verde, ambar, vermelho } };
  }, [negBoard.data]);

  // ── Contexto tab-aware (só números — sem "Escritório") ──
  const contextLabel =
    activeTab === "negocios"
      ? (negResumo ? `${negResumo.total} negócios · ${moneyShort(negResumo.vgvTotal)}` : "negócios")
      : activeTab === "equipes"
      ? `${filteredLeadsCount} leads`
      : `${filteredLeadsCount} leads`;

  // ── Colapsar a 3ª linha (ferramentas) — lembra a escolha por usuário ──
  const [toolsOpen, setToolsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("pipeline_tools_open") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("pipeline_tools_open", toolsOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [toolsOpen]);

  // ── Chips de filtro ativo (remoção individual) ──
  const corretorNome = (() => {
    if (!corretorFilter || corretorFilter === "all" || corretorFilter === "todos") return null;
    if (corretorFilter === "sem_corretor") return "Sem corretor";
    return corretorNomes[corretorFilter] || corretorOptions.find(([id]) => id === corretorFilter)?.[1] || "Corretor";
  })();
  const gestorNome = (() => {
    if (!gestorFilter || gestorFilter === "todos") return null;
    return GERENTES_REAIS.find((x) => x.id === gestorFilter)?.apelido ?? "Gestor";
  })();
  // Rótulo do chip = vocabulária das PÍLULAS (nomes internos são legados):
  // clientStatus "desatualizado" = pílula "Atenção"; "tarefa_atrasada" = pílula "Desatualizado".
  const SAUDE_LABEL: Record<string, string> = { em_dia: "Em dia", desatualizado: "Atenção", tarefa_atrasada: "Desatualizado", estagnado: "Estagnado" };
  const activeChips: { id: string; label: string; onRemove: () => void }[] = [];
  if (filters.search) activeChips.push({ id: "busca", label: `Busca: ${filters.search}`, onRemove: () => setFilters(f => ({ ...f, search: "" })) });
  if (corretorNome) activeChips.push({ id: "corretor", label: `Corretor: ${corretorNome}`, onRemove: () => setCorretorFilter("all") });
  if (gestorNome && setGestorFilter) activeChips.push({ id: "gestor", label: `Gestor: ${gestorNome}`, onRemove: () => setGestorFilter("todos") });
  if (clientStatusFilter && clientStatusFilter !== "todos") activeChips.push({ id: "saude", label: SAUDE_LABEL[clientStatusFilter] ?? String(clientStatusFilter), onRemove: () => setClientStatusFilter("todos") });
  if (negociosFilter) activeChips.push({ id: "negocios", label: "Negócios", onRemove: () => setNegociosFilter(false) });
  if (ganhosFilter) activeChips.push({ id: "ganhos", label: "Ganhos", onRemove: () => setGanhosFilter(false) });
  if (campaignTagFilter && campaignTagFilter !== "all") {
    const camp = campaignTags.find(c => c.tag === campaignTagFilter);
    activeChips.push({ id: "campanha", label: `Campanha: ${camp?.label ?? campaignTagFilter}`, onRemove: () => setCampaignTagFilter("all") });
  }
  // Filtros avançados (Sheet) — cobre o que a faixa antiga do PipelineKanban cobria (fonte única aqui).
  if (filters.temperaturas?.length) activeChips.push({ id: "temp", label: `Temperatura: ${filters.temperaturas.map(t => TEMPERATURA_LABELS[t] ?? t).join(", ")}`, onRemove: () => setFilters(f => ({ ...f, temperaturas: [] })) });
  if (filters.stages?.length) activeChips.push({ id: "stages", label: `${filters.stages.length} etapa${filters.stages.length > 1 ? "s" : ""}`, onRemove: () => setFilters(f => ({ ...f, stages: [] })) });
  if (filters.origens?.length) activeChips.push({ id: "origens", label: `Origem: ${filters.origens.length === 1 ? filters.origens[0] : `${filters.origens.length} origens`}`, onRemove: () => setFilters(f => ({ ...f, origens: [] })) });
  if (filters.segmentos?.length) activeChips.push({ id: "segmentos", label: `${filters.segmentos.length} segmento${filters.segmentos.length > 1 ? "s" : ""}`, onRemove: () => setFilters(f => ({ ...f, segmentos: [] })) });
  if (filters.empreendimentos?.length) activeChips.push({ id: "empreendimentos", label: `Empreendimento: ${filters.empreendimentos.length === 1 ? filters.empreendimentos[0] : `${filters.empreendimentos.length} selecionados`}`, onRemove: () => setFilters(f => ({ ...f, empreendimentos: [] })) });
  if (filters.diasSemAcao) activeChips.push({ id: "dias", label: `> ${filters.diasSemAcao}d sem ação`, onRemove: () => setFilters(f => ({ ...f, diasSemAcao: "" })) });
  if (filters.periodoEntrada) activeChips.push({ id: "periodo", label: `Entrada: ${PERIODO_LABELS[filters.periodoEntrada] ?? filters.periodoEntrada}`, onRemove: () => setFilters(f => ({ ...f, periodoEntrada: "", periodoCustomStart: undefined, periodoCustomEnd: undefined })) });
  if (filters.statusLead) activeChips.push({ id: "statusLead", label: `Status: ${filters.statusLead === "em_dia" ? "Em dia" : filters.statusLead === "tarefa_atrasada" ? "Atrasado" : "Desatualizado"}`, onRemove: () => setFilters(f => ({ ...f, statusLead: "" })) });
  if (filters.gerenteFilter && filters.gerenteFilter !== "all") activeChips.push({ id: "gerenteFilter", label: filters.gerenteFilter === "sem_gerente" ? "Sem gerente" : "Com gerente", onRemove: () => setFilters(f => ({ ...f, gerenteFilter: "all" })) });

  if (filters.comVisita) activeChips.push({ id: "visita", label: "Com visita", onRemove: () => setFilters(f => ({ ...f, comVisita: "" })) });
  if (riscoFilter && clearRisco) activeChips.push({ id: "risco", label: "Em risco de estagnação", onRemove: clearRisco });

  return (
    <div className="shrink-0 bg-muted/40 dark:bg-card border-b border-border sticky top-0" style={{ zIndex: 30 /* Z.headerSticky */ }}>
      {/* ── HEADER ÚNICO RESPONSIVO — 3 zonas (mockup aprovado, mobile→desktop) ── */}
      <div>
        {/* ══ ZONA 1 — Identidade + ação primária ══ */}
        <div className="flex h-12 lg:h-14 items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="w-7 h-7 rounded-[7px] bg-primary flex items-center justify-center shrink-0">
              <LayoutGrid size={13} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-[16px] font-bold text-foreground tracking-[-0.3px] whitespace-nowrap">Pipeline</span>
            <PipelineScopeBadge isAdmin={isAdmin} isDiretor={isDiretor} isGestor={isGestor} countLabel={contextLabel} gestorFilter={gestorFilter} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {activeTab === "kanban" && (
              <button
                type="button"
                onClick={() => setGanhosFilter(v => !v)}
                title="Ver leads ganhos / vendidos"
                className={`inline-flex items-center gap-1.5 rounded-lg h-9 px-3 text-xs font-semibold transition-colors ${ganhosFilter ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"}`}
              >
                <Trophy size={14} strokeWidth={2} /> Ganhos
              </button>
            )}
            {activeTab === "kanban" && (
              <>
                <div className="hidden sm:block h-5 w-px bg-border" />
                <button
                  onClick={() => setFocusModeOpen(true)}
                  className="hidden lg:inline-flex whitespace-nowrap items-center gap-1.5 h-9 px-3 rounded-lg font-semibold text-xs text-white cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #4969FF, #7C3AED)" }}
                >
                  <Zap size={13} strokeWidth={2} /> Modo Foco
                  {focusLeadsCount > 0 && <span className="bg-white/20 rounded-md px-1.5 py-px text-[10px] font-bold">{focusLeadsCount}</span>}
                </button>
                {canAdd && (
                  <button onClick={() => setAddOpen(true)} className="whitespace-nowrap inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 bg-primary hover:bg-primary-600 text-white rounded-lg font-semibold text-xs cursor-pointer">
                    <Plus size={13} strokeWidth={2} /> <span className="hidden sm:inline">Novo Lead</span><span className="sm:hidden">Novo</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ══ ZONA 2 — Navegação (abas) + lente + Sinal + toggle da 3ª linha ══ */}
        <div className="flex min-h-12 flex-wrap items-center gap-x-3 lg:gap-x-4 gap-y-2 border-t border-border px-3 sm:px-4 lg:px-6 py-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-1 shrink-0">
            {roleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 shrink-0 transition-colors h-8 px-3.5 rounded-md text-xs border-none cursor-pointer ${
                  activeTab === tab.key ? "bg-card text-foreground font-semibold shadow-sm" : "bg-transparent text-muted-foreground font-medium hover:text-foreground"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {canToggleCarteira && setMinhaCarteira && activeTab === "kanban" && (
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-1 shrink-0">
              <button type="button" onClick={() => setMinhaCarteira(false)} className={`h-8 px-3 text-xs font-semibold rounded-md transition-colors ${!minhaCarteira ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Equipe</button>
              <button type="button" onClick={() => setMinhaCarteira(true)} className={`h-8 px-3 text-xs font-semibold rounded-md transition-colors ${minhaCarteira ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><span className="hidden md:inline">Minha carteira</span><span className="md:hidden">Minha</span></button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {activeTab === "kanban" && (
              <PipelineFiltroBadges
                showEstagnado={showEstagnado}
                compact
                counts={pillCounts}
                active={
                  negociosFilter ? "negocios"
                  : clientStatusFilter === "em_dia" ? "em_dia"
                  : clientStatusFilter === "desatualizado" ? "sem_tarefa"
                  : clientStatusFilter === "tarefa_atrasada" ? "atrasado" : clientStatusFilter === "estagnado" ? "estagnado"
                  : null
                }
                onChange={(key) => {
                  setFilters(f => (f.statusLead ? { ...f, statusLead: "" } : f));
                  if (key === "negocios") { setNegociosFilter(true); setClientStatusFilter("todos"); return; }
                  setNegociosFilter(false);
                  const map: Record<Exclude<PipelineFiltroKey, "negocios">, ClientStatusFilter> = {
                    em_dia: "em_dia", sem_tarefa: "desatualizado", atrasado: "tarefa_atrasada", estagnado: "estagnado",
                  };
                  setClientStatusFilter(key ? map[key as Exclude<PipelineFiltroKey, "negocios">] : "todos");
                }}
              />
            )}
            {/* Negócios: pílulas de SAÚDE que FILTRAM o board (mesma vocabulária do lead).
                Passo+VGV já vivem no cabeçalho de cada coluna. */}
            {/* Saúde do negócio — MESMO visual compacto do pipeline de Leads (cluster
                segmentado, só a bolinha + número; rótulo aparece na ativa). Sem estagnado. */}
            {activeTab === "negocios" && negResumo && setNegocioSaudeFilter && (
              <div className="inline-flex items-center gap-1">
              <div className="inline-flex items-center rounded-lg border border-[#e8e8f0] dark:border-border bg-[#f7f7fb] dark:bg-muted/50 p-0.5">
                {([
                  { key: "verde", label: "em dia", n: negResumo.saude.verde, color: "#047857", dot: "#22c55e", bgActive: "rgba(34,197,94,0.12)" },
                  { key: "ambar", label: "atenção", n: negResumo.saude.ambar, color: "#B45309", dot: "hsl(var(--warning-500))", bgActive: "rgba(245,158,11,0.12)" },
                  { key: "vermelho", label: "desatualizado", n: negResumo.saude.vermelho, color: "#DC2626", dot: "#DC2626", bgActive: "rgba(220,38,38,0.12)" },
                ] as const).map((s) => {
                  const active = negocioSaudeFilter === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setNegocioSaudeFilter(active ? null : s.key)}
                      aria-pressed={active}
                      title={`${s.label}: ${s.n.toLocaleString("pt-BR")} negócios`}
                      className="group inline-flex items-center gap-1.5 h-7 px-2 rounded-md transition-colors cursor-pointer border-none"
                      style={{ background: active ? s.bgActive : "transparent", color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = s.bgActive; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 700 }}>{s.n.toLocaleString("pt-BR")}</span>
                      {active && <span style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</span>}
                    </button>
                  );
                })}
              </div>
              <InfoOciosidadeNegocio />
              </div>
            )}

            <div className="h-5 w-px bg-border" />
            {toolsOpen ? (
              <button
                onClick={() => setToolsOpen(false)}
                aria-label="Ocultar busca e filtros"
                title="Ocultar busca e filtros"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/40 h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronDown className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={() => setToolsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 h-9 text-xs font-semibold text-primary cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filtros
                {activeChips.length > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{activeChips.length}</span>}
              </button>
            )}
          </div>
        </div>

        {/* ══ CHIPS DE FILTRO ATIVO — sempre visível quando há filtro (mesmo com a 3ª linha colapsada) ══ */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-3 sm:px-4 lg:px-6 py-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Filtros ativos</span>
            {activeChips.map(chip => (
              <span key={chip.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground">
                {chip.label}
                <button onClick={chip.onRemove} aria-label={`Remover ${chip.label}`} className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="ml-1 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer">Limpar tudo</button>
          </div>
        )}

        {/* ══ ZONA 3 — Ferramentas (busca + filtros + ordenação + ações) · colapsável ══ */}
        {toolsOpen && (
        <div className="flex min-h-12 flex-wrap items-center gap-1.5 lg:gap-2 border-t border-border px-3 sm:px-4 lg:px-6 py-2">
          <div className="relative w-full sm:w-[150px] lg:w-[150px] xl:w-[150px] 2xl:w-[230px]">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Buscar lead, telefone ou empreendimento"
              placeholder="Buscar lead, cliente, empreendimento…"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full outline-none h-9 rounded-lg bg-muted/40 border border-border pl-9 pr-8 text-xs font-medium text-foreground transition-all duration-200 focus:border-primary"
            />
            {filters.search && (
              <button aria-label="Limpar busca" onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {(isAdmin || isGestor) && (
            <PipelineCorretorSelect value={corretorFilter} onChange={setCorretorFilter} options={corretorOptions} isAdmin={isAdmin} variant="desktop" />
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

          {/* Spacer só no 2xl: alinha o grupo à direita no monitor grande; no 13"/laptop
              os itens empacotam à esquerda e a linha NÃO quebra em duas. */}
          <div className="hidden 2xl:block flex-1" />
          <PipelineSortDropdown value={sortOrder} onChange={setSortOrder} />

            {isAdmin && filaCeoCount > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`shrink-0 flex items-center gap-1.5 transition-colors h-9 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      filaCeoFilter ? "bg-primary/10 text-primary border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                    }`}
                    title="Fila CEO"
                  >
                    <Inbox size={13} strokeWidth={1.5} /> <span className="hidden 2xl:inline">Fila CEO</span>
                    {filaCeoNovosCount > 0 && <span className="bg-emerald-600 text-white rounded-md px-1.5 py-px text-[10px] font-bold">{filaCeoNovosCount}</span>}
                    <ChevronDown size={12} strokeWidth={1.5} className="opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-2 space-y-1.5">
                  <button
                    onClick={() => setFilaCeoFilter(f => !f)}
                    className={`w-full flex items-center justify-between transition-colors h-8 px-2.5 rounded-md text-xs font-semibold cursor-pointer border ${
                      filaCeoFilter ? "bg-primary/10 text-primary border-primary" : "bg-transparent text-muted-foreground border-border hover:text-foreground"
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

            <HomiPageButton className="h-9 shrink-0 rounded-lg" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Mais ações" className="shrink-0 flex items-center justify-center transition-colors w-9 h-9 rounded-lg text-muted-foreground bg-muted/40 border border-border cursor-pointer hover:text-foreground">
                  <MoreHorizontal size={15} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleRefresh} disabled={refreshing} className="text-xs gap-2">
                  <RefreshCw size={13} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} /> Atualizar pipeline
                </DropdownMenuItem>
                {isAdmin && activeTab === "kanban" && (
                  <DropdownMenuItem onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }} className="text-xs gap-2">
                    {selectionMode ? <CheckSquare size={13} strokeWidth={1.5} /> : <Square size={13} strokeWidth={1.5} />}
                    {selectionMode ? "Sair da seleção" : "Selecionar leads"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
        )}
      </div>


      {/* Vestigial reference for compat — unused state surfaced to keep prop interface stable */}
      {/* displayedClientStatusCounts mantido na interface para futura instrumentação. */}
      {false && <span>{displayedClientStatusCounts.em_dia}</span>}
    </div>
  );
}
