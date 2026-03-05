import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Trophy, Phone, CheckCircle, Flame, Target, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Area,
} from "recharts";

interface DayData {
  date: string;
  label: string;
  tentativas: number;
  aproveitados: number;
  pontos: number;
  ligacoes: number;
  whatsapps: number;
  emails: number;
  taxa: number;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function useWeeklyData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["corretor-weekly-summary", user?.id],
    queryFn: async () => {
      const now = new Date();
      const days: DayData[] = [];

      // Get start of current week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(monday);
      endOfWeek.setDate(monday.getDate() + 7);

      const { data, error } = await supabase
        .from("oferta_ativa_tentativas")
        .select("canal, resultado, pontos, created_at")
        .eq("corretor_id", user!.id)
        .gte("created_at", monday.toISOString())
        .lt("created_at", endOfWeek.toISOString());

      if (error) throw error;

      // Group by day
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = WEEKDAYS[d.getDay()];
        const dayNum = d.getDate().toString().padStart(2, "0") + "/" + (d.getMonth() + 1).toString().padStart(2, "0");

        const dayItems = (data || []).filter(
          (t) => new Date(t.created_at).toISOString().split("T")[0] === dateStr
        );

        const tentativas = dayItems.length;
        const aproveitados = dayItems.filter((t) => t.resultado === "com_interesse").length;
        const pontos = dayItems.reduce((sum, t) => sum + t.pontos, 0);
        const ligacoes = dayItems.filter((t) => t.canal === "ligacao").length;
        const whatsapps = dayItems.filter((t) => t.canal === "whatsapp").length;
        const emails = dayItems.filter((t) => t.canal === "email").length;
        const taxa = tentativas > 0 ? Math.round((aproveitados / tentativas) * 100) : 0;

        days.push({
          date: dateStr,
          label: `${dayLabel}\n${dayNum}`,
          tentativas,
          aproveitados,
          pontos,
          ligacoes,
          whatsapps,
          emails,
          taxa,
        });
      }

      // Previous week for comparison
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);

      const { data: prevData } = await supabase
        .from("oferta_ativa_tentativas")
        .select("resultado, pontos")
        .eq("corretor_id", user!.id)
        .gte("created_at", prevMonday.toISOString())
        .lt("created_at", monday.toISOString());

      const prevTentativas = prevData?.length || 0;
      const prevAproveitados = prevData?.filter((t) => t.resultado === "com_interesse").length || 0;
      const prevPontos = prevData?.reduce((sum, t) => sum + t.pontos, 0) || 0;

      return { days, prevTentativas, prevAproveitados, prevPontos };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) {
    return <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> {label}: --</Badge>;
  }
  if (previous === 0) {
    return <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10"><TrendingUp className="h-3 w-3" /> {label}: novo!</Badge>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) {
    return <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10"><TrendingUp className="h-3 w-3" /> {label}: +{pct}%</Badge>;
  }
  if (pct < 0) {
    return <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30 bg-destructive/10"><TrendingDown className="h-3 w-3" /> {label}: {pct}%</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> {label}: =</Badge>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground">{label?.replace("\n", " ")}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function CorretorWeeklySummary() {
  const { data, isLoading } = useWeeklyData();

  const totals = useMemo(() => {
    if (!data) return { tentativas: 0, aproveitados: 0, pontos: 0, taxa: 0, melhorDia: "" };
    const tentativas = data.days.reduce((s, d) => s + d.tentativas, 0);
    const aproveitados = data.days.reduce((s, d) => s + d.aproveitados, 0);
    const pontos = data.days.reduce((s, d) => s + d.pontos, 0);
    const taxa = tentativas > 0 ? Math.round((aproveitados / tentativas) * 100) : 0;
    const melhorDia = data.days.reduce((best, d) => (d.pontos > best.pontos ? d : best), data.days[0]);
    return { tentativas, aproveitados, pontos, taxa, melhorDia: melhorDia?.label?.replace("\n", " ") || "" };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Resumo da Semana</h3>
                <p className="text-[10px] text-muted-foreground">Sua evolução de segunda a domingo</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <TrendBadge current={totals.tentativas} previous={data.prevTentativas} label="Tentativas" />
              <TrendBadge current={totals.aproveitados} previous={data.prevAproveitados} label="Aproveitados" />
              <TrendBadge current={totals.pontos} previous={data.prevPontos} label="Pontos" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Tentativas", value: totals.tentativas, icon: Phone, color: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: "Aproveitados", value: totals.aproveitados, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
            { label: "Pontos", value: totals.pontos, icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Taxa Aprov.", value: `${totals.taxa}%`, icon: Target, color: "text-purple-500", bg: "bg-purple-500/10" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} shrink-0`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Performance Chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Performance Diária
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.days} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="tentativas"
                    name="Tentativas"
                    fill="hsl(var(--primary) / 0.15)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                  <Bar
                    dataKey="aproveitados"
                    name="Aproveitados"
                    fill="hsl(142 71% 45%)"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    type="monotone"
                    dataKey="pontos"
                    name="Pontos"
                    stroke="hsl(45 93% 47%)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(45 93% 47%)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Best Day Highlight */}
      {totals.tentativas > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-amber-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 shrink-0">
                <Flame className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">🏆 Melhor Dia da Semana</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {totals.melhorDia} — {data.days.reduce((best, d) => (d.pontos > best.pontos ? d : best), data.days[0]).pontos} pontos
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Channel Breakdown */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-bold text-foreground mb-3">Canais Utilizados na Semana</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.days} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ligacoes" name="Ligações" fill="hsl(160 60% 45%)" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="whatsapps" name="WhatsApps" fill="hsl(142 71% 45%)" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="emails" name="E-mails" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
