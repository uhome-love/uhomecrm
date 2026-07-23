import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, PhoneCall, CheckCircle2, CalendarCheck2, Megaphone } from "lucide-react";

const ICONS: Record<string, any> = {
  oa_ligacao: PhoneCall,
  oa_aproveitado: CheckCircle2,
  oa_visita: CalendarCheck2,
};

export function FeedPanel({ sessaoId }: { sessaoId: string | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessaoId) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("pulse_events")
        .select("id, tipo, titulo, descricao, corretor_id, created_at, metadata")
        .in("tipo", ["oa_ligacao", "oa_aproveitado", "oa_visita"])
        .contains("metadata", { sessao_id: sessaoId })
        .order("created_at", { ascending: false })
        .limit(30);
      if (!mounted) return;
      setItems(data ?? []);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`mutirao-feed-${sessaoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pulse_events" }, (payload: any) => {
        const p = payload.new;
        if (p?.metadata?.sessao_id === sessaoId && ["oa_ligacao","oa_aproveitado","oa_visita"].includes(p.tipo)) {
          setItems((prev) => [p, ...prev].slice(0, 30));
        }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [sessaoId]);

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (!items.length) return <div className="text-xs text-muted-foreground p-4">Feed vazio — a primeira ligação inicia o placar!</div>;

  return (
    <div className="rounded-xl border border-border bg-card p-2 space-y-1 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center gap-2 px-2 pb-1 text-sm font-semibold"><Megaphone className="w-4 h-4 text-primary" /> Feed ao vivo</div>
      {items.map((it) => {
        const Icon = ICONS[it.tipo] ?? Megaphone;
        return (
          <div key={it.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/40">
            <Icon className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{it.titulo}</p>
              <p className="text-[10px] text-muted-foreground">{formatBRT(it.created_at, "HH:mm:ss")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
