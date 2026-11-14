// ─────────────────────────────────────────────────────────────────
// PipelineHeaderV2 — topo do Pipeline oficial (/pipeline-leads).
//
// Recebe as MESMAS props do PipelineHeader (troca direta no
// PipelineKanbanV2) e mais 3 opcionais para os atalhos de ação.
//
// 3 linhas no computador:
//   1. Pipeline + contagem · abas · Empresa/Meus leads · Modo Foco · Novo lead
//      (sem botão Ganhos: ganhos ficam só na aba Negócios)
//   2. Busca · Corretor · Gestor · Filtros · Ordenar · Fila CEO · Homi · ···
//   3. Atalhos: ⏰ Tarefa atrasada · 📌 Para hoje · ⚠️ Sem próxima ação | Saúde ● ● ●
//      (estagnados não entram: saem do quadro e ficam na página Leads estagnados)
// Filtros ativos aparecem numa faixa só quando existem.
// No celular: linha 1 + busca e filtros. Os atalhos vão para o PipelineMobileViewV2.
// Na aba Equipes, as linhas 2 e 3 somem (não se aplicam).
// ─────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { LayoutGrid, Plus, RefreshCw, Search, X, Zap, CheckSquare, Square, Users, Building2, MoreHorizontal, ChevronDown, Inbox, Briefcase } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PipelineAdvancedFilters, { TEMPERATURA_LABELS, PERIODO_LABELS } from "@/components/pipeline/PipelineAdvancedFilters";
import { PipelineSortDropdown } from "@/components/pipeline/PipelineSortDropdown";
import PipelineCorretorSelect from "@/components/pipeline/header/PipelineCorretorSelect";
import PipelineGestorSelect from "@/components/pipeline/header/PipelineGestorSelect";
import { GERENTES_REAIS } from "@/components/pipeline/header/gerentesReais";
import HomiPageButton from "@/components/homi/HomiPageButton";
import type { PipelineHeaderProps, ClientStatusFilter } from "@/components/pipeline/PipelineHeader";
import type { FiltroAcao } from "@/lib/pipelineV2/proximaAcao";
import { NegociosLensToggle } from "@/components/pipeline/negocio/NegociosLensToggle";
import type { NegociosLens } from "@/components/pipeline/negocio/boardPresentation";

