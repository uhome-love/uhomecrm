import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Phone, CheckCircle, CalendarCheck, MessageCircle, Mail } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { todayBRT } from "@/lib/utils";

interface Stats {
  tentativas: number;
  aproveitados: number;
  visitasMarcadas: number;
  visitasRealizadas: number;
  pontos: number;
  ligacoes: number;
  whatsapps: number;
  emails: number;
}

function useDesempenho(period: "dia" | "semana" | "mes") {
  const { user } = useAuth();
  const today = todayBRT();

  return useQuery({
    queryKey: ["desempenho-widget", user?.id, period, today],
    queryFn: async (): Promise<Stats> => {
      const now = new Date();
      let fromDate: string;
      if (period === "dia") {
        fromDate = today;
      } else if (period === "semana") {
        fromDate = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      } else {
        fromDate = format(startOfMonth(now), "yyyy-MM-dd");
      }
      const fromUtc = new Date(`${fromDate}T00:00:00-03:00`).toISOString();

      const { data: tentativas } = await supabase
        .from("oferta_ativa_tentativas")
        .select("canal, resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", fromUtc);

      const rows = tentativas || [];
      const stats: Stats = {
        tentativas: rows.length,
        aproveitados: rows.filter(r => r.resultado === "com_interesse").length,
        ligacoes: rows.filter(r => r.canal === "ligacao").length,
        whatsapps: rows.filter(r => r.canal === "whatsapp").length,
        emails: rows.filter(r => r.canal === "email").length,
        pontos: rows.reduce((s, r) => s + (r.pontos || 0), 0),
        visitasMarcadas: 0,
        visitasRealizadas: 0,
      };

      const { count: vm } = await supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user!.id)
        .gte("created_at", fromUtc)
        .in("status", ["marcada", "confirmada"]);
      stats.visitasMarcadas = vm || 0;

      const { count: vr } = await supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", user!.id)
        .gte("created_at", fromUtc)
        .eq("status", "realizada");
      stats.visitasRealizadas = vr || 0;

      return stats;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export default function DashboardDesempenhoWidget() {
  const [period, setPeriod] = useState<"dia" | "semana" | "mes">("dia");
  const { data: stats } = useDesempenho(period);

  const s = stats || { tentativas: 0, aproveitados: 0, visitasMarcadas: 0, visitasRealizadas: 0, pontos: 0, ligacoes: 0, whatsapps: 0, emails: 0 };
  const taxa = s.tentativas > 0 ? Math.round((s.aproveitados / s.tentativas) * 100) : 0;

  const metrics = [
    { label: "Ligações", value: s.ligacoes, icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "WhatsApps", value: s.whatsapps, icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "E-mails", value: s.emails, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
    { label: "Visitas Marc.", value: s.visitasMarcadas, icon: CalendarCheck, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Aproveitados", value: s.aproveitados, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Taxa Aprov.", value: `${taxa}%`, icon: BarChart3, color: "text-primary", bg: "bg-primary/10" },
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
          <span className="text-xs text-muted-foreground">Total tentativas: <strong className="text-foreground">{s.tentativas}</strong></span>
          <span className="text-xs text-muted-foreground">Pontos: <strong className="text-primary">{s.pontos}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}
