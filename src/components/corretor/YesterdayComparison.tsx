import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { CorretorProgress } from "@/hooks/useCorretorProgress";

function CompareChip({ label, today, yesterday }: { label: string; today: number; yesterday: number }) {
  const diff = today - yesterday;
  const pct = yesterday > 0 ? Math.round((diff / yesterday) * 100) : today > 0 ? 100 : 0;

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold text-foreground">{today}</span>
      {diff > 0 ? (
        <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
          <ArrowUp className="h-2.5 w-2.5" />+{pct}%
        </span>
      ) : diff < 0 ? (
        <span className="flex items-center gap-0.5 text-destructive font-medium">
          <ArrowDown className="h-2.5 w-2.5" />{pct}%
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <Minus className="h-2.5 w-2.5" />=
        </span>
      )}
    </div>
  );
}

interface Props {
  progress: CorretorProgress;
}

export default function YesterdayComparison({ progress }: Props) {
  const { user } = useAuth();

  const { data: yesterday } = useQuery({
    queryKey: ["corretor-yesterday-stats", user?.id],
    queryFn: async () => {
      const now = new Date();
      const todayBrt = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const todayStart = new Date(`${todayBrt}T00:00:00-03:00`).toISOString();

      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayBrt = yesterdayDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const yesterdayStart = new Date(`${yesterdayBrt}T00:00:00-03:00`).toISOString();

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);

      if (error) throw error;

      const tentativas = data?.length || 0;
      const aproveitados = data?.filter(d => d.resultado === "com_interesse").length || 0;
      const pontos = data?.reduce((s, d) => s + d.pontos, 0) || 0;

      return { tentativas, aproveitados, pontos };
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  if (!yesterday || (yesterday.tentativas === 0 && progress.tentativas === 0)) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">vs Ontem</span>
      <CompareChip label="Tent" today={progress.tentativas} yesterday={yesterday.tentativas} />
      <CompareChip label="Aprov" today={progress.aproveitados} yesterday={yesterday.aproveitados} />
      <CompareChip label="Pts" today={progress.pontos} yesterday={yesterday.pontos} />
    </div>
  );
}