export interface PipelineHeaderV2Props extends PipelineHeaderProps {
  acaoCounts?: { atrasada: number; hoje: number; sem: number };
  acaoFilter?: FiltroAcao;
  setAcaoFilter?: (v: FiltroAcao) => void;
  negociosLens?: NegociosLens;
  setNegociosLens?: (value: NegociosLens) => void;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function PipelineHeaderV2(props: PipelineHeaderV2Props) {
  const {
    filteredLeadsCount, displayedClientStatusCounts, campaignTags,
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
    sortOrder, setSortOrder,
    gestorFilter = "todos", setGestorFilter,
    pillCounts,
    canToggleCarteira = false, minhaCarteira = false, setMinhaCarteira,
    riscoFilter = false, clearRisco,
    acaoCounts, acaoFilter = "todos", setAcaoFilter,
    negociosLens = "equipe", setNegociosLens,
  } = props;

  const tabs = isAdmin
    ? [
        { key: "equipes", label: "Equipes", icon: Building2 },
        { key: "kanban", label: "Leads", icon: LayoutGrid },
        { key: "negocios", label: "Negócios", icon: Briefcase },
      ]
    : isGestor
    ? [
        { key: "time", label: "Modo Time", icon: Users },
        { key: "kanban", label: "Leads", icon: LayoutGrid },
        { key: "negocios", label: "Negócios", icon: Briefcase },
      ]
    : [
        { key: "kanban", label: "Leads", icon: LayoutGrid },
        { key: "negocios", label: "Negócios", icon: Briefcase },
      ];

  // Saúde por toque (mesmas 4 cores da aba Equipes). Chaves internas são legadas:
  // clientStatus "desatualizado" = Atenção; "tarefa_atrasada" = Desatualizado.
  const saude: Array<{ key: ClientStatusFilter; rotulo: string; n: number; ponto: string }> = [
    { key: "em_dia", rotulo: "Em dia", n: pillCounts?.em_dia ?? displayedClientStatusCounts.em_dia, ponto: "bg-emerald-500" },
    { key: "desatualizado", rotulo: "Atenção", n: pillCounts?.sem_tarefa ?? displayedClientStatusCounts.desatualizado, ponto: "bg-amber-500" },
    { key: "tarefa_atrasada", rotulo: "Desatualizado", n: pillCounts?.atrasado ?? displayedClientStatusCounts.tarefa_atrasada, ponto: "bg-red-500" },
  ];

  const acoes: Array<{ key: Exclude<FiltroAcao, "todos">; emoji: string; rotulo: string; n?: number }> = [
    { key: "atrasada", emoji: "⏰", rotulo: isAdmin || isGestor ? "Tarefa atrasada" : "Atrasadas", n: acaoCounts?.atrasada },
    { key: "hoje", emoji: "📌", rotulo: "Para hoje", n: acaoCounts?.hoje },
    { key: "sem", emoji: "⚠️", rotulo: "Sem próxima ação", n: acaoCounts?.sem },
  ];

  // Filtros ativos (mesma regra do PipelineHeader), mais o atalho de ação.
  const ACAO_LABEL: Record<string, string> = { atrasada: "Tarefa atrasada", hoje: "Para hoje", sem: "Sem próxima ação" };
  const SAUDE_LABEL: Record<string, string> = { em_dia: "Em dia", desatualizado: "Atenção", tarefa_atrasada: "Desatualizado", estagnado: "Estagnado" };
  const corretorNome =
    !corretorFilter || corretorFilter === "all" || corretorFilter === "todos"
      ? null
      : corretorFilter === "sem_corretor"
      ? "Sem corretor"
      : corretorNomes[corretorFilter] || corretorOptions.find(([id]) => id === corretorFilter)?.[1] || "Corretor";
  const gestorNome = !gestorFilter || gestorFilter === "todos" ? null : GERENTES_REAIS.find((x) => x.id === gestorFilter)?.apelido ?? "Gestor";

  const chips = useMemo(() => {
    const c: { id: string; label: string; onRemove: () => void }[] = [];
    if (acaoFilter !== "todos" && setAcaoFilter) c.push({ id: "acao", label: ACAO_LABEL[acaoFilter], onRemove: () => setAcaoFilter("todos") });
    if (filters.search) c.push({ id: "busca", label: `Busca: ${filters.search}`, onRemove: () => setFilters((f) => ({ ...f, search: "" })) });
    if (corretorNome) c.push({ id: "corretor", label: `Corretor: ${corretorNome}`, onRemove: () => setCorretorFilter("all") });
    if (gestorNome && setGestorFilter) c.push({ id: "gestor", label: `Gestor: ${gestorNome}`, onRemove: () => setGestorFilter("todos") });
    if (clientStatusFilter && clientStatusFilter !== "todos") c.push({ id: "saude", label: SAUDE_LABEL[clientStatusFilter] ?? String(clientStatusFilter), onRemove: () => setClientStatusFilter("todos") });
    if (negociosFilter) c.push({ id: "negocios", label: "Negócios", onRemove: () => setNegociosFilter(false) });
    if (ganhosFilter) c.push({ id: "ganhos", label: "Ganhos", onRemove: () => setGanhosFilter(false) });
    if (campaignTagFilter && campaignTagFilter !== "all") {
      const camp = campaignTags.find((x) => x.tag === campaignTagFilter);
      c.push({ id: "campanha", label: `Campanha: ${camp?.label ?? campaignTagFilter}`, onRemove: () => setCampaignTagFilter("all") });
    }
    if (filters.temperaturas?.length) c.push({ id: "temp", label: `Temperatura: ${filters.temperaturas.map((t) => TEMPERATURA_LABELS[t] ?? t).join(", ")}`, onRemove: () => setFilters((f) => ({ ...f, temperaturas: [] })) });
    if (filters.stages?.length) c.push({ id: "stages", label: `${filters.stages.length} etapa${filters.stages.length > 1 ? "s" : ""}`, onRemove: () => setFilters((f) => ({ ...f, stages: [] })) });
    if (filters.origens?.length) c.push({ id: "origens", label: `Origem: ${filters.origens.length === 1 ? filters.origens[0] : `${filters.origens.length} origens`}`, onRemove: () => setFilters((f) => ({ ...f, origens: [] })) });
    if (filters.segmentos?.length) c.push({ id: "segmentos", label: `${filters.segmentos.length} segmento${filters.segmentos.length > 1 ? "s" : ""}`, onRemove: () => setFilters((f) => ({ ...f, segmentos: [] })) });
    if (filters.empreendimentos?.length) c.push({ id: "emp", label: `Empreendimento: ${filters.empreendimentos.length === 1 ? filters.empreendimentos[0] : `${filters.empreendimentos.length} selecionados`}`, onRemove: () => setFilters((f) => ({ ...f, empreendimentos: [] })) });
    if (filters.diasSemAcao) c.push({ id: "dias", label: `> ${filters.diasSemAcao}d sem ação`, onRemove: () => setFilters((f) => ({ ...f, diasSemAcao: "" })) });
    if (filters.periodoEntrada) c.push({ id: "periodo", label: `Entrada: ${PERIODO_LABELS[filters.periodoEntrada] ?? filters.periodoEntrada}`, onRemove: () => setFilters((f) => ({ ...f, periodoEntrada: "", periodoCustomStart: undefined, periodoCustomEnd: undefined })) });
    if (filters.comVisita) c.push({ id: "visita", label: "Com visita", onRemove: () => setFilters((f) => ({ ...f, comVisita: "" })) });
    if (riscoFilter && clearRisco) c.push({ id: "risco", label: "Em risco de estagnação", onRemove: clearRisco });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acaoFilter, filters, corretorNome, gestorNome, clientStatusFilter, negociosFilter, ganhosFilter, campaignTagFilter, riscoFilter]);

  const limparTudo = () => {
    setAcaoFilter?.("todos");
    clearAllFilters();
  };

  const naAbaLeads = activeTab === "kanban";
  const mostraFerramentas = activeTab !== "equipes" && activeTab !== "time";

  const segBase = "inline-flex items-center gap-1 rounded-[11px] bg-muted p-[3px]";
  const segBtn = (ativo: boolean) =>
    `inline-flex h-[34px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
      ativo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;
  const campo = "h-11 rounded-[11px] border border-border bg-card";

  return (
    <div className="sticky top-0 shrink-0 border-b border-border bg-background" style={{ zIndex: 30 }}>
      {/* ── Linha 1 ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-2 pt-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary/10 text-primary sm:flex">
            <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[22px] font-bold leading-7 tracking-tight text-foreground sm:text-xl" style={{ fontFamily: "Montserrat, Inter, sans-serif" }}>
              Pipeline
            </span>
            <span className="truncate text-[13px] font-medium leading-[18px] text-muted-foreground">
              {naAbaLeads ? `${fmt(filteredLeadsCount)} leads ativos${isAdmin && !minhaCarteira ? " na empresa" : ""}` : activeTab === "negocios" ? "Negócios em andamento" : "Resumo da empresa"}
            </span>
          </div>
        </div>

        <div className={`${segBase} hidden sm:inline-flex`} role="tablist" aria-label="Visões do pipeline">
          {tabs.map((t) => {
            const Icon = t.icon;
            const ativo = activeTab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={ativo} onClick={() => setActiveTab(t.key)} className={segBtn(ativo)}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === "negocios" && (isAdmin || isGestor) && setNegociosLens && (
          <div className="order-3 ml-auto sm:order-none sm:ml-0"><NegociosLensToggle value={negociosLens} onChange={setNegociosLens} /></div>
        )}

        {canToggleCarteira && setMinhaCarteira && naAbaLeads && (
          <div className={`${segBase} hidden md:inline-flex`} role="group" aria-label="De quem são os leads">
            <button type="button" aria-pressed={minhaCarteira} onClick={() => setMinhaCarteira(true)} className={segBtn(minhaCarteira)}>
              Meus
            </button>
            <button type="button" aria-pressed={!minhaCarteira} onClick={() => setMinhaCarteira(false)} className={segBtn(!minhaCarteira)}>
              {isAdmin || isDiretor ? "Empresa" : "Minha equipe"}
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {naAbaLeads && (
            <button
              type="button"
              onClick={() => setFocusModeOpen(true)}
              className="hidden h-10 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted lg:inline-flex"
            >
              <Zap className="h-4 w-4 text-primary" strokeWidth={2} />
              Modo Foco
              {focusLeadsCount > 0 && <span className="rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary">{focusLeadsCount}</span>}
            </button>
          )}
          {canAdd && naAbaLeads && (
            <button
              type="button"
              aria-label="Novo lead"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-4"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
              <span className="hidden sm:inline">Novo lead</span>
            </button>
          )}
        </div>

        {/* Abas no celular: linha própria, rolagem sem barra */}
        <div className={`${segBase} w-full sm:hidden`} role="tablist" aria-label="Visões do pipeline">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} onClick={() => setActiveTab(t.key)} className={`${segBtn(activeTab === t.key)} flex-1 justify-center`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {mostraFerramentas && (
        <>
          {/* ── Linha 2 ── */}
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2 sm:px-4 lg:px-6">
            <label className={`${campo} flex min-w-0 flex-1 basis-[260px] items-center gap-2.5 px-3.5 text-muted-foreground sm:max-w-[460px]`}>
              <Search className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
              <span className="sr-only">Buscar lead</span>
              <input
                placeholder={activeTab === "negocios" ? "Buscar cliente ou corretor" : "Buscar lead ou telefone"}
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {filters.search && (
                <button type="button" aria-label="Limpar busca" onClick={() => setFilters((f) => ({ ...f, search: "" }))}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="hidden items-center gap-2 sm:flex">
              {(isAdmin || isGestor) && <PipelineCorretorSelect value={corretorFilter} onChange={setCorretorFilter} options={corretorOptions} isAdmin={isAdmin} variant="desktop" />}
              {isAdmin && setGestorFilter && <PipelineGestorSelect value={gestorFilter} onChange={setGestorFilter} variant="desktop" />}
            </div>
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
            <div className="hidden flex-1 lg:block" />
            <div className="hidden items-center gap-2 sm:flex">
              {naAbaLeads && <PipelineSortDropdown value={sortOrder} onChange={setSortOrder} />}
              {isAdmin && filaCeoCount > 0 && naAbaLeads && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Fila CEO"
                      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold ${
                        filaCeoFilter ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Inbox className="h-4 w-4" strokeWidth={1.8} /> Fila CEO
                      {filaCeoNovosCount > 0 && <span className="rounded-md bg-emerald-600 px-1.5 text-[11px] font-bold text-white">{filaCeoNovosCount}</span>}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-60 space-y-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => setFilaCeoFilter((f) => !f)}
                      className="flex h-8 w-full items-center justify-between rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {filaCeoFilter ? "Filtrando Fila CEO" : "Filtrar Fila CEO"} <span className="opacity-70">{filaCeoCount}</span>
                    </button>
                    {filaCeoNovosCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openDispatch("novos")}
                        className="flex h-8 w-full items-center justify-between rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        🆕 Distribuir novos <span>{filaCeoNovosCount}</span>
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              <HomiPageButton className="h-10 shrink-0 rounded-[10px]" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Mais ações" className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleRefresh} disabled={refreshing} className="gap-2 text-xs">
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar pipeline
                  </DropdownMenuItem>
                  {isAdmin && naAbaLeads && (
                    <DropdownMenuItem onClick={() => (selectionMode ? clearSelection() : setSelectionMode(true))} className="gap-2 text-xs">
                      {selectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      {selectionMode ? "Sair da seleção" : "Selecionar leads"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Linha 3 (computador): atalhos de ação + saúde agrupada ── */}
          {naAbaLeads && (
            <div className="hidden flex-wrap items-center gap-2 px-3 pb-3 sm:flex sm:px-4 lg:px-6">
              {setAcaoFilter &&
                acoes.map((a) => {
                  const ativo = acaoFilter === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setAcaoFilter(ativo ? "todos" : a.key)}
                      className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${
                        ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground/80 hover:bg-muted"
                      }`}
                    >
                      <span aria-hidden>{a.emoji}</span>
                      {a.rotulo}
                      {typeof a.n === "number" && <span className="font-medium tabular-nums text-muted-foreground">{fmt(a.n)}</span>}
                    </button>
                  );
                })}
              <div className="flex-1" />
              <div role="group" aria-label="Saúde do contato" className="inline-flex h-[34px] items-center gap-0.5 rounded-full border border-border bg-card pl-3 pr-1">
                <span className="mr-1 text-[12.5px] font-semibold text-muted-foreground">Saúde</span>
                {saude.map((s) => {
                  const ativo = clientStatusFilter === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={ativo}
                      title={`${s.rotulo}: ${fmt(s.n)}`}
                      onClick={() => {
                        setNegociosFilter(false);
                        setClientStatusFilter(ativo ? "todos" : s.key);
                      }}
                      className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2 text-[12.5px] font-bold tabular-nums transition-colors ${
                        ativo ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted"
                      }`}
                    >
                      <span aria-hidden className={`h-2 w-2 rounded-full ${s.ponto}`} />
                      {fmt(s.n)}
                      {ativo && <span className="font-semibold">{s.rotulo}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Filtros ativos ── */}
      {(chips.length > 0 || hasAnyFilter) && mostraFerramentas && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-3 py-2 sm:px-4 lg:px-6">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Filtrando</span>
          {chips.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
              {c.label}
              <button type="button" onClick={c.onRemove} aria-label={`Remover ${c.label}`} className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={limparTudo} className="ml-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}
