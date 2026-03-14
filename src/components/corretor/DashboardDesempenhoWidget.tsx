import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyKPIs } from "@/hooks/useKPIs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Phone, CheckCircle, CalendarCheck, MessageCircle, Mail } from "lucide-react";

/**
 * DashboardDesempenhoWidget — Broker performance widget
 * 
 * MIGRATED: Main KPI metrics now come from the official metrics layer (useMyKPIs).
 * Channel breakdowns (ligacoes/whatsapp/email) still use a direct query since
 * the RPC doesn't break down by channel.
 */

function useChannelBreakdown(period: "dia" | "semana" | "mes") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["desempenho-channels", user?.id, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_kpi_ligacoes" as any)
        .select("canal, aproveitado")
        .eq("auth_user_id", user!.id);
      // Note: filtering by period is handled by the main KPI hook;
      // here we just need channel distribution for today's view
      const rows = data || [];
      return {
        ligacoes: rows.filter((r: any) => r.canal === "ligacao").length,
        whatsapps: rows.filter((r: any) => r.canal === "whatsapp").length,
        emails: rows.filter((r: any) => r.canal === "email").length,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export default function DashboardDesempenhoWidget() {
  const [period, setPeriod] = useState<"dia" | "semana" | "mes">("dia");
  const { data: kpis } = useMyKPIs(period);
  const { data: channels } = useChannelBreakdown(period);

  const k = kpis || { total_ligacoes: 0, total_aproveitados: 0, taxa_aproveitamento: 0, visitas_marcadas: 0, visitas_realizadas: 0, pontos_gestao: 0 };
  const ch = channels || { ligacoes: 0, whatsapps: 0, emails: 0 };

  const metrics = [
    { label: "Ligações", value: ch.ligacoes, icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "WhatsApps", value: ch.whatsapps, icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "E-mails", value: ch.emails, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
    { label: "Visitas Marc.", value: k.visitas_marcadas, icon: CalendarCheck, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Aproveitados", value: k.total_aproveitados, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Taxa Aprov.", value: `${k.taxa_aproveitamento}%`, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Meu Desempenho</span>
          </div>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="dia" className="text-xs flex-1">Dia</TabsTrigger>
            <TabsTrigger value="semana" className="text-xs flex-1">Semana</TabsTrigger>
            <TabsTrigger value="mes" className="text-xs flex-1">Mês</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-2 p-2 rounded-lg border border-border/40">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.bg} shrink-0`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{m.value}</p>
                <p className="text-[9px] text-muted-foreground">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-1 pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground">Total tentativas: <strong className="text-foreground">{k.total_ligacoes}</strong></span>
          <span className="text-xs text-muted-foreground">Pontos: <strong className="text-primary">{k.pontos_gestao}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}
