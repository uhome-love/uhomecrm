import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, MapPin, BedDouble, Car, Maximize, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface VitrineImovel {
  id: number;
  titulo: string;
  endereco: string | null;
  area: number | null;
  quartos: number | null;
  vagas: number | null;
  valor: number | null;
  fotos: string[];
  empreendimento: string | null;
}

interface VitrineData {
  vitrine: { id: string; titulo: string; mensagem: string | null; created_at: string };
  corretor: { nome: string; telefone: string | null; avatar_url: string | null } | null;
  imoveis: VitrineImovel[];
}

export default function VitrinePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VitrineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ fotos: string[]; idx: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchVitrine = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("vitrine-public", {
          body: { action: "get_vitrine", vitrine_id: id },
        });
        if (fnError) throw fnError;
        if (result?.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err: any) {
        setError(err.message || "Erro ao carregar vitrine");
      } finally {
        setLoading(false);
      }
    };
    fetchVitrine();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Vitrine não encontrada</h1>
          <p className="text-muted-foreground">{error || "O link pode ter expirado."}</p>
        </div>
      </div>
    );
  }

  const { vitrine, corretor, imoveis } = data;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const whatsappLink = corretor?.telefone
    ? `https://wa.me/55${corretor.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá ${corretor.nome}! Vi a seleção de imóveis "${vitrine.titulo}" e gostaria de mais informações.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{vitrine.titulo}</h1>
            {corretor && <p className="text-sm text-muted-foreground">Seleção por {corretor.nome}</p>}
          </div>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                <Phone className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          )}
        </div>
      </header>

      {/* Message */}
      {vitrine.mensagem && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-foreground">
            {vitrine.mensagem}
          </div>
        </div>
      )}

      {/* Imoveis Grid */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {imoveis.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum imóvel encontrado.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {imoveis.map((imovel) => (
              <div key={imovel.id} className="bg-card rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Photo carousel */}
                {imovel.fotos.length > 0 && (
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    <img
                      src={imovel.fotos[0]}
                      alt={imovel.titulo}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightbox({ fotos: imovel.fotos, idx: 0 })}
                    />
                    {imovel.fotos.length > 1 && (
                      <button
                        onClick={() => setLightbox({ fotos: imovel.fotos, idx: 0 })}
                        className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full px-2.5 py-1 text-xs flex items-center gap-1"
                      >
                        <Maximize className="h-3 w-3" /> {imovel.fotos.length} fotos
                      </button>
                    )}
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground">{imovel.titulo}</h3>
                  {imovel.empreendimento && (
                    <p className="text-xs text-primary font-medium">{imovel.empreendimento}</p>
                  )}
                  {imovel.endereco && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {imovel.endereco}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {imovel.area && <span>{imovel.area}m²</span>}
                    {imovel.quartos && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5" /> {imovel.quartos}
                      </span>
                    )}
                    {imovel.vagas && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3.5 w-3.5" /> {imovel.vagas}
                      </span>
                    )}
                  </div>
                  {imovel.valor && (
                    <p className="text-lg font-bold text-primary">{formatCurrency(imovel.valor)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Seleção personalizada por {corretor?.nome || "UHome"}</p>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Fale com o corretor
            </a>
          )}
        </div>
      </footer>

      {/* Lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
            <div className="relative">
              <img
                src={lightbox.fotos[lightbox.idx]}
                alt=""
                className="w-full max-h-[80vh] object-contain"
              />
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5"
              >
                <X className="h-5 w-5" />
              </button>
              {lightbox.fotos.length > 1 && (
                <>
                  <button
                    onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx - 1 + lightbox.fotos.length) % lightbox.fotos.length })}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setLightbox({ ...lightbox, idx: (lightbox.idx + 1) % lightbox.fotos.length })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white rounded-full px-3 py-1 text-xs">
                {lightbox.idx + 1} / {lightbox.fotos.length}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
