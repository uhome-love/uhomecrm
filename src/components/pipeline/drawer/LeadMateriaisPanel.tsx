/**
 * Fase 5 — Atalho de Materiais no contexto do lead.
 *
 * Mostra os materiais mais relevantes do Hub para o lead atual,
 * usando busca semântica combinando empreendimento + observações + origem.
 * Cada material tem ações rápidas (Preview, Copiar, Baixar, WhatsApp).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MaterialListaCompact } from "@/components/materiais/MaterialListaCompact";
import type { MaterialComEmp } from "@/hooks/useMateriaisFavoritos";
import { Link } from "react-router-dom";

interface Props {
  leadId: string;
  empreendimento?: string | null;
  observacoes?: string | null;
  origemDetalhe?: string | null;
  imovelCodigo?: string | null;
  telefone?: string | null;
}

function buildQuery(p: Props): string {
  const parts: string[] = [];
  if (p.empreendimento) parts.push(p.empreendimento);
  if (p.imovelCodigo) parts.push(`imóvel ${p.imovelCodigo}`);
  if (p.observacoes) parts.push(p.observacoes.slice(0, 400));
  if (p.origemDetalhe) parts.push(p.origemDetalhe.slice(0, 200));
  return parts.filter(Boolean).join(" · ").trim();
}

export default function LeadMateriaisPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const query = buildQuery(props);
  const canSearch = query.length >= 3;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["lead-materiais", props.leadId, query],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("materiais-search", {
        body: { query, limit: 5, min_similarity: 0.3 },
      });
      if (error) throw error;
      return ((data as any)?.results ?? []) as MaterialComEmp[];
    },
    enabled: open && canSearch,
    staleTime: 5 * 60 * 1000,
  });

  const count = data?.length ?? 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/60 bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-lg"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-foreground flex-1">
              Materiais para este lead
            </span>
            {open && count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {count}
              </span>
            )}
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-2">
            {!canSearch ? (
              <p className="text-[11px] text-muted-foreground py-2">
                Sem empreendimento ou contexto suficiente para sugerir materiais.
              </p>
            ) : isFetching ? (
              <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando materiais relevantes…
              </div>
            ) : isError ? (
              <p className="text-[11px] text-destructive py-2">Falha ao buscar materiais.</p>
            ) : count === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">
                Nada relevante no Hub para este lead ainda.
              </p>
            ) : (
              <MaterialListaCompact items={data!} emptyLabel="" />
            )}

            <Button asChild variant="ghost" size="sm" className="w-full h-7 text-[11px]">
              <Link to="/materiais">
                <FolderOpen className="h-3 w-3 mr-1.5" />
                Abrir Hub de Materiais
              </Link>
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
