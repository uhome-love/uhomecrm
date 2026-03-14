/**
 * useImoveisFilters — manages all filter state for the Imóveis page.
 *
 * Responsibilities:
 *  - All filter state variables + setters
 *  - Derived filteredBairros list
 *  - Active filter tags (for display + removal)
 *  - clearAllFilters action
 *  - Serialized filterKey for change-detection
 */

import { useState, useMemo } from "react";
import { fmtCompact } from "@/lib/imovelHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BAIRROS_POA = [
  "Auxiliadora", "Bela Vista", "Bom Fim", "Camaquã", "Cavalhada",
  "Centro Histórico", "Chácara das Pedras", "Cidade Baixa", "Cristal",
  "Farroupilha", "Floresta", "Higienópolis", "Humaitá", "Independência",
  "Ipanema", "Jardim Botânico", "Jardim do Salso", "Jardim Europa",
  "Jardim Isabel", "Jardim Lindóia", "Jardim Planalto", "Jardim São Pedro",
  "Lami", "Lomba do Pinheiro", "Medianeira", "Menino Deus", "Moinhos de Vento",
  "Mont'Serrat", "Navegantes", "Nonoai", "Partenon", "Passo d'Areia",
  "Pedra Redonda", "Petrópolis", "Praia de Belas", "Rio Branco",
  "Santa Cecília", "Santa Tereza", "Santana", "Santo Antônio",
  "São Geraldo", "São João", "São José", "São Sebastião",
  "Teresópolis", "Três Figueiras", "Tristeza", "Vila Assunção",
  "Vila Conceição", "Vila Ipiranga", "Vila Jardim", "Vila Nova",
];

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export function useImoveisFilters() {
  // ── Core filter state ──
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState<string[]>([]);
  const [bairro, setBairro] = useState<string[]>([]);
  const [bairroSearch, setBairroSearch] = useState("");
  const [dormitorios, setDormitorios] = useState<string[]>([]);
  const [suitesFilter, setSuitesFilter] = useState("");
  const [vagas, setVagas] = useState("");
  const [areaRange, setAreaRange] = useState<[number, number]>([0, 500]);
  const [valorRange, setValorRange] = useState<[number, number]>([0, 5_000_000]);
  const [somenteObras, setSomenteObras] = useState(false);

  // ── Mode toggles ──
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [uhomeOnly, setUhomeOnly] = useState(false);

  // ── Search / sort ──
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("relevancia");

  // ── Derived ──
  const filteredBairros = useMemo(() => {
    if (!bairroSearch) return BAIRROS_POA;
    const q = bairroSearch.toLowerCase();
    return BAIRROS_POA.filter((b) => b.toLowerCase().includes(q));
  }, [bairroSearch]);

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

  const clearAllFilters = () => {
    setTipo([]); setBairro([]); setDormitorios([]); setSuitesFilter(""); setVagas("");
    setAreaRange([0, 500]); setValorRange([0, 5_000_000]); setSomenteObras(false);
    setSearch(""); setUhomeOnly(false); setCampanhaAtiva(false);
  };

  // ── Serialized key for change-detection by search hook ──
  const filterKey = useMemo(() =>
    JSON.stringify({ search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva }),
    [search, contrato, tipo, bairro, dormitorios, suitesFilter, vagas, areaRange, valorRange, somenteObras, sortBy, uhomeOnly, campanhaAtiva]
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
    // Derived
    filteredBairros,
    activeFilters,
    clearAllFilters,
    filterKey,
  };
}
