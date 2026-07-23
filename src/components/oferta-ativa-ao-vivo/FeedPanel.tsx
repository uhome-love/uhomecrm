import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, CheckCircle2, CalendarCheck2, Megaphone, Trophy, Flame, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

// Feed é APENAS de celebrações — não mostra ligações cruas ("oa_ligacao").
const CELEBRATION_TYPES = ["oa_aproveitado", "oa_visita", "oa_meta_batida", "oa_streak", "oa_level_up"] as const;

const META: Record<string, { icon: any; color: string }> = {
  oa_aproveitado: { icon: CheckCircle2,   color: "text-success-500" },
  oa_visita:      { icon: CalendarCheck2, color: "text-warning-500" },
  oa_meta_batida: { icon: Trophy,         color: "text-primary" },
  oa_streak:      { icon: Flame,          color: "text-orange-500" },
  oa_level_up:    { icon: Gem,            color: "text-purple-500" },
};

export function FeedPanel({ sessaoId, paused }: { sessaoId: string | null; paused?: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessaoId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pulse_events")
        .select("id, tipo, titulo, descricao, corretor_id, created_at, metadata")
        .in("tipo", CELEBRATION_TYPES as unknown as string[])
        .contains("metadata", { sessao_id: sessaoId })
        .order("created_at", { ascending: false })
        .limit(30);
      if (!mounted) return;
      setItems(data ?? []);
      setLoading(false);
    })();

    if (paused) return () => { mounted = false; };

    const ch = supabase
      .channel(`mutirao-feed-${sessaoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pulse_events" }, (payload: any) => {
        const p = payload.new;
        if (p?.metadata?.sessao_id === sessaoId && (CELEBRATION_TYPES as readonly string[]).includes(p.tipo)) {
          setItems((prev) => [p, ...prev].slice(0, 30));
        }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [sessaoId, paused]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Megaphone className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Celebrações</p>
      </div>
      {loading ? (
        <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center px-4 py-8">
          Sem celebrações ainda — a primeira visita/aproveitamento aparece aqui.
        </p>
      ) : (
        <div className="max-h-[42vh] overflow-y-auto p-1.5">
          {items.map((it) => {
            const m = META[it.tipo] ?? { icon: Megaphone, color: "text-muted-foreground" };
            const Icon = m.icon;
            return (
              <div
                key={it.id}
                className="flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted/50 transition-colors animate-fade-in"
              >
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", m.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{it.titulo}</p>
                  <p className="text-[10px] text-muted-foreground font-mono tabular-nums">{formatBRT(it.created_at, "HH:mm:ss")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
