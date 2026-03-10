import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building2, Loader2, ChevronLeft, ChevronRight, Home, BedDouble, Bath, Maximize, MapPin, Car } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

interface Imovel {
  id: number;
  codigo: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  tipo?: string;
  subtipo?: string;
  contrato?: string;
  valor_venda?: number;
  valor_locacao?: number;
  condominio?: number;
  iptu?: number;
  area_total?: number;
  area_privativa?: number;
  dormitorios?: number;
  suites?: number;
  banheiros?: number;
  vagas?: number;
  fotos?: { url: string; descricao?: string }[];
  foto_principal?: string;
  imagens?: { url: string }[];
  status?: string;
  disponibilidade?: string;
  descricao?: string;
  caracteristicas?: string[];
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ImoveisPage() {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("Porto Alegre");
  const [bairro, setBairro] = useState("");

  const fetchImoveis = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("jetimob-proxy", {
        body: {
          action: "list_imoveis",
          page: pageNum,
          pageSize: 20,
          search: search || undefined,
          contrato: contrato || undefined,
          tipo: tipo && tipo !== "all" ? tipo : undefined,
          cidade: cidade || undefined,
          bairro: bairro || undefined,
        },
      });

      if (error) {
        toast.error("Erro ao buscar imóveis");
        console.error("jetimob-proxy error:", error);
        return;
      }

      const results = data?.result || data?.imoveis || data?.data || [];
      const items = Array.isArray(results) ? results : [];
      setImoveis(items);
      setTotal(data?.total || data?.count || items.length);
      setTotalPages(data?.totalPages || data?.pages || Math.ceil((data?.total || items.length) / 20));
      setPage(pageNum);
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão com Jetimob");
    } finally {
      setLoading(false);
    }
  }, [search, contrato, tipo, cidade, bairro]);

  // Auto-load on mount
  useEffect(() => {
    fetchImoveis(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => fetchImoveis(1);

  const getImageUrl = (imovel: Imovel): string | null => {
    if (imovel.foto_principal) return imovel.foto_principal;
    if (imovel.fotos?.length) return imovel.fotos[0].url;
    if (imovel.imagens?.length) return imovel.imagens[0].url;
    return null;
  };

  const getPreco = (imovel: Imovel): string => {
    if (contrato === "locacao" && imovel.valor_locacao) return fmtBRL(imovel.valor_locacao);
    if (imovel.valor_venda) return fmtBRL(imovel.valor_venda);
    if (imovel.valor_locacao) return fmtBRL(imovel.valor_locacao);
    return "Consultar";
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Imóveis Jetimob
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulte imóveis para sugerir aos seus clientes
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Busca</label>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="cobertura">Cobertura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bairro</label>
            <Input
              placeholder="Qualquer bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
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
            {imoveis.map((imovel) => {
              const img = getImageUrl(imovel);
              return (
                <Card key={imovel.id || imovel.codigo} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="flex">
                    <div className="w-40 h-40 flex-shrink-0 bg-muted relative">
                      {img ? (
                        <img src={img} alt={imovel.endereco || ""} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <Badge variant="secondary" className="absolute bottom-1 left-1 text-[10px]">
                        {imovel.codigo}
                      </Badge>
                    </div>

                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {imovel.endereco}{imovel.numero ? `, ${imovel.numero}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {[imovel.bairro, imovel.cidade].filter(Boolean).join(" · ")}
                          </span>
                        </p>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                          {imovel.tipo && <Badge variant="outline" className="text-[10px] h-5">{imovel.tipo}</Badge>}
                          {imovel.subtipo && <Badge variant="outline" className="text-[10px] h-5">{imovel.subtipo}</Badge>}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {(imovel.dormitorios ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <BedDouble className="h-3 w-3" /> {imovel.dormitorios}
                              {(imovel.suites ?? 0) > 0 && <span className="text-[10px]">({imovel.suites}s)</span>}
                            </span>
                          )}
                          {(imovel.banheiros ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Bath className="h-3 w-3" /> {imovel.banheiros}
                            </span>
                          )}
                          {(imovel.area_privativa ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Maximize className="h-3 w-3" /> {imovel.area_privativa}m²
                            </span>
                          )}
                          {(imovel.vagas ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Car className="h-3 w-3" /> {imovel.vagas}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <p className="text-sm font-bold text-primary">{getPreco(imovel)}</p>
                          {(imovel.condominio ?? 0) > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              Cond. {fmtBRL(imovel.condominio!)}
                            </p>
                          )}
                        </div>
                        {imovel.disponibilidade && (
                          <Badge
                            variant={imovel.disponibilidade === "disponivel" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {imovel.disponibilidade}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchImoveis(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} de {totalPages}
              </span>
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
