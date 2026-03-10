import React, { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Building2, Loader2, ChevronLeft, ChevronRight, Home, BedDouble, Bath, Maximize, MapPin, Car, Megaphone, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Códigos dos imóveis com campanha de leads ativa */
const CAMPANHA_CODES: { codigo: string; nome: string }[] = [
  { codigo: "97325-UH", nome: "Shift" },
  { codigo: "32849-UH", nome: "Open Bosque" },
  { codigo: "57920-UH", nome: "Orygem" },
  { codigo: "39808-UH", nome: "Melnick Day - Compactos" },
  { codigo: "58935-UH", nome: "Lake Eyre" },
  { codigo: "4688-UH", nome: "Casa Bastian" },
  { codigo: "52101-UH", nome: "Casa Tua" },
  { codigo: "41190-UH", nome: "Las Casas" },
];

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

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function extractImage(item: any): string | null {
  const arr = item.imagens;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[0].link_thumb || arr[0].link || null;
  }
  return null;
}

function extractEndereco(item: any): { endereco: string; bairro: string; cidade: string } {
  const logradouro = item.endereco_logradouro || item.endereco || item.logradouro || "";
  const numero = item.endereco_numero || item.numero || "";
  const bairro = item.endereco_bairro || item.bairro || "";
  const cidade = item.endereco_cidade || item.cidade || "";
  return {
    endereco: `${logradouro}${numero ? `, ${numero}` : ""}`.trim(),
    bairro,
    cidade,
  };
}

