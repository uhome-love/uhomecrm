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

  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  const itens = data?.itens ?? [];
  if (!itens.length) return <div className="text-xs text-muted-foreground p-4">Nenhum lead seu marcado como "não atendeu" nas últimas 24h.</div>;

  return (
    <div className="rounded-xl border border-border bg-card p-2 space-y-1 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center gap-2 px-2 pb-1 text-sm font-semibold"><Rewind className="w-4 h-4 text-primary" /> Reaproveitar (posse 24h)</div>
      {itens.map((it) => (
        <div key={it.ligacao_id} className="px-2 py-2 rounded border border-border bg-muted/20">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{it.nome}</p>
              <p className="text-[11px] text-muted-foreground">{it.telefone} · {formatBRT(it.ligacao_em, "HH:mm")}</p>
              {it.motivo_descarte && <p className="text-[10px] text-muted-foreground truncate">{it.motivo_descarte}</p>}
            </div>
            <Button
              size="sm"
              variant={it.pode_reabrir ? "default" : "outline"}
              disabled={!it.pode_reabrir}
              onClick={() => { onReabrir(); refetch(); }}
              className="shrink-0 h-7 text-xs"
            >
              {it.pode_reabrir ? "Reabrir" : "Em cooldown"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
