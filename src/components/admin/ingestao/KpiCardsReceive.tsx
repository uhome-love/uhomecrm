import { Card } from "@/components/ui/card";
import type { KpiPorFn } from "@/hooks/useIngestaoStats";

const FN_LABELS: Record<string, string> = {
  "receive-meta-lead": "Meta Ads",
  "receive-imovelweb-lead": "ImovelWeb",
  "receive-rdstation-lead": "RD Station",
  "receive-tiktok-lead": "TikTok",
  "receive-landing-lead": "Landing",
  "crm-webhook": "CRM Webhook",
};

interface Props {
  kpis: KpiPorFn[] | undefined;
  loading: boolean;
}

export function KpiCardsReceive({ kpis, loading }: Props) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse h-28 bg-muted/30" />
        ))}
      </div>
    );
  }
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((k) => {
        const total = k.new_leads + k.errors;
        const successRate = total > 0 ? ((k.new_leads / total) * 100).toFixed(1) : "—";
        const hasError = k.errors > 0;
        return (
          <Card key={k.fn} className="p-4">
            <div className="text-xs text-muted-foreground font-medium truncate">
              {FN_LABELS[k.fn] ?? k.fn}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold">{k.new_leads}</span>
              <span className="text-xs text-muted-foreground">leads</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {total > 0 ? `${successRate}% sucesso` : "sem eventos"}
            </div>
            <div className={`text-xs mt-0.5 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
              {k.errors} erros · {k.total_events} eventos
            </div>
          </Card>
        );
      })}
    </div>
  );
}