function getNum(item: any, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && v !== "" && v !== 0 && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

function getNumIncZero(item: any, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && v !== "" && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

export default function ImoveisPage() {
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const [uhomeOnly, setUhomeOnly] = useState(false);

  const [search, setSearch] = useState("");
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState("");
  const [bairro, setBairro] = useState("");
  const [bairroOpen, setBairroOpen] = useState(false);
  const [bairroSearch, setBairroSearch] = useState("");
  const [dormitorios, setDormitorios] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  const filteredBairros = useMemo(() => {
    if (!bairroSearch) return BAIRROS_POA;
    const q = bairroSearch.toLowerCase();
    return BAIRROS_POA.filter((b) => b.toLowerCase().includes(q));
  }, [bairroSearch]);

  const fetchImoveis = useCallback(async (pageNum: number, campanha = campanhaAtiva) => {
    setLoading(true);
    try {
      if (campanha) {
        // Fetch each campaign property by code in parallel
        const results = await Promise.all(
          CAMPANHA_CODES.map((c) =>
            supabase.functions.invoke("jetimob-proxy", {
              body: { action: "get_imovel", codigo: c.codigo },
            })
          )
        );
        const items = results
          .map((r) => r.data?.data || r.data)
          .filter((d) => d && !d.not_found);
        setImoveis(items);
        setTotal(items.length);
        setTotalPages(1);
        setPage(1);
      } else {
        const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
          body: {
            action: "list_imoveis",
            page: pageNum,
            pageSize: 20,
            search: search || undefined,
            contrato: contrato || undefined,
            tipo: tipo && tipo !== "all" ? tipo : undefined,
            cidade: "Porto Alegre",
            bairro: bairro || undefined,
            search_uhome: uhome ? true : undefined,
            dormitorios: dormitorios && dormitorios !== "all" ? dormitorios : undefined,
            valor_min: valorMin || undefined,
            valor_max: valorMax || undefined,
          },
        });

        if (error) {
          toast.error("Erro ao buscar imóveis");
          console.error("jetimob-proxy error:", error);
          return;
        }

        const items = Array.isArray(data?.data) ? data.data : [];
        setImoveis(items);
        setTotal(data?.total || items.length);
        setTotalPages(data?.totalPages || Math.ceil((data?.total || items.length) / 20));
        setPage(pageNum);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [search, contrato, tipo, bairro, dormitorios, valorMin, valorMax, campanhaAtiva, uhomeOnly]);

  const mounted = React.useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchImoveis(1, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setCampanhaAtiva(false);
    setUhomeOnly(false);
    fetchImoveis(1, false, false);
  };

  const handleCampanha = () => {
    const next = !campanhaAtiva;
    setCampanhaAtiva(next);
    setUhomeOnly(false);
    fetchImoveis(1, next, false);
  };

  const handleUhome = () => {
    const next = !uhomeOnly;
    setUhomeOnly(next);
    setCampanhaAtiva(false);
    fetchImoveis(1, false, next);
  };

  const getPreco = (item: any): string => {
    const venda = getNum(item, "valor_venda", "preco_venda", "valor", "price");
    const locacao = getNum(item, "valor_locacao", "preco_locacao", "valor_aluguel");
    if (contrato === "locacao" && locacao) return fmtBRL(locacao);
    if (venda) return fmtBRL(venda);
    if (locacao) return fmtBRL(locacao);
    return "Consultar";
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Imóveis Jetimob
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Porto Alegre · Consulte imóveis para sugerir aos seus clientes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleUhome}
            variant={uhomeOnly ? "default" : "outline"}
            size="sm"
            className={cn("gap-2 font-semibold", uhomeOnly && "bg-primary text-primary-foreground")}
          >
            <Building2 className="h-4 w-4" />
            {uhomeOnly ? "Mostrando uHome" : "Imóveis uHome"}
          </Button>
          <Button
            onClick={handleCampanha}
            variant={campanhaAtiva ? "default" : "outline"}
            size="sm"
            className={cn("gap-2 font-semibold", campanhaAtiva && "bg-primary text-primary-foreground")}
          >
            <Megaphone className="h-4 w-4" />
            {campanhaAtiva ? "Mostrando campanhas" : "Campanha de Leads Ativa"}
          </Button>
        </div>
      </div>

      {/* Campaign chips when active */}
      {campanhaAtiva && (
        <div className="flex flex-wrap gap-2">
          {CAMPANHA_CODES.map((c) => (
            <Badge key={c.codigo} variant="secondary" className="text-xs">
              {c.nome} ({c.codigo})
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      {!campanhaAtiva && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Busca livre</label>
              <Input
                placeholder="Endereço, código, condomínio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contrato</label>
              <Select value={contrato} onValueChange={setContrato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="locacao">Locação</SelectItem>
                  <SelectItem value="temporada">Temporada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="cobertura">Cobertura</SelectItem>
                  <SelectItem value="duplex">Duplex</SelectItem>
                  <SelectItem value="loft">Loft</SelectItem>
                  <SelectItem value="kitnet">Kitnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dormitórios</label>
              <Select value={dormitorios} onValueChange={setDormitorios}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Bairro</label>
              <Popover open={bairroOpen} onOpenChange={setBairroOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bairroOpen}
                    className="w-full justify-between font-normal h-9 text-sm"
                  >
                    {bairro || "Todos os bairros"}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar bairro..."
                      value={bairroSearch}
                      onValueChange={setBairroSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {bairroSearch ? (
                          <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded"
                            onClick={() => {
                              setBairro(bairroSearch);
                              setBairroOpen(false);
                              setBairroSearch("");
                            }}
                          >
                            Usar "<strong>{bairroSearch}</strong>"
                          </button>
                        ) : (
                          "Nenhum bairro encontrado"
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__todos__"
                          onSelect={() => {
                            setBairro("");
                            setBairroOpen(false);
                            setBairroSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-3 w-3", !bairro ? "opacity-100" : "opacity-0")} />
                          Todos os bairros
                        </CommandItem>
                        {filteredBairros.map((b) => (
                          <CommandItem
                            key={b}
                            value={b}
                            onSelect={() => {
                              setBairro(b);
                              setBairroOpen(false);
                              setBairroSearch("");
                            }}
                          >
                            <Check className={cn("mr-2 h-3 w-3", bairro === b ? "opacity-100" : "opacity-0")} />
                            {b}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Valor mínimo</label>
              <Input
                type="number"
                placeholder="Ex: 300000"
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Valor máximo</label>
              <Input
                type="number"
                placeholder="Ex: 800000"
                value={valorMax}
                onChange={(e) => setValorMax(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
            {total > 0 && (
              <span className="text-sm text-muted-foreground">
                {total.toLocaleString()} imóveis encontrados
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex">
                <Skeleton className="w-40 h-40 flex-shrink-0 rounded-none" />
                <div className="flex-1 p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-5 w-1/3 mt-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : imoveis.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel encontrado</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imoveis.map((item, idx) => {
              const img = extractImage(item);
              const loc = extractEndereco(item);
              const codigo = item.codigo;
              const titulo = item.titulo_anuncio || "";
              const tipoImovel = item.subtipo || item.tipo || "";
              const dorms = getNum(item, "dormitorios");
              const suites = getNum(item, "suites");
              const banhos = getNum(item, "banheiros");
              const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
              const vagas = getNum(item, "garagens", "vagas");
              const cond = getNum(item, "valor_condominio");
              const disponib = item.situacao || item.status || "";
              const isCampanha = CAMPANHA_CODES.some((c) => c.codigo === codigo);

              return (
                <Card key={item.id_imovel || codigo || idx} className={cn("overflow-hidden hover:shadow-lg transition-shadow", isCampanha && "ring-1 ring-primary/30")}>
                  <div className="flex">
                    {/* Image */}
                    <div className="w-40 h-40 flex-shrink-0 bg-muted relative">
                      {img ? (
                        <img src={img} alt={titulo || loc.endereco} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      {codigo && (
                        <Badge variant="secondary" className="absolute bottom-1 left-1 text-[10px]">
                          {codigo}
                        </Badge>
                      )}
                      {isCampanha && (
                        <Badge className="absolute top-1 right-1 text-[10px] bg-primary text-primary-foreground">
                          <Megaphone className="h-2.5 w-2.5 mr-0.5" /> Campanha
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        {titulo && (
                          <p className="text-sm font-semibold text-foreground truncate" title={titulo}>
                            {titulo}
                          </p>
                        )}
                        {(loc.bairro || loc.cidade || loc.endereco) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {[loc.endereco, loc.bairro, loc.cidade].filter(Boolean).join(" · ")}
                            </span>
                          </p>
                        )}

                        <div className="flex items-center gap-1 text-xs flex-wrap">
                          {tipoImovel && <Badge variant="outline" className="text-[10px] h-5">{tipoImovel}</Badge>}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {dorms != null && dorms > 0 && (
                            <span className="flex items-center gap-0.5">
                              <BedDouble className="h-3 w-3" /> {dorms}
                              {suites != null && suites > 0 && <span className="text-[10px]">({suites}s)</span>}
                            </span>
                          )}
                          {banhos != null && banhos > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Bath className="h-3 w-3" /> {banhos}
                            </span>
                          )}
                          {area != null && area > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Maximize className="h-3 w-3" /> {area}m²
                            </span>
                          )}
                          {vagas != null && vagas > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Car className="h-3 w-3" /> {vagas}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <p className="text-sm font-bold text-primary">{getPreco(item)}</p>
                          {cond != null && cond > 0 && (
                            <p className="text-[10px] text-muted-foreground">Cond. {fmtBRL(cond)}</p>
                          )}
                        </div>
                        {disponib && (
                          <Badge variant={disponib === "disponivel" ? "default" : "secondary"} className="text-[10px]">
                            {disponib}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && !campanhaAtiva && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchImoveis(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => fetchImoveis(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
