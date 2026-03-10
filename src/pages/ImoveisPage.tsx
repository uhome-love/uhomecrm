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

/* eslint-disable @typescript-eslint/no-explicit-any */

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Extract thumbnail URL (fastest) from Jetimob imagens array */
function extractImage(item: any): string | null {
  const arr = item.imagens;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[0].link_thumb || arr[0].link || null;
  }
  return null;
}

/** Extract address/location from Jetimob fields */
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

  const [search, setSearch] = useState("");
  const [contrato, setContrato] = useState("venda");
  const [tipo, setTipo] = useState("");
  const [cidade, setCidade] = useState("Porto Alegre");
  const [bairro, setBairro] = useState("");
  const [dormitorios, setDormitorios] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

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
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [search, contrato, tipo, cidade, bairro, dormitorios, valorMin, valorMax]);

  useEffect(() => {
    fetchImoveis(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => fetchImoveis(1);

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bairro</label>
            <Input
              placeholder="Qualquer bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cidade</label>
            <Input
              placeholder="Porto Alegre"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
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
              const codigo = item.codigo || item.code || item.referencia || item.id;
              const tipoImovel = item.tipo || "";
              const subtipo = item.subtipo || "";
              const dorms = getNum(item, "dormitorios");
              const suites = getNum(item, "suites");
              const banhos = getNum(item, "banheiros");
              const area = getNumIncZero(item, "area_privativa", "area_util", "area_total");
              const vagas = getNum(item, "garagens", "vagas");
              const cond = getNum(item, "valor_condominio");
              const disponib = item.situacao || item.status || "";

              return (
                <Card key={item.id || codigo || idx} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="flex">
                    {/* Image */}
                    <div className="w-40 h-40 flex-shrink-0 bg-muted relative">
                      {img ? (
                        <img src={img} alt={loc.endereco} className="w-full h-full object-cover" loading="lazy" />
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
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        {loc.endereco && (
                          <p className="text-sm font-semibold text-foreground truncate">
                            {loc.endereco}
                          </p>
                        )}
                        {(loc.bairro || loc.cidade) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {[loc.bairro, loc.cidade].filter(Boolean).join(" · ")}
                            </span>
                          </p>
                        )}

                        <div className="flex items-center gap-1 text-xs flex-wrap">
                          {tipoImovel && <Badge variant="outline" className="text-[10px] h-5">{tipoImovel}</Badge>}
                          {subtipo && <Badge variant="outline" className="text-[10px] h-5">{subtipo}</Badge>}
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

          {totalPages > 1 && (
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
