import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Link2, Copy, BarChart3, ChevronRight, Clock, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getVitrinePublicUrl } from "@/lib/vitrineUrl";
import VitrineAnalyticsPanel from "@/components/showcase/VitrineAnalyticsPanel";
import { toast } from "sonner";

export default function MinhasVitrines() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: vitrines = [], isLoading } = useQuery({
    queryKey: ["minhas-vitrines", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Vitrines vivem no banco do site; lemos via edge function `vitrine-bridge`
      // que valida o JWT do CRM e filtra por created_by = user.id usando service role.
      const { data, error } = await supabase.functions.invoke("vitrine-bridge", {
        body: { action: "list_vitrines", payload: { limit: 50 } },
      });
      if (error || !data?.ok) {
        console.error("[MinhasVitrines] bridge error:", { error, data });
        return [];
      }
      return (data.vitrines ?? []).map((v: any) => ({
        ...v,
        tipo: v.tipo ?? "property_selection",
        imovel_ids: v.imovel_codigos ?? [],
      }));
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">Minhas Vitrines</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe o desempenho das suas vitrines de imóveis</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : vitrines.length === 0 ? (
        <Card className="p-8 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Você ainda não criou vitrines.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Selecione imóveis no Buscador e clique em "Gerar Vitrine".</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {vitrines.map(v => {
            const ids = (v.imovel_ids as string[]) || [];
            const isExpanded = expandedId === v.id;
            const link = getVitrinePublicUrl(v.id);

            return (
              <Card key={v.id} className="overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground truncate">{v.titulo}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">
                        {v.tipo === "product_page" ? "Landing" : "Seleção"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      <span>{ids.length} imóvel(is)</span>
                      {v.lead_nome && <span>• {v.lead_nome}</span>}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-blue-600">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="font-bold">{v.visualizacoes || 0}</span>
                      </div>
                      <p className="text-muted-foreground text-[10px]">views</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-green-600">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="font-bold">{v.cliques_whatsapp || 0}</span>
                      </div>
                      <p className="text-muted-foreground text-[10px]">WhatsApp</p>
                    </div>
                  </div>

                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>

                {/* Expanded analytics */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4" style={{ background: "var(--muted)" }}>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }}>
                        <Copy className="h-3 w-3" /> Copiar link
                      </Button>
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3 w-3" /> Abrir vitrine
                        </Button>
                      </a>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Confira esta seleção de imóveis: ${link}`)}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white">
                          <MessageCircle className="h-3 w-3" /> Compartilhar
                        </Button>
                      </a>
                    </div>

                    {/* Analytics panel */}
                    <VitrineAnalyticsPanel vitrineId={v.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
