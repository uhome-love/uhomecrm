import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, FileText, Radio, Zap } from "lucide-react";
import { subDays } from "date-fns";

interface Stats {
  total24h: number;
  errors48h: number;
  opsEvents24h: number;
  opsErrors24h: number;
  traced: number;
}

export function AuditStatsBar() {
  const [stats, setStats] = useState<Stats>({ total24h: 0, errors48h: 0, opsEvents24h: 0, opsErrors24h: 0, traced: 0 });

  useEffect(() => {
    const load = async () => {
      const since24h = subDays(new Date(), 1).toISOString();
      const since48h = subDays(new Date(), 2).toISOString();

      const [totalRes, errorRes, opsRes, opsErrRes, tracedRes] = await Promise.all([
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("automation_logs").select("id", { count: "exact", head: true }).eq("status", "error").gte("triggered_at", since48h),
        supabase.from("ops_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("ops_events").select("id", { count: "exact", head: true }).eq("level", "error").gte("created_at", since24h),
        supabase.from("ops_events").select("id", { count: "exact", head: true }).not("trace_id", "is", null).gte("created_at", since24h),
      ]);

      setStats({
        total24h: totalRes.count || 0,
        errors48h: errorRes.count || 0,
        opsEvents24h: opsRes.count || 0,
        opsErrors24h: opsErrRes.count || 0,
        traced: tracedRes.count || 0,
      });
    };
    load();
  }, []);

  const items = [
    { icon: FileText, label: "Audit Logs (24h)", value: stats.total24h, color: "text-blue-500" },
    { icon: Radio, label: "Ops Events (24h)", value: stats.opsEvents24h, color: "text-purple-500" },
    { icon: AlertTriangle, label: "Erros Ops (24h)", value: stats.opsErrors24h, color: stats.opsErrors24h > 0 ? "text-destructive" : "text-green-500" },
    { icon: AlertTriangle, label: "Erros Automação (48h)", value: stats.errors48h, color: stats.errors48h > 0 ? "text-destructive" : "text-green-500" },
    { icon: Zap, label: "Com Trace ID", value: stats.traced, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
            <div>
              <p className="text-2xl font-bold leading-none">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
