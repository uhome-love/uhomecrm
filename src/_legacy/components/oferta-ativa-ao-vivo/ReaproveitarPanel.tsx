import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, Rewind } from "lucide-react";

export function ReaproveitarPanel({ sessaoId, onReabrir }: { sessaoId: string | null; onReabrir: () => void }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mutirao", "reaproveitar", sessaoId],
    enabled: !!sessaoId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("oferta-ativa-historico-reaproveitar", { body: { sessao_id: sessaoId } });
      if (error) throw error;
      return data as { ok: boolean; itens: any[] };
    },
    refetchInterval: 60_000,
  });

  const itens = data?.itens ?? [];

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Rewind className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Reaproveitar</p>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Posse 24h</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center px-4 py-8">
          Nenhum lead seu marcado como "não atendeu" nas últimas 24h.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1.5">
          {itens.map((it) => (
            <div key={it.ligacao_id} className="px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{it.nome}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {it.telefone} · {formatBRT(it.ligacao_em, "HH:mm")}
                  </p>
                  {it.motivo_descarte && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{it.motivo_descarte}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={it.pode_reabrir ? "default" : "outline"}
                  disabled={!it.pode_reabrir}
                  onClick={() => { onReabrir(); refetch(); }}
                  className="shrink-0 h-7 text-xs"
                >
                  {it.pode_reabrir ? "Reabrir" : "Cooldown"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
