/**
 * LeadImoveisIndicadosTab — Shows indicated properties for a lead
 * inside the pipeline lead detail modal.
 */

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ExternalLink, MapPin, Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  leadId: string;
  corretorNomes?: Record<string, string>;
}

interface Indicacao {
  id: string;
  imovel_codigo: string;
  observacao: string | null;
  criado_em: string;
  criado_por: string;
}

export default function LeadImoveisIndicadosTab({ leadId, corretorNomes = {} }: Props) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: indicacoes, isLoading } = useQuery({
    queryKey: ["lead-imoveis-indicados", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_imoveis_indicados" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as Indicacao[];
    },
    enabled: !!leadId,
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("lead_imoveis_indicados" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["lead-imoveis-indicados", leadId] });
      toast.success("Indicação removida");
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!indicacoes?.length) {
    return (
      <div className="text-center py-8 px-4">
        <Bookmark className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
        <p className="text-sm font-medium text-foreground">Nenhum imóvel indicado ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Acesse a página de Imóveis para fazer o match.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      <p className="text-xs text-muted-foreground font-medium px-1">
        {indicacoes.length} imóve{indicacoes.length === 1 ? "l indicado" : "is indicados"}
      </p>
      {indicacoes.map((ind) => (
        <Card key={ind.id} className="p-3 border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground font-mono">
                  {ind.imovel_codigo}
                </span>
              </div>
              {ind.observacao && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ind.observacao}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                <span>{formatDistanceToNow(new Date(ind.criado_em), { addSuffix: true, locale: ptBR })}</span>
                {corretorNomes[ind.criado_por] && (
                  <span>por {corretorNomes[ind.criado_por]}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`/imovel/${ind.imovel_codigo}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive/60 hover:text-destructive"
                onClick={() => handleDelete(ind.id)}
                disabled={deletingId === ind.id}
              >
                {deletingId === ind.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
