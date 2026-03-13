import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2 } from "lucide-react";
import type { ShowcaseData } from "@/components/showcase/types";
import ProductPageLayout from "@/components/showcase/ProductPageLayout";
import MelnickDayLayout from "@/components/showcase/MelnickDayLayout";
import PropertySelectionLayout from "@/components/showcase/PropertySelectionLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function VitrinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        console.log("[Vitrine] Fetching data for:", id);
        const { data: result, error: fnError } = await supabase.functions.invoke("vitrine-public", {
          body: { action: "get_vitrine", vitrine_id: id },
        });
        if (fnError) throw fnError;
        if (result?.error) {
          console.error("[Vitrine] API error:", result.error);
          setError(result.error);
        } else {
          console.log("[Vitrine] Data loaded:", {
            tipo: result?.vitrine?.tipo,
            imoveis: result?.imoveis?.length,
            hasLanding: !!result?.landing,
            hasCorretor: !!result?.corretor,
          });
          // Sanitize imoveis array
          if (result?.imoveis && Array.isArray(result.imoveis)) {
            result.imoveis = result.imoveis.filter((i: any) => i != null);
          }
          setData(result);
        }
      } catch (err: any) {
        console.error("[Vitrine] Fetch error:", err);
        setError(err.message || "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Vitrine não disponível</h1>
          <p className="text-slate-500">{error || "O link pode ter expirado."}</p>
        </div>
      </div>
    );
  }

  const tipo = data.vitrine.tipo || "property_selection";

  const renderLayout = () => {
    switch (tipo) {
      case "melnick_day":
      case "mega_cyrela":
        return <MelnickDayLayout data={data} />;
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
  };

  return (
    <ErrorBoundary
      onError={(error, stack) => {
        console.error("[Vitrine] Runtime error in layout:", error.message);
        console.error("[Vitrine] Stack:", stack);
      }}
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Building2 className="h-8 w-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Erro ao abrir vitrine</h1>
            <p className="text-slate-500">Tente gerar o link novamente na página de imóveis.</p>
          </div>
        </div>
      }
    >
      {renderLayout()}
    </ErrorBoundary>
  );
}
