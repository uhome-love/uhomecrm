import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2 } from "lucide-react";
import type { ShowcaseData, ShowcaseImovel } from "@/components/showcase/types";
import ProductPageLayout from "@/components/showcase/ProductPageLayout";
import PropertySelectionLayout from "@/components/showcase/PropertySelectionLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function sanitizeImovel(item: any): ShowcaseImovel | null {
  if (!item || typeof item !== "object") return null;
  return {
    id: Number(item.id) || 0,
    codigo: typeof item.codigo === "string" ? item.codigo : undefined,
    titulo: item.titulo || "Imóvel",
    endereco: item.endereco ?? null,
    bairro: item.bairro ?? null,
    cidade: item.cidade ?? null,
    area: typeof item.area === "number" ? item.area : null,
    quartos: typeof item.quartos === "number" ? item.quartos : null,
    suites: typeof item.suites === "number" ? item.suites : null,
    vagas: typeof item.vagas === "number" ? item.vagas : null,
    banheiros: typeof item.banheiros === "number" ? item.banheiros : null,
    valor: typeof item.valor === "number" ? item.valor : null,
    fotos: Array.isArray(item.fotos) ? item.fotos.filter((f: unknown) => typeof f === "string" && f.length > 0) : [],
    empreendimento: item.empreendimento ?? null,
    descricao: item.descricao ?? null,
    lat: typeof item.lat === "number" ? item.lat : (typeof item.lat === "string" ? Number(item.lat) : null),
    lng: typeof item.lng === "number" ? item.lng : (typeof item.lng === "string" ? Number(item.lng) : null),
    precoDe: item.precoDe ?? null,
    precoPor: item.precoPor ?? null,
    descontoMax: item.descontoMax ?? null,
    status: item.status ?? null,
    metragens: item.metragens ?? null,
    dorms: item.dorms ?? null,
    condicoes: item.condicoes ?? null,
    segmento: item.segmento ?? null,
  };
}

function sanitizeShowcaseData(raw: any): ShowcaseData | null {
  if (!raw?.vitrine?.id) return null;

  const imoveis = Array.isArray(raw.imoveis)
    ? raw.imoveis.map(sanitizeImovel).filter(Boolean) as ShowcaseImovel[]
    : [];

  return {
    vitrine: {
      id: raw.vitrine.id,
      titulo: raw.vitrine.titulo || "Vitrine",
      subtitulo: raw.vitrine.subtitulo ?? null,
      mensagem: raw.vitrine.mensagem ?? null,
      created_at: raw.vitrine.created_at || new Date().toISOString(),
      tipo: raw.vitrine.tipo || "property_selection",
    },
    corretor: raw.corretor && typeof raw.corretor === "object"
      ? {
          nome: raw.corretor.nome || "Consultor",
          telefone: raw.corretor.telefone ?? null,
          avatar_url: raw.corretor.avatar_url ?? null,
        }
      : null,
    imoveis,
    landing: raw.landing && typeof raw.landing === "object" ? raw.landing : null,
  };
}

function RuntimeSafeFallback({ data }: { data: ShowcaseData }) {
  const safeImoveis = Array.isArray(data?.imoveis) ? data.imoveis : [];

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900">{data?.vitrine?.titulo || "Vitrine"}</h1>
        <p className="text-slate-500 mt-2">Alguns componentes falharam, mas os imóveis continuam disponíveis abaixo.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {safeImoveis.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {item.fotos?.[0] ? (
                  <img src={item.fotos[0]} alt={item.empreendimento || item.titulo} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-slate-800">{item.empreendimento || item.titulo || "Imóvel"}</p>
                <p className="text-sm text-slate-500">{item.bairro || "-"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VitrinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!id) {
      setFatalError("Link inválido.");
      setLoading(false);
      return;
    }

    let active = true;

    const fetchVitrine = async () => {
      console.log("[Vitrine] iniciando fetch", { vitrineId: id, attempt: retryCountRef.current });
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("vitrine-public", {
          body: { action: "get_vitrine", vitrine_id: id },
        });

        if (!active) return;
        if (fnError) throw fnError;
        if (result?.error) throw new Error(result.error);

        const sanitized = sanitizeShowcaseData(result);
        if (!sanitized) throw new Error("Dados de vitrine inválidos");

        console.log("[Vitrine] imóveis carregados", { total: sanitized.imoveis.length });

        // If 0 imóveis and haven't retried yet, retry after 3s
        if (sanitized.imoveis.length === 0 && retryCountRef.current < 1) {
          console.log("[Vitrine] 0 imóveis, retrying in 3s...");
          retryCountRef.current++;
          setTimeout(() => { if (active) fetchVitrine(); }, 3000);
          return;
        }

        setData(sanitized);
      } catch (err: any) {
        console.error("[Vitrine] erro capturado", err);
        if (!active) return;
        // Retry once on error
        if (retryCountRef.current < 1) {
          retryCountRef.current++;
          setTimeout(() => { if (active) fetchVitrine(); }, 2000);
          return;
        }
        setFatalError(err?.message || "Erro ao carregar vitrine");
      } finally {
        if (active && retryCountRef.current >= 1) setLoading(false);
        else if (active && data) setLoading(false);
      }
    };

    fetchVitrine().then(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    console.log("[Vitrine] transformação dos imóveis concluída", { total: data.imoveis.length });
    queueMicrotask(() => console.log("[Vitrine] primeiro render concluído"));
  }, [data]);

  const tipo = data?.vitrine?.tipo || "property_selection";

  const layout = useMemo(() => {
    if (!data) return null;

    switch (tipo) {
      case "product_page":
      case "anuncio":
        return <ProductPageLayout data={data} />;
      case "property_selection":
      case "jetimob":
      default:
        if (data.landing && data.imoveis.length <= 1) {
          return <ProductPageLayout data={data} />;
        }
        return <PropertySelectionLayout data={data} />;
    }
  }, [data, tipo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (fatalError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Vitrine não disponível</h1>
          <p className="text-slate-500">{fatalError || "O link pode ter expirado."}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, stack) => {
        console.error("[Vitrine] erro capturado com stack trace", {
          message: error?.message,
          stack,
        });
      }}
      fallback={<RuntimeSafeFallback data={data} />}
    >
      {layout}
    </ErrorBoundary>
  );
}

