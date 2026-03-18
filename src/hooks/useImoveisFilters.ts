/**
 * useImoveisFilters — manages all filter state for the Imóveis page.
 *
 * Responsibilities:
 *  - All filter state variables + setters
 *  - URL query param sync (read on init, write on change — debounced)
 *  - Derived filteredBairros list (from dynamic facets)
 *  - Active filter tags (for display + removal)
 *  - clearAllFilters action
 *  - Serialized filterKey for change-detection
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { fmtCompact } from "@/lib/imovelHelpers";
import type { Facet } from "@/hooks/useTypesenseFacets";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── URL param helpers ──

const DEFAULTS = {
  contrato: "venda",
  sortBy: "relevancia",
  areaMin: 0,
  areaMax: 500,
  valorMin: 0,
  valorMax: 5_000_000,
} as const;

function readStr(sp: URLSearchParams, key: string, fallback: string): string {
  return sp.get(key) || fallback;
}

function readArr(sp: URLSearchParams, key: string): string[] {
  const v = sp.get(key);
  return v ? v.split(",").filter(Boolean) : [];
}

function readInt(sp: URLSearchParams, key: string, fallback: number): number {
  const v = sp.get(key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function readBool(sp: URLSearchParams, key: string): boolean {
  return sp.get(key) === "1";
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export function useImoveisFilters(bairroFacets?: Facet[], tipoFacets?: Facet[], construtoraFacets?: Facet[], empreendimentoFacets?: Facet[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitRef = useRef(true);

  // ── Read initial state from URL ──
  const [contrato, setContrato] = useState(() => readStr(searchParams, "contrato", DEFAULTS.contrato));
  const [tipo, setTipo] = useState<string[]>(() => readArr(searchParams, "tipo"));
  const [bairro, setBairro] = useState<string[]>(() => readArr(searchParams, "bairro"));
  const [bairroSearch, setBairroSearch] = useState("");
  const [dormitorios, setDormitorios] = useState<string[]>(() => readArr(searchParams, "dorms"));
  const [suitesFilter, setSuitesFilter] = useState(() => readStr(searchParams, "suites", ""));
  const [vagas, setVagas] = useState(() => readStr(searchParams, "vagas", ""));
  const [areaRange, setAreaRange] = useState<[number, number]>(() => [
    readInt(searchParams, "area_min", DEFAULTS.areaMin),
    readInt(searchParams, "area_max", DEFAULTS.areaMax),
  ]);
  const [valorRange, setValorRange] = useState<[number, number]>(() => [
    readInt(searchParams, "valor_min", DEFAULTS.valorMin),
    readInt(searchParams, "valor_max", DEFAULTS.valorMax),
  ]);
  const [somenteObras, setSomenteObras] = useState(() => readBool(searchParams, "obras"));

  // ── New filters ──
  const [construtora, setConstrutora] = useState<string[]>(() => readArr(searchParams, "construtora"));
  const [construtoraSearch, setConstrutoraSearch] = useState("");
  const [empreendimento, setEmpreendimento] = useState<string[]>(() => readArr(searchParams, "empreendimento"));
  const [empreendimentoSearch, setEmpreendimentoSearch] = useState("");

  // ── Situação filter ──
  const [situacao, setSituacao] = useState<string[]>(() => readArr(searchParams, "situacao"));

  // ── Mode toggles ──
  const [campanhaAtiva, setCampanhaAtiva] = useState(() => readBool(searchParams, "campanha"));
  const [uhomeOnly, setUhomeOnly] = useState(() => readBool(searchParams, "uhome"));

  // ── Search / sort ──
  const [search, setSearch] = useState(() => readStr(searchParams, "q", ""));
  const [sortBy, setSortBy] = useState(() => readStr(searchParams, "sort", DEFAULTS.sortBy));

  // ── Write state to URL (debounced, replaceState to avoid history spam) ──
  const urlWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncToUrl = useCallback(() => {
    const p = new URLSearchParams();

    if (search) p.set("q", search);
    if (contrato !== DEFAULTS.contrato) p.set("contrato", contrato);
    if (tipo.length) p.set("tipo", tipo.join(","));
    if (bairro.length) p.set("bairro", bairro.join(","));
    if (dormitorios.length) p.set("dorms", dormitorios.join(","));
    if (suitesFilter && suitesFilter !== "all") p.set("suites", suitesFilter);
    if (vagas && vagas !== "all") p.set("vagas", vagas);
    if (areaRange[0] > DEFAULTS.areaMin) p.set("area_min", String(areaRange[0]));
    if (areaRange[1] < DEFAULTS.areaMax) p.set("area_max", String(areaRange[1]));
    if (valorRange[0] > DEFAULTS.valorMin) p.set("valor_min", String(valorRange[0]));
    if (valorRange[1] < DEFAULTS.valorMax) p.set("valor_max", String(valorRange[1]));
    if (somenteObras) p.set("obras", "1");
    if (sortBy !== DEFAULTS.sortBy) p.set("sort", sortBy);
    if (uhomeOnly) p.set("uhome", "1");
    if (campanhaAtiva) p.set("campanha", "1");
    if (construtora.length) p.set("construtora", construtora.join(","));
    if (empreendimento.length) p.set("empreendimento", empreendimento.join(","));
    if (situacao.length) p.set("situacao", situacao.join(","));

    setSearchParams(p, { replace: true });
  }, [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva, construtora, empreendimento, situacao, setSearchParams]);

  useEffect(() => {
    // Skip URL write on first render (we just read from URL)
    if (isInitRef.current) {
      isInitRef.current = false;
      return;
    }
    if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current);
    urlWriteTimer.current = setTimeout(syncToUrl, 500);
    return () => { if (urlWriteTimer.current) clearTimeout(urlWriteTimer.current); };
  }, [syncToUrl]);

  // ── Derived: filteredBairros from dynamic facets ──
  const allBairros = useMemo(() => bairroFacets || [], [bairroFacets]);
  const filteredBairros = useMemo(() => {
    if (!bairroSearch) return allBairros;
    const q = bairroSearch.toLowerCase();
    return allBairros.filter((b) => b.value.toLowerCase().includes(q));
  }, [bairroSearch, allBairros]);

  // ── Derived: tipoOptions from dynamic facets ──
  const tipoOptions = useMemo(() => tipoFacets || [], [tipoFacets]);

  // ── Derived: construtora options ──
  const allConstrutoras = useMemo(() => construtoraFacets || [], [construtoraFacets]);
  const filteredConstrutoras = useMemo(() => {
    if (!construtoraSearch) return allConstrutoras;
    const q = construtoraSearch.toLowerCase();
    return allConstrutoras.filter((c) => c.value.toLowerCase().includes(q));
  }, [construtoraSearch, allConstrutoras]);

  // ── Derived: empreendimento options ──
  const allEmpreendimentos = useMemo(() => empreendimentoFacets || [], [empreendimentoFacets]);
  const filteredEmpreendimentos = useMemo(() => {
    if (!empreendimentoSearch) return allEmpreendimentos;
    const q = empreendimentoSearch.toLowerCase();
    return allEmpreendimentos.filter((e) => e.value.toLowerCase().includes(q));
  }, [empreendimentoSearch, allEmpreendimentos]);

  // ── Active filter tags ──
  const activeFilters: ActiveFilter[] = [];
  if (search) activeFilters.push({ key: "search", label: `"${search}"`, onRemove: () => setSearch("") });
  if (tipo.length > 0) activeFilters.push({ key: "tipo", label: tipo.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", "), onRemove: () => setTipo([]) });
  if (bairro.length > 0) activeFilters.push({ key: "bairro", label: bairro.join(", "), onRemove: () => setBairro([]) });
  if (dormitorios.length > 0) activeFilters.push({ key: "dorms", label: dormitorios.map(d => `${d} dorm`).join(", "), onRemove: () => setDormitorios([]) });
  if (suitesFilter && suitesFilter !== "all") activeFilters.push({ key: "suites", label: `${suitesFilter}+ suíte`, onRemove: () => setSuitesFilter("") });
  if (vagas && vagas !== "all") activeFilters.push({ key: "vagas", label: `${vagas}+ vaga`, onRemove: () => setVagas("") });
  if (valorRange[0] > 0 || valorRange[1] < 5_000_000) activeFilters.push({ key: "valor", label: `${fmtCompact(valorRange[0])} — ${valorRange[1] >= 5_000_000 ? "5M+" : fmtCompact(valorRange[1])}`, onRemove: () => setValorRange([0, 5_000_000]) });
  if (areaRange[0] > 0 || areaRange[1] < 500) activeFilters.push({ key: "area", label: `${areaRange[0]}m² — ${areaRange[1] >= 500 ? "500+" : areaRange[1]}m²`, onRemove: () => setAreaRange([0, 500]) });
  if (somenteObras) activeFilters.push({ key: "obras", label: "Em obras", onRemove: () => setSomenteObras(false) });
  if (uhomeOnly) activeFilters.push({ key: "uhome", label: "uHome", onRemove: () => setUhomeOnly(false) });
  if (campanhaAtiva) activeFilters.push({ key: "campanha", label: "Campanha", onRemove: () => setCampanhaAtiva(false) });
  if (construtora.length > 0) activeFilters.push({ key: "construtora", label: construtora.join(", "), onRemove: () => setConstrutora([]) });
  if (empreendimento.length > 0) activeFilters.push({ key: "empreendimento", label: empreendimento.length <= 2 ? empreendimento.join(", ") : `${empreendimento.length} empreend.`, onRemove: () => setEmpreendimento([]) });
  if (situacao.length > 0) activeFilters.push({ key: "situacao", label: situacao.map(s => s === "pronto" ? "Pronto" : s === "em_obras" ? "Em obras" : "Lançamento").join(", "), onRemove: () => setSituacao([]) });

  const clearAllFilters = () => {
    setTipo([]); setBairro([]); setDormitorios([]); setSuitesFilter(""); setVagas("");
    setAreaRange([0, 500]); setValorRange([0, 5_000_000]); setSomenteObras(false);
    setSearch(""); setUhomeOnly(false); setCampanhaAtiva(false);
    setConstrutora([]); setEmpreendimento([]); setSituacao([]);
  };

  // ── Serialized key for change-detection by search hook ──
  const filterKey = useMemo(() =>
    JSON.stringify({ search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva, construtora, empreendimento, situacao }),
    [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva, construtora, empreendimento, situacao]
  );

  return {
    // Filter state + setters
    contrato, setContrato,
    tipo, setTipo,
    bairro, setBairro,
    bairroSearch, setBairroSearch,
    dormitorios, setDormitorios,
    suitesFilter, setSuitesFilter,
    vagas, setVagas,
    areaRange, setAreaRange,
    valorRange, setValorRange,
    somenteObras, setSomenteObras,
    campanhaAtiva, setCampanhaAtiva,
    uhomeOnly, setUhomeOnly,
    search, setSearch,
    sortBy, setSortBy,
    construtora, setConstrutora,
    construtoraSearch, setConstrutoraSearch,
    empreendimento, setEmpreendimento,
    empreendimentoSearch, setEmpreendimentoSearch,
    situacao, setSituacao,
    // Derived
    filteredBairros,
    tipoOptions,
    filteredConstrutoras,
    filteredEmpreendimentos,
    activeFilters,
    clearAllFilters,
    filterKey,
  };
}
