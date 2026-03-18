import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface AnalyticsData {
  reactivated: number;
  new_lead: number;
  sent_to_roleta: number;
  visit_scheduled: number;
  proposal: number;
  sale: number;
}

const COUNTERS = [
  { key: "reactivated", label: "Reativados", icon: "🔄", color: "text-blue-600" },
  { key: "new_lead", label: "Novos Leads", icon: "🆕", color: "text-emerald-600" },
  { key: "sent_to_roleta", label: "Enviados Roleta", icon: "🎯", color: "text-purple-600" },
  { key: "visit_scheduled", label: "Visitas", icon: "📍", color: "text-amber-600" },
  { key: "proposal", label: "Propostas", icon: "📝", color: "text-cyan-600" },
  { key: "sale", label: "Vendas", icon: "🏆", color: "text-orange-600" },
] as const;

export default function MelnickCampaignAnalytics() {
  const { data: analytics } = useQuery({
    queryKey: ["melnick-campaign-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("melnick_campaign_analytics")
        .select("tipo")
        .eq("campaign", "MELNICK_DAY_2026");

      if (error) throw error;

      const counts: AnalyticsData = {
        reactivated: 0, new_lead: 0, sent_to_roleta: 0,
        visit_scheduled: 0, proposal: 0, sale: 0,
      };

      for (const row of data || []) {
        if (row.tipo in counts) counts[row.tipo as keyof AnalyticsData]++;
      }
      return counts;
    },
    refetchInterval: 30_000,
  });

  if (!analytics) return null;

  const total = Object.values(analytics).reduce((a: number, b: any) => a + (b as number), 0);
  if (total === 0) return null;

  return (
    <Card className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
          🔥 Campanha de Ativação Melnick Day — Analytics
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {COUNTERS.map(({ key, label, icon, color }) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-[10px]">{icon}</span>
            <span className={`text-xs font-bold ${color}`}>
              {analytics[key as keyof AnalyticsData]}
            </span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
